import { fetchScriptInfo } from "@App/pkg/utils/script";
import { v4 as uuidv4 } from "uuid";
import { Group } from "@Packages/message/server";
import Logger from "@App/app/logger/logger";
import LoggerCore from "@App/app/logger/core";
import Cache from "@App/app/cache";
import CacheKey from "@App/app/cache_key";
import { openInCurrentTab } from "@App/pkg/utils/utils";
import { Script, ScriptDAO } from "@App/app/repo/scripts";
import { MessageQueue } from "@Packages/message/message_queue";

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
  async installScript(script: Script) {
    const dao = new ScriptDAO();
    // 判断是否已经安装
    const oldScript = await dao.findByUUID(script.uuid);
    if (!oldScript) {
      // 执行安装逻辑
    } else {
      // 执行更新逻辑
    }
    // 广播一下
    this.mq.publish("installScript", script);
  }

  init() {
    this.listenerScriptInstall();

    this.group.on("getInstallInfo", this.getInstallInfo);
    this.group.on("installScript", this.installScript.bind(this));
  }
}
