import LoggerCore from "./app/logger/core";
import DBWriter from "./app/logger/db_writer";
import MessageWriter from "./app/logger/message_writer";
import { LoggerDAO } from "./app/repo/logger";
import { OffscreenManager } from "./app/service/offscreen";

function main() {
    // 建立与offscreen页面的连接
    
  // 初始化日志组件
  const loggerCore = new LoggerCore({
    debug: process.env.NODE_ENV === "development",
    writer: new MessageWriter(connectSandbox),
    labels: { env: "sandbox" },
  });
  loggerCore.logger().debug("offscreen start");

  // 初始化管理器
  const manager = new OffscreenManager();
  manager.initManager();
}

main();
