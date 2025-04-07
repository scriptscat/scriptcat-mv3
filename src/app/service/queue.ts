import { MessageQueue } from "@Packages/message/message_queue";
import { Script, SCRIPT_RUN_STATUS } from "../repo/scripts";

export function subscribeScriptInstall(
  messageQueue: MessageQueue,
  callback: (message: { script: Script; update: boolean }) => void
) {
  return messageQueue.subscribe("installScript", callback);
}

export function subscribeScriptDelete(messageQueue: MessageQueue, callback: (message: { uuid: string }) => void) {
  return messageQueue.subscribe("deleteScript", callback);
}

export type ScriptEnableCallbackValue = { uuid: string; enable: boolean };

export function subscribeScriptEnable(
  messageQueue: MessageQueue,
  callback: (message: ScriptEnableCallbackValue) => void
) {
  return messageQueue.subscribe("enableScript", callback);
}

export function subscribeScriptRunStatus(
  messageQueue: MessageQueue,
  callback: (message: { uuid: string; runStatus: SCRIPT_RUN_STATUS }) => void
) {
  return messageQueue.subscribe("scriptRunStatus", callback);
}

export type ScriptMenuRegisterCallbackValue = {
  uuid: string;
  id: number;
  name: string;
  accessKey: string;
  tabId: number;
  frameId: number;
};

export function subscribeScriptMenuRegister(
  messageQueue: MessageQueue,
  callback: (message: ScriptMenuRegisterCallbackValue) => void
) {
  return messageQueue.subscribe("registerMenuCommand", callback);
}
