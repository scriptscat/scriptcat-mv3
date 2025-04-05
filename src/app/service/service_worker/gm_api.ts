import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, ScriptDAO } from "@App/app/repo/scripts";
import { GetSender, Group, MessageSend, MessageSender } from "@Packages/message/server";
import { ValueService } from "@App/app/service/service_worker/value";
import PermissionVerify from "./permission_verify";
import { connect } from "@Packages/message/client";
import Cache, { incr } from "@App/app/cache";
import { unsafeHeaders } from "@App/runtime/utils";
import EventEmitter from "eventemitter3";

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

export type Api = (request: Request, con: GetSender) => Promise<any>;

export default class GMApi {
  logger: Logger;

  scriptDAO: ScriptDAO = new ScriptDAO();

  permissionVerify: PermissionVerify = new PermissionVerify();

  constructor(
    private group: Group,
    private send: MessageSend,
    private value: ValueService
  ) {
    this.logger = LoggerCore.logger().with({ service: "runtime/gm_api" });
  }

  async handlerRequest(data: MessageRequest, con: GetSender) {
    this.logger.trace("GM API request", { api: data.api, uuid: data.uuid, param: data.params });
    const api = PermissionVerify.apis.get(data.api);
    if (!api) {
      return Promise.reject(new Error("gm api is not found"));
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
  async buildDNRRule(reqeustId: number, params: GMSend.XHRDetails): Promise<{ [key: string]: string }> {
    // 检查是否有unsafe header,有则生成dnr规则
    const headers = params.headers;
    console.log(headers, !headers);
    if (!headers) {
      return Promise.resolve({});
    }
    const requestHeaders = [
      {
        header: "X-Scriptcat-GM-XHR-Request-Id",
        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
      },
    ] as chrome.declarativeNetRequest.ModifyHeaderInfo[];
    Object.keys(headers).forEach((key) => {
      const lowKey = key.toLowerCase();
      if (unsafeHeaders[lowKey] || lowKey.startsWith("sec-") || lowKey.startsWith("proxy-")) {
        requestHeaders.push({
          header: key,
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: headers[key],
        });
        delete headers[key];
      }
    });
    const ruleId = reqeustId;
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
      urlFilter: params.url,
      requestMethods: [(params.method || "GET").toLowerCase() as chrome.declarativeNetRequest.RequestMethod],
      excludedTabIds: excludedTabIds,
    };
    console.log(rule);
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule],
    });
    return Promise.resolve(headers);
  }

  gmXhrHeadersReceived: EventEmitter = new EventEmitter();

  @PermissionVerify.API()
  async GM_xmlhttpRequest(request: Request, con: GetSender) {
    console.log("GM XHR", request);
    if (request.params.length === 0) {
      return Promise.reject(new Error("param is failed"));
    }
    const params = request.params[0] as GMSend.XHRDetails;
    // 先处理unsafe hearder
    // 关联自己生成的请求id与chrome.webRequest的请求id
    const requestId = 10000 + (await incr(Cache.getInstance(), "gmXhrRequestId", 1));
    // 添加请求header
    if (!params.headers) {
      params.headers = {};
    }
    params.headers["X-Scriptcat-GM-XHR-Request-Id"] = requestId.toString();
    params.headers = await this.buildDNRRule(requestId, request.params[0]);
    console.log("    params.headers", params.headers);
    let responseHeader = "";
    // 等待response
    this.gmXhrHeadersReceived.addListener(
      "headersReceived:" + requestId,
      (details: chrome.webRequest.WebResponseHeadersDetails) => {
        details.responseHeaders?.forEach((header) => {
          responseHeader += header.name + ": " + header.value + "\n";
        });
      }
    );
    // 再发送到offscreen, 处理请求
    const offscreenCon = await connect(this.send, "offscreen/gmApi/xmlHttpRequest", request.params[0]);
    offscreenCon.onMessage((msg: { action: string; data: any }) => {
      // 发送到content
      // 替换msg.data.responseHeaders
      msg.data.responseHeaders = responseHeader;
      con.getConnect().sendMessage(msg);
    });
  }

  start() {
    this.group.on("gmApi", this.handlerRequest.bind(this));
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        if (details.tabId === -1) {
          console.log(details);
          // 判断是否存在X-Scriptcat-GM-XHR-Request-Id
          // 讲请求id与chrome.webRequest的请求id关联
          if (details.requestHeaders) {
            const requestId = details.requestHeaders.find((header) => header.name === "X-Scriptcat-GM-XHR-Request-Id");
            if (requestId) {
              Cache.getInstance().set("gmXhrRequest:" + details.requestId, requestId.value);
            }
          }
        }
      },
      {
        urls: ["<all_urls>"],
        types: ["xmlhttprequest"],
      },
      ["requestHeaders", "extraHeaders"]
    );
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (details.tabId === -1) {
          // 判断请求是否与gmXhrRequest关联
          Cache.getInstance()
            .get("gmXhrRequest:" + details.requestId)
            .then((requestId) => {
              if (requestId) {
                this.gmXhrHeadersReceived.emit("headersReceived:" + requestId, details);
                // 删除关联与DNR
                Cache.getInstance().del("gmXhrRequest:" + details.requestId);
                chrome.declarativeNetRequest.updateSessionRules({
                  removeRuleIds: [parseInt(requestId)],
                });
              }
            });
        }
      },
      {
        urls: ["<all_urls>"],
        types: ["xmlhttprequest"],
      },
      ["responseHeaders", "extraHeaders"]
    );
  }
}
