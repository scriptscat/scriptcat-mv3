import LoggerCore from "@App/app/logger/core";
import { Message, MessageConnect } from "./server";

export async function sendMessage(msg: Message, action: string, data?: any): Promise<any> {
  const res = await msg.sendMessage({ action, data });
  LoggerCore.getInstance().logger().debug("sendMessage", { action, data, res });
  if (res && res.code) {
    console.error(res);
    return Promise.reject(res.message);
  } else {
    return Promise.resolve(res.data);
  }
}

export function connect(msg: Message, action: string, data?: any): Promise<MessageConnect> {
  return msg.connect({ action, data });
}

export class Client {
  constructor(
    private msg: Message,
    private prefix: string
  ) {
    if (!this.prefix.endsWith("/")) {
      this.prefix += "/";
    }
  }

  do(action: string, params?: any): Promise<any> {
    return sendMessage(this.msg, this.prefix + action, params);
  }
}
