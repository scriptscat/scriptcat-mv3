import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { ScriptRunResouce } from "@App/app/repo/scripts";
import GMApi from "./gm_api";
import { compileScript, createContext, proxyContext, ScriptFunc } from "./utils";
import { Message } from "@Packages/message/server";

export type ValueUpdateData = {
  oldValue: any;
  value: any;
  key: string; // 值key
  uuid: string;
  storageKey: string; // 储存key
  sender: {
    runFlag: string;
    tabId?: number;
  };
};

export class RuntimeMessage {}

// 执行脚本,控制脚本执行与停止
export default class ExecScript {
  scriptRes: ScriptRunResouce;

  scriptFunc: ScriptFunc;

  logger: Logger;

  proxyContent: any;

  sandboxContent?: GMApi;

  GM_info: any;

  constructor(scriptRes: ScriptRunResouce, message: Message, thisContext?: { [key: string]: any }) {
    this.scriptRes = scriptRes;
    this.logger = LoggerCore.getInstance().logger({
      component: "exec",
      script: this.scriptRes.uuid,
      name: this.scriptRes.name,
    });
    this.GM_info = GMApi.GM_info(this.scriptRes);
    // 构建脚本资源
    this.scriptFunc = compileScript(this.scriptRes.code);
    const grantMap: { [key: string]: boolean } = {};
    scriptRes.metadata.grant.forEach((key) => {
      grantMap[key] = true;
    });
    if (grantMap.none) {
      // 不注入任何GM api
      this.proxyContent = global;
    } else {
      // 构建脚本GM上下文
      this.sandboxContent = createContext(scriptRes, this.GM_info, message);
      this.proxyContent = proxyContext(global, this.sandboxContent, thisContext);
    }
  }

  // 触发值更新
  valueUpdate(data: ValueUpdateData) {
    this.sandboxContent?.valueUpdate(data);
  }

  exec() {
    this.logger.debug("script start");
    return this.scriptFunc.apply(this.proxyContent, [this.proxyContent, this.GM_info]);
  }

  // TODO: 实现脚本的停止,资源释放
  stop() {
    this.logger.debug("script stop");
    return true;
  }
}
