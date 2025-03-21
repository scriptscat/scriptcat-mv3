import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, ScriptDAO } from "@App/app/repo/scripts";
import { ValueDAO } from "@App/app/repo/value";
import { storageKey } from "@App/runtime/utils";
import { Group } from "@Packages/message/server";

export class ValueService {
  logger: Logger;
  scriptDAO: ScriptDAO = new ScriptDAO();
  valueDAO: ValueDAO = new ValueDAO();

  constructor(private group: Group) {
    this.logger = LoggerCore.logger().with({ service: "value" });
  }

  async getScriptValue(script: Script) {
    const ret = await this.valueDAO.get(storageKey(script));
    if (!ret) {
      return {};
    }
    return Promise.resolve(ret?.data);
  }

  async setValue(uuid: string, key: string, value: any): Promise<boolean> {
    // 查询出脚本
    const script = await this.scriptDAO.get(uuid);
    if (!script) {
      return Promise.reject(new Error("script not found"));
    }
    // 查询老的值
    const oldValue = await this.valueDAO.get(storageKey(script));
    if (!oldValue) {
      this.valueDAO.save(storageKey(script), {
        uuid: script.uuid,
        storageName: storageKey(script),
        data: { [key]: value },
        createtime: Date.now(),
        updatetime: Date.now(),
      });
    } else {
      oldValue.data[key] = value;
      this.valueDAO.save(storageKey(script), oldValue);
    }
    return Promise.resolve(true);
  }

  init() {
    this.group.on("getScriptValue", this.getScriptValue.bind(this));
  }
}
