/* eslint-disable @typescript-eslint/no-explicit-any */
import EventEmitter from "eventemitter3";
import { v4 as uuidv4 } from "uuid";

export interface IServer {
  onConnect: (callback: (con: IConnect) => void) => void;
}

export interface IConnect {
  postMessage: (message: unknown) => void;
  onMessage: (callback: (message: unknown) => void) => void;
  onDisconnect: (callback: () => void) => void;
  disconnect: () => void;
}

// 消息通道, 通过连接封装消息通道
export class Server {
  private EE: EventEmitter;

  constructor(private connect: IServer) {
    this.EE = new EventEmitter();
    this.connect.onConnect((con) => {
      this.EE.emit("connection", con);
    });
  }

  on(eventName: "connection", callback: (con: IConnect) => void): void;
  on(eventName: string, callback: (con: IConnect) => void) {
    this.EE.on(eventName, callback);
  }
}

export class Connect {
  private EE: EventEmitter;

  constructor(private con: IConnect) {
    this.EE = new EventEmitter();
    this.con.onMessage((message) => {
      this.messageHandler(message);
    });
    this.con.onDisconnect(() => {
      this.EE.emit("disconnect");
      this.EE.removeAllListeners();
    });
  }

  private callbackFunc(msgId: string): (...data: unknown[]) => void {
    return (...data: unknown[]) => {
      this.con.postMessage({ eventName: "callback", data, messageId: msgId });
    };
  }

  private messageHandler(data: unknown) {
    const subData = data as { eventName: string; data: unknown[]; messageId: string; conType: string; id: string };
    if (subData.eventName === "callback") {
      this.EE.emit(subData.eventName + subData.messageId, ...subData.data);
      return;
    }
    subData.data.push(this.callbackFunc(subData.messageId));
    this.EE.emit(subData.eventName, ...subData.data);
  }

  on(eventName: string, callback: (...args: any[]) => void) {
    this.EE.on(eventName, callback);
  }

  send(eventName: string, ...data: unknown[]) {
    this.con.postMessage({ eventName, data });
  }

  emit(eventName: string, ...data: any[]) {
    // 判断最后一个参数是否为函数
    const callback = data.pop();
    const messageId = uuidv4();
    if (typeof callback !== "function") {
      data.push(callback);
    } else {
      this.EE.on("callback" + messageId, (...args) => {
        callback(...args);
      });
    }
    const sendData = { eventName, data, messageId };
    this.con.postMessage(sendData);
  }
}
