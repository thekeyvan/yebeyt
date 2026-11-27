import { devPagesEnabled } from "../dev";

/** The header that asks the door's debug server to answer the games and challenges of a visitor with no session (`sessionStorage.beytPlayStub = "1"`, the phone's `-beytPlayStub 1`): only in a development build or one made with NEXT_PUBLIC_DEV_PAGES=1. */
export const playStubHeader = "x-beyt-play-stub";

export function playStubHeaders(): Record<string, string> {
  try {
    return devPagesEnabled() && sessionStorage.getItem("beytPlayStub") === "1" ? { [playStubHeader]: "1" } : {};
  } catch {
    return {};
  }
}
