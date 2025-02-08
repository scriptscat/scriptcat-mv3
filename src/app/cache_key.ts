import { ConfirmParam } from "@App/runtime/service_worker/permission_verify";

export default class CacheKey {
  // 加载脚本信息时的缓存
  static scriptInstallInfo(uuid: string): string {
    return `scriptInfo:${uuid}`;
  }

  static permissionConfirm(scriptUuid: string, confirm: ConfirmParam): string {
    return `permission:${scriptUuid}:${confirm.permissionValue || ""}:${confirm.permission || ""}`;
  }
}
