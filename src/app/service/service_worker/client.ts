import { Script } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";
import { Broker } from "@Packages/message/message_queue";

export class ScriptClient extends Client {
  constructor() {
    super("serviceWorker/script");
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return this.do("getInstallInfo", uuid);
  }

  install(script: Script, upsertBy: InstallSource = "user") {
    return this.do("install", { script, upsertBy });
  }

  delete(uuid: string) {
    return this.do("delete", uuid);
  }

  enable(uuid: string, enable: boolean) {
    return this.do("enable", { uuid, enable });
  }
}

export function subscribeScriptInstall(
  border: Broker,
  callback: (message: { script: Script; update: boolean }) => void
) {
  return border.subscribe("installScript", callback);
}

export function subscribeScriptDelete(border: Broker, callback: (message: { uuid: string }) => void) {
  return border.subscribe("deleteScript", callback);
}
