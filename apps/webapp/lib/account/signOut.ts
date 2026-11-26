import type { DivanSync } from "./divanSync";
import type { ReactionsSync } from "./reactionsSync";
import type { ScoreSync } from "./scoreSync";
import type { Session } from "./session";
import type { GameStats } from "../games/stats";
import type { ReaderMarks } from "../reader/marks";

/** The question before «خروج از حساب»: what it says is what `AccountSignOut` does (Me/Settings/AccountLeaving.swift). */
export const signOutCopy = {
  title: "از حسابت بیرون بری؟",
  message: "دیوانت به حسابت همگام می‌شه و از این گوشی پاک می‌شه؛ با ورود دوباره برمی‌گرده.",
  confirm: "بیرون برو",
  stay: "نه",
};

/** Shown when the last sync before signing out did not go through: what is not on the account would be lost. */
export const unsyncedCopy = {
  title: "همه‌ی بیت‌هات هنوز به حسابت نرسیده. اگه الان خارج بشی، از این گوشی پاک می‌شن.",
  stay: "بمونم",
  leave: "خروج",
};

type Data = { marks: ReaderMarks; stats: GameStats; reactions: ReactionsSync; scores: ScoreSync; divan: DivanSync };

/**
 * «خروج از حساب»: one last sync (the divan, the likes and reposts, the scores), so nothing made in this browser is lost, then the sign-in is forgotten and the
 * account's data goes from the browser: the divan with its times, the likes and reposts, and what is unsent. The game points stay, but only as the leaving
 * account's: the next one may claim just what is earned after. What a guest has anyway (reading, game scores, text settings) stays. When the last sync did not go
 * through, nothing happens until the person insists (`force`): what is not on the account would be lost.
 */
export class AccountSignOut {
  constructor(
    private readonly session: Pick<Session, "signOut" | "isSignedIn">,
    private readonly data: Data,
  ) {}

  async signOut(force = false): Promise<"done" | "unsynced"> {
    const { marks, stats, reactions, scores, divan } = this.data;
    if (!force) {
      const divanSent = await divan.syncNow();
      const reactionsSent = await reactions.syncNow();
      await scores.flush();
      if (!divanSent || !reactionsSent || scores.hasUnsent) return "unsynced";
    }
    await divan.stop();
    await reactions.stop();
    await scores.settle();
    // The session is forgotten at once and the server told meanwhile; the account's data goes in the same breath, so nothing shows of it for a person who is out.
    const told = this.session.signOut();
    stats.release();
    marks.clearDivan();
    marks.clearLikesAndReposts();
    reactions.clear();
    scores.clear();
    await told;
    return "done";
  }
}
