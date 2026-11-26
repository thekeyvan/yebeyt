import type { PrivacyPatch, PrivacySettings } from "../account/api";

export type Patch = PrivacyPatch;

/** The defaults are the board's selection (and the server's: `PRIVACY_DEFAULTS` in apps/server/src/routes/privacy.ts). */
export const defaultPrivacy: PrivacySettings = {
  keptVisibility: "friends",
  dailyVisibility: "friends",
  showOnline: true,
  inGlobalLeaderboard: false,
  messagesFrom: "friends",
  gameInvitesFrom: "all",
  allowReposts: true,
};

const fields = Object.keys(defaultPrivacy) as (keyof PrivacySettings)[];

/** The fields of `next` that differ from `old`: the `PrivacyPatch` of the contract (Me/Privacy/PrivacyStore.swift). */
export function makePatch(old: PrivacySettings, next: PrivacySettings): Patch {
  return Object.fromEntries(fields.filter((field) => old[field] !== next[field]).map((field) => [field, next[field]]));
}

/** The fields of `later` win where both have one. */
export const mergePatch = (earlier: Patch, later: Patch): Patch => ({ ...earlier, ...later });

/** Without the fields that still hold the value `sent` carried (a field changed again meanwhile stays). */
export function removeSent(unsent: Patch, sent: Patch): Patch {
  return Object.fromEntries(Object.entries(unsent).filter(([field, value]) => sent[field as keyof Patch] !== value));
}

export const isEmptyPatch = (patch: Patch): boolean => Object.keys(patch).length === 0;

/** The saved form back as settings: every field the server knows, the default for what is missing or not one of the choices. */
export function parseSettings(value: unknown): PrivacySettings {
  const found = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [field, typeof found[field] === typeof defaultPrivacy[field] ? found[field] : defaultPrivacy[field]])) as PrivacySettings;
}

/** The saved form back as a patch: only fields it knows. */
export function parsePatch(value: unknown): Patch {
  const found = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(fields.filter((field) => typeof found[field] === typeof defaultPrivacy[field]).map((field) => [field, found[field]]));
}
