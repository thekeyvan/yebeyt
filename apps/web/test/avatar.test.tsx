import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "../components/Avatar";

describe("Avatar", () => {
  it("puts the shared face in the amber sticker circle, hidden from screen readers", () => {
    expect(renderToStaticMarkup(<Avatar avatar={null} />)).toMatch(/^<span class="avatar" aria-hidden="true"><svg viewBox="0 0 200 200">.*<circle cx="100" cy="108" r="52" fill="#F2C29B">/);
  });

  it("can be the large one of the invite page", () => {
    expect(renderToStaticMarkup(<Avatar avatar={null} large />)).toContain('class="avatar large"');
  });

  it("draws what the person chose", () => {
    const html = renderToStaticMarkup(<Avatar avatar={{ face: "brown", eyes: "happy", hair: "lapis", mouth: "grin", accessory: "crown", background: "mint" }} />);
    expect(html).toContain('fill="#9C6A45"');
    expect(html).toContain('fill="#BDEBA3"');
  });
});
