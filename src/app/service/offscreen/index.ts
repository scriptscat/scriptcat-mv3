import { Server } from "@Packages/message/server";
import { ScriptService } from "./script";
import { MessageQueue } from "@Packages/message/message_queue";

// offscreen环境的管理器
export class OffscreenManager {
  private api: Server = new Server("offscreen");

  private mq: MessageQueue = new MessageQueue(this.api);

  initManager() {
    // 监听消息
    const group = this.api.group("serviceWorker");
    const script = new ScriptService(group.group("script"), this.mq);
    script.init();
  }
}
