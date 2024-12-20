export type ApiFunction = (params: any, con: chrome.runtime.Port | chrome.runtime.MessageSender) => any;

export class Server {
  private apiFunctionMap: Map<string, ApiFunction> = new Map();

  constructor(private env: string) {
    chrome.runtime.onConnect.addListener((port) => {
      const handler = (msg: { action: string }) => {
        port.onMessage.removeListener(handler);
        this.connectHandle(msg.action, msg, port);
      };
      port.onMessage.addListener(handler);
    });

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      this.messageHandle(msg.action, msg, sender, sendResponse);
    });
  }

  on(name: string, func: ApiFunction) {
    this.apiFunctionMap.set(name, func);
  }

  private connectHandle(msg: string, params: any, con: chrome.runtime.Port) {
    const func = this.apiFunctionMap.get(msg);
    if (func) {
      func(params, con);
    }
  }

  private messageHandle(
    msg: string,
    params: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) {
    const func = this.apiFunctionMap.get(msg);
    if (func) {
      try {
        const ret = func(params, sender);
        sendResponse({ code: 0, data: ret });
      } catch (e: any) {
        sendResponse({ code: -1, message: e.message });
      }
    }
  }
}
