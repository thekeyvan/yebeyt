"use client";

import { useAccount } from "../account/AccountProvider";
import { toast } from "../ui/Toast";
import { useMarks } from "../../lib/reader/browser";
import { browserEnvironment, copy, send } from "../../lib/reader/send";
import { copyText, shareText } from "../../lib/reader/text";
import type { Reader } from "./useReader";

/**
 * پسند, بازنشر, بفرست and نگه دار, and «کپی متن», on one couplet of the open poem. A press answers whether the mark turned on (`true`), off
 * (`false`), or did not change (nothing): پسند and بازنشر need an account (`account.require(.likes)`), which until W4 is the gate.
 */
export function useCoupletActions(reader: Reader, couplet: number) {
  const marks = useMarks();
  const account = useAccount();
  const { content } = reader;
  const path = content?.poem.path ?? "";
  const line = content?.poem.couplets[couplet];
  const copied = () => toast("کپی شد");
  return {
    liked: marks.contains("liked", path, couplet),
    reposted: marks.contains("reposted", path, couplet),
    kept: marks.contains("kept", path, couplet),
    like: () => account.require("likes"),
    repost: () => account.require("likes"),
    send(): true {
      if (content && line) void send(shareText(line, content.poet, content.title), browserEnvironment(), copied);
      return true;
    },
    keep(): boolean {
      marks.toggleKept(path, couplet, (text, undo) => toast(text, undo));
      return marks.contains("kept", path, couplet);
    },
    copy() {
      if (content && line) void copy(copyText(line, content.poet), browserEnvironment(), copied);
    },
  };
}

export type CoupletActions = ReturnType<typeof useCoupletActions>;
