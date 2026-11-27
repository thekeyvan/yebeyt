import { describe, expect, it } from "vitest";
import { alphaOf, intersect } from "../lib/feedback/covers";
import { addMark, clamp01, drawMarks, lineWidth, rectBetween, undoMark, type Mark } from "../lib/feedback/markup";
import { blankPrivate, privateSelector } from "../lib/feedback/privacy";
import { fitSize } from "../lib/feedback/screenshot";
import { feedbackPrivate } from "../lib/feedbackPrivate";
import { colors } from "../lib/tokens";

/** The copy of a page, as the screenshot has it before it is drawn: a detached tree. */
function copyOf(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

const secret = "رمز پیام محرمانه";
const attribute = Object.keys(feedbackPrivate)[0];

describe("the private views are blank in the picture (FeedbackPrivacyTests)", () => {
  it("what a private element had is gone from the copy: its text, its value, its placeholder and its labels", () => {
    const root = copyOf(`
      <p id="bubble" ${attribute}="" class="pseudo-quote" style="color: red; width: 120px; height: 40px" title="${secret}" aria-label="${secret}">${secret}<b>${secret}</b></p>
      <input value="${secret}" placeholder="${secret}" aria-label="${secret}">
      <textarea placeholder="${secret}">${secret}</textarea>
      <select><option>${secret}</option></select>
      <div contenteditable="true">${secret}</div>
      <p id="open">نوشته‌ی عمومی</p>`);
    expect(blankPrivate(root)).toBe(5);
    expect(root.innerHTML).not.toContain("رمز");
    expect(root.querySelector("#open")?.textContent).toBe("نوشته‌ی عمومی");
    expect(root.textContent?.replace(/\s/g, "")).toBe("نوشته‌یعمومی");
  });

  it("what is left of it is its box, filled with the track colour and with no decoration", () => {
    const root = copyOf(`<p ${attribute}="" style="width: 120px; height: 40px; box-shadow: 0 1px red">${secret}</p><input value="x">`);
    blankPrivate(root);
    expect(colors.trackLight.toLowerCase()).toBe("#e6e3ec");
    for (const element of root.querySelectorAll<HTMLElement>("p, input")) {
      expect(element.style.getPropertyValue("background")).toMatch(/#e6e3ec|rgb\(230, 227, 236\)/i);
      expect(element.style.getPropertyValue("box-shadow")).toBe("none");
      expect(element.style.getPropertyPriority("background")).toBe("important");
    }
    expect(root.querySelector("p")?.style.width).toBe("120px");
    expect(root.querySelector("p")?.getAttributeNames()).toEqual(["style"]);
  });

  it("an element inside a private one is gone with it, and is not counted twice", () => {
    const root = copyOf(`<div ${attribute}=""><input value="${secret}"><p ${attribute}="">${secret}</p></div>`);
    expect(blankPrivate(root)).toBe(1);
    expect(root.querySelector("input, p")).toBeNull();
  });

  it("a page with nothing private is left as it is", () => {
    const root = copyOf("<p>مرحبا</p><button>برو</button>");
    expect(blankPrivate(root)).toBe(0);
    expect(root.innerHTML).toBe("<p>مرحبا</p><button>برو</button>");
  });

  it("every typed field counts, and an editable element that says it is not does not", () => {
    for (const html of ["<input>", "<textarea></textarea>", "<select></select>", "<div contenteditable></div>", '<div contenteditable="true"></div>', `<div ${attribute}=""></div>`]) {
      expect(copyOf(html).querySelector(privateSelector), html).not.toBeNull();
    }
    expect(copyOf('<div contenteditable="false"></div>').querySelector(privateSelector)).toBeNull();
  });
});

describe("the covers of a recording", () => {
  it("box intersection", () => {
    expect(intersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 5, right: 20, bottom: 8 })).toEqual({ left: 5, top: 5, right: 10, bottom: 8 });
    expect(intersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 })).toBeUndefined();
  });

  it("how much of a colour is there", () => {
    expect(alphaOf("transparent")).toBe(0);
    expect(alphaOf("rgba(0, 0, 0, 0)")).toBe(0);
    expect(alphaOf("rgba(20, 17, 43, 0.3)")).toBe(0.3);
    expect(alphaOf("color(srgb 0.0784 0.0667 0.1686 / 0.3)")).toBe(0.3);
    expect(alphaOf("color(srgb 0.1 0.1 0.1 / 30%)")).toBe(0.3);
    expect(alphaOf("rgb(255, 255, 255)")).toBe(1);
    expect(alphaOf("oklch(0.5 0.1 200)")).toBe(1);
  });
});

