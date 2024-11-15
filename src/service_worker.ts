import { ExtServer } from "@Packages/message/extension";
import { Connect, Server } from "@Packages/message";

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

async function main() {
  // 监听消息
  const server = new Server(new ExtServer());
  server.on("connection", (con) => {
    const wrapCon = new Connect(con);
    wrapCon.on("recv", (data,resp) => {
      console.log(data);
      resp("service_wwww");
    });
  });
  // 初始化沙盒环境
  await setupOffscreenDocument();
}

main();
