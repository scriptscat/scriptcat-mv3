import { fakeBrowser } from "@webext-core/fake-browser";
import { it } from "node:test";
import initTestEnv from "@Tests/utils";
import { beforeEach, describe, expect } from "vitest";

initTestEnv();

describe("GM xhr", () => {
  beforeEach(() => {
    // See https://webext-core.aklinker1.io/fake-browser/reseting-state
    fakeBrowser.reset();
  });
  it("1", async () => {
    expect(1).toBe(2);
  });
});
