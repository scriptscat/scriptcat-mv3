import { fetchScriptInfo } from "@App/pkg/utils/script";
import { v4 as uuidv4 } from "uuid";
import Cache from "@App/app/cache";
import CacheKey from "@App/app/cache_key";
import { openInCurrentTab } from "@App/pkg/utils/utils";
import LoggerCore from "@App/app/logger/core";
import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";

export type InstallSource = "user" | "system" | "sync" | "subscribe" | "vscode";

// service worker的管理器
export default class ServiceWorkerManager {
  constructor() {}

  listenerScriptInstall() {
    // 初始化脚本安装监听
    chrome.webRequest.onCompleted.addListener(
      (req: chrome.webRequest.WebResponseCacheDetails) => {
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
        LoggerCore.getInstance().logger().debug("install script", { url: targetUrl });
        this.openInstallPageByUrl(targetUrl).catch(() => {
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
        removeRuleIds: [1],
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
              // 排除常见的复合上述条件的域名
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
    return fetchScriptInfo(url, "user", false, uuidv4()).then((info) => {
      Cache.getInstance().set(CacheKey.scriptInfo(info.uuid), info);
      setTimeout(() => {
        // 清理缓存
        Cache.getInstance().del(CacheKey.scriptInfo(info.uuid));
      }, 60 * 1000);
      openInCurrentTab(`/src/install.html?uuid=${info.uuid}`);
    });
  }

  private api: Server = new Server();

  private mq: MessageQueue = new MessageQueue();

  // 获取安装信息
  getInstallInfo(params: { uuid: string }) {
    const info = Cache.getInstance().get(CacheKey.scriptInfo(params.uuid));
    return info;
  }

  initManager() {
    // 监听消息
    this.api.on("getInstallInfo", this.getInstallInfo);

    this.listenerScriptInstall();
  }
}
