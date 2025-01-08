import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Broker, MessageQueue } from "@Packages/message/message_queue";
import { Group } from "@Packages/message/server";
import { WindowMessage } from "@Packages/message/window_message";
import { ScriptClient, subscribeScriptEnable } from "../service_worker/client";
import { SCRIPT_TYPE_NORMAL } from "@App/app/repo/scripts";
import { disableScript, enableScript } from "../sandbox/client";

export class ScriptService {
  logger: Logger;

  constructor(
    private group: Group,
    private mq: MessageQueue,
    private windowMessage: WindowMessage,
    private broker: Broker
  ) {
    this.logger = LoggerCore.logger().with({ service: "script" });
  }

  async init() {
    subscribeScriptEnable(this.broker, async (data) => {
      const info = await new ScriptClient().info(data.uuid);
      if (info.type === SCRIPT_TYPE_NORMAL) {
        return;
      }
      if (data.enable) {
        // 发送给沙盒运行
        enableScript(this.windowMessage, info);
      } else {
        // 发送给沙盒停止
        disableScript(this.windowMessage, info);
      }
    });
  }
}
