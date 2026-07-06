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

  return false;
});
