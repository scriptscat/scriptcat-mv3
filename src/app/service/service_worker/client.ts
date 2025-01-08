import { Script } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";
import { Broker } from "@Packages/message/message_queue";

export class ServiceWorkerClient extends Client {
  constructor() {
    super("serviceWorker");
  }

  preparationOffscreen() {
    return this.do("preparationOffscreen");
  }
}

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

  info(uuid: string): Promise<Script> {
    return this.do("fetchInfo", uuid);
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

export type ScriptEnableCallbackValue = { uuid: string; enable: boolean };

export function subscribeScriptEnable(border: Broker, callback: (message: ScriptEnableCallbackValue) => void) {
  return border.subscribe("enableScript", callback);
}
