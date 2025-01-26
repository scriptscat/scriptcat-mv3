import { Script } from "@App/app/repo/scripts";

export function storageKey(script: Script): string {
  if (script.metadata && script.metadata.storagename) {
    return script.metadata.storagename[0];
  }
  return script.uuid;
}
