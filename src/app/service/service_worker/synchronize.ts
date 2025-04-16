import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { ScriptDAO } from "@App/app/repo/scripts";
import { Group } from "@Packages/message/server";

export class SynchronizeService {
  logger: Logger;

  scriptDAO = new ScriptDAO();

  constructor(private group: Group) {
    this.logger = LoggerCore.logger().with({ service: "synchronize" });
  }

  init() {}
}
