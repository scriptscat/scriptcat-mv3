import LoggerCore from "@App/app/logger/core";
import { MessageConnect, MessageSend } from "./server";

export async function sendMessage(msg: MessageSend, action: string, data?: any): Promise<any> {
  const res = await msg.sendMessage({ action, data });
  LoggerCore.getInstance().logger().trace("sendMessage", { action, data, response: res });
  if (res && res.code) {
    console.error(res);
    throw res.message;
  } else {
    return res.data;
  }
}

export function connect(msg: MessageSend, action: string, data?: any): Promise<MessageConnect> {
  return msg.connect({ action, data });
}

export class Client {
  constructor(
    private msg: MessageSend,
    private prefix?: string
  ) {
    if (this.prefix && !this.prefix.endsWith("/")) {
      this.prefix += "/";
    } else {
      this.prefix = "";
    }
  }

  do(action: string, params?: any): Promise<any> {
    return sendMessage(this.msg, this.prefix + action, params);
  }
}
