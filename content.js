(function () {
  const STATE_KEY = "lmsVideoStatus";
  const STUDY_STATE_KEY = "lmsStudyAssistantStatus";
  let observedVideo = null;
  let observer = null;
  let endedNoticeShown = false;
  let automationRunning = false;
  let automationTimer = null;
  let currentLessonId = "";

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

    saveStudyStatus({
      running: false,
      message,
      checkedAt: new Date().toISOString()
    });

    chrome.runtime.sendMessage({ type: "RELEASE_KEEP_AWAKE" });
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

  function isReviewQuestionLesson(title) {
    return /câu\s*hỏi\s*ôn\s*tập\s*chương/i.test(title);
  }

  function findButtonByText(text) {
    const normalizedText = text.trim().toLowerCase();

    return Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent?.trim().toLowerCase() === normalizedText) || null;
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

  async function waitForButtonByText(text, timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const button = findButtonByText(text);

      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") return button;
      await sleep(300);
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
    if (setPlaybackRate(video, 4)) return 4;
    if (setPlaybackRate(video, 2)) return 2;
    return video.playbackRate;
  }

  function muteVideo(video) {
    try {
      video.muted = true;
      video.volume = 0;
    } catch (_error) {
      return false;
    }

    return video.muted && video.volume === 0;
  }

  async function startCurrentVideo() {
    const video = await waitForVideoElement();

    if (!video) {
      return { ok: false, message: "Đã mở bài học, nhưng chưa tìm thấy video." };
    }

    attachVideo(video);
    const playbackRate = setPreferredPlaybackRate(video);
    const muted = muteVideo(video);

    try {
      await video.play();
    } catch (_error) {
      return {
        ok: false,
        message: "Chrome chặn tự động phát. Hãy bấm Play trên video.",
        playbackRate,
        muted
      };
    }

    updateStatus();
    return {
      ok: true,
      message: playbackRate === 4
        ? "Đang phát video với tốc độ 4x."
        : playbackRate === 2
          ? "Không đặt được 4x, đang phát video với tốc độ 2x."
          : `Không đặt được 4x hoặc 2x, đang phát với tốc độ ${playbackRate}x.`,
      playbackRate,
      muted
    };
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

    if (isReviewQuestionLesson(lesson.title)) {
      await openLesson(lesson);

      const startQuizButton = await waitForButtonByText("Bắt đầu làm bài");

      if (startQuizButton) {
        startQuizButton.scrollIntoView({ block: "center", behavior: "smooth" });
        stopAutomation(`Đã đến bước Bắt đầu làm bài. Tạm dừng để kiểm thử thủ công: ${lesson.title}`);
      } else {
        stopAutomation(`Tạm dừng tại bài cần test thủ công: ${lesson.title}. Không tìm thấy nút Bắt đầu làm bài.`);
      }

      return window[STUDY_STATE_KEY];
    }

    await openLesson(lesson);

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "START_LMS_STUDY_AUTOMATION") {
      startStudyAutomation().then(sendResponse);
      return true;
    }

    if (message?.type === "STOP_LMS_STUDY_AUTOMATION") {
      stopAutomation("Đã dừng kịch bản kiểm thử.");
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
