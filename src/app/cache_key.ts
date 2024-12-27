export default class CacheKey {
  // 加载脚本信息时的缓存
  static scriptInstallInfo(uuid: string): string {
    return `scriptInfo:${uuid}`;
  }
}
