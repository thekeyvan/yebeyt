import { randomInt } from "node:crypto";

/** Crockford's base32 without I, L, O and U: letters people do not mix up when they read a code aloud. */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 4;

export const newCode = (): string => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** A code as people type it: any case, O as 0, I and L as 1 (Crockford's rule). */
export const normalizeCode = (raw: string): string => raw.toUpperCase().replaceAll("O", "0").replaceAll(/[IL]/g, "1");

export const isCode = (raw: string): boolean => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(normalizeCode(raw));
