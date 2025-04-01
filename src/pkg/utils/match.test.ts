import { describe, it } from "vitest";
import { dealMatches, parseURL } from "./match";

// https://developer.chrome.com/docs/extensions/mv3/match_patterns/
describe("dealMatches", () => {
  it("*://link.17173.com*", () => {
    const url = parseURL("*://link.17173.com*");
    const matches = dealMatches(["*://link.17173.com*"]);
    console.log(url, matches);
  });
});
