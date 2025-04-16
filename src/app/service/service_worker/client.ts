import { Script, ScriptCode, ScriptRunResouce } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { InstallSource } from ".";
import { Resource } from "@App/app/repo/resource";
import { MessageSend } from "@Packages/message/server";
import { ScriptMenu, ScriptMenuItem } from "./popup";
import PermissionVerify, { ConfirmParam, UserConfirm } from "./permission_verify";

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

  excludeUrl(uuid: string, url: string, remove: boolean) {
    return this.do("excludeUrl", { uuid, url, remove });
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

  pageLoad(): Promise<{ flag: string; scripts: ScriptRunResouce[] }> {
    return this.do("pageLoad");
  }

  scriptLoad(flag: string, uuid: string) {
    return this.do("scriptLoad", { flag, uuid });
  }
}

export type GetPopupDataReq = {
  tabId: number;
  url: string;
};

export type GetPopupDataRes = {
  scriptList: ScriptMenu[];
  backScriptList: ScriptMenu[];
};

export class PopupClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker/popup");
  }

  getPopupData(data: GetPopupDataReq): Promise<GetPopupDataRes> {
    return this.do("getPopupData", data);
  }

  menuClick(uuid: string, data: ScriptMenuItem) {
    return this.do("menuClick", {
      uuid,
      id: data.id,
      sender: {
        tabId: data.tabId,
        frameId: data.frameId,
        documentId: data.documentId,
      },
    });
  }
}

export class PermissionClient extends Client {
  constructor(msg: MessageSend) {
    super(msg, "serviceWorker/runtime/permission");
  }

  confirm(uuid: string, userConfirm: UserConfirm): Promise<void> {
    return this.do("confirm", { uuid, userConfirm });
  }

  getPermissionInfo(uuid: string): ReturnType<PermissionVerify["getInfo"]> {
    return this.do("getInfo", uuid);
  }
}
