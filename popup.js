const statusEl = document.querySelector("#status");
const studyStatusEl = document.querySelector("#study-status");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");

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

async function stopStudy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://lms.ptit.edu.vn/")) {
    renderMissing("Hãy mở trang lms.ptit.edu.vn");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "STOP_LMS_STUDY_AUTOMATION" }, (response) => {
    startButton.disabled = false;
    chrome.runtime.sendMessage({ type: "RELEASE_KEEP_AWAKE" });

    if (chrome.runtime.lastError) {
      studyStatusEl.textContent = "Tải lại trang LMS rồi thử lại.";
      return;
    }

    studyStatusEl.textContent = response?.message || "Đã dừng.";
    checkStatus();
  });
}

startButton.addEventListener("click", startStudy);
stopButton.addEventListener("click", stopStudy);
checkStatus();
