import { ScriptRunResouce } from "@App/app/repo/scripts";
import { getMetadataStr, getUserConfigStr, parseUserConfig } from "@App/pkg/utils/script";
import { ValueUpdateData } from "./exec_script";
import { ExtVersion } from "@App/app/const";
import { storageKey } from "../utils";
import { Message, MessageConnect } from "@Packages/message/server";

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
    return this.message.sendMessage({
      action: this.prefix + "/runtime/gmApi",
      data: {
        uuid: this.scriptRes.uuid,
        api,
        params,
      },
    });
  }

  // 长连接使用,connect只用于接受消息,不发送消息
  public connect(api: string, params: any[]) {
    return this.message.connect({
      action: this.prefix + "/runtime/gmApi",
      data: {
        uuid: this.scriptRes.uuid,
        api,
        params,
      },
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

  @GMContext.API()
  GM_log(message: string, level?: GMTypes.LoggerLevel, labels?: GMTypes.LoggerLabel) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    return this.sendMessage("GM_log", [message, level, labels]);
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
            // controller?.enqueue(new Uint8Array(resp.data));
            break;
        }
      });
    });

    return {
      abort: () => {
        if (connect) {
          connect.disconnect();
        }
      },
    };
  }
}
