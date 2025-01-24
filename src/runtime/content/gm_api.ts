import { ScriptRunResouce } from "@App/app/repo/scripts";
import { getMetadataStr, getUserConfigStr, parseUserConfig } from "@App/pkg/utils/script";
import { v4 as uuidv4 } from "uuid";
import { ValueUpdateData } from "./exec_script";
import { ExtVersion } from "@App/app/const";

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

  // 单次回调使用
  public sendMessage(api: string, params: any[]) {
    return null;
  }

  // 长连接使用,connect只用于接受消息,不能发送消息
  public connect(api: string, params: any[]) {
    return null;
  }

  public valueUpdate(data: ValueUpdateData) {
    const { storagename } = this.scriptRes.metadata;
    if (
      data.value.uuid === this.scriptRes.uuid ||
      (storagename && data.value.storageName && storagename[0] === data.value.storageName)
    ) {
      // 触发,并更新值
      if (data.value.value === undefined) {
        delete this.scriptRes.value[data.value.key];
      } else {
        this.scriptRes.value[data.value.key] = data.value;
      }
      this.valueChangeListener.forEach((item) => {
        if (item.name === data.value.key) {
          item.listener(
            data.value.key,
            data.oldValue,
            data.value.value,
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
}
