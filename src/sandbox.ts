import { Connect } from "@Packages/message";
import { windowConnect } from "@Packages/message/window";

function main() {
  const client = new Connect(windowConnect(window, window.parent));
  client.emit("recv", "123", (resp: string) => {
    console.log("sandbox", resp);
  });
}

main();
