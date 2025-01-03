import { v4 as uuidv4 } from "uuid";

// 通过 window.postMessage/onmessage 实现通信

import EventEmitter from "eventemitter3";

// 消息体
export type WindowMessageBody = {
  messageId: string; // 消息id
  type: "sendMessage" | "respMessage" | "connect"; // 消息类型
  data: any; // 消息数据
};

export class WindowMessage {
  EE: EventEmitter = new EventEmitter();

  // source: Window 消息来源
  // target: Window 消息目标
  constructor(
    private source: Window,
    private target: Window
  ) {
    // 监听消息
    this.source.addEventListener("message", (e) => {
      if (e.source === this.target) {
        this.messageHandle(e.data);
      }
    });
  }

  messageHandle(data: WindowMessageBody) {
    // 处理消息
    if (data.type === "sendMessage") {
      // 接收到消息
      this.EE.emit("message", data.data, (resp: any) => {
        // 发送响应消息
        const body: WindowMessageBody = {
          messageId: data.messageId,
          type: "respMessage",
          data: resp,
        };
        this.target.postMessage(body, "*");
      });
    } else if (data.type === "respMessage") {
      // 接收到响应消息
      this.EE.emit("response:" + data.messageId, data);
    } else if (data.type === "connect") {
      this.EE.emit("connect", data.data, new WindowMessageConnect(data.messageId, this.EE, this.target));
    } else if (data.type === "disconnect") {
      this.EE.emit("disconnect", data.data, new WindowMessageConnect(data.messageId, this.EE, this.target));
    } else if (data.type === "connectMessage") {
      this.EE.emit("connectMessage", data.data, new WindowMessageConnect(data.messageId, this.EE, this.target));
    }
  }

  onConnect(callback: (data: any, con: WindowMessageConnect) => void) {
    this.EE.addListener("connect", callback);
  }

  connect(action: string, data?: any): Promise<WindowMessageConnect> {
    return new Promise((resolve) => {
      const body: WindowMessageBody = {
        messageId: uuidv4(),
        type: "connect",
        data: { action, data },
      };
      this.target.postMessage(body, "*");
      resolve(new WindowMessageConnect(body.messageId, this.EE, this.target));
    });
  }

  onMessage(callback: (data: any, sendResponse: (data: any) => void) => void) {
    this.EE.addListener("message", callback);
  }

  sendMessage(action: string, data?: any): Promise<any> {
    return new Promise((resolve) => {
      const body: WindowMessageBody = {
        messageId: uuidv4(),
        type: "sendMessage",
        data: { action, data },
      };
      const callback = (body: WindowMessageBody) => {
        this.EE.removeListener("response:" + body.messageId, callback);
        resolve(body.data);
      };
      this.EE.addListener("response:" + body.messageId, callback);
      this.target.postMessage(body, "*");
    });
  }
}

export class WindowMessageConnect {
  constructor(
    private messageId: string,
    private EE: EventEmitter,
    private target: Window
  ) {}
}
