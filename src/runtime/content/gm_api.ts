import { ScriptRunResouce } from "@App/app/repo/scripts";
import { getMetadataStr, getUserConfigStr, parseUserConfig } from "@App/pkg/utils/script";
import { ValueUpdateData } from "./exec_script";
import { ExtVersion } from "@App/app/const";
import { storageKey } from "../utils";
import { Message, MessageConnect } from "@Packages/message/server";
import { CustomEventMessage } from "@Packages/message/custom_event_message";
import LoggerCore from "@App/app/logger/core";
import { connect, sendMessage } from "@Packages/message/client";
import EventEmitter from "eventemitter3";

interface ApiParam {
  depend?: string[];
  listener?: () => void;
}

export interface ApiValue {
  api: any;
  param: ApiParam;
}

export class GMContext {
  static apis: Map<string, ApiValue> = new Map();

  public static API(param: ApiParam = {}) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const key = propertyName;
      if (param.listener) {
        param.listener();
      }
      if (key === "GMdotXmlHttpRequest") {
        GMContext.apis.set("GM.xmlHttpRequest", {
          api: descriptor.value,
          param,
        });
        return;
      }
      GMContext.apis.set(key, {
        api: descriptor.value,
        param,
      });
      // 兼容GM.*
      const dot = key.replace("_", ".");
      if (dot !== key) {
        // 特殊处理GM.xmlHttpRequest
        if (dot === "GM.xmlhttpRequest") {
          return;
        }
        GMContext.apis.set(dot, {
          api: descriptor.value,
          param,
        });
      }
    };
  }
}

export default class GMApi {
  scriptRes!: ScriptRunResouce;

  runFlag!: string;

  valueChangeListener = new Map<number, { name: string; listener: GMTypes.ValueChangeListener }>();

  constructor(
    private prefix: string,
    private message: Message
  ) {}

  // 单次回调使用
  public sendMessage(api: string, params: any[]) {
    return sendMessage(this.message, this.prefix + "/runtime/gmApi", {
      uuid: this.scriptRes.uuid,
      api,
      params,
    });
  }

  // 长连接使用,connect只用于接受消息,不发送消息
  public connect(api: string, params: any[]) {
    return connect(this.message, this.prefix + "/runtime/gmApi", {
      uuid: this.scriptRes.uuid,
      api,
      params,
    });
  }

  public valueUpdate(data: ValueUpdateData) {
    if (data.uuid === this.scriptRes.uuid || data.storageKey === storageKey(this.scriptRes)) {
      // 触发,并更新值
      if (data.value === undefined) {
        delete this.scriptRes.value[data.value];
      } else {
        this.scriptRes.value[data.key] = data.value;
      }
      this.valueChangeListener.forEach((item) => {
        if (item.name === data.value.key) {
          item.listener(
            data.value.key,
            data.oldValue,
            data.value,
            data.sender.runFlag !== this.runFlag,
            data.sender.tabId
          );
        }
      });
    }
  }

  menuClick(id: number) {
    this.EE.emit("menuClick" + id);
  }

  // 获取脚本信息和管理器信息
  static GM_info(script: ScriptRunResouce) {
    const metadataStr = getMetadataStr(script.code);
    const userConfigStr = getUserConfigStr(script.code) || "";
    const options = {
      description: (script.metadata.description && script.metadata.description[0]) || null,
      matches: script.metadata.match || [],
      includes: script.metadata.include || [],
      "run-at": (script.metadata["run-at"] && script.metadata["run-at"][0]) || "document-idle",
      icon: (script.metadata.icon && script.metadata.icon[0]) || null,
      icon64: (script.metadata.icon64 && script.metadata.icon64[0]) || null,
      header: metadataStr,
      grant: script.metadata.grant || [],
      connects: script.metadata.connect || [],
    };

    return {
      // downloadMode
      // isIncognito
      scriptWillUpdate: true,
      scriptHandler: "ScriptCat",
      scriptUpdateURL: script.downloadUrl,
      scriptMetaStr: metadataStr,
      userConfig: parseUserConfig(userConfigStr),
      userConfigStr,
      // scriptSource: script.sourceCode,
      version: ExtVersion,
      script: {
        // TODO: 更多完整的信息(为了兼容Tampermonkey,后续待定)
        name: script.name,
        namespace: script.namespace,
        version: script.metadata.version && script.metadata.version[0],
        author: script.author,
        ...options,
      },
    };
  }

