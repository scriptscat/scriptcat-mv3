import { Script } from "@App/app/repo/scripts";
import { WindowMessage } from "@Packages/message/window_message";
import { sendMessage } from "../utils";

export function enableScript(msg: WindowMessage, data: Script) {
  return sendMessage(msg, "enableScript", data);
}

export function disableScript(msg: WindowMessage, data: Script) {
  return sendMessage(msg, "disableScript", data);
}
