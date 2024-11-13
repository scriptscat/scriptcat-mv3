import EventEmitter from "eventemitter3";
import { IConnect, IServer } from ".";
import { v4 as uuidv4 } from "uuid";

export class WindowServer implements IServer {
  private EE: EventEmitter;

  constructor(win: Window) {
    this.EE = new EventEmitter();
    win.addEventListener("message", (event) => {
      if (event.data.type === "connect") {
        this.EE.emit("connection", new WindowConnect(event.data.connectId, event.target as Window, win));
      }
    });
  }

  onConnect(callback: (con: IConnect) => void) {
    this.EE.on("connection", callback);
  }
}

export function connect(source: Window, target: Window) {
  const con = new WindowConnect(uuidv4(), source, target);
  con.postMessage({ type: "connect" });
  return con;
}

export class WindowConnect implements IConnect {
  private EE: EventEmitter;

  constructor(
    private id: string,
    private source: Window,
    private target: Window
  ) {
    this.EE = new EventEmitter();
    this.source.addEventListener("message", (event) => {
      if (event.data.id === id) {
        this.EE.emit("message", event.data);
      }
    });
  }

  postMessage(message: unknown) {
    this.target.postMessage(message, "*");
  }

  onMessage(callback: (message: unknown) => void) {
    this.EE.on("message", callback);
  }

  onDisconnect(callback: () => void) {
    this.EE.on("disconnect", callback);
  }

  disconnect() {
    this.EE.emit("disconnect");
    this.EE.removeAllListeners();
  }
}
