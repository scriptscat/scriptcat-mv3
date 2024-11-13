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

  on(eventName: string, callback: (con: IConnect) => void) {
    this.EE.on(eventName, callback);
  }
}

export class Connect {
  private EE: EventEmitter;

  private con: IConnect;

  constructor(
    private id: string | IConnect,
    con?: IConnect
  ) {
    this.EE = new EventEmitter();
    if (arguments.length === 1) {
      this.con = id as IConnect;
      this.con.onMessage((message) => {
        this.messageHandler(message);
      });
    } else {
      // 子连接
      this.con = con!;
      this.con.onMessage((message) => {
        const data = message as { eventName: string; data: unknown; id: string };
        if (data.eventName === "subcon") {
          if (data.id !== this.id) return;
          this.messageHandler(data.data);
        }
      });
    }
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
    const subData = data as { eventName: string; data: unknown[]; messageId: string };
    subData.data.push(this.callbackFunc(subData.messageId));
    this.EE.emit(subData.eventName, ...subData.data);
  }

  on(eventName: string, callback: (message: unknown) => void) {
    this.EE.on(eventName, callback);
  }

  send(eventName: string, ...data: unknown[]) {
    this.con.postMessage({ eventName, data });
  }

  emit(eventName: string, ...data: unknown[]) {
    // 判断最后一个参数是否为函数
    const callback = data.pop();
    if (typeof callback !== "function") {
      data.push(callback);
    }
    this.con.postMessage({ eventName, data, messageId: uuidv4() });
  }

  // 子连接
  connect() {
    return new Connect(uuidv4(), this.con);
  }
}
