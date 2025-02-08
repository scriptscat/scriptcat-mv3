import { MessageQueue } from "@Packages/message/message_queue";
import { ScriptEnableCallbackValue } from "./client";
import { Group } from "@Packages/message/server";
import { Script, SCRIPT_STATUS_ENABLE, SCRIPT_TYPE_NORMAL, ScriptAndCode, ScriptDAO } from "@App/app/repo/scripts";
import GMApi from "@App/runtime/service_worker/gm_api";
import { ValueService } from "./value";

export class RuntimeService {
  scriptDAO: ScriptDAO = new ScriptDAO();

  constructor(
    private group: Group,
    private mq: MessageQueue,
    private value: ValueService
  ) {}

  async init() {
    // 监听脚本开启
    this.mq.addListener("enableScript", async (data: ScriptEnableCallbackValue) => {
      const script = await this.scriptDAO.getAndCode(data.uuid);
      if (!script) {
        return;
      }
      // 如果是普通脚本, 在service worker中进行注册
      // 如果是后台脚本, 在offscreen中进行处理
      if (script.type === SCRIPT_TYPE_NORMAL) {
        // 注册入页面脚本
        if (data.enable) {
          this.registryPageScript(script);
        } else {
          this.unregistryPageScript(script);
        }
      }
    });

    // 将开启的脚本发送一次enable消息
    const scriptDao = new ScriptDAO();
    const list = await scriptDao.all();
    list.forEach((script) => {
      if (script.status !== SCRIPT_STATUS_ENABLE || script.type !== SCRIPT_TYPE_NORMAL) {
        return;
      }
      this.mq.publish("enableScript", { uuid: script.uuid, enable: true });
    });
    // 监听offscreen环境初始化, 初始化完成后, 再将后台脚本运行起来
    this.mq.addListener("preparationOffscreen", () => {
      list.forEach((script) => {
        if (script.status !== SCRIPT_STATUS_ENABLE || script.type === SCRIPT_TYPE_NORMAL) {
          return;
        }
        this.mq.publish("enableScript", { uuid: script.uuid, enable: true });
      });
    });

    // 启动gm api
    const gmApi = new GMApi(this.group, this.value);
    gmApi.start();
  }

  registryPageScript(script: ScriptAndCode) {
    console.log(script);
  }

  unregistryPageScript(script: Script) {}
}
