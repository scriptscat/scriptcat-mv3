import { WindowMessage } from "@Packages/message/window_message";
import { sendMessage } from "../utils";
import { SCRIPT_RUN_STATUS } from "@App/app/repo/scripts";

export function preparationSandbox(msg: WindowMessage) {
  return sendMessage(msg, "preparationSandbox");
}

// 代理发送消息到ServiceWorker
export function sendMessageToServiceWorker(msg: WindowMessage, action: string, data?: any) {
  return sendMessage(msg, "sendMessageToServiceWorker", { action, data });
}

// 代理连接ServiceWorker
export function connectServiceWorker(msg: WindowMessage) {
  return sendMessage(msg, "connectServiceWorker");
}

export function proxyUpdateRunStatus(
  msg: WindowMessage,
  data: { uuid: string; runStatus: SCRIPT_RUN_STATUS; error?: any; nextruntime?: number }
) {
  return sendMessageToServiceWorker(msg, "updateRunStatus", data);
}
