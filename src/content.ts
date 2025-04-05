import LoggerCore from "./app/logger/core";
import MessageWriter from "./app/logger/message_writer";
import { ExtensionMessageSend } from "@Packages/message/extension_message";
import { CustomEventMessage } from "@Packages/message/custom_event_message";
import { RuntimeClient } from "./app/service/service_worker/client";
import ContentRuntime from "./runtime/content/content";
import { Server } from "@Packages/message/server";

// 建立与service_worker页面的连接
const send = new ExtensionMessageSend();

// 初始化日志组件
const loggerCore = new LoggerCore({
  writer: new MessageWriter(send),
  labels: { env: "content" },
});

const client = new RuntimeClient(send);
client.pageLoad().then((data) => {
  loggerCore.logger().debug("content start");
  const msg = new CustomEventMessage(data.flag, true);
  const server = new Server("content", msg);
  // 初始化运行环境
  const runtime = new ContentRuntime(server, send, msg);
  runtime.start(data.scripts);
});
