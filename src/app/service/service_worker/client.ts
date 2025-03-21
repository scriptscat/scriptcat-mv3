import { Script, ScriptCode, ScriptRunResouce } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";
import { Resource } from "@App/app/repo/resource";
import { MessageSend } from "@Packages/message/server";

export class ServiceWorkerClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker");
  }

  preparationOffscreen() {
    return this.do("preparationOffscreen");
  }
}

export class ScriptClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker/script");
  }

  // 获取安装信息
  getInstallInfo(uuid: string) {
    return this.do("getInstallInfo", uuid);
  }

  install(script: Script, code: string, upsertBy: InstallSource = "user"): Promise<{ update: boolean }> {
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
    super(msg, "serviceWorker/resource");
  }

  getScriptResources(script: Script): Promise<{ [key: string]: Resource }> {
    return this.do("getScriptResources", script);
  }
}

export class ValueClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker/value");
  }

  getScriptValue(script: Script) {
    return this.do("getScriptValue", script);
  }
}

export class RuntimeClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker/runtime");
  }

  runScript(uuid: string) {
    return this.do("runScript", uuid);
  }

  stopScript(uuid: string) {
    return this.do("stopScript", uuid);
  }
}
