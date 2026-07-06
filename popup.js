const statusEl = document.querySelector("#status");
const timeEl = document.querySelector("#time");
const progressEl = document.querySelector("#progress");
const speedEl = document.querySelector("#speed");
const volumeEl = document.querySelector("#volume");
const studyStatusEl = document.querySelector("#study-status");
const startButton = document.querySelector("#start");
const refreshButton = document.querySelector("#refresh");

function setStatusClass(className) {
  statusEl.className = `status ${className || ""}`.trim();
}

function renderMissing(message) {
  setStatusClass("missing");
  statusEl.textContent = message;
  timeEl.textContent = "--";
  progressEl.textContent = "--";
  speedEl.textContent = "--";
  volumeEl.textContent = "--";
}

function renderStatus(status) {
  if (!status?.found) {
    renderMissing("Khong tim thay video tren tab hien tai");
    return;
  }

  if (status.ended) {
    setStatusClass("paused");
    statusEl.textContent = "Da phat xong";
  } else if (status.playing) {
    setStatusClass("playing");
    statusEl.textContent = "Dang phat";
  } else {
    setStatusClass("paused");
    statusEl.textContent = "Dang tam dung";
  }

  timeEl.textContent = `${status.currentTimeText} / ${status.durationText}`;
  progressEl.textContent = `${status.progress.toFixed(1)}%`;
  speedEl.textContent = status.speedText || `${status.playbackRate}x`;
  volumeEl.textContent = status.muted ? "Tat tieng" : `${Math.round(status.volume * 100)}%`;
}

async function checkStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://lms.ptit.edu.vn/")) {
    renderMissing("Hay mo trang lms.ptit.edu.vn");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "GET_LMS_VIDEO_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      renderMissing("Tai lai trang LMS roi thu lai");
      return;
    }

    renderStatus(response);
  });
}

async function startStudy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://lms.ptit.edu.vn/")) {
    renderMissing("Hay mo trang lms.ptit.edu.vn");
    return;
  }

  startButton.disabled = true;
  studyStatusEl.textContent = "Dang tim bai chua xem...";

  chrome.tabs.sendMessage(tab.id, { type: "START_LMS_STUDY_ONCE" }, (response) => {
    startButton.disabled = false;

    if (chrome.runtime.lastError) {
      studyStatusEl.textContent = "Tai lai trang LMS roi thu lai.";
      return;
    }

    studyStatusEl.textContent = response?.lessonTitle
      ? `${response.message} Bai: ${response.lessonTitle}`
      : response?.message || "Khong co phan hoi tu trang LMS.";

    checkStatus();
  });
}

startButton.addEventListener("click", startStudy);
refreshButton.addEventListener("click", checkStatus);
checkStatus();
