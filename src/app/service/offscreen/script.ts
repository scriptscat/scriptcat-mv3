import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Broker, MessageQueue } from "@Packages/message/message_queue";
import { Group } from "@Packages/message/server";
import { WindowMessage } from "@Packages/message/window_message";
import {
  ResourceClient,
  ScriptClient,
  subscribeScriptEnable,
  subscribeScriptInstall,
  ValueClient,
} from "../service_worker/client";
import { SCRIPT_STATUS_ENABLE, SCRIPT_TYPE_NORMAL } from "@App/app/repo/scripts";
import { disableScript, enableScript } from "../sandbox/client";

export class ScriptService {
  logger: Logger;

  scriptClient: ScriptClient = new ScriptClient();
  resourceClient: ResourceClient = new ResourceClient();
  valueClient: ValueClient = new ValueClient();

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
      const info = await this.scriptClient.info(data.uuid);
      if (info.type === SCRIPT_TYPE_NORMAL) {
        return;
      }
      if (data.enable) {
        // 构造脚本运行资源,发送给沙盒运行
        enableScript(this.windowMessage, await this.scriptClient.getScriptRunResource(info));
      } else {
        // 发送给沙盒停止
        disableScript(this.windowMessage, info.uuid);
      }
    });
    subscribeScriptInstall(this.broker, async (data) => {
      // 判断是开启还是关闭
      if (data.script.status === SCRIPT_STATUS_ENABLE) {
        // 构造脚本运行资源,发送给沙盒运行
        enableScript(this.windowMessage, await this.scriptClient.getScriptRunResource(data.script));
      } else {
        // 发送给沙盒停止
        disableScript(this.windowMessage, data.script.uuid);
      }
    });
  }
}
