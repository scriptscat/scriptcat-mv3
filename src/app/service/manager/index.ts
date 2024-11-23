import { fetchScriptInfo } from "@App/pkg/utils/script";
import { v4 as uuidv4 } from "uuid";
import { Connect } from "@Packages/message";
import Cache from "@App/app/cache";
import CacheKey from "@App/app/cache_key";
import { openInCurrentTab } from "@App/pkg/utils/utils";
import LoggerCore from "@App/app/logger/core";

export type InstallSource = "user" | "system" | "sync" | "subscribe" | "vscode";

export default class Manager {
  constructor(private connect: Connect) {}

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
        // 判断是否有bypass参数
        if (url.hash.includes("bypass=true")) {
          return;
        }
        // 读取脚本url内容, 进行安装
        LoggerCore.getInstance().logger().debug("install script", { url: targetUrl });
        this.openInstallPageByUrl(targetUrl).catch(() => {
          // 如果打开失败, 则重定向到安装页
          chrome.scripting.executeScript({
            target: { tabId: req.tabId },
            func: () => {
              history.back();
            },
          });
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
    // 屏蔽某个tab都安装脚本
    this.connect.on("install_script", (data: { req: chrome.webRequest.WebRequestBodyDetails }) => {
      chrome.declarativeNetRequest.updateDynamicRules(
        {
          removeRuleIds: [2],
          addRules: [
            {
              id: 2,
              priority: 1,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
                redirect: {
                  regexSubstitution: "https://docs.scriptcat.org/docs/script_installation#url=\\0",
                },
              },
              condition: {
                regexFilter: "^([^#]+?)\\.user(\\.bg|\\.sub)?\\.js((\\?).*|$)",
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
                requestMethods: [chrome.declarativeNetRequest.RequestMethod.GET],
                tabIds: [data.req.tabId],
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

  initManager() {
    this.listenerScriptInstall();
  }
}
