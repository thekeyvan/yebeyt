import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChallengePage from "../app/(fa)/c/[code]/page";
import GamePage from "../app/(fa)/g/[code]/page";
import InvitePage from "../app/(fa)/i/[username]/page";

const avatar = { face: "brown", eyes: "wink", hair: "lapis", mouth: "calm", accessory: "rose", background: "rose" };
const creator = { username: "niloofar", displayName: "نیلوفر", avatar };
const answers: Record<string, unknown> = {
  "/v1/public/users/niloofar": creator,
  "/v1/public/games/MOSH": { kind: "mosh", creator, status: "waiting" },
  "/v1/challenges/7KQ2": { creator, game: "jigsaw", items: ["a", "b"], score: 1, seconds: 30, label: null },
};
const server = (creatorAvatar: unknown) =>
  vi.fn<typeof fetch>(async (url) => {
    const body = answers[new URL(String(url)).pathname];
    const copy = JSON.parse(JSON.stringify(body)) as { creator?: { avatar: unknown }; avatar?: unknown };
    if (copy.creator) copy.creator.avatar = creatorAvatar;
    else copy.avatar = creatorAvatar;
    return new Response(JSON.stringify(copy));
  });

afterEach(() => vi.unstubAllGlobals());

// The chosen skin (brown), hair (lapis) and background (rose) are drawn, and the standard face's are not.
const chosen = (html: string) => ["#9C6A45", "#FFC2DA", 'd="M90 138 Q100 142 110 138"'].every((part) => html.includes(part)) && !html.includes("#F2C29B");

describe("the link pages draw the face the person chose", () => {
  const pages = [
    ["/i/<username>", () => InvitePage({ params: Promise.resolve({ username: "niloofar" }) })],
    ["/g/<code>", () => GamePage({ params: Promise.resolve({ code: "MOSH" }) })],
    ["/c/<code>", () => ChallengePage({ params: Promise.resolve({ code: "7KQ2" }) })],
  ] as const;

  for (const [name, page] of pages) {
    it(name, async () => {
      vi.stubGlobal("fetch", server(avatar));
      expect(chosen(renderToStaticMarkup(await page()))).toBe(true);
    });

    it(`${name}: the standard face when the person has none`, async () => {
      vi.stubGlobal("fetch", server(null));
      const html = renderToStaticMarkup(await page());
      expect(html).toContain("#F2C29B");
      expect(html).not.toContain("#9C6A45");
    });
  }
});
