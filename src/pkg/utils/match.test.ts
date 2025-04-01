import { describe, expect, it } from "vitest";
import { dealMatches } from "./match";

// https://developer.chrome.com/docs/extensions/mv3/match_patterns/
describe("dealMatches", () => {
  it("*://link.17173.com*", () => {
    const matches = dealMatches(["*://link.17173.com*"]);
    expect(matches).toEqual(["*://link.17173.com/*"]);
  });
});
