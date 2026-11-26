import { describe, expect, it } from "vitest";
import { channels, inviteLink, inviteMessage, inviteOpener, inviteTones, shareUrl } from "../lib/me/invite";
import { drawStoryCard, storySize, type Canvas2D } from "../lib/me/storyCard";

// Ported from apps/ios/YebeytTests/InviteTests.swift (tones, message, link, channels).

describe("the invite text", () => {
  it("has the three tones with their texts", () => {
    expect(inviteTones.map((tone) => tone.title)).toEqual(["رفیقانه", "شاعرانه", "کوتاه"]);
    expect(inviteTones[0]!.body).toBe("یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه! هر روز یه بیت، جورچین، مشاعره با رفیقا. بیا با هم مشاعره کنیم، من شروع می‌کنم:");
    expect(inviteTones[1]!.body).toBe("شعر فارسی رو با یه بیت دوباره پیدا کردم؛ هر روز یه بیت، یه بازی. بیا با هم مشاعره کنیم، من شروع می‌کنم:");
    expect(inviteTones[2]!.body).toBe("بیا با هم مشاعره کنیم:");
  });

  it("is the body, the opener couplet and the link, each on its own line", () => {
    expect(inviteMessage(inviteTones[2]!.body, inviteLink.display("niloofar"))).toBe("بیا با هم مشاعره کنیم:\n«الا یا ایها الساقی ادر کأسا و ناولها»\nyebeyt.com/i/niloofar");
    expect(inviteOpener).toBe("الا یا ایها الساقی ادر کأسا و ناولها");
  });

  it("uses a text written by the person as it is", () => {
    const text = inviteMessage("سلام، بیا!", inviteLink.display("ali.r"));
    expect(text.startsWith("سلام، بیا!\n")).toBe(true);
    expect(text.endsWith("yebeyt.com/i/ali.r")).toBe(true);
  });

  it("has the personal link", () => {
    expect(inviteLink.display("niloofar")).toBe("yebeyt.com/i/niloofar");
    expect(inviteLink.url("niloofar")).toBe("https://yebeyt.com/i/niloofar");
  });
});

describe("the ways to send it", () => {
  const text = "بیا با هم مشاعره کنیم: a&b=c?d#e+f\nyebeyt.com/i/niloofar";
  const payload = { text, url: "https://yebeyt.com/i/niloofar" };
  const channel = (id: string) => channels.find((item) => item.id === id)!;
  const query = (url: string, name: string) => new URL(url).searchParams.get(name);

  it("are the board's in order, with their names", () => {
    expect(channels.map((item) => item.title)).toEqual(["پیامک", "تلگرام", "واتس‌اپ"]);
  });

  it("gives Telegram the link and the text before it", () => {
    const url = shareUrl(channel("telegram"), payload);
    expect(new URL(url).origin + new URL(url).pathname).toBe("https://t.me/share/url");
    expect(query(url, "url")).toBe("https://yebeyt.com/i/niloofar");
    expect(query(url, "text")).toBe("بیا با هم مشاعره کنیم: a&b=c?d#e+f");
  });

  it("gives WhatsApp the whole text", () => {
    const url = shareUrl(channel("whatsapp"), payload);
    expect(new URL(url).origin + new URL(url).pathname).toBe("https://wa.me/");
    expect(query(url, "text")).toBe(text);
  });

  it("gives the messages app the text as the body", () => {
    const url = shareUrl(channel("sms"), payload);
    expect(url.startsWith("sms:?&body=")).toBe(true);
    expect(decodeURIComponent(url.slice("sms:?&body=".length))).toBe(text);
  });

  it("escapes the reserved characters, so the text cannot break the query", () => {
    const url = shareUrl(channel("whatsapp"), { text: "a&b=c?d#e+f\ng", url: "https://yebeyt.com" });
    const value = url.split("?text=")[1]!;
    expect(/[&=?#+\n ]/.test(value)).toBe(false);
    for (const code of ["%26", "%3D", "%3F", "%23", "%2B", "%0A"]) expect(value).toContain(code);
  });
});

describe("the story card", () => {
  /** A canvas that only remembers what it was asked to write, and measures text as ten per letter. */
  function recorder() {
    const written: { text: string; font: string; align: string }[] = [];
    const ctx = {
      font: "",
      fillStyle: "",
      strokeStyle: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      direction: "rtl",
      shadowColor: "",
      shadowBlur: 0,
      shadowOffsetY: 0,
      lineWidth: 0,
      measureText: (text: string) => ({ width: text.length * 10 }),
      fillText(text: string) {
        written.push({ text, font: this.font, align: this.textAlign });
      },
      fillRect() {},
      beginPath() {},
      arc() {},
      fill() {},
      stroke() {},
      roundRect() {},
      save() {},
      restore() {},
      scale() {},
    };
    return { ctx: ctx as unknown as Canvas2D, written };
  }

  it("is a 1080×1920 picture: three times the 360×640 card", () => {
    expect(storySize).toEqual({ width: 1080, height: 1920, scale: 3 });
  });

  it("writes «یه بیت», the short text, the opener couplet and the link", () => {
    const { ctx, written } = recorder();
    drawStoryCard(ctx, "yebeyt.com/i/niloofar");
    const lines = written.map((item) => item.text);
    expect(lines).toContain("یه بیت");
    expect(lines.join(" ")).toContain("بیا با هم مشاعره کنیم:");
    expect(lines.join(" ")).toContain("«الا یا ایها الساقی ادر کأسا و ناولها»");
    expect(lines.at(-1)).toBe("yebeyt.com/i/niloofar");
    expect(written.find((item) => item.text === "یه بیت")!.font).toContain("yebeyt-title");
  });
});
