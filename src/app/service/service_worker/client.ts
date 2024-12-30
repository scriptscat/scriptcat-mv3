import { Script } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";

export class ScriptClient extends Client {
  constructor() {
    super("serviceWorker/script");
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return this.do("getInstallInfo", uuid);
  }

  installScript(script: Script, upsertBy: InstallSource = "user") {
    return this.do("installScript", { script, upsertBy });
  }
}
