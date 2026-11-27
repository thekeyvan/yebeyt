import { ApiError } from "../account/api";
import { decodeLive, type LiveEvent } from "./liveEvents";

/** What a socket tells (a browser `WebSocket` or a test's): `code` is the server's close code, undefined when the socket was lost without one. */
export type LiveHandlers = { open(): void; frame(text: string): void; close(code: number | undefined): void };

/** One WebSocket, as `LiveConnection` needs it. */
export type LiveSocket = { send(text: string): void; close(): void };

export type LiveSocketFactory = { open(url: string, handlers: LiveHandlers): LiveSocket };

/** What the web app's `/auth/live` gives: a fresh access token (the route refreshes the session when it must) and the socket's address. */
export type LiveToken = { token: string; url: string };

/** How long to wait before the next try: 1, 2, 4, … seconds, never more than 30, each a little randomised. */
export function backoffMs(failures: number, jitter: () => number = () => 0.8 + Math.random() * 0.4): number {
  return Math.round(Math.min(30, 2 ** (Math.max(failures, 1) - 1)) * jitter() * 1000);
}

/** The server closes a socket that sends a frame of more than 4 KB (1009): the page never sends one. */
export const maxFrameBytes = 4096;

export type LiveState = "stopped" | "connecting" | "ready" | "evicted";

type Outcome = { kind: "noToken"; error: unknown } | { kind: "lost"; wasReady: boolean; code?: number };

type Options = {
  factory: LiveSocketFactory;
  /** A token for the socket; `renew` is true after the server refused the last one (4401), so the session is refreshed and the same token is not handed out again. */
  token: (renew: boolean) => Promise<LiveToken>;
  onEvent: (event: LiveEvent) => void;
  onReady: () => void;
  /** What the backoff sleeps with (tests make it instant). */
  wait?: (ms: number) => Promise<void>;
  backoff?: (failures: number) => number;
};

/**
 * The one WebSocket (`/v1/live`) the page keeps open while it is in front and someone is signed in (Messages/LiveConnection.swift). The first message is the
 * access token; the server answers `ready`. It reconnects with a growing wait; when the token has expired (close 4401, the server closes at its expiry) it asks
 * for a new one at once, which `/auth/live` makes by refreshing the session; when a sixth socket of the same person closed this one (4409) it stops until
 * the next `start()` after a `stop()` (the page coming back). Events are handed on as they come; they are not kept while the socket is closed, so `onReady`
 * (called after every connect) is where the stores read their lists again. `send` is for a duel's answers. A browser cannot send a ping: the server's are answered by the browser itself.
 */
export class LiveConnection {
  private current: LiveState = "stopped";
  /** Each `start` is a run of its own; a run that was stopped must not touch the next one's socket. */
  private run = 0;
  private socket?: LiveSocket;
  private cancel?: () => void;

  constructor(private readonly options: Options) {}

  get state(): LiveState {
    return this.current;
  }

  /** Opens the socket if it is not open (or being opened). Does nothing after an eviction until `stop()`. */
  start(): void {
    if (this.current !== "stopped") return;
    this.current = "connecting";
    void this.loop(++this.run);
  }

  /** Closes the socket and forgets an eviction: the page went away for long or someone signed out. */
  stop(): void {
    this.run += 1;
    this.cancel?.();
    this.socket?.close();
    this.socket = undefined;
    this.current = "stopped";
  }

  /** Sends a text frame (a duel answer). False when the socket is not ready, or the frame is over the server's 4 KB, which would close the socket: nothing is sent then. */
  send(text: string): boolean {
    if (this.current !== "ready" || !this.socket || new TextEncoder().encode(text).length > maxFrameBytes) return false;
    try {
      this.socket.send(text);
      return true;
    } catch {
      return false;
    }
  }

  private async loop(run: number): Promise<void> {
    const wait = this.options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const backoff = this.options.backoff ?? backoffMs;
    let failures = 0;
    let renew = false;
    while (run === this.run) {
      this.current = "connecting";
      const outcome = await this.connectOnce(run, renew);
      if (run !== this.run) return;
      renew = outcome.kind === "lost" && outcome.code === 4401;
      if (outcome.kind === "noToken") {
        if (outcome.error instanceof ApiError && outcome.error.isUnauthorized) return this.finish("stopped"); // signed out
        failures += 1;
      } else if (outcome.code === 4409) {
        return this.finish("evicted");
      } else if (outcome.code === 4403) {
        return this.finish("stopped");
      } else if (outcome.code === 4401) {
        failures = outcome.wasReady ? 0 : failures + 1;
        if (failures <= 1) continue; // a token that expired is made new and used at once
      } else {
        failures = outcome.wasReady ? 1 : failures + 1;
      }
      await wait(backoff(failures));
    }
  }

  private finish(state: LiveState): void {
    this.current = state;
    this.socket = undefined;
  }

  private async connectOnce(run: number, renew: boolean): Promise<Outcome> {
    let given;
    try {
      given = await this.options.token(renew);
    } catch (error) {
      return { kind: "noToken", error };
    }
    // Stopped while the token was coming: this run is old; it must not open a socket or touch the new run's.
    if (run !== this.run) return { kind: "lost", wasReady: false };
    return new Promise<Outcome>((resolve) => {
      let ready = false;
      const socket = this.options.factory.open(given.url, {
        open: () => socket.send(JSON.stringify({ type: "auth", token: given.token })),
        frame: (text) => {
          if (run !== this.run) return;
          const event = decodeLive(text);
          if (!event) return;
          if (event.type === "ready") {
            ready = true;
            this.current = "ready";
            this.options.onReady();
          } else if (ready) {
            this.options.onEvent(event);
          }
        },
        close: (code) => {
          // A lost socket sends nothing more, while the next try waits.
          if (run === this.run && this.socket === socket) {
            this.socket = undefined;
            this.current = "connecting";
          }
          resolve({ kind: "lost", wasReady: ready, code });
        },
      });
      this.socket = socket; // only the current run gets here: an old one returned above
      this.cancel = () => resolve({ kind: "lost", wasReady: ready });
    });
  }
}