  // 获取脚本的值,可以通过@storageName让多个脚本共享一个储存空间
  @GMContext.API()
  public GM_getValue(key: string, defaultValue?: any) {
    const ret = this.scriptRes.value[key];
    if (ret) {
      return ret;
    }
    return defaultValue;
  }

  @GMContext.API()
  public GM_setValue(key: string, value: any) {
    // 对object的value进行一次转化
    if (typeof value === "object") {
      value = JSON.parse(JSON.stringify(value));
    }
    if (value === undefined) {
      delete this.scriptRes.value[key];
    } else {
      this.scriptRes.value[key] = value;
    }
    return this.sendMessage("GM_setValue", [key, value]);
  }

  @GMContext.API({ depend: ["GM_setValue"] })
  public GM_deleteValue(name: string): void {
    this.GM_setValue(name, undefined);
  }

  valueChangeId: number | undefined;

  @GMContext.API()
  public GM_addValueChangeListener(name: string, listener: GMTypes.ValueChangeListener): number {
    if (!this.valueChangeId) {
      this.valueChangeId = 1;
    } else {
      this.valueChangeId += 1;
    }
    this.valueChangeListener.set(this.valueChangeId, { name, listener });
    return this.valueChangeId;
  }

  @GMContext.API()
  public GM_removeValueChangeListener(listenerId: number): void {
    this.valueChangeListener.delete(listenerId);
  }

  @GMContext.API()
  public GM_listValues(): string[] {
    return Object.keys(this.scriptRes.value);
  }

