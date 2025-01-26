import { Message, MessageConnect } from "./server";

export function sendMessage(msg: Message, action: string, data?: any): Promise<any> {
  return msg.sendMessage({ action, data });
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
