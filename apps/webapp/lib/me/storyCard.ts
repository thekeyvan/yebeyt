import { colors, sticker } from "../tokens";
import { inviteOpener, inviteTones } from "./invite";

export type Canvas2D = CanvasRenderingContext2D;

/** The picture «استوری» shares: 1080×1920, the 360×640 card of the phone (Me/Invite/InviteStoryCard.swift) at three times. */
export const storySize = { width: 1080, height: 1920, scale: 3 } as const;

const POINTS = { width: 360, height: 640 };
const PADDING = 28;
const GAP = 26;
const TITLE = { font: '54px "yebeyt-title"', height: 70 };
const BODY = { font: '500 18px "yebeyt-ui"', height: 32 };
const OPENER = { font: '30px "yebeyt-poem"', height: 46 };
const LINK = { font: '700 18px "yebeyt-ui"', height: 52, side: 24 };

/** The fonts the picture is drawn with, to load before drawing. */
const storyFonts = [TITLE.font, BODY.font, OPENER.font, LINK.font];

/** `text` broken into lines that fit `width`, at the spaces. */
function wrap(ctx: Canvas2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  return line === "" ? lines : [...lines, line];
}

function dots(ctx: Canvas2D): void {
  const { grid, radius } = sticker.dots;
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, POINTS.width, POINTS.height);
  ctx.fillStyle = colors.dot;
  for (let column = 0; column < Math.ceil(POINTS.width / grid); column++) {
    for (let row = 0; row < Math.ceil(POINTS.height / grid); row++) {
      ctx.beginPath();
      ctx.arc((column + 0.5) * grid, (row + 0.5) * grid, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draws the card (the opener couplet on a sticker card, with the personal link) on a canvas that is `storySize` wide. */
export function drawStoryCard(ctx: Canvas2D, link: string): void {
  ctx.save();
  ctx.scale(storySize.scale, storySize.scale);
  dots(ctx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";

  const inner = POINTS.width - 2 * PADDING - 2 * PADDING;
  ctx.font = BODY.font;
  const body = wrap(ctx, inviteTones[2].body, inner);
  ctx.font = OPENER.font;
  const opener = wrap(ctx, `«${inviteOpener}»`, inner);
  const cardHeight = 2 * PADDING + body.length * BODY.height + 14 + opener.length * OPENER.height;
  const total = TITLE.height + GAP + cardHeight + GAP + LINK.height;
  const centre = POINTS.width / 2;
  let y = (POINTS.height - total) / 2;

  ctx.fillStyle = colors.lapis;
  ctx.font = TITLE.font;
  ctx.fillText("یه بیت", centre, y + TITLE.height / 2);
  y += TITLE.height + GAP;

  ctx.shadowColor = `rgba(20, 17, 43, ${0.18})`;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = colors.white;
  ctx.beginPath();
  ctx.roundRect(PADDING, y, POINTS.width - 2 * PADDING, cardHeight, sticker.radius.card);
  ctx.fill();
  ctx.shadowColor = "transparent";

  let line = y + PADDING;
  ctx.fillStyle = colors.muted;
  ctx.font = BODY.font;
  for (const text of body) ctx.fillText(text, centre, (line += BODY.height) - BODY.height / 2);
  line += 14;
  ctx.fillStyle = colors.ink;
  ctx.font = OPENER.font;
  for (const text of opener) ctx.fillText(text, centre, (line += OPENER.height) - OPENER.height / 2);
  y += cardHeight + GAP;

  ctx.font = LINK.font;
  ctx.direction = "ltr";
  const width = ctx.measureText(link).width + 2 * LINK.side;
  ctx.fillStyle = colors.lapis;
  ctx.beginPath();
  ctx.roundRect(centre - width / 2, y, width, LINK.height, LINK.height / 2);
  ctx.fill();
  ctx.fillStyle = colors.white;
  ctx.fillText(link, centre, y + LINK.height / 2);
  ctx.restore();
}

/** What drawing the picture asks of the browser: loading a font, and a canvas (a test gives its own). */
export type StoryEnvironment = {
  loadFont: (font: string) => Promise<unknown>;
  makeCanvas: () => Pick<HTMLCanvasElement, "width" | "height" | "getContext" | "toBlob">;
};

const browser: StoryEnvironment = { loadFont: (font) => document.fonts.load(font), makeCanvas: () => document.createElement("canvas") };

/** The card as a PNG: the fonts are loaded first, or the canvas would draw in a fallback. */
export async function storyImage(link: string, { loadFont, makeCanvas } = browser): Promise<Blob> {
  await Promise.all(storyFonts.map(loadFont));
  const canvas = makeCanvas();
  canvas.width = storySize.width;
  canvas.height = storySize.height;
  drawStoryCard(canvas.getContext("2d")!, link);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no picture"))), "image/png"));
}
