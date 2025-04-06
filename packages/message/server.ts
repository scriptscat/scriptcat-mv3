import LoggerCore from "@App/app/logger/core";

export interface Message extends MessageSend {
  onConnect(callback: (data: any, con: MessageConnect) => void): void;
  onMessage(callback: (data: any, sendResponse: (data: any) => void, sender?: MessageSender) => void): void;
}

export interface MessageSend {
  connect(data: any): Promise<MessageConnect>;
  sendMessage(data: any): Promise<any>;
}

export interface MessageConnect {
  onMessage(callback: (data: any) => void): void;
  sendMessage(data: any): void;
  disconnect(): void;
  onDisconnect(callback: () => void): void;
}

export type MessageSender = any;

export class GetSender {
  constructor(private sender: MessageConnect | MessageSender) {}

  getSender(): MessageSender {
    return this.sender as MessageSender;
  }

  getConnect(): MessageConnect {
    return this.sender as MessageConnect;
  }
}

export type ApiFunction = (params: any, con: GetSender) => Promise<any> | void;

export class Server {
  private apiFunctionMap: Map<string, ApiFunction> = new Map();

  private logger = LoggerCore.getInstance().logger({ service: "messageServer" });

  constructor(prefix: string, message: Message) {
    message.onConnect((msg: any, con: MessageConnect) => {
      this.logger.trace("server onConnect", { msg });
      if (msg.action.startsWith(prefix)) {
        return this.connectHandle(msg.action.slice(prefix.length + 1), msg.data, con);
      }
      return false;
    });

    message.onMessage((msg: { action: string; data: any }, sendResponse, sender) => {
      this.logger.trace("server onMessage", { msg: msg as any });
      if (msg.action.startsWith(prefix)) {
        return this.messageHandle(msg.action.slice(prefix.length + 1), msg.data, sendResponse, sender);
      }
      return false;
    });
  }

  group(name: string) {
    return new Group(this, name);
  }

  on(name: string, func: ApiFunction) {
    this.apiFunctionMap.set(name, func);
  }

  private connectHandle(msg: string, params: any, con: MessageConnect) {
    const func = this.apiFunctionMap.get(msg);
    if (func) {
      func(params, new GetSender(con));
    }
  }

  private messageHandle(msg: string, params: any, sendResponse: (response: any) => void, sender?: MessageSender) {
    const func = this.apiFunctionMap.get(msg);
    if (func) {
      try {
        const ret = func(params, new GetSender(sender!));
        if (ret instanceof Promise) {
          ret.then((data) => {
            sendResponse({ code: 0, data });
          });
          return true;
        } else {
          sendResponse({ code: 0, data: ret });
        }
      } catch (e: any) {
        sendResponse({ code: -1, message: e.message });
      }
    } else {
      sendResponse({ code: -1, message: "no such api" });
      this.logger.error("no such api", { msg });
    }
  }
}

export class Group {
  constructor(
    private server: Server,
    private name: string
  ) {
    if (!name.endsWith("/")) {
      this.name += "/";
    }
  }

  group(name: string) {
    return new Group(this.server, `${this.name}${name}`);
  }

  on(name: string, func: ApiFunction) {
    this.server.on(`${this.name}${name}`, func);
  }
}

// 转发消息
export function forwardMessage(prefix: string, path: string, from: Server, to: MessageSend, middleware?: ApiFunction) {
  from.on(path, async (params, fromCon) => {
    console.log("forwardMessage", path, prefix, params);
    if (middleware) {
      const resp = await middleware(params, new GetSender(fromCon));
      if (resp !== false) {
        return resp;
      }
    }
    if (fromCon) {
      const fromConnect = fromCon.getConnect();
      to.connect({ action: prefix + "/" + path, data: params }).then((toCon) => {
        fromConnect.onMessage((data) => {
          toCon.sendMessage(data);
        });
        toCon.onMessage((data) => {
          fromConnect.sendMessage(data);
        });
        fromConnect.onDisconnect(() => {
          toCon.disconnect();
        });
        toCon.onDisconnect(() => {
          fromConnect.disconnect();
        });
      });
    } else {
      return to.sendMessage({ action: prefix + "/" + path, data: params });
    }
  });
}
