import { ScriptRunResouce } from "@App/app/repo/scripts";
import { WindowMessage } from "@Packages/message/window_message";
import { sendMessage } from "../utils";

export function enableScript(msg: WindowMessage, data: ScriptRunResouce) {
  return sendMessage(msg, "enableScript", data);
}

export function disableScript(msg: WindowMessage, uuid: string) {
  return sendMessage(msg, "disableScript", uuid);
}
