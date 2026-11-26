import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessoryIcon } from "../src/AccessoryArt";
import { AvatarFace } from "../src/AvatarFace";
import type { AvatarParts as Parts } from "../src/catalogue";

const standard: Parts = { face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun" };
const render = (avatar: Parts | null) => renderToStaticMarkup(<AvatarFace avatar={avatar} />);

describe("AvatarFace", () => {
  it("draws the app's standard face for null, in a 200×200 box clipped to a circle", () => {
    const html = render(null);
    expect(html).toMatch(/^<svg viewBox="0 0 200 200"><clipPath id="[^"]+"><circle cx="100" cy="100" r="96">/);
    expect(html).toContain('<circle cx="100" cy="108" r="52" fill="#F2C29B"></circle>'); // skin
    expect(html).toContain('fill="#FFE08A"'); // background
    expect(html).toContain('fill="#3B2A2A"'); // hair
    expect(html).toContain('<ellipse cx="82" cy="112" rx="5.5" ry="6.5" fill="#14112B"></ellipse>'); // round eyes
    expect(html).toContain('d="M88 134 Q100 146 112 134"'); // smile
    expect(html).toContain('fill="#D9A86C"'); // the ney
    expect(render(null)).toBe(render(standard));
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

  it("falls back part by part, as the app draws another person's face: a part's default, and no accessory", () => {
    const chosen = { face: "brown", eyes: "happy", hair: "lapis", mouth: "grin", accessory: "crown", background: "mint" };
    const unknown = { face: "purple", eyes: "sleepy", hair: "rainbow", mouth: "scream", accessory: "wizard-hat", background: "neon" };
    expect(render(unknown)).toBe(render({ ...standard, accessory: "none" }));
    // one unknown part changes only that part
    expect(render({ ...chosen, accessory: "wizard-hat" })).toBe(render({ ...chosen, accessory: "none" }));
    expect(render({ ...chosen, face: "purple" })).toBe(render({ ...chosen, face: "peach" }));
    expect(render({ ...chosen, eyes: "sleepy" })).toBe(render({ ...chosen, eyes: "round" }));
    expect(render({ ...chosen, hair: "rainbow" })).toBe(render({ ...chosen, hair: "dark" }));
    expect(render({ ...chosen, mouth: "scream" })).toBe(render({ ...chosen, mouth: "smile" }));
    expect(render({ ...chosen, background: "neon" })).toBe(render({ ...chosen, background: "sun" }));
    expect(render({ ...chosen, accessory: "wizard-hat" })).toContain("#9C6A45"); // the rest stays as chosen
    // names of the object prototype are not ids
    expect(render({ ...standard, face: "constructor", hair: "toString" })).toBe(render(standard));
  });

  it("gives each face its own clip id, so several on a page don't share one", () => {
    const html = renderToStaticMarkup(
      <>
        <AvatarFace avatar={null} />
        <AvatarFace avatar={null} />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
    expect(html).toContain(`clip-path="url(#${ids[0]})"`);
  });
});

describe("AccessoryIcon", () => {
  it("draws each accessory in the grid's 44×44 box, the same shapes the face wears", () => {
    const icon = (accessory: Parameters<typeof AccessoryIcon>[0]["accessory"]) => renderToStaticMarkup(<AccessoryIcon accessory={accessory} />);
    expect(icon("none")).toContain('stroke="#B9B4C6"');
    expect(icon("ney")).toContain('transform="rotate(35 22 22)"');
    expect(icon("rose")).toContain('fill="#FF3D8B"');
    expect(icon("crown")).toMatch(/viewBox="0 0 44 44" width="44" height="44"/);
    expect(icon("crown")).toContain('d="M7 32L9 14l7 8 6-12 6 12 7-8 2 18z"');
    expect(render({ ...standard, accessory: "crown" })).toContain('d="M7 32L9 14l7 8 6-12 6 12 7-8 2 18z"');
    expect(icon("helmet")).toContain('fill="#9AA0B4"');
    expect(icon("candle")).toContain('stroke="#DAD6E2"');
  });

  it("can be any size", () => {
    expect(renderToStaticMarkup(<AccessoryIcon accessory="ney" size={30} />)).toContain('width="30" height="30"');
  });
});
