import { apiUrl } from "./config";

export type Avatar = { face: string; eyes: string; hair: string; mouth: string; accessory: string; background: string };
export type Person = { username: string; displayName: string | null; avatar: Avatar | null };
export type Challenge = { creator: Person; game: "jigsaw" | "poet"; items: string[]; score: number; seconds: number; label: string | null };
export type PublicGame = { kind: "mosh" | "duel"; creator: Person; status: "waiting" };

const CODE = /^[0-9A-Za-z]{4}$/;
const USERNAME = /^[A-Za-z0-9_.]{1,20}$/;

/** The JSON at `path`, or null when the server says there is no such thing (404, or 400 for a bad code). Anything else throws. */
async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${apiUrl()}${path}`, { cache: "no-store", headers: { accept: "application/json" } });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`api ${path.split("/").slice(0, 4).join("/")} answered ${res.status}`);
  return (await res.json()) as T;
}

export const getChallenge = (code: string) => (CODE.test(code) ? getJson<Challenge>(`/v1/challenges/${code}`) : Promise.resolve(null));
export const getPublicGame = (code: string) => (CODE.test(code) ? getJson<PublicGame>(`/v1/public/games/${code}`) : Promise.resolve(null));
export const getPublicUser = (username: string) => (USERNAME.test(username) ? getJson<Person>(`/v1/public/users/${username}`) : Promise.resolve(null));
