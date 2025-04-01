export interface Url {
  scheme: string;
  host: string;
  path: string;
  search: string;
}

// 根据https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns?hl=zh-cn进行匹配
export class Match {}

export function parseURL(url: string): Url | undefined {
  const match = /^(.+?):\/\/(.*?)((\/.*?)(\?.*?|)|)$/.exec(url);
  if (match) {
    return {
      scheme: match[1],
      host: match[2],
      path: match[4] || (url[url.length - 1] === "*" ? "*" : "/"),
      search: match[5],
    };
  }
  // 处理一些特殊情况
  switch (url) {
    case "*":
      return {
        scheme: "*",
        host: "*",
        path: "*",
        search: "*",
      };
    default:
  }
  return undefined;
}

// 处理油猴的match和include为chrome的matches
export function dealMatches(matches: string[]) {
  const result: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const url = parseURL(matches[i]);
    if (url) {
      // *开头但是不是*.的情况
      if (url.host.startsWith("*")) {
        if (!url.host.startsWith("*.")) {
          // 删除开头的*号
          url.host = url.host.slice(1);
        }
      } else if (url.host.endsWith("*")) {
        url.host = url.host.slice(0, -1);
      }
      result.push(`${url.scheme}://${url.host}/${url.path}` + (url.search ? "?" + url.search : ""));
    }
  }
  return result;
}
