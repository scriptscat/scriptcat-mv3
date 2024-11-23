import { Connect, Server } from "@Packages/message";
import { ExtServer } from "@Packages/message/extension";
import { WindowServer } from "@Packages/message/window";
import migrate from "./app/migrate";
import LoggerCore from "./app/logger/core";
import DBWriter from "./app/logger/db_writer";
import { LoggerDAO } from "./app/repo/logger";

function main() {
  // 初始化数据库
  migrate();
  // 初始化日志组件
  const loggerCore = new LoggerCore({
    debug: process.env.NODE_ENV === "development",
    writer: new DBWriter(new LoggerDAO()),
    labels: { env: "offscreen" },
  });
  loggerCore.logger().debug("offscreen start");
  // 与sandbox建立连接
  const server = new Server(new WindowServer(window));
  server.on("connection", (con) => {
    const wrapCon = new Connect(con);
    wrapCon.on("forward", (data, resp) => {
      console.log(data);
    });
  });
  // 监听扩展消息
  const extServer = new Server(new ExtServer());
  extServer.on("connection", (con) => {
    const wrapCon = new Connect(con);
    wrapCon.on("recv", (data, resp) => {
      console.log(data);
      resp("service_wwww");
    });
  });
}

main();
