import { ScriptRunResouce } from "@App/app/repo/scripts";
import { sendMessage } from "@Packages/message/client";
import { WindowMessage } from "@Packages/message/window_message";

export function enableScript(msg: WindowMessage, data: ScriptRunResouce) {
  return sendMessage(msg, "enableScript", data);
}

export function disableScript(msg: WindowMessage, uuid: string) {
  return sendMessage(msg, "disableScript", uuid);
}
