export function isExtensionRequest(details: chrome.webRequest.ResourceRequest & { originUrl?: string }): boolean {
  return !!(
    (details.initiator && chrome.runtime.getURL("").startsWith(details.initiator)) ||
    (details.originUrl && details.originUrl.startsWith(chrome.runtime.getURL("")))
  );
}

// 处理油猴的match和include为chrome的matches
export function dealMatches(matches: string[]) {
  return matches;
}
