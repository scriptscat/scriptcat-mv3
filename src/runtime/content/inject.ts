import { ScriptRunResouce } from "@App/app/repo/scripts";
import { Message } from "@Packages/message/server";
import ExecScript from "./exec_script";
import { addStyle, ScriptFunc } from "./utils";

export class InjectRuntime {
  execList: ExecScript[] = [];

  constructor(
    private msg: Message,
    private scripts: ScriptRunResouce[]
  ) {}

  start() {
    this.scripts.forEach((script) => {
      // @ts-ignore
      const scriptFunc = window[script.flag];
      if (scriptFunc) {
        this.execScript(script, scriptFunc);
      } else {
        // 监听脚本加载,和屏蔽读取
        Object.defineProperty(window, script.flag, {
          configurable: true,
          set: (val: ScriptFunc) => {
            this.execScript(script, val);
          },
        });
      }
    });
  }

  execScript(script: ScriptRunResouce, scriptFunc: ScriptFunc) {
    // @ts-ignore
    delete window[script.flag];
    const exec = new ExecScript(script, this.msg, scriptFunc);
    this.execList.push(exec);
    // 注入css
    if (script.metadata["require-css"]) {
      script.metadata["require-css"].forEach((val) => {
        const res = script.resource[val];
        if (res) {
          addStyle(res.content);
        }
      });
    }
    exec.exec();
  }
}
