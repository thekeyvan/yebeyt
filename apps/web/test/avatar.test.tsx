import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "../components/Avatar";
import type { Avatar as Parts } from "../lib/api";

const standard: Parts = { face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun" };
const render = (avatar: Parts | null, large = false) => renderToStaticMarkup(<Avatar avatar={avatar} large={large} />);

describe("Avatar", () => {
  it("draws the app's standard face for null, in the amber sticker circle", () => {
    const html = render(null);
    expect(html).toMatch(/^<span class="avatar" aria-hidden="true"><svg viewBox="0 0 200 200">/);
    expect(html).toContain('<circle cx="100" cy="108" r="52" fill="#F2C29B"></circle>'); // skin
    expect(html).toContain('fill="#FFE08A"'); // background
    expect(html).toContain('fill="#3B2A2A"'); // hair
    expect(html).toContain('<ellipse cx="82" cy="112" rx="5.5" ry="6.5" fill="#14112B"></ellipse>'); // round eyes
    expect(html).toContain('d="M88 134 Q100 146 112 134"'); // smile
    expect(html).toContain('fill="#D9A86C"'); // the ney
    expect(render(null)).toBe(render(standard));
  });

  it("can be the large one of the invite page", () => {
    expect(render(null, true)).toContain('class="avatar large"');
  });

  it("draws the colours and variants a person chose", () => {
    const html = render({ face: "brown", eyes: "happy", hair: "lapis", mouth: "grin", accessory: "crown", background: "mint" });
    expect(html).toContain('<circle cx="100" cy="108" r="52" fill="#9C6A45"></circle>');
    expect(html).toContain('<rect width="200" height="200" fill="#BDEBA3"></rect>');
    expect(html).toMatch(/d="M47 104[^"]*" fill="#2F35F5"/); // hair cap, in lapis
    expect(html).toContain('d="M74 98 q8 -5 16 0" fill="none" stroke="#2F35F5" stroke-width="4"'); // brows follow the hair
    expect(html).toContain('d="M74 114 q8 -9 16 0"'); // happy eyes are arcs, not ovals
    expect(html).not.toContain("<ellipse");
    expect(html).toContain('d="M84 130 Q100 156 116 130Z"'); // grin
    expect(html).toContain('translate(47 -24) scale(2.4)'); // crown on the head
    expect(html).not.toContain("#F2C29B");
    expect(html).not.toContain("#D9A86C"); // no ney
  });

  it("draws a wink, a calm mouth and the other accessories", () => {
    const wink = render({ ...standard, eyes: "wink", mouth: "calm", accessory: "rose" });
    expect(wink).toContain('<ellipse cx="82"');
    expect(wink).not.toContain('<ellipse cx="118"');
    expect(wink).toContain('d="M110 114 q8 -9 16 0"');
    expect(wink).toContain('d="M90 138 Q100 142 110 138"');
    expect(wink).toContain('fill="#FF3D8B"'); // the rose
    expect(render({ ...standard, accessory: "helmet" })).toContain('fill="#9AA0B4"');
    expect(render({ ...standard, accessory: "candle" })).toContain("translate(84 42) scale(3)");
  });

  it("keeps the layers in the app's order: background, hills, accessory behind, body, face, hair, eyes, mouth, accessory on the head", () => {
    const html = render({ ...standard, accessory: "crown" });
    const at = (text: string) => html.indexOf(text);
    const order = ['fill="#FFE08A"', "M0 150 C40", "M44 210", 'r="52"', "M47 104", "<ellipse", "M88 134", "translate(47 -24)"].map(at);
    expect(order.every((n) => n >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(at("#D9A86C")).toBe(-1);
    const behind = render(standard);
    expect(behind.indexOf("#D9A86C")).toBeLessThan(behind.indexOf("M44 210"));
  });

  it("falls back to each part's default for an id it doesn't know", () => {
    const unknown = { face: "purple", eyes: "sleepy", hair: "rainbow", mouth: "scream", accessory: "wizard-hat", background: "neon" };
    expect(render(unknown)).toBe(render({ ...standard, accessory: "none" }));
    expect(render({ ...standard, face: "constructor", hair: "toString" })).toBe(render(standard));
  });

  it("gives each face its own clip id, so several on a page don't share one", () => {
    const html = renderToStaticMarkup(
      <>
        <Avatar avatar={null} />
        <Avatar avatar={null} />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
    expect(html).toContain(`clip-path="url(#${ids[0]})"`);
  });
});
