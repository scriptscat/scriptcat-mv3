import { WindowMessage } from "@Packages/message/window_message";

export function sendMessage(msg: WindowMessage, action: string, data?: any) {
  return msg.sendMessage({
    action,
    data,
  });
}
