import { z } from "@hono/zod-openapi";

export const DISPLAY_NAME_MAX = 30;

/** The stored form: trimmed. */
export const normalizeDisplayName = (name: string): string => name.trim();

/** Checks a normalized name: 1–30 characters, no control characters (ZWNJ and other format characters are fine). */
export function displayNameProblem(name: string): "empty" | "too_long" | "control_chars" | null {
  const length = [...name].length;
  if (length === 0) return "empty";
  if (length > DISPLAY_NAME_MAX) return "too_long";
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name)) return "control_chars";
  return null;
}

export const displayNameSchema = z
  .string()
  .max(200)
  .refine((name) => displayNameProblem(normalizeDisplayName(name)) === null)
  .openapi({ description: `1–${DISPLAY_NAME_MAX} characters after trimming, no control characters.`, example: "علی" });
