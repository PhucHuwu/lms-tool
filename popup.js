const statusEl = document.querySelector("#status");
const studyStatusEl = document.querySelector("#study-status");
const startButton = document.querySelector("#start");
const volumeSelect = document.querySelector("#volume");
const speedSelect = document.querySelector("#speed");
const volumeNote = document.querySelector("#volume-note");

const DEFAULT_VOLUME_PERCENT = 25;
const DEFAULT_PLAYBACK_RATE = 1;

function updateVolumeNote() {
  volumeNote.classList.toggle("hidden", volumeSelect.value !== "0");
}

function getSelectedVolumePercent() {
  const volumePercent = Number(volumeSelect.value);
  return Number.isFinite(volumePercent) ? volumePercent : DEFAULT_VOLUME_PERCENT;
}

function getSelectedPlaybackRate() {
  const playbackRate = Number(speedSelect.value);
  return [1, 2, 4].includes(playbackRate) ? playbackRate : DEFAULT_PLAYBACK_RATE;
}

async function loadSettings() {
  const result = await chrome.storage.local.get({
    playbackVolumePercent: DEFAULT_VOLUME_PERCENT,
    playbackRate: DEFAULT_PLAYBACK_RATE
  });

  volumeSelect.value = String(result.playbackVolumePercent);
  speedSelect.value = String(result.playbackRate);
  updateVolumeNote();
}

async function saveSettings() {
  await chrome.storage.local.set({
    playbackVolumePercent: getSelectedVolumePercent(),
    playbackRate: getSelectedPlaybackRate()
  });

  updateVolumeNote();
}

function setStatusClass(className) {
  statusEl.className = `status ${className || ""}`.trim();
}

function renderMissing(message) {
  setStatusClass("missing");
  statusEl.textContent = message;
}

function renderStatus(status) {
  if (!status?.found) {
    renderMissing("Không tìm thấy video trên tab hiện tại");
    return;
  }

  if (status.ended) {
    setStatusClass("paused");
    statusEl.textContent = "Đã phát xong";
  } else if (status.playing) {
    setStatusClass("playing");
    statusEl.textContent = "Đang phát";
  } else {
    setStatusClass("paused");
    statusEl.textContent = "Đang tạm dừng";
  }

}

async function checkStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://lms.ptit.edu.vn/")) {
    renderMissing("Hãy mở trang lms.ptit.edu.vn");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "GET_LMS_VIDEO_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      renderMissing("Tải lại trang LMS rồi thử lại");
      return;
    }

    renderStatus(response);
  });
}

async function startStudy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://lms.ptit.edu.vn/")) {
    renderMissing("Hãy mở trang lms.ptit.edu.vn");
    return;
  }

  startButton.disabled = true;
  studyStatusEl.textContent = "Đang chạy hỗ trợ phát bài học...";
  await saveSettings();
  chrome.runtime.sendMessage({ type: "REQUEST_KEEP_AWAKE" });

  chrome.tabs.sendMessage(tab.id, { type: "START_LMS_STUDY_AUTOMATION" }, (response) => {
    startButton.disabled = Boolean(response?.running);

    if (chrome.runtime.lastError) {
      startButton.disabled = false;
      studyStatusEl.textContent = "Tải lại trang LMS rồi thử lại.";
      return;
    }

    studyStatusEl.textContent = response?.lessonTitle
      ? `${response.message} Bài: ${response.lessonTitle}`
      : response?.message || "Không có phản hồi từ trang LMS.";

    checkStatus();
  });
}

startButton.addEventListener("click", startStudy);
volumeSelect.addEventListener("change", saveSettings);
speedSelect.addEventListener("change", saveSettings);
loadSettings();
checkStatus();
