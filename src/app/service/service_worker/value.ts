import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script } from "@App/app/repo/scripts";
import { ValueDAO } from "@App/app/repo/value";
import { MessageQueue } from "@Packages/message/message_queue";
import { Group } from "@Packages/message/server";

export class ValueService {
  logger: Logger;
  valueDAO: ValueDAO = new ValueDAO();

  constructor(
    private group: Group,
    private mq: MessageQueue
  ) {
    this.logger = LoggerCore.logger().with({ service: "value" });
  }

  storageKey(script: Script): string {
    if (script.metadata.storagename) {
      return script.metadata.storagename[0];
    }
    return script.uuid;
  }

  async getScriptValue(script: Script) {
    const ret = await this.valueDAO.get(this.storageKey(script));
    if (!ret) {
      return {};
    }
    return Promise.resolve(ret?.data);
  }

  init() {
    this.group.on("getScriptValue", this.getScriptValue.bind(this));
  }
}
