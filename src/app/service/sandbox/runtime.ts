import LoggerCore from "@App/app/logger/core";
import Logger from "@App/app/logger/logger";
import { Script, SCRIPT_TYPE_BACKGROUND, ScriptRunResouce } from "@App/app/repo/scripts";
import ExecScript from "@App/runtime/content/exec_script";
import { Server } from "@Packages/message/server";
import { WindowMessage } from "@Packages/message/window_message";
import { CronJob } from "cron";

export class Runtime {
  cronJob: Map<string, Array<CronJob>> = new Map();

  execScripts: Map<string, ExecScript> = new Map();

  logger: Logger;

  retryList: {
    script: ScriptRunResouce;
    retryTime: number;
  }[] = [];

  constructor(
    private windowMessage: WindowMessage,
    private api: Server
  ) {
    this.logger = LoggerCore.getInstance().logger({ component: "sandbox" });
    // 重试队列,5s检查一次
    setInterval(() => {
      if (!this.retryList.length) {
        return;
      }
      const now = Date.now();
      const retryList = [];
      for (let i = 0; i < this.retryList.length; i += 1) {
        const item = this.retryList[i];
        if (item.retryTime < now) {
          this.retryList.splice(i, 1);
          i -= 1;
          retryList.push(item.script);
        }
      }
      retryList.forEach((script) => {
        script.nextruntime = 0;
        this.execScript(script);
      });
    }, 5000);
  }

  joinRetryList(script: ScriptRunResouce) {
    if (script.nextruntime) {
      this.retryList.push({
        script,
        retryTime: script.nextruntime,
      });
      this.retryList.sort((a, b) => a.retryTime - b.retryTime);
    }
  }

  removeRetryList(scriptId: number) {
    for (let i = 0; i < this.retryList.length; i += 1) {
      if (this.retryList[i].script.id === scriptId) {
        this.retryList.splice(i, 1);
        i -= 1;
      }
    }
  }

  enableScript(data: Script) {
    // 开启脚本, 判断脚本是后台脚本还是定时脚本
    if (data.type === SCRIPT_TYPE_BACKGROUND) {
      // 后台脚本直接运行起来
    } else {
      // 定时脚本加入定时任务
    }
    eval("console.log('hello')");
    console.log("enableScript", data);
  }

  disableScript(data: Script) {
    // 关闭脚本, 判断脚本是后台脚本还是定时脚本
    if (data.type === SCRIPT_TYPE_BACKGROUND) {
      // 后台脚本直接停止
    } else {
      // 定时脚本停止定时任务
    }
    console.log("disableScript", data);
  }

  init() {
    this.api.on("enableScript", this.enableScript.bind(this));
    this.api.on("disableScript", this.disableScript.bind(this));
  }
}
