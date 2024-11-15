import { Connect, Server } from "@Packages/message";
import { extConnect } from "@Packages/message/extension";
import { WindowServer } from "@Packages/message/window";

function main() {
  // 与sandbox建立连接
  const extClient = new Connect(extConnect());
  const server = new Server(new WindowServer(window));
  server.on("connection", (con) => {
    const wrapCon = new Connect(con);
    wrapCon.on("forward", (data, resp) => {
      console.log(data);
    });
  });
}

main();
