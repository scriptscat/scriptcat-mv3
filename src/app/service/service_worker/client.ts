import { Script } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";

export class ScriptClient extends Client {
  constructor() {
    super("serviceWorker/script");
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return this.do("getInstallInfo", uuid);
  }

  installScript(script: Script) {
    return this.do("installScript", script);
  }
}
