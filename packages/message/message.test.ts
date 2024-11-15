// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Server, Connect } from ".";
import { windowConnect, WindowServer } from "./window";

describe("server", () => {
  it("hello", async () => {
    const myFunc = vi.fn();
    const server = new Server(new WindowServer(global.window));
    server.on("connection", (con) => {
      myFunc();
      con.onMessage((message) => {
        myFunc(message);
      });
    });
    const client = windowConnect(window, window);
    client.postMessage("hello");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(myFunc).toHaveBeenCalledTimes(2);
    expect(myFunc).toHaveBeenCalledWith("hello");
  });
});

describe("connect", async () => {
  it("hello", async () => {
    const server = new Server(new WindowServer(global.window));
    const myFunc = vi.fn();
    server.on("connection", (con) => {
      myFunc();
      const wrapCon = new Connect(con);
      wrapCon.on("hello", (message) => {
        myFunc(message);
        wrapCon.emit("world", "world");
      });
    });
    const client = new Connect(windowConnect(window, window));
    client.on("world", (message) => {
      myFunc(message);
    });
    client.emit("hello", "hello");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(myFunc).toHaveBeenCalledTimes(3);
    expect(myFunc).toHaveBeenCalledWith("hello");
    expect(myFunc).toHaveBeenCalledWith("world");
  });
  it("response", async () => {
    const server = new Server(new WindowServer(global.window));
    const myFunc = vi.fn();
    server.on("connection", (con) => {
      const wrapCon = new Connect(con);
      wrapCon.on("ping", (message, response) => {
        myFunc(message);
        response("pong");
      });
    });
    const client = new Connect(windowConnect(window, window));
    client.emit("ping", "ping", (message: string) => {
      myFunc(message);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(myFunc).toHaveBeenCalledTimes(2);
    expect(myFunc).toHaveBeenCalledWith("ping");
    expect(myFunc).toHaveBeenCalledWith("pong");
  });
});
