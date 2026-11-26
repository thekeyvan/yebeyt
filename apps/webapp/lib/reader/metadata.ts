import type { Metadata } from "next";
import { serverStore } from "../poetry/server";
import type { ReaderRoute } from "./route";
import { shortTitle } from "./text";

/**
 * The title and the Open Graph text of a poem's page: the poet and the poem («حافظ · غزل ۳»), and the couplet the link opens at as the description,
 * so a link shared in a messenger shows it. Nothing special when the poem cannot be found (the page itself says so).
 */
export async function poemMetadata({ path, couplet }: ReaderRoute): Promise<Metadata> {
  try {
    const store = await serverStore();
    const poem = await store.poem(path);
    const lines = poem.couplets[Math.min(couplet, poem.couplets.length - 1)];
    const title = `${store.poetOf(path)?.nickname ?? ""} · ${shortTitle(poem.title)}`.replace(/^ · /, "");
    const description = lines && (lines.m2 ? `${lines.m1}\n${lines.m2}` : lines.m1);
    return { title, description, openGraph: { title, description, type: "article", locale: "fa_IR", siteName: "یه بیت" } };
  } catch {
    return {};
  }
}
