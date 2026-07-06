chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "REQUEST_KEEP_AWAKE") {
    chrome.power.requestKeepAwake("display");
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "RELEASE_KEEP_AWAKE") {
    chrome.power.releaseKeepAwake();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "SHOW_NOTIFICATION") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.svg",
      title: message.title || "LMS Assistant",
      message: message.message || "Có trạng thái mới cần xử lý.",
      priority: 2
    }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });

    return true;
  }

  return false;
});
