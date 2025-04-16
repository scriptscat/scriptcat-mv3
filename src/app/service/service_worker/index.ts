import { Server } from "@Packages/message/server";
import { MessageQueue } from "@Packages/message/message_queue";
import { ScriptService } from "./script";
import { ResourceService } from "./resource";
import { ValueService } from "./value";
import { RuntimeService } from "./runtime";
import { ServiceWorkerMessageSend } from "@Packages/message/window_message";
import { PopupService } from "./popup";
import { SystemConfig } from "@App/pkg/config/config";
import { SynchronizeService } from "./synchronize";

export type InstallSource = "user" | "system" | "sync" | "subscribe" | "vscode";

// service worker的管理器
export default class ServiceWorkerManager {
  constructor(
    private api: Server,
    private mq: MessageQueue,
    private sender: ServiceWorkerMessageSend
  ) {}

  async initManager() {
    this.api.on("preparationOffscreen", async () => {
      // 准备好环境
      await this.sender.init();
      this.mq.emit("preparationOffscreen", {});
    });
    this.sender.init();

    const systemConfig = new SystemConfig(this.mq);

    const resource = new ResourceService(this.api.group("resource"), this.mq);
    resource.init();
    const value = new ValueService(this.api.group("value"), this.sender);
    const script = new ScriptService(systemConfig, this.api.group("script"), this.mq, value, resource);
    script.init();
    const runtime = new RuntimeService(systemConfig, this.api.group("runtime"), this.sender, this.mq, value, script);
    runtime.init();
    const popup = new PopupService(this.api.group("popup"), this.mq, runtime);
    popup.init();
    value.init(runtime, popup);
    const synchronize = new SynchronizeService(this.sender, this.api.group("synchronize"), value, resource);
    synchronize.init();

    // 定时器处理
    chrome.alarms.onAlarm.addListener((alarm) => {
      switch (alarm.name) {
        case "checkScriptUpdate":
          script.checkScriptUpdate();
          break;
      }
    });
  }
}
