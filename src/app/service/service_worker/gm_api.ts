import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, ScriptDAO } from "@App/app/repo/scripts";
import { Group, MessageConnect, MessageSender } from "@Packages/message/server";
import { ValueService } from "@App/app/service/service_worker/value";
import PermissionVerify from "./permission_verify";

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

  @PermissionVerify.API()
  GM_xmlhttpRequest(request: Request, con: MessageConnect) {
    console.log("xml request", request, con);
    // 先处理unsafe hearder
    // 再发送到offscreen, 处理请求
    sendMessageToOffscreen("offscreen/gmApi/requestXhr", request.params);
  }

  start() {
    this.group.on("gmApi", this.handlerRequest.bind(this));
  }
}

export async function sendMessageToOffscreen(action: string, data?: any) {
  // service_worker和offscreen同时监听消息,会导致消息被两边同时接收,但是返回结果时会产生问题,导致报错
  // 不进行监听的话又无法从service_worker主动发送消息
  // 所以这里通过clients.matchAll()获取到所有的client,然后通过postMessage发送消息
  const list = await clients.matchAll({ includeUncontrolled: true, type: "window" });
  list[0].postMessage({
    type: "sendMessage",
    data: { action, data },
  });
}
