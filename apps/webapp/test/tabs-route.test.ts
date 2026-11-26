import { describe, expect, it } from "vitest";
import { tabAt, tabs } from "../lib/tabs";

describe("tabs", () => {
  it("are خونه، کاوش، بازی، پیام‌ها، من in that order, each on its own route", () => {
    expect(tabs.map((tab) => tab.title)).toEqual(["خونه", "کاوش", "بازی", "پیام‌ها", "من"]);
    expect(tabs.map((tab) => tab.href)).toEqual(["/", "/explore", "/games", "/messages", "/me"]);
  });

  it("find the tab a path belongs to, and its pages inside it", () => {
    expect(tabAt("/")).toBe(0);
    expect(tabAt("/explore")).toBe(1);
    expect(tabAt("/explore/poet/hafez")).toBe(1);
    expect(tabAt("/games")).toBe(2);
    expect(tabAt("/messages/chat/sara")).toBe(3);
    expect(tabAt("/me")).toBe(4);
  });

  it("belong to no tab on other paths", () => {
    expect(tabAt("/dev/stickers")).toBeNull();
    expect(tabAt("/exploring")).toBeNull();
  });
});
