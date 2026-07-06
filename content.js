(function () {
  const STATE_KEY = "lmsVideoStatus";
  const STUDY_STATE_KEY = "lmsStudyAssistantStatus";
  let observedVideo = null;
  let observer = null;
  let endedNoticeShown = false;
  let automationRunning = false;
  let automationTimer = null;
  let resumeTimer = null;
  let currentLessonId = "";
  let playbackVolumePercent = 25;
  let preferredPlaybackRate = 1;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "00:00";

    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function getPlyrRoot(video) {
    return video.closest(".plyr");
  }

  function findVideoInDocument(rootDocument) {
    return rootDocument.querySelector(".lesson-video-styles__VideoContainer-sc-f73a8977-0 video, .plyr video, video");
  }

  function getAccessibleFrameDocument(frame) {
    try {
      return frame.contentDocument || frame.contentWindow?.document || null;
    } catch (_error) {
      return null;
    }
  }

  function findVideoInFrames(rootDocument) {
    const frames = Array.from(rootDocument.querySelectorAll("iframe"));

    for (const frame of frames) {
      const frameDocument = getAccessibleFrameDocument(frame);
      if (!frameDocument) continue;

      const video = findVideoElement(frameDocument);
      if (video) return video;
    }

    return null;
  }

  function findVideoElement(rootDocument = document) {
    return findVideoInDocument(rootDocument) || findVideoInFrames(rootDocument);
  }

  function getVideoStatus(video) {
    const plyrRoot = getPlyrRoot(video);
    const seek = plyrRoot?.querySelector('input[data-plyr="seek"]');
    const currentTimeText = plyrRoot?.querySelector('.plyr__time--current')?.textContent?.trim();
    const durationText = plyrRoot?.querySelector('.plyr__time--duration')?.textContent?.trim();
    const speedText = plyrRoot?.querySelector('[id$="-speed"] [data-plyr="speed"][aria-checked="true"] span')?.textContent?.trim();

    const rawDuration = Number.isFinite(video.duration) ? video.duration : Number(seek?.getAttribute("aria-valuemax"));
    const rawCurrentTime = Number.isFinite(video.currentTime) && video.currentTime > 0
      ? video.currentTime
      : Number(seek?.getAttribute("aria-valuenow"));
    const duration = Number.isFinite(rawDuration) ? rawDuration : 0;
    const currentTime = Number.isFinite(rawCurrentTime) ? rawCurrentTime : 0;
    const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    return {
      found: true,
      playing: !video.paused && !video.ended,
      paused: video.paused,
      ended: video.ended,
      muted: video.muted,
      volume: video.volume,
      playbackRate: video.playbackRate,
      speedText: speedText || `${video.playbackRate}x`,
      currentTime,
      duration,
      currentTimeText: currentTimeText || formatTime(currentTime),
      durationText: durationText || formatTime(duration),
      progress,
      readyState: video.readyState,
      networkState: video.networkState,
      src: video.currentSrc || video.src || "",
      checkedAt: new Date().toISOString()
    };
  }

  function saveStatus(status) {
    window[STATE_KEY] = status;
    document.documentElement.dataset.lmsVideoPlaying = status.playing ? "true" : "false";
    window.dispatchEvent(new CustomEvent("lms-video-status", { detail: status }));

    if (status.ended && automationRunning && !endedNoticeShown) {
      endedNoticeShown = true;
      scheduleNextLesson();
    }

    if (status.found && status.paused && !status.ended && automationRunning) {
      scheduleResumeVideo();
    }

    if (!status.ended) endedNoticeShown = false;
  }

  function saveStudyStatus(status) {
    window[STUDY_STATE_KEY] = status;
    window.dispatchEvent(new CustomEvent("lms-study-assistant-status", { detail: status }));
  }

  function stopAutomation(message) {
    automationRunning = false;

    if (automationTimer) {
      clearTimeout(automationTimer);
      automationTimer = null;
    }

    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }

    saveStudyStatus({
      running: false,
      message,
      checkedAt: new Date().toISOString()
    });

    chrome.runtime.sendMessage({ type: "RELEASE_KEEP_AWAKE" });
  }

  function showNotification(title, message) {
    chrome.runtime.sendMessage({
      type: "SHOW_NOTIFICATION",
      title,
      message
    });
  }

  function showInPageNotice(title, message) {
    const existingNotice = document.querySelector("#lms-assistant-notice");
    existingNotice?.remove();

    const notice = document.createElement("div");
    notice.id = "lms-assistant-notice";
    notice.setAttribute("role", "alert");
    notice.innerHTML = `
      <div class="lms-assistant-notice__title"></div>
      <div class="lms-assistant-notice__message"></div>
      <button type="button" class="lms-assistant-notice__button">Đã hiểu</button>
    `;

    const style = document.createElement("style");
    style.id = "lms-assistant-notice-style";
    style.textContent = `
      #lms-assistant-notice {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483647;
        width: min(380px, calc(100vw - 36px));
        padding: 16px;
        border: 1px solid #bfdbfe;
        border-radius: 14px;
        color: #172033;
        background: #ffffff;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.25);
        font-family: Arial, sans-serif;
      }

      .lms-assistant-notice__title {
        margin-bottom: 6px;
        color: #1d4ed8;
        font-size: 16px;
        font-weight: 700;
      }

      .lms-assistant-notice__message {
        margin-bottom: 12px;
        color: #475569;
        font-size: 13px;
        line-height: 1.45;
      }

      .lms-assistant-notice__button {
        width: 100%;
        border: 0;
        border-radius: 10px;
        padding: 9px 12px;
        color: #ffffff;
        background: #2563eb;
        font-weight: 700;
        cursor: pointer;
      }
    `;

    if (!document.querySelector("#lms-assistant-notice-style")) {
      document.documentElement.appendChild(style);
    }

    notice.querySelector(".lms-assistant-notice__title").textContent = title;
    notice.querySelector(".lms-assistant-notice__message").textContent = message;
    notice.querySelector("button").addEventListener("click", () => notice.remove());

    document.documentElement.appendChild(notice);
  }

  function updateStatus() {
    const video = findVideoElement() || observedVideo;

    if (!video) {
      saveStatus({ found: false, checkedAt: new Date().toISOString() });
      return;
    }

    if (video !== observedVideo) attachVideo(video);
    saveStatus(getVideoStatus(video));
  }

  function attachVideo(video) {
    if (observedVideo === video) return;

    observedVideo = video;
    const events = [
      "play",
      "playing",
      "pause",
      "ended",
      "timeupdate",
      "ratechange",
      "volumechange",
      "loadedmetadata",
      "durationchange",
      "waiting",
      "seeking",
      "seeked"
    ];

    events.forEach((eventName) => video.addEventListener(eventName, updateStatus, { passive: true }));
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(updateStatus);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed", "aria-valuenow", "aria-valuetext"]
    });
  }

  function getLessons() {
    return Array.from(document.querySelectorAll("[data-lesson-id]"));
  }

  function isLessonChecked(lesson) {
    return Boolean(lesson.querySelector(".ant-checkbox-checked, input[type='checkbox']:checked"));
  }

  function getLessonTitle(lesson) {
    return lesson.querySelector("[title]")?.getAttribute("title")?.trim()
      || lesson.textContent?.trim()?.replace(/\s+/g, " ")
      || lesson.getAttribute("data-lesson-id")
      || "Bài học chưa có tên";
  }

  function findButtonByText(text) {
    const normalizedText = text.trim().toLowerCase();

    return Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent?.trim().toLowerCase() === normalizedText) || null;
  }

  function findQuizElement() {
    return findButtonByText("Bắt đầu làm bài")
      || findButtonByText("Nộp bài")
      || document.querySelector('[data-quiz-scroll="true"], [role="radiogroup"], input[type="radio"][name^="quiz-"]');
  }

  async function openLesson(lesson) {
    if (lesson.active) return;

    lesson.element.scrollIntoView({ block: "center", behavior: "smooth" });
    lesson.element.click();
    saveStudyStatus({
      running: automationRunning,
      message: `Đang mở bài: ${lesson.title}`,
      lessonTitle: lesson.title,
      checkedAt: new Date().toISOString()
    });

    await sleep(1800);
  }

  async function waitForQuizElement(timeoutMs = 2500) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const quizElement = findQuizElement();

      if (quizElement) return quizElement;
      await sleep(250);
    }

    return null;
  }

  function findFirstUnwatchedLesson(excludeLessonId = "") {
    return getLessons()
      .filter((lesson) => lesson.getAttribute("aria-disabled") !== "true")
      .filter((lesson) => lesson.getAttribute("data-lesson-id") !== excludeLessonId)
      .map((lesson) => ({
        element: lesson,
        id: lesson.getAttribute("data-lesson-id") || "",
        title: getLessonTitle(lesson),
        checked: isLessonChecked(lesson),
        active: lesson.getAttribute("data-lesson-active") === "true"
      }))
      .find((lesson) => !lesson.checked);
  }

  function isIncompleteSection(item) {
    const progress = item.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow");
    const meta = item.textContent?.match(/(\d+)\s*\/\s*(\d+)/);

    if (progress !== null && progress !== undefined) return Number(progress) < 100;
    if (meta) return Number(meta[1]) < Number(meta[2]);
    return true;
  }

  async function expandNextIncompleteSection() {
    const collapsedSection = Array.from(document.querySelectorAll(".ant-collapse-item"))
      .find((item) => {
        const header = item.querySelector(".ant-collapse-header[aria-expanded='false']");
        return header && isIncompleteSection(item);
      });

    const header = collapsedSection?.querySelector(".ant-collapse-header");
    if (!header) return false;

    header.scrollIntoView({ block: "center", behavior: "smooth" });
    header.click();
    await sleep(900);
    return true;
  }

  function setPlaybackRate(video, rate) {
    try {
      video.playbackRate = rate;
      video.defaultPlaybackRate = rate;
    } catch (_error) {
      return false;
    }

    return video.playbackRate === rate;
  }

  function setPreferredPlaybackRate(video) {
    const playbackRate = [1, 2, 4].includes(Number(preferredPlaybackRate)) ? Number(preferredPlaybackRate) : 1;

    if (setPlaybackRate(video, playbackRate)) return playbackRate;
    return video.playbackRate;
  }

  function applyVolume(video) {
    const volumePercent = Math.min(100, Math.max(0, Number(playbackVolumePercent) || 0));

    try {
      video.volume = volumePercent / 100;
      video.muted = volumePercent === 0;
    } catch (_error) {
      return false;
    }

    return Math.round(video.volume * 100) === volumePercent && video.muted === (volumePercent === 0);
  }

  async function startCurrentVideo() {
    const video = await waitForVideoElement();

    if (!video) {
      return { ok: false, message: "Đã mở bài học, nhưng chưa tìm thấy video." };
    }

    attachVideo(video);
    const playbackRate = setPreferredPlaybackRate(video);
    const volumeApplied = applyVolume(video);

    try {
      await video.play();
    } catch (_error) {
      return {
        ok: false,
        message: "Chrome chặn tự động phát. Hãy bấm Play trên video.",
        playbackRate,
        volumeApplied
      };
    }

    updateStatus();
    return {
      ok: true,
      message: playbackRate === Number(preferredPlaybackRate)
        ? `Đang phát video với tốc độ ${playbackRate === 1 ? "Normal" : `${playbackRate}x`}.`
        : `Không đặt được tốc độ đã chọn, đang phát với tốc độ ${playbackRate}x.`,
      playbackRate,
      volumeApplied
    };
  }

  async function resumeCurrentVideo() {
    const video = findVideoElement();

    if (!video || video.ended || !automationRunning) return;

    attachVideo(video);
    setPreferredPlaybackRate(video);
    applyVolume(video);

    try {
      await video.play();
      updateStatus();
    } catch (_error) {
      saveStudyStatus({
        running: automationRunning,
        message: "Video đang tạm dừng. Hãy bấm Play để tiếp tục.",
        checkedAt: new Date().toISOString()
      });
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForVideoElement(timeoutMs = 12000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const video = findVideoElement();
      if (video) return video;
      await sleep(300);
    }

    return null;
  }

  async function waitForLessonChecked(lessonId, timeoutMs = 15000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const lesson = lessonId ? document.querySelector(`[data-lesson-id="${CSS.escape(lessonId)}"]`) : null;

      if (!lesson || isLessonChecked(lesson)) return true;
      await sleep(500);
    }

    return false;
  }

  async function startStudyStep(excludeLessonId = "") {
    let lesson = findFirstUnwatchedLesson(excludeLessonId);

    if (!lesson && await expandNextIncompleteSection()) {
      lesson = findFirstUnwatchedLesson(excludeLessonId);
    }

    if (!lesson) {
      stopAutomation("Đã hoàn tất kịch bản hoặc không còn bài chưa xem có thể mở.");
      return window[STUDY_STATE_KEY];
    }

    await openLesson(lesson);

    const quizElement = await waitForQuizElement();

    if (quizElement) {
      quizElement.scrollIntoView({ block: "center", behavior: "smooth" });
      const message = `Đã phát hiện bài quiz. Tạm dừng để xử lý thủ công: ${lesson.title}`;
      showInPageNotice("Đã phát hiện bài quiz", `Tiện ích đã tạm dừng tại bài: ${lesson.title}. Vui lòng xử lý thủ công trên trang LMS.`);
      showNotification("Đã phát hiện bài quiz", `Vui lòng xử lý thủ công: ${lesson.title}`);
      stopAutomation(message);
      return window[STUDY_STATE_KEY];
    }

    currentLessonId = lesson.id;

    const result = await startCurrentVideo();

    if (!result.ok) {
      stopAutomation(result.message);
      return window[STUDY_STATE_KEY];
    }

    saveStudyStatus({
      running: automationRunning,
      message: result.message,
      lessonTitle: lesson.title,
      checkedAt: new Date().toISOString()
    });

    return window[STUDY_STATE_KEY];
  }

  async function startStudyAutomation() {
    chrome.runtime.sendMessage({ type: "REQUEST_KEEP_AWAKE" });
    const settings = await chrome.storage.local.get({
      playbackVolumePercent: 25,
      playbackRate: 1
    });

    playbackVolumePercent = settings.playbackVolumePercent;
    preferredPlaybackRate = settings.playbackRate;
    automationRunning = true;
    endedNoticeShown = false;
    return startStudyStep();
  }

  function scheduleNextLesson() {
    if (!automationRunning) return;

    saveStudyStatus({
      running: true,
      message: "Video đã kết thúc. Đang chờ LMS cập nhật tiến độ...",
      checkedAt: new Date().toISOString()
    });

    if (automationTimer) clearTimeout(automationTimer);
    automationTimer = setTimeout(async () => {
      automationTimer = null;

      if (!automationRunning) return;
      const progressUpdated = await waitForLessonChecked(currentLessonId);

      if (!automationRunning) return;
      startStudyStep(progressUpdated ? "" : currentLessonId);
    }, 2500);
  }

  function scheduleResumeVideo() {
    if (resumeTimer) return;

    resumeTimer = setTimeout(() => {
      resumeTimer = null;

      if (!automationRunning) return;
      resumeCurrentVideo();
    }, 1200);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "START_LMS_STUDY_AUTOMATION") {
      startStudyAutomation().then(sendResponse);
      return true;
    }

    if (message?.type === "STOP_LMS_STUDY_AUTOMATION") {
      stopAutomation("Đã dừng.");
      sendResponse(window[STUDY_STATE_KEY]);
      return true;
    }

    if (message?.type === "GET_LMS_STUDY_STATUS") {
      sendResponse(window[STUDY_STATE_KEY] || { running: false, message: "Chưa bắt đầu", checkedAt: new Date().toISOString() });
      return true;
    }

    if (message?.type !== "GET_LMS_VIDEO_STATUS") return false;

    updateStatus();
    sendResponse(window[STATE_KEY] || { found: false, checkedAt: new Date().toISOString() });
    return true;
  });

  startObserver();
  updateStatus();
})();
