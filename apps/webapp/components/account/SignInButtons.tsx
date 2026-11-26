"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountModel, Outcome } from "../../lib/account/accountModel";
import { ApiError } from "../../lib/account/api";
import { appleRedirectUri, appleServicesId, googleClientId } from "../../lib/account/config";
import { debugCredential, type DebugAccount } from "../../lib/account/debug";
import { googleName, loadGoogleIdentity } from "../../lib/account/credentials";
import { accountServices } from "../../lib/account/services";
import { devPagesEnabled } from "../../lib/dev";
import { useStore } from "../../lib/library/browser";
import { AppleMark, GoogleMark } from "./Marks";

const apple = "flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-[#000] text-base font-bold text-white disabled:opacity-60";
const google = "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-[#DADCE0] bg-white text-base font-bold text-ink";

/**
 * «ادامه با اپل» and «ادامه با گوگل», with the line that says why a sign-in failed (Account/SignInButtons.swift). Sign in with Apple JS opens its popup from the
 * press; Google Identity Services draws its own button (it is the one that is pressed, and it gives an id token). Until a
 * provider's id is set, its button cannot be pressed and a line says so. `onOutcome` hears how every attempt ended.
 */
export function SignInButtons({ account, onOutcome }: { account: AccountModel | undefined; onOutcome: (outcome: Outcome) => void }) {
  const busy = useStore(account)?.isSigningIn ?? false;
  const [error, setError] = useState<string>();
  const [appleReady, setAppleReady] = useState(false);
  const googleFrame = useRef<HTMLDivElement>(null);
  const missing = !appleServicesId || !googleClientId;

  async function run(attempt: Promise<Outcome>) {
    setError(undefined);
    const outcome = await attempt;
    if (outcome.kind === "failed") setError(outcome.message);
    onOutcome(outcome);
  }

  // The debug sign-in (the phone's `-beytSignedIn 1`), in a build with the debug pages only: `beytSignIn({ username })` signs in as if the buttons had been pressed.
  useEffect(() => {
    if (!account || !devPagesEnabled()) return;
    const debug = window as unknown as { beytSignIn?: (spec?: DebugAccount) => Promise<void> };
    debug.beytSignIn = (spec = {}) => run(account.signInWith(debugCredential(spec, appleRedirectUri())));
    return () => {
      delete debug.beytSignIn;
    };
  });

  useEffect(() => {
    if (!account || !appleServicesId) return;
    accountServices()
      .appleCredentials?.prepare()
      .then(() => setAppleReady(true), () => setError(new ApiError(500).persianMessage));
  }, [account]);

  useEffect(() => {
    const frame = googleFrame.current;
    const clientId = googleClientId;
    if (!account || !clientId || !frame) return;
    let current = true;
    loadGoogleIdentity().then(
      (identity) => {
        if (!current) return;
        identity.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) void run(account.signInWith({ credential: { provider: "google", idToken: credential }, name: googleName(credential) }));
          },
        });
        identity.renderButton(frame, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", locale: "fa", width: Math.min(400, Math.max(200, Math.floor(frame.offsetWidth))) });
      },
      () => current && setError(new ApiError(500).persianMessage),
    );
    return () => {
      current = false;
    };
    // `run` and `onOutcome` are new on every render; the button is set up once per account.
  }, [account]);

  return (
    <div className="flex w-full flex-col gap-2.5" style={{ opacity: busy ? 0.6 : 1 }}>
      <button type="button" disabled={!appleReady || busy} onClick={() => account && void run(account.signIn())} className={apple}>
        <AppleMark />
        ادامه با اپل
      </button>
      {googleClientId ? (
        // Google's own button, drawn by Google in its frame and by its rules (outline, «continue with», pill, Persian); it is the one that is pressed.
        <div ref={googleFrame} className={`flex min-h-10 w-full justify-center ${busy ? "pointer-events-none" : ""}`} />
      ) : (
        <button type="button" disabled className={`${google} disabled:opacity-60`}>
          <GoogleMark />
          ادامه با گوگل
        </button>
      )}
      {missing && <p className="text-center text-xs font-medium text-muted">ورود روی وب به‌زودی</p>}
      {error && (
        <p role="alert" className="text-center text-xs font-medium text-fire">
          {error}
        </p>
      )}
    </div>
  );
}
