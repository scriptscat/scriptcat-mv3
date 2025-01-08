import { WindowMessage } from "@Packages/message/window_message";
import { sendMessage } from "../utils";

export function preparationSandbox(msg: WindowMessage) {
  return sendMessage(msg, "preparationSandbox");
}
