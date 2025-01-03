import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { MessageQueue } from "@Packages/message/message_queue";
import { Group } from "@Packages/message/server";

export class ScriptService {
  logger: Logger;

  constructor(
    private group: Group,
    private mq: MessageQueue
  ) {
    this.logger = LoggerCore.logger().with({ service: "script" });
  }

  init() {
    // 初始化, 执行所有的后台脚本, 设置定时脚本计时器

  }
}
