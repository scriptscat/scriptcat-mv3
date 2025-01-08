import { Server } from "@Packages/message/server";
import { WindowMessage } from "@Packages/message/window_message";
import { preparationSandbox } from "../offscreen/client";
import { Script, SCRIPT_TYPE_BACKGROUND } from "@App/app/repo/scripts";

// sandbox环境的管理器
export class SandboxManager {
  api: Server = new Server("sandbox", this.windowMessage);

  constructor(private windowMessage: WindowMessage) {}

  enableScript(data: Script) {
    // 开启脚本, 判断脚本是后台脚本还是定时脚本
    if(data.type === SCRIPT_TYPE_BACKGROUND) {
      // 后台脚本直接运行起来
    }else{
      // 定时脚本加入定时任务
    }
    eval("console.log('hello')");
    console.log("enableScript", data);
  }

  initManager() {
    this.api.on("enableScript", this.enableScript.bind(this));

    // 通知初始化好环境了
    preparationSandbox(this.windowMessage);
  }
}
