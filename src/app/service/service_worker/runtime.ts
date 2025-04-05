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
import { compileInjectScript } from "@App/runtime/content/utils";
import Cache from "@App/app/cache";
import { dealPatternMatches, UrlMatch } from "@App/pkg/utils/match";

// 为了优化性能，存储到缓存时删除了code与value
export interface ScriptMatchInfo extends ScriptRunResouce {
  matches: string[];
  excludeMatches: string[];
}

export class RuntimeService {
  scriptDAO: ScriptDAO = new ScriptDAO();

  scriptMatch: UrlMatch<string> = new UrlMatch<string>();
  scriptMatchCache: Map<string, ScriptMatchInfo> | null | undefined;

  constructor(
    private group: Group,
    private sender: MessageSend,
    private mq: MessageQueue,
    private value: ValueService,
    private script: ScriptService
  ) {}

  async init() {
    // 启动gm api
    const gmApi = new GMApi(this.group, this.sender, this.value);
    gmApi.start();

    this.group.on("stopScript", this.stopScript.bind(this));
    this.group.on("runScript", this.runScript.bind(this));
    this.group.on("pageLoad", this.pageLoad.bind(this));

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
  }

  messageFlag() {
    return Cache.getInstance().getOrSet("scriptInjectMessageFlag", () => {
      return Promise.resolve(randomString(16));
    });
  }

  async pageLoad(_, sender: GetSender) {
    const [scriptFlag, match] = await Promise.all([this.messageFlag(), this.loadScriptMatchInfo()]);
    const chromeSender = sender.getSender() as chrome.runtime.MessageSender;

    // 匹配当前页面的脚本
    const matchScriptUuid = match.match(chromeSender.url!);
    const scripts = await Promise.all(
      matchScriptUuid.map(
        (uuid) =>
          new Promise((resolve) => {
            // 获取value
            const scriptRes = Object.assign({}, this.scriptMatchCache?.get(uuid));
            resolve(scriptRes);
          })
      )
    );
    return Promise.resolve({ flag: scriptFlag, scripts: scripts });
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
          .then(async (injectJs) => {
            // 替换ScriptFlag
            const code = `(function (MessageFlag) {\n${injectJs}\n})('${await this.messageFlag()}')`;
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

  loadScripting: Promise<void> | null | undefined;

  // 加载脚本匹配信息，由于service_worker的机制，如果由不活动状态恢复过来时，会优先触发事件
  // 可能当时会没有脚本匹配信息，所以使用脚本信息时，尽量使用此方法获取
  async loadScriptMatchInfo() {
    if (this.scriptMatchCache) {
      return this.scriptMatch;
    }
    if (this.loadScripting) {
      await this.loadScripting;
    } else {
      // 如果没有缓存, 则创建一个新的缓存
      this.loadScripting = Cache.getInstance()
        .get("scriptMatch")
        .then((data: { [key: string]: ScriptMatchInfo }) => {
          this.scriptMatchCache = new Map<string, ScriptMatchInfo>();
          if (data) {
            Object.keys(data).forEach((key) => {
              const item = data[key];
              this.scriptMatchCache!.set(item.uuid, item);
              item.matches.forEach((match) => {
                this.scriptMatch.add(match, item.uuid);
              });
              item.excludeMatches.forEach((match) => {
                this.scriptMatch.exclude(match, item.uuid);
              });
            });
          }
        });
      await this.loadScripting;
      this.loadScripting = null;
    }
    return this.scriptMatch;
  }

  // 保存脚本匹配信息
  async saveScriptMatchInfo() {
    if (!this.scriptMatchCache) {
      return;
    }
    const scriptMatch = {} as { [key: string]: ScriptMatchInfo };
    this.scriptMatchCache.forEach((val, key) => {
      scriptMatch[key] = val;
      // 优化性能，将不需要的信息去掉
      scriptMatch[key].code = "";
      scriptMatch[key].value = {};
    });
    return await Cache.getInstance().set("scriptMatch", scriptMatch);
  }

  async addScriptMatch(item: ScriptMatchInfo) {
    if (!this.scriptMatchCache) {
      await this.loadScriptMatchInfo();
    }
    this.scriptMatchCache!.set(item.uuid, item);
    item.matches.forEach((match) => {
      this.scriptMatch.add(match, item.uuid);
    });
    item.excludeMatches.forEach((match) => {
      this.scriptMatch.exclude(match, item.uuid);
    });
    this.saveScriptMatchInfo();
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

    scriptRes.code = compileInjectScript(scriptRes);

    matches.push(...(script.metadata["include"] || []));
    const patternMatches = dealPatternMatches(matches);
    const scriptMatchInfo: ScriptMatchInfo = Object.assign(
      { matches: patternMatches.result, excludeMatches: [] },
      scriptRes
    );

    const registerScript: chrome.userScripts.RegisteredUserScript = {
      id: scriptRes.uuid,
      js: [{ code: scriptRes.code }],
      matches: patternMatches.patternResult,
      world: "MAIN",
    };
    if (!script.metadata["noframes"]) {
      registerScript.allFrames = true;
    }

    if (script.metadata["exclude-match"]) {
      const excludeMatches = script.metadata["exclude-match"];
      excludeMatches.push(...(script.metadata["exclude"] || []));
      const result = dealPatternMatches(excludeMatches);

      registerScript.excludeMatches = result.patternResult;
      scriptMatchInfo.excludeMatches = result.result;
    }
    if (script.metadata["run-at"]) {
      registerScript.runAt = getRunAt(script.metadata["run-at"]);
    }
    chrome.userScripts.register([registerScript], async () => {
      // 标记为已注册
      Cache.getInstance().set("registryScript:" + script.uuid, true);
      // 将脚本match信息放入缓存中
      this.addScriptMatch(scriptMatchInfo);
    });
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
