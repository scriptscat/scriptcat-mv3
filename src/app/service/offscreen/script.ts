import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Broker, MessageQueue } from "@Packages/message/message_queue";
import { Group, Message } from "@Packages/message/server";
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

  scriptClient: ScriptClient = new ScriptClient(this.extensionMessage);
  resourceClient: ResourceClient = new ResourceClient(this.extensionMessage);
  valueClient: ValueClient = new ValueClient(this.extensionMessage);

  constructor(
    private group: Group,
    private mq: MessageQueue,
    private extensionMessage: Message,
    private windowMessage: WindowMessage,
    private broker: Broker
  ) {
    this.logger = LoggerCore.logger().with({ service: "script" });
  }

  async init() {
    subscribeScriptEnable(this.broker, async (data) => {
      const script = await this.scriptClient.info(data.uuid);
      if (script.type === SCRIPT_TYPE_NORMAL) {
        return;
      }
      if (data.enable) {
        // 构造脚本运行资源,发送给沙盒运行
        enableScript(this.windowMessage, await this.scriptClient.getScriptRunResource(script));
      } else {
        // 发送给沙盒停止
        disableScript(this.windowMessage, script.uuid);
      }
    });
    subscribeScriptInstall(this.broker, async (data) => {
      // 判断是开启还是关闭
      console.log("1dd23", data);
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
