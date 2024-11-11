import EventEmitter from 'eventemitter3';
import { Connect } from '.';

export class ExtServer {
  private EE: EventEmitter;

  constructor() {
    this.EE = new EventEmitter();
    chrome.runtime.onConnect.addListener((port) => {
      this.EE.emit('connect', new ExtConnect(port));
    });
  }

  onConnect(callback: (con: Connect) => void) {
    this.EE.on('connect', callback);
  }
}

export function connect() {
  return new ExtConnect(chrome.runtime.connect());
}

export class ExtConnect implements Connect {
  private EE: EventEmitter;
  private port: chrome.runtime.Port;

  constructor(port: chrome.runtime.Port) {
    this.EE = new EventEmitter();
    this.port = port;
    port.onMessage.addListener((message) => {
      this.EE.emit('message', message);
    });
    port.onDisconnect.addListener(() => {
      this.EE.emit('disconnect');
      this.EE.removeAllListeners();
    });
  }

  postMessage(message: unknown) {
    this.port.postMessage(message);
  }

  onMessage(callback: (message: unknown) => void) {
    this.EE.on('message', callback);
  }

  onDisconnect(callback: () => void) {
    this.EE.on('disconnect', callback);
  }

  disconnect() {
    this.port.disconnect();
  }
}
