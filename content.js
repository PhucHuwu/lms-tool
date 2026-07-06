(function () {
  const STATE_KEY = "lmsVideoStatus";
  const STUDY_STATE_KEY = "lmsStudyAssistantStatus";
  let observedVideo = null;
  let observer = null;
  let endedNoticeShown = false;

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

  function getVideoStatus(video) {
    const plyrRoot = getPlyrRoot(video);
    const seek = plyrRoot?.querySelector('input[data-plyr="seek"]');
    const currentTimeText = plyrRoot?.querySelector('.plyr__time--current')?.textContent?.trim();
    const durationText = plyrRoot?.querySelector('.plyr__time--duration')?.textContent?.trim();
    const speedText = plyrRoot?.querySelector('[id$="-speed"] [data-plyr="speed"][aria-checked="true"] span')?.textContent?.trim();

    const duration = Number.isFinite(video.duration) ? video.duration : Number(seek?.getAttribute("aria-valuemax"));
    const currentTime = Number.isFinite(video.currentTime) && video.currentTime > 0
      ? video.currentTime
      : Number(seek?.getAttribute("aria-valuenow"));
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

    if (status.ended && !endedNoticeShown) {
      endedNoticeShown = true;
      const nextLesson = findFirstUnwatchedLesson();
      saveStudyStatus({
        running: false,
        message: nextLesson ? "Video da ket thuc. Bam Bat dau hoc de mo bai tiep theo." : "Video da ket thuc. Khong tim thay bai chua xem tiep theo.",
        nextLessonTitle: nextLesson?.title || "",
        checkedAt: new Date().toISOString()
      });
    }

    if (!status.ended) endedNoticeShown = false;
  }

  function saveStudyStatus(status) {
    window[STUDY_STATE_KEY] = status;
    window.dispatchEvent(new CustomEvent("lms-study-assistant-status", { detail: status }));
  }

  function updateStatus() {
    const video = observedVideo || document.querySelector(".lesson-video-styles__VideoContainer-sc-f73a8977-0 video, .plyr video, video");

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
      || "Bai hoc chua co ten";
  }

  function findFirstUnwatchedLesson() {
    return getLessons()
      .filter((lesson) => lesson.getAttribute("aria-disabled") !== "true")
      .map((lesson) => ({
        element: lesson,
        title: getLessonTitle(lesson),
        checked: isLessonChecked(lesson),
        active: lesson.getAttribute("data-lesson-active") === "true"
      }))
      .find((lesson) => !lesson.checked);
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

  async function startCurrentVideo() {
    const video = document.querySelector(".lesson-video-styles__VideoContainer-sc-f73a8977-0 video, .plyr video, video");

    if (!video) {
      return { ok: false, message: "Da mo bai hoc, nhung chua tim thay video." };
    }

    attachVideo(video);
    const speedSet = setPlaybackRate(video, 4);

    try {
      await video.play();
    } catch (_error) {
      return {
        ok: false,
        message: "Chrome chan tu dong phat. Hay bam Play tren video.",
        speedSet
      };
    }

    updateStatus();
    return {
      ok: true,
      message: speedSet ? "Dang phat video voi toc do 4x." : "Dang phat video, nhung khong dat duoc toc do 4x.",
      speedSet
    };
  }

  async function startStudyOnce() {
    const lesson = findFirstUnwatchedLesson();

    if (!lesson) {
      const result = await startCurrentVideo();
      saveStudyStatus({
        running: result.ok,
        message: result.ok ? result.message : "Khong tim thay bai chua xem co the mo.",
        checkedAt: new Date().toISOString()
      });
      return window[STUDY_STATE_KEY];
    }

    if (!lesson.active) {
      lesson.element.scrollIntoView({ block: "center", behavior: "smooth" });
      lesson.element.click();
      saveStudyStatus({
        running: true,
        message: `Dang mo bai: ${lesson.title}`,
        lessonTitle: lesson.title,
        checkedAt: new Date().toISOString()
      });

      await new Promise((resolve) => setTimeout(resolve, 1800));
    }

    const result = await startCurrentVideo();
    saveStudyStatus({
      running: result.ok,
      message: result.message,
      lessonTitle: lesson.title,
      checkedAt: new Date().toISOString()
    });

    return window[STUDY_STATE_KEY];
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "START_LMS_STUDY_ONCE") {
      startStudyOnce().then(sendResponse);
      return true;
    }

    if (message?.type === "GET_LMS_STUDY_STATUS") {
      sendResponse(window[STUDY_STATE_KEY] || { running: false, message: "Chua bat dau", checkedAt: new Date().toISOString() });
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
