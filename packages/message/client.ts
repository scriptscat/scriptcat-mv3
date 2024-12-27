export function sendMessage(action: string, params?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, data: params }, (res) => {
      if (res.code) {
        console.error(res);
        reject(res.message);
      } else {
        resolve(res.data);
      }
    });
  });
}

export function connect(action: string, params?: any): Promise<chrome.runtime.Port> {
  return new Promise((resolve) => {
    const port = chrome.runtime.connect();
    port.postMessage({ action, data: params });
    resolve(port);
  });
}

export class Client {
  constructor(private prefix: string) {
    if (!this.prefix.endsWith("/")) {
      this.prefix += "/";
    }
  }

  do(action: string, params?: any): Promise<any> {
    return sendMessage(this.prefix + action, params);
  }
}
