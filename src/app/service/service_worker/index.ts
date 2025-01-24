import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";
import { ScriptService } from "./script";
import { ExtensionMessage } from "@Packages/message/extension_message";
import { ResourceService } from "./resource";
import { ValueService } from "./value";
import { RuntimeService } from "./runtime";

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

    const resource = new ResourceService(group.group("resource"), this.mq);
    resource.init();
    const value = new ValueService(group.group("value"), this.mq);
    value.init();
    const script = new ScriptService(group.group("script"), this.mq, value, resource);
    script.init();
    const runtime = new RuntimeService(group.group("runtime"), this.mq);
    runtime.init();
  }
}
