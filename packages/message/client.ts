import LoggerCore from "@App/app/logger/core";
import { Message, MessageConnect, MessageSend } from "./server";
import { ExtensionMessageSend } from "./extension_message";

export async function sendMessage(msg: MessageSend, action: string, data?: any): Promise<any> {
  const res = await msg.sendMessage({ action, data });
  LoggerCore.getInstance().logger().trace("sendMessage", { action, data, response: res });
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
    private msg: MessageSend,
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
