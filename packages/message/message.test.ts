// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { Server, Connect } from ".";
import { connect, WindowServer } from "./window";

test("server", async () => {
  const myFunc = vi.fn();
  const server = new Server(new WindowServer(global.window));
  server.on("connection", (con) => {
    myFunc();
    con.onMessage((message) => {
      myFunc(message);
    });
  });
  const client = connect(window, window);
  client.postMessage("hello");
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(myFunc).toHaveBeenCalledTimes(2);
  expect(myFunc).toHaveBeenCalledWith("hello");
});

test("connect", async () => {
  const myFunc = vi.fn();
  const server = new Server(new WindowServer(global.window));
  server.on("connection", (con) => {
    myFunc();
    const wrapCon = new Connect(con);
    wrapCon.on("hello", (message) => {
      myFunc(message);
      wrapCon.emit("world", "world");
    });
  });
  const client = new Connect(connect(window, window));
  client.on("world", (message) => {
    myFunc(message);
  });
  client.emit("hello", "hello");
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(myFunc).toHaveBeenCalledTimes(3);
  expect(myFunc).toHaveBeenCalledWith("hello");
  expect(myFunc).toHaveBeenCalledWith("world");
});
