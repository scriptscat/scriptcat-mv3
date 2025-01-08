import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";
import { ScriptService } from "./script";
import { ExtensionMessage } from "@Packages/message/extension_message";

export type InstallSource = "user" | "system" | "sync" | "subscribe" | "vscode";

// service worker的管理器
export default class ServiceWorkerManager {
  constructor() {}

  private api: Server = new Server("service_worker", new ExtensionMessage());

  private mq: MessageQueue = new MessageQueue(this.api);

  initManager() {
    const group = this.api.group("serviceWorker");
    group.on("preparationOffscreen", () => {
      // 准备好环境
      this.mq.emit("preparationOffscreen", {});
    });
    const script = new ScriptService(group.group("script"), this.mq);
    script.init();
  }
}
