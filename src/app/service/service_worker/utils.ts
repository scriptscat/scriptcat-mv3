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

export function getRunAt(runAts: string[]): chrome.userScripts.RunAt {
  if (runAts.length === 0) {
    return "document_idle";
  }
  const runAt = runAts[0];
  if (runAt === "document-start") {
    return "document_start";
  } else if (runAt === "document-end") {
    return "document_end";
  }
  return "document_idle";
}
