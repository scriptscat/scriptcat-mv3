import { ApiFunction } from "./server";

export class Broker {
  constructor() {}

  // 订阅
  subscribe(topic: string, handler: (message: any) => void) {
    const con = chrome.runtime.connect({ name: topic });
    con.postMessage({ action: "subscribe", topic });
    con.onMessage.addListener((msg: { action: string; topic: string; message: any }) => {
      if (msg.action === "message") {
        handler(msg.message);
      }
    });
  }

  // 发布
  publish(topic: string, message: any) {
    chrome.runtime.sendMessage({ action: "publish", topic, message });
  }
}

// 消息队列
export class MessageQueue {
  topicConMap: Map<string, { name: string; con: chrome.runtime.Port }[]> = new Map();

  handler(): ApiFunction {
    return ({ action, topic, message }: { action: string; topic: string; message: any }, con) => {
      if (!con) {
        throw new Error("con is required");
      }
      if (!topic) {
        throw new Error("topic is required");
      }
      switch (action) {
        case "subscribe":
          this.subscribe(topic, con as chrome.runtime.Port);
          break;
        case "publish":
          this.publish(topic, message);
          break;
        default:
          throw new Error("action not found");
      }
    };
  }

  private subscribe(topic: string, con: chrome.runtime.Port) {
    let list = this.topicConMap.get(topic);
    if (!list) {
      list = [];
      this.topicConMap.set(topic, list);
    }
    list.push({ name: topic, con });
    con.onDisconnect.addListener(() => {
      list = list!.filter((item) => item.con !== con);
    });
  }

  publish(topic: string, message: any) {
    const list = this.topicConMap.get(topic);
    list?.forEach((item) => {
      item.con.postMessage({ action: "message", topic, message });
    });
  }
}
