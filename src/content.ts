import LoggerCore from "./app/logger/core";
import MessageWriter from "./app/logger/message_writer";
import { SandboxManager } from "./app/service/sandbox";
import { ExtensionMessageSend } from "@Packages/message/extension_message";
import ContentRuntime from "./runtime/content/content";

function main() {
  // 建立与service_worker页面的连接
  const msg = new ExtensionMessageSend();

  // 初始化日志组件
  const loggerCore = new LoggerCore({
    writer: new MessageWriter(msg),
    labels: { env: "content" },
  });
  loggerCore.logger().debug("content start");

  // 初始化运行环境
  const contentMessage = new MessageContent(scriptFlag, true);
  const runtime = new ContentRuntime(contentMessage, internalMessage);
  runtime.start();
}

main();