  @GMContext.API()
  GM_log(message: string, level?: GMTypes.LoggerLevel, labels?: GMTypes.LoggerLabel) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    return this.sendMessage("GM_log", [message, level, labels]);
  }

  @GMContext.API()
  public CAT_createBlobUrl(blob: Blob): Promise<string> {
    return this.sendMessage("CAT_createBlobUrl", [blob]);
  }

  // 辅助GM_xml获取blob数据
  @GMContext.API()
  public CAT_fetchBlob(url: string): Promise<Blob> {
    return this.sendMessage("CAT_fetchBlob", [url]);
  }

  @GMContext.API()
  public async CAT_fetchDocument(url: string): Promise<Document | undefined> {
    const data = await this.sendMessage("CAT_fetchDocument", [url]);
    return (<CustomEventMessage>this.message).getAndDelRelatedTarget(data.relatedTarget);
  }

  menuId: number | undefined;

  menuMap: Map<number, string> | undefined;

  EE: EventEmitter = new EventEmitter();

  @GMContext.API()
  GM_registerMenuCommand(name: string, listener: () => void, accessKey?: string): number {
    if (!this.menuMap) {
      this.menuMap = new Map();
    }
    let flag = 0;
    this.menuMap.forEach((val, menuId) => {
      if (val === name) {
        flag = menuId;
      }
    });
    if (flag) {
      this.EE.addListener("menuClick" + flag, listener);
      return flag;
    }
    if (!this.menuId) {
      this.menuId = 1;
    } else {
      this.menuId += 1;
    }
    const id = this.menuId;
    this.menuMap.set(id, name);
    this.EE.addListener("menuClick" + id, listener);
    this.sendMessage("GM_registerMenuCommand", [id, name, accessKey]);
    return id;
  }

  @GMContext.API()
  GM_unregisterMenuCommand(id: number): void {
    if (!this.menuMap) {
      this.menuMap = new Map();
    }
    this.menuMap.delete(id);
    this.EE.removeAllListeners("menuClick" + id);
    this.sendMessage("GM_unregisterMenuCommand", [id]);
  }

  // 用于脚本跨域请求,需要@connect domain指定允许的域名
  @GMContext.API({
    depend: ["CAT_fetchBlob", "CAT_createBlobUrl", "CAT_fetchDocument"],
  })
  public GM_xmlhttpRequest(details: GMTypes.XHRDetails) {
    const u = new URL(details.url, window.location.href);
    if (details.headers) {
      Object.keys(details.headers).forEach((key) => {
        if (key.toLowerCase() === "cookie") {
          details.cookie = details.headers![key];
          delete details.headers![key];
        }
      });
    }

    const param: GMSend.XHRDetails = {
      method: details.method,
      timeout: details.timeout,
      url: u.href,
      headers: details.headers,
      cookie: details.cookie,
      context: details.context,
      responseType: details.responseType,
      overrideMimeType: details.overrideMimeType,
      anonymous: details.anonymous,
      user: details.user,
      password: details.password,
      maxRedirects: details.maxRedirects,
    };
    if (!param.headers) {
      param.headers = {};
    }
    if (details.nocache) {
      param.headers["Cache-Control"] = "no-cache";
    }
    let connect: MessageConnect;
    const handler = async () => {
      // 处理数据
      if (details.data instanceof FormData) {
        // 处理FormData
        param.dataType = "FormData";
        const data: Array<GMSend.XHRFormData> = [];
        const keys: { [key: string]: boolean } = {};
        details.data.forEach((val, key) => {
          keys[key] = true;
        });
        // 处理FormData中的数据
        await Promise.all(
          Object.keys(keys).map((key) => {
            const values = (<FormData>details.data).getAll(key);
            return Promise.all(
              values.map(async (val) => {
                if (val instanceof File) {
                  const url = await this.CAT_createBlobUrl(val);
                  data.push({
                    key,
                    type: "file",
                    val: url,
                    filename: val.name,
                  });
                } else {
                  data.push({
                    key,
                    type: "text",
                    val,
                  });
                }
              })
            );
          })
        );
        param.data = data;
      } else if (details.data instanceof Blob) {
        // 处理blob
        param.dataType = "Blob";
        param.data = await this.CAT_createBlobUrl(details.data);
      }

      // 处理返回数据
      let readerStream: ReadableStream<Uint8Array> | undefined;
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      // 如果返回类型是arraybuffer或者blob的情况下,需要将返回的数据转化为blob
      // 在background通过URL.createObjectURL转化为url,然后在content页读取url获取blob对象
      const responseType = details.responseType?.toLocaleLowerCase();
      const warpResponse = (old: (xhr: GMTypes.XHRResponse) => void) => {
        if (responseType === "stream") {
          readerStream = new ReadableStream<Uint8Array>({
            start(ctrl) {
              controller = ctrl;
            },
          });
        }
        return async (xhr: GMTypes.XHRResponse) => {
          if (xhr.response) {
            if (responseType === "document") {
              xhr.response = await this.CAT_fetchDocument(<string>xhr.response);
              xhr.responseXML = xhr.response;
              xhr.responseType = "document";
            } else {
              const resp = await this.CAT_fetchBlob(<string>xhr.response);
              if (responseType === "arraybuffer") {
                xhr.response = await resp.arrayBuffer();
              } else {
                xhr.response = resp;
              }
            }
          }
          if (responseType === "stream") {
            xhr.response = readerStream;
          }
          old(xhr);
        };
      };
      if (
        responseType === "arraybuffer" ||
        responseType === "blob" ||
        responseType === "document" ||
        responseType === "stream"
      ) {
        if (details.onload) {
          details.onload = warpResponse(details.onload);
        }
        if (details.onreadystatechange) {
          details.onreadystatechange = warpResponse(details.onreadystatechange);
        }
        if (details.onloadend) {
          details.onloadend = warpResponse(details.onloadend);
        }
        // document类型读取blob,然后在content页转化为document对象
        if (responseType === "document") {
          param.responseType = "blob";
        }
        if (responseType === "stream") {
          if (details.onloadstart) {
            details.onloadstart = warpResponse(details.onloadstart);
          }
        }
      }

      // 发送信息
      this.connect("GM_xmlhttpRequest", [param]).then((con) => {
        connect = con;
        con.onMessage((data: { action: string; data: any }) => {
          // 处理返回
          switch (data.action) {
            case "onload":
              details.onload?.(data.data);
              break;
            case "onloadend":
              details.onloadend?.(data.data);
              break;
            case "onloadstart":
              details.onloadstart?.(data.data);
              break;
            case "onprogress":
              details.onprogress?.(data.data);
              break;
            case "onreadystatechange":
              details.onreadystatechange && details.onreadystatechange(data.data);
              break;
            case "ontimeout":
              details.ontimeout?.();
              break;
            case "onerror":
              details.onerror?.("");
              break;
            case "onabort":
              details.onabort?.();
              break;
            case "onstream":
              controller?.enqueue(new Uint8Array(data.data));
              break;
            default:
              LoggerCore.logger().warn("GM_xmlhttpRequest resp is error", {
                action: data.action,
              });
              break;
          }
        });
      });
    };
    // 由于需要同步返回一个abort，但是一些操作是异步的，所以需要在这里处理
    handler();
    return {
      abort: () => {
        if (connect) {
          connect.disconnect();
        }
      },
    };
  }
}
