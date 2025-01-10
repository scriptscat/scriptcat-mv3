import { Server } from "@Packages/message/server";
import { WindowMessage } from "@Packages/message/window_message";
import { preparationSandbox } from "../offscreen/client";
import { Script, SCRIPT_TYPE_BACKGROUND } from "@App/app/repo/scripts";
import { CronJob } from "cron";
import ExecScript from "@App/runtime/content/exec_script";
import { Runtime } from "./runtime";

// sandbox环境的管理器
export class SandboxManager {
  api: Server = new Server("sandbox", this.windowMessage);

  constructor(private windowMessage: WindowMessage) {}

  initManager() {
    const runtime = new Runtime(this.windowMessage, this.api);
    runtime.init();
    // 通知初始化好环境了
    preparationSandbox(this.windowMessage);
  }
}
