import type { DivanSync } from "./divanSync";
import type { ReactionsSync } from "./reactionsSync";
import type { ScoreSync } from "./scoreSync";
import type { Session } from "./session";
import type { GameStats } from "../games/stats";
import type { AvatarStore } from "../me/avatarStore";
import type { PrivacyStore } from "../me/privacyStore";
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

/** What in this browser belongs to an account: the divan with its times, the likes and reposts, the privacy settings and the face, and the scores and reactions not sent yet. */
export type AccountData = { marks: ReaderMarks; stats: GameStats; reactions: ReactionsSync; scores: ScoreSync; divan: DivanSync; privacy: PrivacyStore; avatar: AvatarStore };

/** Whatever is on its way when an account leaves must land (or fail) before this browser is cleared. */
export async function settleAccountData({ divan, reactions, scores, privacy, avatar }: AccountData): Promise<void> {
  await divan.stop();
  await reactions.stop();
  await scores.settle();
  await privacy.settle();
  await avatar.settle();
}

/**
 * Forgets what belongs to the account (`LocalAccountData.clearForSignOut`), so nothing of it is carried over to the next account in this browser: the divan with
 * its times, the likes and reposts and what is unsent, the privacy settings and the face. The game points stay, but only as the leaving account's: the next one
 * may claim just what is earned after. What a guest has anyway (reading, game scores, text settings) stays.
 */
export function clearAccountData({ marks, stats, reactions, scores, privacy, avatar }: AccountData): void {
  stats.release();
  marks.clearDivan();
  marks.clearLikesAndReposts();
  reactions.clear();
  scores.clear();
  privacy.clear();
  avatar.clear();
}

/**
 * «خروج از حساب»: one last sync (the divan, the likes and reposts, an unsent face, unsent privacy changes, the scores), so nothing made in this browser is lost, then the sign-in
 * is forgotten and the account's data goes from the browser. When the last sync did not go through, nothing happens until the person insists (`force`): what is
 * not on the account would be lost.
 */
export class AccountSignOut {
  constructor(
    private readonly session: Pick<Session, "signOut" | "isSignedIn">,
    private readonly data: AccountData,
  ) {}

  async signOut(force = false): Promise<"done" | "unsynced"> {
    const { reactions, scores, divan, privacy, avatar } = this.data;
    if (!force) {
      const divanSent = await divan.syncNow();
      const reactionsSent = await reactions.syncNow();
      await privacy.flush();
      await avatar.flush();
      await scores.flush();
      if (!divanSent || !reactionsSent || scores.hasUnsent || privacy.hasUnsentChanges || avatar.isUnsent) return "unsynced";
    }
    await settleAccountData(this.data);
    // The session is forgotten at once and the server told meanwhile; the account's data goes in the same breath, so nothing shows of it for a person who is out.
    const told = this.session.signOut();
    clearAccountData(this.data);
    await told;
    return "done";
  }
}
