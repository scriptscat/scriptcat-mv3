import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

export interface Server {
  onConnect: (callback: (con: Connect) => void) => void;
}

export interface Connect {
  postMessage: (message: unknown) => void;
  onMessage: (callback: (message: unknown) => void) => void;
  onDisconnect: (callback: () => void) => void;
  disconnect: () => void;
}

// 消息通道, 通过连接封装消息通道
export class MessageChannel {
  private EE: EventEmitter;
  // 实例id
  private id: string;

  constructor(private connect: Connect) {
    this.EE = new EventEmitter();
    this.id = uuidv4();
    connect.onMessage((message) => {
      // 判断消息是否为连接消息
      if (message && typeof message === 'object') {
        const data = message as { type: string; id: string };
        // 判断实例
        if (data.id == this.id) {
          switch (data.type) {
            case 'connect':
              // 建立连接
              break;
            case 'message':
              // 发送消息
              break;
          }
        }
      }
    });
  }

  // 发送一次消息并接收结果
  async send(message: unknown) {
    return new Promise((resolve) => {
      const callback = (message: unknown) => {
        this.connect.onMessage(callback);
        resolve(message);
      };
      this.connect.onMessage(callback);
      this.connect.postMessage(message);
    });
  }

  // 发送消息
  postMessage(message: unknown) {
    this.connect.postMessage({
      type: 'message',
      id: this.id,
      data: message,
    });
  }
}
