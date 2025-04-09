import { Script } from "@App/app/repo/scripts";

export const unsafeHeaders: { [key: string]: boolean } = {
  // 部分浏览器中并未允许
  "user-agent": true,
  // 这两个是前缀
  "proxy-": true,
  "sec-": true,
  // cookie已经特殊处理
  cookie: true,
  "accept-charset": true,
  "accept-encoding": true,
  "access-control-request-headers": true,
  "access-control-request-method": true,
  connection: true,
  "content-length": true,
  date: true,
  dnt: true,
  expect: true,
  "feature-policy": true,
  host: true,
  "keep-alive": true,
  origin: true,
  referer: true,
  te: true,
  trailer: true,
  "transfer-encoding": true,
  upgrade: true,
  via: true,
};

export function getStorageName(script: Script): string {
  if (script.metadata && script.metadata.storagename) {
    return script.metadata.storagename[0];
  }
  return script.uuid;
}
