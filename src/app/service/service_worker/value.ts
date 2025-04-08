import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, SCRIPT_TYPE_NORMAL, ScriptDAO } from "@App/app/repo/scripts";
import { ValueDAO } from "@App/app/repo/value";
import { storageKey } from "@App/runtime/utils";
import { Group, MessageSend } from "@Packages/message/server";
import { RuntimeService } from "./runtime";
import { PopupService } from "./popup";
import { ValueUpdateData } from "@App/runtime/content/exec_script";
import { sendMessage } from "@Packages/message/client";

export class ValueService {
  logger: Logger;
  scriptDAO: ScriptDAO = new ScriptDAO();
  valueDAO: ValueDAO = new ValueDAO();
  private popup: PopupService | undefined;
  private runtime: RuntimeService | undefined;

  constructor(
    private group: Group,
    private send: MessageSend
  ) {
    this.logger = LoggerCore.logger().with({ service: "value" });
  }

  async getScriptValue(script: Script) {
    const ret = await this.valueDAO.get(storageKey(script));
    if (!ret) {
      return {};
    }
    return ret.data;
  }

  async setValue(uuid: string, key: string, value: any, sender?: any): Promise<boolean> {
    // 查询出脚本
    const script = await this.scriptDAO.get(uuid);
    if (!script) {
      return Promise.reject(new Error("script not found"));
    }
    // 查询老的值
    const storageName = storageKey(script);
    const valueModel = await this.valueDAO.get(storageName);
    let oldValue;
    if (!valueModel) {
      this.valueDAO.save(storageName, {
        uuid: script.uuid,
        storageName: storageName,
        data: { [key]: value },
        createtime: Date.now(),
        updatetime: Date.now(),
      });
    } else {
      oldValue = valueModel.data[key];
      valueModel.data[key] = value;
      this.valueDAO.save(storageName, valueModel);
    }
    const sendData: ValueUpdateData = {
      oldValue,
      sender,
      value,
      key,
      uuid,
      storageKey: storageName,
    };
    // 判断是后台脚本还是前台脚本
    console.log("value update", script, sendData);
    if (script.type === SCRIPT_TYPE_NORMAL) {
      chrome.tabs.query({}, (tabs) => {
        // 推送到所有加载了本脚本的tab中
        tabs.forEach(async (tab) => {
          const scriptMenu = await this.popup!.getScriptMenu(tab.id!);
          if (scriptMenu.find((item) => item.storageName === storageName)) {
            this.runtime!.sendMessageToTab(tab.id!, "valueUpdate", sendData);
          }
        });
      });
    } else {
      // 推送到offscreen中
      sendMessage(this.send, "offscreen/runtime/valueUpdate", sendData);
    }

    return Promise.resolve(true);
  }

  init(runtime: RuntimeService, popup: PopupService) {
    this.popup = popup;
    this.runtime = runtime;
    this.group.on("getScriptValue", this.getScriptValue.bind(this));
  }
}
