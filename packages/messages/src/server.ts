import EventEmitter from 'eventemitter3';

export class Server {
  private EE: EventEmitter;

  constructor() {
    this.EE = new EventEmitter();
  }

  onConnect(callback: (con: Connect) => void) {
    this.EE.on('connect', callback);
  }
}

export interface Connect {
  postMessage: (message: unknown) => void;
  onMessage: (callback: (message: unknown) => void) => void;
}

export class ChromeServer {

  private EE: EventEmitter;

  constructor() {
    chrome.runtime.onConnect.addListener((port) => {
      this.EE.emit('connect', {
        postMessage: (message: unknown) => port.postMessage(message),
        onMessage: (callback: (message: unknown) => void) =>
          port.onMessage.addListener(callback),
      });
    });
  }

  onConnect(callback: (con: Connect) => void) {
    this.EE.on('connect', callback);
  }
}
