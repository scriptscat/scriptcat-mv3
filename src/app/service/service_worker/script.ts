import { fetchScriptInfo } from "@App/pkg/utils/script";
import { v4 as uuidv4 } from "uuid";
import { Group } from "@Packages/message/server";
import Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import Cache from "@App/app/cache";
import CacheKey from "@App/app/cache_key";
import { openInCurrentTab } from "@App/pkg/utils/utils";
import {
  Script,
  SCRIPT_STATUS_DISABLE,
  SCRIPT_STATUS_ENABLE,
  SCRIPT_TYPE_NORMAL,
  ScriptDAO,
} from "@App/app/repo/scripts";
import { MessageQueue } from "@Packages/message/message_queue";
import { InstallSource } from ".";
import { ScriptEnableCallbackValue } from "./client";

export class ScriptService {
  logger: Logger;

  constructor(
    private group: Group,
    private mq: MessageQueue
  ) {
    this.logger = LoggerCore.logger().with({ service: "script" });
  }

  listenerScriptInstall() {
    // 初始化脚本安装监听
    chrome.webRequest.onBeforeRequest.addListener(
      (req: chrome.webRequest.WebRequestBodyDetails) => {
        // 处理url, 实现安装脚本
        if (req.method !== "GET") {
          return;
        }
        const url = new URL(req.url);
        // 判断是否有hash
        if (!url.hash) {
          return;
        }
        // 判断是否有url参数
        if (!url.hash.includes("url=")) {
          return;
        }
        // 获取url参数
        const targetUrl = url.hash.split("url=")[1];
        // 读取脚本url内容, 进行安装
        const logger = this.logger.with({ url: targetUrl });
        logger.debug("install script");
        this.openInstallPageByUrl(targetUrl).catch((e) => {
          logger.error("install script error", Logger.E(e));
          // 如果打开失败, 则重定向到安装页
          chrome.scripting.executeScript({
            target: { tabId: req.tabId },
            func: function () {
              history.back();
            },
          });
          // 并不再重定向当前url
          chrome.declarativeNetRequest.updateDynamicRules(
            {
              removeRuleIds: [2],
              addRules: [
                {
                  id: 2,
                  priority: 1,
                  action: {
                    type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
                  },
                  condition: {
                    regexFilter: targetUrl,
                    resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
                    requestMethods: [chrome.declarativeNetRequest.RequestMethod.GET],
                  },
                },
              ],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
              }
            }
          );
        });
      },
      {
        urls: [
          "https://docs.scriptcat.org/docs/script_installation",
          "https://www.tampermonkey.net/script_installation.php",
        ],
        types: ["main_frame"],
      }
    );
    // 重定向到脚本安装页
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: [1, 2],
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
              redirect: {
                regexSubstitution: "https://docs.scriptcat.org/docs/script_installation#url=\\0",
              },
            },
            condition: {
              regexFilter: "^([^#]+?)\\.user(\\.bg|\\.sub)?\\.js((\\?).*|$)",
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
              requestMethods: [chrome.declarativeNetRequest.RequestMethod.GET],
              // 排除常见的符合上述条件的域名
              excludedRequestDomains: ["github.com"],
            },
          },
        ],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
      }
    );
  }

  public openInstallPageByUrl(url: string) {
    const uuid = uuidv4();
    return fetchScriptInfo(url, "user", false, uuidv4()).then((info) => {
      Cache.getInstance().set(CacheKey.scriptInstallInfo(uuid), info);
      setTimeout(() => {
        // 清理缓存
        Cache.getInstance().del(CacheKey.scriptInstallInfo(uuid));
      }, 60 * 1000);
      openInCurrentTab(`/src/install.html?uuid=${uuid}`);
    });
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return Cache.getInstance().get(CacheKey.scriptInstallInfo(uuid));
  }

  // 安装脚本
  async installScript(param: { script: Script; upsertBy: InstallSource }) {
    param.upsertBy = param.upsertBy || "user";
    const { script, upsertBy } = param;
    const logger = this.logger.with({
      name: script.name,
      uuid: script.uuid,
      version: script.metadata.version[0],
      upsertBy,
    });
    let update = false;
    const dao = new ScriptDAO();
    // 判断是否已经安装
    const oldScript = await dao.findByUUID(script.uuid);
    if (oldScript) {
      // 执行更新逻辑
      update = true;
      script.selfMetadata = oldScript.selfMetadata;
    }
    return dao
      .save(script)
      .then(() => {
        logger.info("install success");
        // 广播一下
        this.mq.publish("installScript", { script, update });
        return {};
      })
      .catch((e) => {
        logger.error("install error", Logger.E(e));
        throw e;
      });
  }

  async deleteScript(uuid: string) {
    const logger = this.logger.with({ uuid });
    const dao = new ScriptDAO();
    const script = await dao.findByUUID(uuid);
    if (!script) {
      logger.error("script not found");
      throw new Error("script not found");
    }
    return dao
      .delete(uuid)
      .then(() => {
        logger.info("delete success");
        this.mq.publish("deleteScript", { uuid });
        return {};
      })
      .catch((e) => {
        logger.error("delete error", Logger.E(e));
        throw e;
      });
  }

  async enableScript(param: { uuid: string; enable: boolean }) {
    const logger = this.logger.with({ uuid: param.uuid, enable: param.enable });
    const dao = new ScriptDAO();
    const script = await dao.findByUUID(param.uuid);
    if (!script) {
      logger.error("script not found");
      throw new Error("script not found");
    }
    return dao
      .update(param.uuid, { status: param.enable ? SCRIPT_STATUS_ENABLE : SCRIPT_STATUS_DISABLE })
      .then(() => {
        logger.info("enable success");
        this.mq.publish("enableScript", { uuid: param.uuid, enable: param.enable });
        return {};
      })
      .catch((e) => {
        logger.error("enable error", Logger.E(e));
        throw e;
      });
  }

  async fetchInfo(uuid: string) {
    const script = await new ScriptDAO().findByUUID(uuid);
    if (!script) {
      return null;
    }
    return script;
  }

  async init() {
    this.listenerScriptInstall();

    this.group.on("getInstallInfo", this.getInstallInfo);
    this.group.on("install", this.installScript.bind(this));
    this.group.on("delete", this.deleteScript.bind(this));
    this.group.on("enable", this.enableScript.bind(this));
    this.group.on("fetchInfo", this.fetchInfo.bind(this));

    this.listenScript();
  }

  // 监听脚本
  async listenScript() {
    // 监听脚本开启
    this.mq.addListener("enableScript", async (data: ScriptEnableCallbackValue) => {
      const script = await new ScriptDAO().findByUUID(data.uuid);
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
  }

  registryPageScript(script: Script) {}

  unregistryPageScript(script: Script) {}
}
