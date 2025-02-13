import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, ScriptDAO } from "@App/app/repo/scripts";
import { Group, MessageConnect, MessageSender } from "@Packages/message/server";
import { ValueService } from "@App/app/service/service_worker/value";
import PermissionVerify from "./permission_verify";
import { ServiceWorkerMessageSend } from "@Packages/message/window_message";
import { connect, sendMessage } from "@Packages/message/client";
import Cache, { incr } from "@App/app/cache";
import { unsafeHeaders } from "@App/runtime/utils";

// GMApi,处理脚本的GM API调用请求

export type MessageRequest = {
  uuid: string; // 脚本id
  api: string;
  runFlag: string;
  params: any[];
};

export type Request = MessageRequest & {
  script: Script;
  sender: MessageSender;
};

export type Api = (request: Request, con: MessageConnect | null) => Promise<any>;

export default class GMApi {
  logger: Logger;

  scriptDAO: ScriptDAO = new ScriptDAO();

  permissionVerify: PermissionVerify = new PermissionVerify();

  constructor(
    private group: Group,
    private sender: ServiceWorkerMessageSend,
    private value: ValueService
  ) {
    this.logger = LoggerCore.logger().with({ service: "runtime/gm_api" });
  }

  async handlerRequest(data: MessageRequest, con: MessageConnect | null) {
    this.logger.trace("GM API request", { api: data.api, uuid: data.uuid, param: data.params });
    const api = PermissionVerify.apis.get(data.api);
    if (!api) {
      return Promise.reject(new Error("api is not found"));
    }
    const req = await this.parseRequest(data, { tabId: 0 });
    try {
      await this.permissionVerify.verify(req, api);
    } catch (e) {
      this.logger.error("verify error", { api: data.api }, Logger.E(e));
      return Promise.reject(e);
    }
    return api.api.call(this, req, con);
  }

  // 解析请求
  async parseRequest(data: MessageRequest, sender: MessageSender): Promise<Request> {
    const script = await this.scriptDAO.get(data.uuid);
    if (!script) {
      return Promise.reject(new Error("script is not found"));
    }
    const req: Request = <Request>data;
    req.script = script;
    req.sender = sender;
    return Promise.resolve(req);
  }

  @PermissionVerify.API()
  GM_setValue(request: Request): Promise<any> {
    if (!request.params || request.params.length !== 2) {
      return Promise.reject(new Error("param is failed"));
    }
    const [key, value] = request.params;
    const sender = <MessageSender & { runFlag: string }>request.sender;
    sender.runFlag = request.runFlag;
    return this.value.setValue(request.script.uuid, key, value);
  }

  // 根据header生成dnr规则
  async buildDNRRule(params: GMSend.XHRDetails) {
    // 检查是否有unsafe header,有则生成dnr规则
    const headers = params.headers;
    if (!headers) {
      return;
    }
    const requestHeaders = [] as chrome.declarativeNetRequest.ModifyHeaderInfo[];
    Object.keys(headers).forEach((key) => {
      const lowKey = key.toLowerCase();
      if (unsafeHeaders[lowKey] || lowKey.startsWith("sec-") || lowKey.startsWith("proxy-")) {
        requestHeaders.push({
          header: key,
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: headers[key],
        });
      }
    });
    if (requestHeaders.length === 0) {
      return;
    }
    const ruleId = 1000 + (await incr(Cache.getInstance(), "dnrRuleId", 1));
    const rule = {} as chrome.declarativeNetRequest.Rule;
    rule.id = ruleId;
    rule.action = {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: requestHeaders,
    };
    rule.priority = 1;
    const tabs = await chrome.tabs.query({});
    const excludedTabIds: number[] = [];
    tabs.forEach((tab) => {
      if (tab.id) {
        excludedTabIds.push(tab.id);
      }
    });
    rule.condition = {
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
      urlFilter: "^" + params.url + "$",
      excludedTabIds: excludedTabIds,
    };
    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule],
    });
  }

  @PermissionVerify.API()
  async GM_xmlhttpRequest(request: Request, con: MessageConnect) {
    console.log("xml request", request, con);
    // 先处理unsafe hearder
    await this.buildDNRRule(request.params[0]);
    // 再发送到offscreen, 处理请求
    connect(this.sender, "gmApi/xmlHttpRequest", request.params);
  }

  start() {
    this.group.on("gmApi", this.handlerRequest.bind(this));

    // 处理收到的header
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
