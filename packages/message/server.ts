import LoggerCore from "@App/app/logger/core";
import { ExtensionMessageSend } from "./extension_message";

export interface Message extends MessageSend {
  onConnect(callback: (data: any, con: MessageConnect) => void): void;
  onMessage(callback: (data: any, sendResponse: (data: any) => void) => void): void;
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

export type MessageSender = {
  tabId: number;
};

export type ApiFunction = (params: any, con: MessageConnect | null) => Promise<any> | void;

export class Server {
  private apiFunctionMap: Map<string, ApiFunction> = new Map();

  constructor(
    private env: string,
    message: Message
  ) {
    message.onConnect((msg: any, con: MessageConnect) => {
      if (msg.serverEnv !== this.env) {
        con.disconnect();
        return;
      }
      this.connectHandle(msg.action, msg.data, con);
    });

    message.onMessage((msg, sendResponse) => {
      if (msg.serverEnv !== this.env) {
        return;
      }
      return this.messageHandle(msg.action, msg.data, sendResponse);
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
      func(params, con);
    }
  }

  private messageHandle(msg: string, params: any, sendResponse: (response: any) => void) {
    const logger = LoggerCore.getInstance().logger({ env: this.env, msg });
    logger.trace("messageHandle", { params });
    const func = this.apiFunctionMap.get(msg);
    if (func) {
      try {
        const ret = func(params, null);
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
      logger.error("no such api");
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
export function forwardMessage(path: string, from: Server, to: MessageSend) {
  from.on(path, (params, fromCon) => {
    if (fromCon) {
      to.connect({ action: path, data: params }).then((toCon) => {
        fromCon.onMessage((data) => {
          toCon.sendMessage(data);
        });
        toCon.onMessage((data) => {
          fromCon.sendMessage(data);
        });
        fromCon.onDisconnect(() => {
          toCon.disconnect();
        });
        toCon.onDisconnect(() => {
          fromCon.disconnect();
        });
      });
    } else {
      return to.sendMessage({ action: path, data: params });
    }
  });
}
