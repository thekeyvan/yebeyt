import { cache } from "react";
import { apiUrl } from "./config";

export type Avatar = { face: string; eyes: string; hair: string; mouth: string; accessory: string; background: string };
export type Person = { username: string; displayName: string | null; avatar: Avatar | null };
export type Challenge = { creator: Person; game: "jigsaw" | "poet"; items: string[]; score: number; seconds: number; label: string | null };
export type PublicGame = { kind: "mosh" | "duel"; creator: Person; status: "waiting" };

const TIMEOUT_MS = 5000;
const CODE = /^[0-9A-Za-z]{4}$/;
const USERNAME = /^[A-Za-z0-9_.]{1,20}$/;

/** The JSON at `path`, or null when the server says there is no such thing (404, or 400 for a bad code). Anything else throws. */
async function getJson<T>(path: string): Promise<T | null> {
  // A good answer is kept for a minute (Next's data cache stores only 200s), which spares the server's shared bucket.
  const res = await fetch(`${apiUrl()}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 60 } });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`api ${path.split("/").slice(0, 4).join("/")} answered ${res.status}`);
  return (await res.json()) as T;
}

// `cache` shares a lookup between a page and its generateMetadata within one request (404s are not kept by the data cache).
export const getChallenge = cache((code: string) => (CODE.test(code) ? getJson<Challenge>(`/v1/challenges/${code}`) : Promise.resolve(null)));
export const getPublicGame = cache((code: string) => (CODE.test(code) ? getJson<PublicGame>(`/v1/public/games/${code}`) : Promise.resolve(null)));
export const getPublicUser = cache((username: string) => (USERNAME.test(username) ? getJson<Person>(`/v1/public/users/${username}`) : Promise.resolve(null)));