describe("the marks of the editor (ScreenshotTests)", () => {
  /** A canvas that remembers what was drawn and in which colour. */
  function recorder() {
    const log: string[] = [];
    const context = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
      fillRect: (x: number, y: number, w: number, h: number) => log.push(`fillRect ${x},${y},${w},${h} ${context.fillStyle}`),
      beginPath: () => log.push("begin"),
      moveTo: (x: number, y: number) => log.push(`move ${x},${y}`),
      lineTo: (x: number, y: number) => log.push(`line ${x},${y}`),
      stroke: () => log.push(`stroke ${context.strokeStyle} ${context.lineWidth}`),
      arc: (x: number, y: number, r: number) => log.push(`arc ${x},${y},${r}`),
      fill: () => log.push(`fill ${context.fillStyle}`),
    };
    return { context: context as unknown as CanvasRenderingContext2D, log };
  }

  it("a cover is a solid ink rectangle and a line is ink, 0.7% of the long side thick, in the picture's own pixels", () => {
    const { context, log } = recorder();
    const marks: Mark[] = [
      { kind: "cover", rect: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 } },
      { kind: "line", points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }] },
      { kind: "line", points: [{ x: 0.5, y: 0.5 }] },
    ];
    drawMarks(context, marks, 100, 200);
    expect(log[0]).toMatch(/^fillRect 40,80,20,40 /);
    expect(log[0]).toContain(colors.ink);
    expect(log.slice(1, 5)).toEqual(["begin", "move 10,20", "line 90,20", `stroke ${colors.ink} ${lineWidth * 200}`]);
    expect(log.slice(5)).toEqual(["begin", `arc 50,100,${(lineWidth * 200) / 2}`, `fill ${colors.ink}`]);
  });

  it("marks are added and taken back one at a time, and taking back with none left harms nothing", () => {
    const one: Mark = { kind: "cover", rect: { x: 0, y: 0, width: 1, height: 1 } };
    const two: Mark = { kind: "line", points: [{ x: 0, y: 0 }] };
    const marks = addMark(addMark([], one), two);
    expect(marks).toEqual([one, two]);
    expect(undoMark(marks)).toEqual([one]);
    expect(undoMark(undoMark(undoMark(marks)))).toEqual([]);
  });

  it("a drag makes a rectangle in any direction, and a point stays inside the picture", () => {
    const rect = rectBetween({ x: 0.6, y: 0.2 }, { x: 0.2, y: 0.5 });
    expect([rect.x, rect.y]).toEqual([0.2, 0.2]);
    expect([rect.width, rect.height]).toEqual([expect.closeTo(0.4), expect.closeTo(0.3)]);
    expect([clamp01(-1), clamp01(0.4), clamp01(3)]).toEqual([0, 0.4, 1]);
  });
});

describe("the picture that is sent", () => {
  it("is scaled to 1600 on its long side, and never enlarged", () => {
    expect(fitSize(1179, 2556)).toEqual({ width: 738, height: 1600 });
    expect(fitSize(390 * 3, 844 * 3)).toEqual({ width: 739, height: 1600 });
    expect(fitSize(300, 600)).toEqual({ width: 300, height: 600 });
    expect(fitSize(2000, 1000)).toEqual({ width: 1600, height: 800 });
  });

  it("an empty picture has no size", () => {
    expect(fitSize(0, 0)).toBeUndefined();
    expect(fitSize(1, 5000)).toBeUndefined();
  });
});
