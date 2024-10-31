


async function setupOffscreenDocument() {
  // 创建运行后台脚本的沙盒环境
  await chrome.offscreen.createDocument({
    url: "src/sandbox.html",
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: "background script",
  });

  // Send message to offscreen document
  chrome.runtime.sendMessage({
    type: "init",
    target: "offscreen",
    data: { init: "1" },
  });
}

setupOffscreenDocument();
