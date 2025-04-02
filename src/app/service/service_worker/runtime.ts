import { MessageQueue } from "@Packages/message/message_queue";
import { GetSender, Group, MessageSend } from "@Packages/message/server";
import { Script, SCRIPT_STATUS_ENABLE, SCRIPT_TYPE_NORMAL, ScriptDAO, ScriptRunResouce } from "@App/app/repo/scripts";
import { ValueService } from "./value";
import GMApi from "./gm_api";
import { subscribeScriptDelete, subscribeScriptEnable, subscribeScriptInstall } from "../queue";
import { ScriptService } from "./script";
import { runScript, stopScript } from "../offscreen/client";
import { getRunAt } from "./utils";
import { randomString } from "@App/pkg/utils/utils";
import { compileInjectScript, compileScriptCode } from "@App/runtime/content/utils";
import Cache from "@App/app/cache";
import { dealMatches } from "@App/pkg/utils/match";

export class RuntimeService {
  scriptDAO: ScriptDAO = new ScriptDAO();

  scriptFlag: string = "";

  // 运行中的页面脚本
  runningPageScript = new Map<string, ScriptRunResouce>();

  constructor(
    private group: Group,
    private sender: MessageSend,
    private mq: MessageQueue,
    private value: ValueService,
    private script: ScriptService
  ) {}

  async init() {
    this.scriptFlag = await Cache.getInstance().getOrSet("scriptInjectFlag", () => {
      return Promise.resolve(randomString(16));
    });
    // 读取inject.js注入页面
    this.registerInjectScript();
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
    // 监听脚本安装
    subscribeScriptInstall(this.mq, async (data) => {
      const script = await this.scriptDAO.get(data.script.uuid);
      if (!script) {
        return;
      }
      if (script.type === SCRIPT_TYPE_NORMAL) {
        this.registryPageScript(script);
      }
    });
    // 监听脚本删除
    subscribeScriptDelete(this.mq, async (data) => {
      const script = await this.scriptDAO.get(data.uuid);
      if (!script) {
        return;
      }
      if (script.type === SCRIPT_TYPE_NORMAL) {
        this.unregistryPageScript(script);
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
    this.group.on("pageLoad", this.pageLoad.bind(this));
  }

  pageLoad(_, sender: GetSender) {
    const chromeSender = sender.getSender() as chrome.runtime.MessageSender;
    // 匹配当前页面的脚本

    return Promise.resolve({ flag: this.scriptFlag });
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

  registerInjectScript() {
    chrome.userScripts.getScripts({ ids: ["scriptcat-inject"] }).then((res) => {
      if (res.length == 0) {
        fetch("inject.js")
          .then((res) => res.text())
          .then((injectJs) => {
            // 替换ScriptFlag
            const code = `(function (ScriptFlag) {\n${injectJs}\n})('${this.scriptFlag}')`;
            chrome.userScripts.register([
              {
                id: "scriptcat-inject",
                js: [{ code }],
                matches: ["<all_urls>"],
                allFrames: true,
                world: "MAIN",
                runAt: "document_start",
              },
            ]);
          });
        chrome.scripting.registerContentScripts([
          {
            id: "scriptcat-content",
            js: ["src/content.js"],
            matches: ["<all_urls>"],
            allFrames: true,
            runAt: "document_start",
            world: "ISOLATED",
          },
        ]);
      }
    });
  }

  async registryPageScript(script: Script) {
    if (await Cache.getInstance().has("registryScript:" + script.uuid)) {
      return;
    }
    const matches = script.metadata["match"];
    if (!matches) {
      return;
    }
    const scriptRes = await this.script.buildScriptRunResource(script);

    scriptRes.code = compileScriptCode(scriptRes);
    scriptRes.code = compileInjectScript(scriptRes);

    this.runningPageScript.set(scriptRes.uuid, scriptRes);

    matches.push(...(script.metadata["include"] || []));
    const registerScript: chrome.userScripts.RegisteredUserScript = {
      id: scriptRes.uuid,
      js: [{ code: scriptRes.code }],
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
      registerScript.runAt = getRunAt(script.metadata["run-at"]);
    }
    chrome.userScripts.register([registerScript], () => {
      // 标记为已注册
      Cache.getInstance().set("registryScript:" + script.uuid, true);
    });
    console.log(registerScript);
    // 把脚本uuid注册到content页面
    chrome.userScripts.register([
      {
        id: "content-" + scriptRes.uuid,
        js: [{ code: "window.a=1;console.log('window.a',window,window.b)" }],
        matches: dealMatches(matches),
        runAt: "document_start",
      },
    ]);
  }

  unregistryPageScript(script: Script) {
    chrome.userScripts.unregister(
      {
        ids: [script.uuid],
      },
      () => {
        // 删除缓存
        Cache.getInstance().del("registryScript:" + script.uuid);
      }
    );
  }
}
