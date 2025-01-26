import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script } from "@App/app/repo/scripts";
import PermissionVerify from "./permission_verify";
import { MessageSender } from "@Packages/message/server";
import { ValueService } from "@App/app/service/service_worker/value";

// GMApi,处理脚本的GM API调用请求

export type MessageRequest = {
  scriptId: number; // 脚本id
  api: string;
  runFlag: string;
  params: any[];
};

export type Request = MessageRequest & {
  script: Script;
  sender: MessageSender;
};

export type Api = (request: Request) => Promise<any>;

export default class GMApi {
  logger: Logger;

  constructor(private value: ValueService) {
    this.logger = LoggerCore.logger().with({ service: "runtime/gm_api" });
  }

  handlerRequest(params: Request) {
    console.log(params);
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

  start() {}
}
