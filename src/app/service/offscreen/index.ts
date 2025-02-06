import { forwardMessage, Server } from "@Packages/message/server";
import { ScriptService } from "./script";
import { Broker } from "@Packages/message/message_queue";
import { Logger, LoggerDAO } from "@App/app/repo/logger";
import { WindowMessage } from "@Packages/message/window_message";
import { ExtensionMessageSend } from "@Packages/message/extension_message";
import { ServiceWorkerClient } from "../service_worker/client";
import { sendMessage } from "@Packages/message/client";

// offscreen环境的管理器
export class OffscreenManager {
  private extensionMessage = new ExtensionMessageSend();

  private windowMessage = new WindowMessage(window, sandbox);

  private windowApi: Server = new Server("offscreen-window", this.windowMessage);

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

  async initManager() {
    // 监听消息
    this.windowApi.on("logger", this.logger.bind(this));
    this.windowApi.on("preparationSandbox", this.preparationSandbox.bind(this));
    this.windowApi.on("sendMessageToServiceWorker", this.sendMessageToServiceWorker.bind(this));
    const script = new ScriptService(this.extensionMessage, this.windowMessage, this.broker);
    script.init();
    // 转发gm api请求
    forwardMessage("serviceWorker/runtime/gmApi", this.windowApi, this.extensionMessage);

    // // 处理gm xhr请求
    // this.api.on("gmXhr", (data) => {
    //   console.log("123");
    // });
    // // 测试xhr
    // const ret = await sendMessage(this.extensionMessage, "serviceWorker/testGmApi");
    // console.log("test xhr", ret);
    // const xhr = new XMLHttpRequest();
    // xhr.onload = () => {
    //   console.log(xhr);
    // };
    // xhr.open("GET", "https://scriptcat.org/zh-CN");

    // xhr.send();
  }
}
