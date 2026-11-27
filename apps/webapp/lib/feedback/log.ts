import type { ScreenName } from "./screens";
import { listLimit } from "./technical";

/** What a call that failed says about itself: its status (0 when the server could not be reached) and the server's code, if it gave one. */
export type FailedCall = { status: number; code?: string };

/**
 * What a bug report may know about the last minutes, kept in memory only and never written anywhere (FeedbackLog.swift): the screens visited (names from `ScreenName`,
 * never text) and the codes of the errors shown to the person (never messages). Each is a small ring: only the last 20 are kept.
 */
export class FeedbackLog {
  private visited: ScreenName[] = [];
  private codes: string[] = [];

  get steps(): readonly ScreenName[] {
    return this.visited;
  }

  get errors(): readonly string[] {
    return this.codes;
  }

  visit(screen: ScreenName): void {
    if (this.visited.at(-1) === screen) return;
    this.visited = [...this.visited, screen].slice(-listLimit);
  }

  /** The place where an error's Persian line is chosen for the screen calls this. */
  record(error: FailedCall): void {
    this.codes = [...this.codes, codeOf(error)].slice(-listLimit);
  }
}

/** «429 rate_limited», «network»: a code, never the message or anything the server said besides its code. */
export function codeOf({ status, code }: FailedCall): string {
  if (status === 0) return "network";
  if (status === 502) return "bad_response";
  return `${status} ${code ?? "unknown"}`;
}

/** The log of this tab. */
export const feedbackLog = new FeedbackLog();
