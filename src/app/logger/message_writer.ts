import { WindowMessage } from "@Packages/message/window_message";
import { LogLabel, LogLevel, Writer } from "./core";

// 通过通讯机制写入日志
export default class MessageWriter implements Writer {
  connect: WindowMessage;

  constructor(connect: WindowMessage) {
    this.connect = connect;
  }

  write(level: LogLevel, message: string, label: LogLabel): void {
    this.connect.sendMessage({
      action: "logger",
      data: {
        id: 0,
        level,
        message,
        label,
        createtime: new Date().getTime(),
      },
    });
  }
}
