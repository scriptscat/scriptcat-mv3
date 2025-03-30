import { MessageQueue } from "@Packages/message/message_queue";
import { Group, MessageSend } from "@Packages/message/server";
import { Script, SCRIPT_STATUS_ENABLE, SCRIPT_TYPE_NORMAL, ScriptAndCode, ScriptDAO } from "@App/app/repo/scripts";
import { ValueService } from "./value";
import GMApi from "./gm_api";
import { subscribeScriptEnable } from "../queue";
import { ScriptService } from "./script";
import { runScript, stopScript } from "../offscreen/client";
import { dealMatches } from "./utils";

export class RuntimeService {
  scriptDAO: ScriptDAO = new ScriptDAO();

  constructor(
    private group: Group,
    private sender: MessageSend,
    private mq: MessageQueue,
    private value: ValueService,
    private script: ScriptService
  ) {}

  async init() {
    // 监听脚本开启
    subscribeScriptEnable(this.mq, async (data) => {
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
    this.mq.subscribe("preparationOffscreen", () => {
      list.forEach((script) => {
        if (script.status !== SCRIPT_STATUS_ENABLE || script.type === SCRIPT_TYPE_NORMAL) {
          return;
        }
        this.mq.publish("enableScript", { uuid: script.uuid, enable: true });
      });
    });

    // 启动gm api
    const gmApi = new GMApi(this.group, this.sender, this.value);
    gmApi.start();

    this.group.on("stopScript", this.stopScript.bind(this));
    this.group.on("runScript", this.runScript.bind(this));
  }

  // 停止脚本
  stopScript(uuid: string) {
    return stopScript(this.sender, uuid);
  }

  // 运行脚本
  async runScript(uuid: string) {
    const script = await this.scriptDAO.get(uuid);
    if (!script) {
      return;
    }
    const res = await this.script.buildScriptRunResource(script);
    return runScript(this.sender, res);
  }

  registryPageScript(script: ScriptAndCode) {
    console.log(script);
    const matches = script.metadata["match"];
    if (!matches) {
      return;
    }
    matches.push(...(script.metadata["include"] || []));
    const registerScript: chrome.userScripts.RegisteredUserScript = {
      id: script.uuid,
      js: [{ code: script.code }],
      matches: dealMatches(matches),
      world: "MAIN",
    };
    if (!script.metadata["noframes"]) {
      registerScript.allFrames = true;
    }
    if (script.metadata["exclude-match"]) {
      const excludeMatches = script.metadata["exclude-match"];
      excludeMatches.push(...(script.metadata["exclude"] || []));
      registerScript.excludeMatches = dealMatches(excludeMatches);
    }
    if (script.metadata["run-at"]) {
      registerScript.runAt = script.metadata["run-at"][0] as chrome.userScripts.RunAt;
    }
    chrome.userScripts.register([registerScript]);
  }

  unregistryPageScript(script: Script) {
    chrome.userScripts.unregister({
      ids: [script.uuid],
    });
  }
}
