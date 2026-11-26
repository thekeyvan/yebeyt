import type { Credential, ProviderSignIn } from "./accountModel";

/** The person closed the provider's sheet. */
export class SignInCanceled extends Error {}

/** SHA-256 as lower-case hex, the form the server compares with the identity token's `nonce`. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-."; // 64 characters: no modulo bias

/** The nonce of Sign in with Apple: Apple gets its SHA-256, the server the raw value. */
export function appleNonce(length = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => alphabet[byte % alphabet.length]).join("");
}

const loading = new Map<string, Promise<void>>();

/** Loads a provider's script once; a failed load is tried again next time. */
export function loadScript(src: string): Promise<void> {
  let loaded = loading.get(src);
  if (!loaded) {
    loaded = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading.delete(src);
        reject(new Error(`${src} did not load`));
      };
      document.head.append(script);
    });
    loading.set(src, loaded);
  }
  return loaded;
}

export type AppleAnswer = { authorization?: { id_token?: string; code?: string; state?: string }; user?: { name?: { firstName?: string; lastName?: string } } };
type AppleAuth = { init(config: Record<string, unknown>): void; signIn(): Promise<AppleAnswer> };

const appleScript = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

async function loadAppleJs(): Promise<AppleAuth> {
  await loadScript(appleScript);
  return (window as unknown as { AppleID: { auth: AppleAuth } }).AppleID.auth;
}

/** Where the `state` sent to Apple waits for the answer's copy of it. */
export const appleStateKey = "apple.state";

const canceled = new Set(["popup_closed_by_user", "user_cancelled_authorize"]);

/**
 * Sign in with Apple JS in a popup (Account/Credentials.swift `AppleSignIn`). Apple wants the hashed nonce when it is set up, so the script is loaded and
 * set up before the press (`prepare`), with a nonce of its own; the press then calls Apple at once, as a popup must, and a new nonce is made for the next one.
 * The server gets the raw nonce, and the return URL the code was asked with. Apple also gets a random `state`, kept in sessionStorage, and an answer that does not
 * carry it back is refused.
 */
export class AppleCredentials {
  private auth?: AppleAuth;
  private nonce?: string;

  constructor(
    private readonly clientId: string,
    private readonly redirectUri: string,
    private readonly load: () => Promise<AppleAuth> = loadAppleJs,
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = sessionStorage,
  ) {}

  async prepare(): Promise<void> {
    this.auth ??= await this.load();
    const raw = appleNonce();
    const state = appleNonce();
    const hashed = await sha256Hex(raw);
    // The state, the nonce and Apple's setup are changed together with nothing awaited between them, so two `prepare`s that overlap cannot leave them from different calls.
    this.storage.setItem(appleStateKey, state);
    this.auth.init({ clientId: this.clientId, scope: "name", redirectURI: this.redirectUri, state, nonce: hashed, usePopup: true });
    this.nonce = raw;
  }

  signIn(): Promise<ProviderSignIn> {
    const { auth, nonce } = this;
    if (!auth || nonce === undefined) return Promise.reject(new Error("Sign in with Apple is not ready"));
    this.nonce = undefined;
    const state = this.storage.getItem(appleStateKey);
    this.storage.removeItem(appleStateKey); // used once; the next `prepare` sets a new one
    const answer = auth.signIn();
    const next = () => void this.prepare().catch(() => undefined);
    return answer.then(
      (result) => {
        next();
        if (state === null || result.authorization?.state !== state) throw new Error("Apple's answer is not to this sign-in");
        const idToken = result.authorization.id_token;
        if (!idToken) throw new Error("Apple gave no identity token");
        const name = [result.user?.name?.firstName, result.user?.name?.lastName].filter(Boolean).join(" ");
        const credential: Credential = { provider: "apple", identityToken: idToken, authorizationCode: result.authorization?.code, nonce, redirectUri: this.redirectUri };
        return { credential, ...(name ? { name } : {}) };
      },
      (error: { error?: string }) => {
        next();
        throw canceled.has(error?.error ?? "") ? new SignInCanceled() : new Error("Sign in with Apple failed");
      },
    );
  }
}

/** The name Google shares, from its id token's payload (it only fills the name field). */
export function googleName(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((idToken.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)))) as { name?: unknown };
    return typeof payload.name === "string" && payload.name !== "" ? payload.name : undefined;
  } catch {
    return undefined;
  }
}

type GoogleId = {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
};

/** Google Identity Services, loaded (once). Its button is drawn by Google, in its own frame; what it gives back is an id token. */
export async function loadGoogleIdentity(): Promise<GoogleId> {
  await loadScript("https://accounts.google.com/gsi/client");
  return (window as unknown as { google: { accounts: { id: GoogleId } } }).google.accounts.id;
}
