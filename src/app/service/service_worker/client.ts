import { Script, ScriptCode, ScriptRunResouce } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";
import { Broker } from "@Packages/message/message_queue";
import { Resource } from "@App/app/repo/resource";
import { MessageSend } from "@Packages/message/server";

export class ServiceWorkerClient extends Client {
  constructor(msg: MessageSend) {
    super(msg);
  }

  preparationOffscreen() {
    return this.do("preparationOffscreen");
  }
}

export class ScriptClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "script");
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return this.do("getInstallInfo", uuid);
  }

  install(script: Script, code: string, upsertBy: InstallSource = "user") {
    return this.do("install", { script, code, upsertBy });
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

  getCode(uuid: string): Promise<ScriptCode | undefined> {
    return this.do("getCode", uuid);
  }

  getScriptRunResource(script: Script): Promise<ScriptRunResouce> {
    return this.do("getScriptRunResource", script);
  }
}

export class ResourceClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "resource");
  }

  getScriptResources(script: Script): Promise<{ [key: string]: Resource }> {
    return this.do("getScriptResources", script);
  }
}

export class ValueClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "value");
  }

  getScriptValue(script: Script) {
    return this.do("getScriptValue", script);
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
