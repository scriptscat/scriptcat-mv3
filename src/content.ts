import LoggerCore from "./app/logger/core";
import MessageWriter from "./app/logger/message_writer";
import { SandboxManager } from "./app/service/sandbox";
import { ExtensionMessageSend } from "@Packages/message/extension_message";

function main() {
  // 建立与service_worker页面的连接
  const msg = new ExtensionMessageSend();

  // 初始化日志组件
  const loggerCore = new LoggerCore({
    writer: new MessageWriter(msg),
    labels: { env: "sandbox" },
  });
  loggerCore.logger().debug("offscreen start");

  // 初始化管理器
  const manager = new SandboxManager(msg);
  manager.initManager();
}

main();
