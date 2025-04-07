import { ScriptRunResouce } from "@App/app/repo/scripts";
import { Client } from "@Packages/message/client";
import { forwardMessage, Message, MessageSend, Server } from "@Packages/message/server";

// content页的处理
export default class ContentRuntime {
  constructor(
    private extServer: Server,
    private server: Server,
    private send: MessageSend,
    private msg: Message
  ) {}

  start(scripts: ScriptRunResouce[]) {
    this.extServer.on("runtime/menuClick", (action, data) => {
      // gm菜单点击
      console.log("runtime/menuClick", action, data);
    });
    this.extServer.on("runtime/valueUpdate", (action, data) => {
      // gm value变化
      console.log(action, data);
    });
    forwardMessage("serviceWorker", "runtime/gmApi", this.server, this.send, (data: { api: string; params: any }) => {
      // 拦截关注的api
      switch (data.api) {
        case "CAT_createBlobUrl": {
          const file = data.params[0] as File;
          const url = URL.createObjectURL(file);
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 60 * 1000);
          return Promise.resolve(url);
        }
        case "CAT_fetchBlob": {
          return fetch(data.params[0]).then((res) => res.blob());
        }
        case "CAT_fetchDocument": {
          return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = "document";
            xhr.open("GET", data.params[0]);
            xhr.onload = () => {
              resolve({
                relatedTarget: xhr.response,
              });
            };
            xhr.send();
          });
        }
      }
      return Promise.resolve(false);
    });
    const client = new Client(this.msg, "inject");
    client.do("pageLoad", { scripts });
  }
}
