import EventEmitter from "eventemitter3";
import { ApiFunction, Message, MessageConnect, Server } from "./server";

export type SubscribeCallback = (message: any) => void;

export class Broker {
  constructor(private msg: Message) {}

  // 订阅
  async subscribe(topic: string, handler: SubscribeCallback): Promise<MessageConnect> {
    const con = await this.msg.connect({ action: "messageQueue", data: { action: "subscribe", topic } });
    con.onMessage((msg: { action: string; topic: string; message: any }) => {
      if (msg.action === "message") {
        handler(msg.message);
      }
    });
    return con;
  }

  // 发布
  publish(topic: string, message: any) {
    chrome.runtime.sendMessage({ action: "publish", topic, message });
  }
}

// 消息队列
export class MessageQueue {
  topicConMap: Map<string, { name: string; con: MessageConnect }[]> = new Map();

  private EE: EventEmitter = new EventEmitter();

  constructor(api: Server) {
    api.on("messageQueue", this.handler());
  }

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
          this.subscribe(topic, con as MessageConnect);
          break;
        case "publish":
          this.publish(topic, message);
          break;
        default:
          throw new Error("action not found");
      }
    };
  }

  private subscribe(topic: string, con: MessageConnect) {
    let list = this.topicConMap.get(topic);
    if (!list) {
      list = [];
      this.topicConMap.set(topic, list);
    }
    list.push({ name: topic, con });
    con.onDisconnect(() => {
      let list = this.topicConMap.get(topic);
      // 移除断开连接的con
      list = list!.filter((item) => item.con !== con);
      this.topicConMap.set(topic, list);
    });
  }

  publish(topic: string, message: any) {
    const list = this.topicConMap.get(topic);
    list?.forEach((item) => {
      item.con.sendMessage({ action: "message", topic, message });
    });
    this.EE.emit(topic, message);
  }

  // 只发布给当前环境
  emit(topic: string, message: any) {
    this.EE.emit(topic, message);
  }

  // 同环境下使用addListener
  addListener(topic: string, handler: (message: any) => void) {
    this.EE.on(topic, handler);
  }
}
