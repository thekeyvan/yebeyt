import { statsStore } from "../games/browser";
import { scoreGameOf } from "../games/scoreGame";
import { Taste } from "../onboarding/taste";
import { marksStore } from "../reader/browser";
import { AccountModel, type CredentialSource } from "./accountModel";
import { createApi } from "./api";
import { appleRedirectUri, appleServicesId } from "./config";
import { AppleCredentials } from "./credentials";
import { DivanSync } from "./divanSync";
import { MyStats } from "./myStats";
import { ReactionsSync } from "./reactionsSync";
import { ScoreSync } from "./scoreSync";
import { Session } from "./session";
import { AccountSignOut } from "./signOut";

function build() {
  // Without the Services ID there is nothing to ask: the button is not pressable then.
  const appleCredentials = appleServicesId ? new AppleCredentials(appleServicesId, appleRedirectUri()) : undefined;
  const source: CredentialSource = { apple: () => (appleCredentials ? appleCredentials.signIn() : Promise.reject(new Error("Sign in with Apple is not set up"))) };
  const session = new Session();
  const api = createApi(session.clear);
  const marks = marksStore();
  const stats = statsStore();
  const myStats = new MyStats(stats, session, api);
  const scores = new ScoreSync(session, api, localStorage);
  scores.onSent = () => void myStats.refresh();
  // A round that ends, and the day's puzzle, are reported to the account (nothing is kept for a guest).
  stats.onRoundFinished = (kind, points) => {
    const game = scoreGameOf(kind);
    if (game) scores.report(game, points);
  };
  stats.onDailyFinished = (day, solved, tries, points) => scores.reportDaily(day, solved, tries, points);
  const divan = new DivanSync(marks, session, api);
  const reactions = new ReactionsSync(marks, session, api, localStorage);
  return {
    session,
    api,
    appleCredentials,
    marks,
    stats,
    myStats,
    scores,
    divan,
    reactions,
    taste: new Taste(localStorage),
    account: new AccountModel(session, stats, source, api),
    leaving: new AccountSignOut(session, { marks, stats, reactions, scores, divan }),
  };
}

export type Services = ReturnType<typeof build>;

let services: Services | undefined;

/** What the account is made of in this browser: the session, the models and the syncs, made once, in the browser only (they read localStorage). */
export const accountServices = (): Services => (services ??= build());
