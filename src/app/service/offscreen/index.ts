import { forwardMessage, Server } from "@Packages/message/server";
import { ScriptService } from "./script";
import { Broker, MessageQueue } from "@Packages/message/message_queue";
import { Logger, LoggerDAO } from "@App/app/repo/logger";
import { WindowMessage } from "@Packages/message/window_message";
import { ExtensionMessage } from "@Packages/message/extension_message";
import { ServiceWorkerClient } from "../service_worker/client";
import { sendMessage } from "@Packages/message/client";

// offscreen环境的管理器
export class OffscreenManager {
  private extensionMessage = new ExtensionMessage();

  private api: Server = new Server("offscreen", this.extensionMessage);

  private windowMessage = new WindowMessage(window, sandbox);

  private windowApi: Server = new Server("offscreen-window", this.windowMessage);

  private mq: MessageQueue = new MessageQueue(this.api);

  private broker: Broker = new Broker(this.extensionMessage);

  private serviceWorker = new ServiceWorkerClient(this.extensionMessage);

  logger(data: Logger) {
    const dao = new LoggerDAO();
    dao.save(data);
  }

  preparationSandbox() {
    // 通知初始化好环境了
    this.serviceWorker.preparationOffscreen();
  }

  sendMessageToServiceWorker(data: { action: string; data: any }) {
    return sendMessage(this.extensionMessage, data.action, data.data);
  }

  initManager() {
    // 监听消息
    const group = this.api.group("offscreen");
    this.windowApi.on("logger", this.logger.bind(this));
    this.windowApi.on("preparationSandbox", this.preparationSandbox.bind(this));
    this.windowApi.on("sendMessageToServiceWorker", this.sendMessageToServiceWorker.bind(this));
    const script = new ScriptService(
      group.group("script"),
      this.mq,
      this.extensionMessage,
      this.windowMessage,
      this.broker
    );
    script.init();
    // 转发gm api请求
    forwardMessage("serviceWorker/runtime/gmApi", this.windowApi, this.extensionMessage);
  }
}
