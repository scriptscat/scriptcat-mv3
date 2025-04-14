import { SystemConfig } from "@App/pkg/config/config";
import { ExtensionMessage } from "@Packages/message/extension_message";
import { MessageQueue } from "@Packages/message/message_queue";

export const message = new ExtensionMessage();
export const messageQueue = new MessageQueue();
export const systemConfig = new SystemConfig(messageQueue);
