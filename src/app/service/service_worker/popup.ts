import { MessageQueue } from "@Packages/message/message_queue";
import { GetSender, Group } from "@Packages/message/server";
import { RuntimeService } from "./runtime";

// 处理popup页面的数据
export class PopupService {
  constructor(
    private group: Group,
    private mq: MessageQueue,
    private runtime: RuntimeService
  ) {}

  registerMenuCommand(message: { uuid: string; id: string; name: string; accessKey: string; con: GetSender }) {
    console.log("registerMenuCommand", message);
  }

  unregisterMenuCommand(message: { id: string }) {
    console.log("unregisterMenuCommand", message);
  }

  init() {
    // 处理脚本菜单数据
    this.mq.subscribe("registerMenuCommand", this.registerMenuCommand.bind(this));
    this.mq.subscribe("unregisterMenuCommand", this.unregisterMenuCommand.bind(this));
  }
}
