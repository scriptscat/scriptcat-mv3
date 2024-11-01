chrome.runtime.onConnect.addListener((port) => {
  console.log("service worker connected", port);
});

async function setupOffscreenDocument() {
  // 创建运行后台脚本的沙盒环境
  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: "offscreen page",
  });

  // Send message to offscreen document
  chrome.runtime.sendMessage({
    type: "init",
    target: "offscreen",
    data: { init: "1" },
  });
}

setupOffscreenDocument();
