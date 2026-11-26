"use client";

import { useAccount } from "../account/AccountProvider";
import { toast } from "../ui/Toast";
import { useMarks } from "../../lib/reader/browser";
import type { Couplet } from "../../lib/poetry/models";
import { browserEnvironment, copy, send } from "../../lib/reader/send";
import { copyText, shareText } from "../../lib/reader/text";
import type { Reader } from "./useReader";

/** The couplet the actions are for: its poem's path, poet and title, and its two lines. */
export type ActionTarget = { path: string; poet: string; title: string; line?: Couplet };

/**
 * پسند, بازنشر, بفرست and نگه دار, and «کپی متن», on one couplet (`couplet` is its 0-based place in the poem). A press answers whether the
 * mark turned on (`true`), off (`false`), or did not change (nothing): پسند and بازنشر need an account (`account.require(.likes)`): a guest gets the gate, and
 * the press goes ahead once they have signed in (so it answers nothing then); taking a mark back needs none.
 */
export function useMarkActions(target: ActionTarget | undefined, couplet: number) {
  const marks = useMarks();
  const account = useAccount();
  const path = target?.path ?? "";
  const line = target?.line;
  const copied = () => toast("کپی شد");
  const react = (mark: "liked" | "reposted") => () => {
    let on: boolean | undefined;
    account.require("likes", () => (on = marks.toggle(mark, path, couplet)), { needed: !marks.contains(mark, path, couplet) });
    return on;
  };
  return {
    liked: marks.contains("liked", path, couplet),
    reposted: marks.contains("reposted", path, couplet),
    kept: marks.contains("kept", path, couplet),
    like: react("liked"),
    repost: react("reposted"),
    send(): true {
      if (target && line) void send(shareText(line, target.poet, target.title), browserEnvironment(), copied);
      return true;
    },
    keep(): boolean {
      marks.toggleKept(path, couplet, (text, undo) => toast(text, undo));
      return marks.contains("kept", path, couplet);
    },
    copy() {
      if (target && line) void copy(copyText(line, target.poet), browserEnvironment(), copied);
    },
  };
}

/** The marks and actions on one couplet of the open poem. */
export function useCoupletActions(reader: Reader, couplet: number) {
  const { content } = reader;
  return useMarkActions(content && { path: content.poem.path, poet: content.poet, title: content.title, line: content.poem.couplets[couplet] }, couplet);
}

export type CoupletActions = ReturnType<typeof useMarkActions>;
