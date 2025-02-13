import { Message, MessageConnect, MessageSend } from "./server";

export class ExtensionMessageSend implements MessageSend {
  constructor() {}

  connect(data: any): Promise<MessageConnect> {
    return new Promise((resolve) => {
      const con = chrome.runtime.connect();
      con.postMessage(data);
      resolve(new ExtensionMessageConnect(con));
    });
  }

  // 发送消息 注意不进行回调的内存泄漏
  sendMessage(data: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(data, (resp) => {
        resolve(resp);
      });
    });
  }
}

export class ExtensionMessage extends ExtensionMessageSend implements Message {
  onConnect(callback: (data: any, con: MessageConnect) => void) {
    chrome.runtime.onConnect.addListener((port) => {
      const handler = (msg: any) => {
        port.onMessage.removeListener(handler);
        callback(msg, new ExtensionMessageConnect(port));
      };
      port.onMessage.addListener(handler);
    });
  }

  // 注意chrome.runtime.onMessage.addListener的回调函数需要返回true才能处理异步请求
  onMessage(callback: (data: any, sendResponse: (data: any) => void) => void) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      return callback(msg, sendResponse);
    });
  }
}

export class ExtensionMessageConnect implements MessageConnect {
  constructor(private con: chrome.runtime.Port) {}

  sendMessage(data: any) {
    this.con.postMessage(data);
  }

  onMessage(callback: (data: any) => void) {
    this.con.onMessage.addListener(callback);
  }

  disconnect() {
    this.con.disconnect();
  }

  onDisconnect(callback: () => void) {
    this.con.onDisconnect.addListener(callback);
  }
}
