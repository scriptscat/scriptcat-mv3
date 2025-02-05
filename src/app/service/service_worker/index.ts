import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";
import { ScriptService } from "./script";
import { ExtensionMessage } from "@Packages/message/extension_message";
import { ResourceService } from "./resource";
import { ValueService } from "./value";
import { RuntimeService } from "./runtime";

export type InstallSource = "user" | "system" | "sync" | "subscribe" | "vscode";

// service worker的管理器
export default class ServiceWorkerManager {
  constructor() {}

  private api: Server = new Server("service_worker", new ExtensionMessage());

  private mq: MessageQueue = new MessageQueue(this.api);

  initManager() {
    const group = this.api.group("serviceWorker");
    group.on("preparationOffscreen", () => {
      // 准备好环境
      this.mq.emit("preparationOffscreen", {});
    });

    const resource = new ResourceService(group.group("resource"), this.mq);
    resource.init();
    const value = new ValueService(group.group("value"), this.mq);
    value.init();
    const script = new ScriptService(group.group("script"), this.mq, value, resource);
    script.init();
    const runtime = new RuntimeService(group.group("runtime"), this.mq, value);
    runtime.init();

    // 测试xhr
    setTimeout(() => {
      chrome.tabs.query(
        {
          url: chrome.runtime.getURL("src/offscreen.html"),
        },
        (result) => {
          console.log(result);
        }
      );
    }, 2000);
    group.on("testGmApi", () => {
      console.log(chrome.runtime.getURL("src/offscreen.html"));
      return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
          const excludedTabIds: number[] = [];
          tabs.forEach((tab) => {
            if (tab.id) {
              excludedTabIds.push(tab.id);
            }
          });
          chrome.declarativeNetRequest.updateSessionRules(
            {
              removeRuleIds: [100],
              addRules: [
                {
                  id: 100,
                  priority: 1,
                  action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [
                      {
                        header: "cookie",
                        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: "test=1234314",
                      },
                      {
                        header: "origin",
                        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: "https://learn.scriptcat.org",
                      },
                      {
                        header: "user-agent",
                        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: "test",
                      },
                    ],
                  },
                  condition: {
                    resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
                    urlFilter: "https://scriptcat.org/zh-CN",
                    excludedTabIds: excludedTabIds,
                  },
                },
              ],
            },
            () => {
              resolve(1);
            }
          );
        });
      });
    });
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        console.log(details);
      },
      {
        urls: ["<all_urls>"],
        types: ["xmlhttprequest"],
      },
      ["responseHeaders", "extraHeaders"]
    );
  }
}
