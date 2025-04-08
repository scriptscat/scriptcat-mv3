import { MessageQueue } from "@Packages/message/message_queue";
import { GetSender, Group, MessageSend } from "@Packages/message/server";
import {
  Script,
  SCRIPT_STATUS,
  SCRIPT_STATUS_DISABLE,
  SCRIPT_STATUS_ENABLE,
  SCRIPT_TYPE_NORMAL,
  ScriptDAO,
  ScriptRunResouce,
} from "@App/app/repo/scripts";
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
import { ExtensionContentMessageSend } from "@Packages/message/extension_message";
import { sendMessage } from "@Packages/message/client";

// 为了优化性能，存储到缓存时删除了code与value
export interface ScriptMatchInfo extends ScriptRunResouce {
  matches: string[];
  excludeMatches: string[];
  customizeExcludeMatches: string[];
}

export class RuntimeService {
  scriptDAO: ScriptDAO = new ScriptDAO();

  scriptMatch: UrlMatch<string> = new UrlMatch<string>();
  scriptCustomizeMatch: UrlMatch<string> = new UrlMatch<string>();
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
    const gmApi = new GMApi(this.group, this.sender, this.mq, this.value);
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
        // 加载页面脚本
        await this.loadPageScript(script);
        if (!data.enable) {
          await this.unregistryPageScript(script);
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
        await this.loadPageScript(script);
      }
    });
    // 监听脚本删除
    subscribeScriptDelete(this.mq, async (data) => {
      const script = await this.scriptDAO.get(data.uuid);
      if (!script) {
        return;
      }
      if (script.type === SCRIPT_TYPE_NORMAL) {
        await this.unregistryPageScript(script);
        this.deleteScriptMatch(script.uuid);
      }
    });

    // 将开启的脚本发送一次enable消息
    const scriptDao = new ScriptDAO();
    const list = await scriptDao.all();
    list.forEach((script) => {
      if (script.type !== SCRIPT_TYPE_NORMAL) {
        return;
      }
      this.mq.publish("enableScript", { uuid: script.uuid, enable: script.status === SCRIPT_STATUS_ENABLE });
    });
    // 监听offscreen环境初始化, 初始化完成后, 再将后台脚本运行起来
    this.mq.subscribe("preparationOffscreen", () => {
      list.forEach((script) => {
        if (script.type === SCRIPT_TYPE_NORMAL) {
          return;
        }
        this.mq.publish("enableScript", { uuid: script.uuid, enable: script.status === SCRIPT_STATUS_ENABLE });
      });
    });

    this.loadScriptMatchInfo();
  }

  messageFlag() {
    return Cache.getInstance().getOrSet("scriptInjectMessageFlag", () => {
      return Promise.resolve(randomString(16));
    });
  }

  // 给指定tab发送消息
  sendMessageToTab(
    tabId: number,
    action: string,
    data: any,
    options?: {
      documentId?: string;
      frameId?: number;
    }
  ) {
    if (tabId === -1) {
      // 如果是-1, 代表给offscreen发送消息
      return sendMessage(this.sender, "offscreen/runtime/" + action, data);
    }
    return sendMessage(new ExtensionContentMessageSend(tabId, options), "content/runtime/" + action, data);
  }

  async getPageScriptUuidByUrl(url: string) {
    const match = await this.loadScriptMatchInfo();
    // 匹配当前页面的脚本
    const matchScriptUuid = match.match(url!);
    // 排除自定义匹配
    const excludeScriptUuid = this.scriptCustomizeMatch.match(url!);
    const excludeMatch = new Set<string>();
    excludeScriptUuid.forEach((uuid) => {
      excludeMatch.add(uuid);
    });
    return matchScriptUuid.filter((value) => {
      // 过滤掉自定义排除的脚本
      return !excludeMatch.has(value);
    });
  }

  async getPageScriptByUrl(url: string) {
    const matchScriptUuid = await this.getPageScriptUuidByUrl(url);
    return matchScriptUuid.map((uuid) => {
      return Object.assign({}, this.scriptMatchCache?.get(uuid));
    });
  }

  async pageLoad(_: any, sender: GetSender) {
    const [scriptFlag] = await Promise.all([this.messageFlag(), this.loadScriptMatchInfo()]);
    const chromeSender = sender.getSender() as chrome.runtime.MessageSender;

    // 匹配当前页面的脚本
    const matchScriptUuid = await this.getPageScriptUuidByUrl(chromeSender.url!);

    const scripts = await Promise.all(
      matchScriptUuid.map(async (uuid): Promise<undefined | ScriptRunResouce> => {
        const scriptRes = Object.assign({}, this.scriptMatchCache?.get(uuid));
        // 判断脚本是否开启
        if (scriptRes.status === SCRIPT_STATUS_DISABLE) {
          return undefined;
        }
        // 如果是iframe,判断是否允许在iframe里运行
        if (chromeSender.frameId !== undefined) {
          if (scriptRes.metadata.noframes) {
            return undefined;
          }
        }
        // 获取value
        return scriptRes;
      })
    );

    const enableScript = scripts.filter((item) => item);

    this.mq.emit("pageLoad", {
      tabId: chromeSender.tab?.id,
      frameId: chromeSender.frameId,
      scripts: enableScript,
    });

    return Promise.resolve({ flag: scriptFlag, scripts: enableScript });
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

  // 注册inject.js
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

  loadingScript: Promise<void> | null | undefined;

  // 加载脚本匹配信息，由于service_worker的机制，如果由不活动状态恢复过来时，会优先触发事件
  // 可能当时会没有脚本匹配信息，所以使用脚本信息时，尽量使用此方法获取
  async loadScriptMatchInfo() {
    if (this.scriptMatchCache) {
      return this.scriptMatch;
    }
    if (this.loadingScript) {
      await this.loadingScript;
    } else {
      // 如果没有缓存, 则创建一个新的缓存
      const cache = new Map<string, ScriptMatchInfo>();
      this.loadingScript = Cache.getInstance()
        .get("scriptMatch")
        .then((data: { [key: string]: ScriptMatchInfo }) => {
          if (data) {
            Object.keys(data).forEach((key) => {
              const item = data[key];
              cache.set(item.uuid, item);
              item.matches.forEach((match) => {
                this.scriptMatch.add(match, item.uuid);
              });
              item.excludeMatches.forEach((match) => {
                this.scriptMatch.exclude(match, item.uuid);
              });
              item.customizeExcludeMatches.forEach((match) => {
                this.scriptCustomizeMatch.exclude(match, item.uuid);
              });
            });
          }
        });
      await this.loadingScript;
      this.loadingScript = null;
      this.scriptMatchCache = cache;
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
    // 清理一下老数据
    this.scriptMatch.del(item.uuid);
    this.scriptCustomizeMatch.del(item.uuid);
    // 添加新的数据
    item.matches.forEach((match) => {
      this.scriptMatch.add(match, item.uuid);
    });
    item.excludeMatches.forEach((match) => {
      this.scriptMatch.exclude(match, item.uuid);
    });
    item.customizeExcludeMatches.forEach((match) => {
      this.scriptCustomizeMatch.exclude(match, item.uuid);
    });
    this.saveScriptMatchInfo();
  }

  async updateScriptStatus(uuid: string, status: SCRIPT_STATUS) {
    if (!this.scriptMatchCache) {
      await this.loadScriptMatchInfo();
    }
    this.scriptMatchCache!.get(uuid)!.status = status;
    this.saveScriptMatchInfo();
  }

  deleteScriptMatch(uuid: string) {
    if (!this.scriptMatchCache) {
      return;
    }
    this.scriptMatchCache.delete(uuid);
    this.scriptMatch.del(uuid);
    this.scriptCustomizeMatch.del(uuid);
    this.saveScriptMatchInfo();
  }

  // 加载页面脚本, 会把脚本信息放入缓存中
  // 如果脚本开启, 则注册脚本
  async loadPageScript(script: Script) {
    const matches = script.metadata["match"];
    if (!matches) {
      return;
    }
    const scriptRes = await this.script.buildScriptRunResource(script);

    scriptRes.code = compileInjectScript(scriptRes);

    matches.push(...(script.metadata["include"] || []));
    const patternMatches = dealPatternMatches(matches);
    const scriptMatchInfo: ScriptMatchInfo = Object.assign(
      { matches: patternMatches.result, excludeMatches: [], customizeExcludeMatches: [] },
      scriptRes
    );

    const registerScript: chrome.userScripts.RegisteredUserScript = {
      id: scriptRes.uuid,
      js: [{ code: scriptRes.code }],
      matches: patternMatches.patternResult,
      world: "MAIN",
    };

    if (script.metadata["exclude"]) {
      const excludeMatches = script.metadata["exclude"];
      const result = dealPatternMatches(excludeMatches);

      registerScript.excludeMatches = result.patternResult;
      scriptMatchInfo.excludeMatches = result.result;
    }
    // 自定义排除
    if (script.selfMetadata && script.selfMetadata.exclude) {
      const excludeMatches = script.selfMetadata.exclude;
      const result = dealPatternMatches(excludeMatches);

      if (!registerScript.excludeMatches) {
        registerScript.excludeMatches = [];
      }
      registerScript.excludeMatches.push(...result.patternResult);
      scriptMatchInfo.customizeExcludeMatches = result.result;
    }

    // 将脚本match信息放入缓存中
    this.addScriptMatch(scriptMatchInfo);

    // 如果脚本开启, 则注册脚本
    if (script.status === SCRIPT_STATUS_ENABLE) {
      if (!script.metadata["noframes"]) {
        registerScript.allFrames = true;
      }
      if (script.metadata["run-at"]) {
        registerScript.runAt = getRunAt(script.metadata["run-at"]);
      }
      await chrome.userScripts.register([registerScript]);
      await Cache.getInstance().set("registryScript:" + script.uuid, true);
    }
  }

  async unregistryPageScript(script: Script) {
    if (!(await Cache.getInstance().get("registryScript:" + script.uuid))) {
      return;
    }
    chrome.userScripts.unregister(
      {
        ids: [script.uuid],
      },
      () => {
        // 删除缓存
        Cache.getInstance().del("registryScript:" + script.uuid);
        // 修改脚本状态为disable
        this.updateScriptStatus(script.uuid, SCRIPT_STATUS_DISABLE);
      }
    );
  }
}
