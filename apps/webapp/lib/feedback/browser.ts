import { accountServices } from "../account/services";
import { currentTextSettings } from "../reader/browser";
import { parseRoute } from "../reader/route";
import { feedbackLog } from "./log";
import { screenAt } from "./screens";
import { networkKind, coupletKey, type TechnicalInfo } from "./technical";
import { textSettingValues } from "./textSettings";

/** The word the browser has for how it is connected, where it has one (Chrome on Android). */
const connectionType = (): string | undefined => (navigator as Navigator & { connection?: { type?: string } }).connection?.type;

/** The poem the address opens, if it is one (an address that does not decode is none). */
function openPoem(pathname: string, search: string): ReturnType<typeof parseRoute> | undefined {
  if (!pathname.startsWith("/poem/")) return undefined;
  try {
    return parseRoute(pathname.slice("/poem/".length).split("/").map(decodeURIComponent), Object.fromEntries(new URLSearchParams(search)));
  } catch {
    return undefined;
  }
}

/**
 * What a bug report may say about the state of the moment: the screen at the address, and for a poem its couplet and mode (the address keeps both), the text settings,
 * the connection, whether someone is signed in, and the log (`feedbackLog`). Never typed text, messages, a phone number, an address or a place.
 */
export function currentInfo(): TechnicalInfo {
  const { pathname, search } = window.location;
  const poem = openPoem(pathname, search);
  const couplet = poem && coupletKey(poem.path, poem.couplet);
  return {
    screen: screenAt(pathname),
    ...(couplet ? { couplet } : {}),
    ...(poem ? { mode: poem.mode === "couplet" ? "بیت به بیت" : "کل شعر" } : {}),
    textSettings: textSettingValues(currentTextSettings()),
    network: networkKind(navigator.onLine, connectionType()),
    accountState: accountServices().session.isSignedIn ? "signedIn" : "guest",
    recentErrors: [...feedbackLog.errors],
    steps: [...feedbackLog.steps],
  };
}
