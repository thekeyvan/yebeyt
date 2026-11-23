import { z } from "@hono/zod-openapi";

export const ERROR_CODES = [
  "invalid_request",
  "bad_timestamp",
  "divan_full",
  "invalid_token",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "username_taken",
  "username_reserved",
  "username_too_short",
  "username_too_long",
  "username_bad_chars",
  "username_change_too_soon",
  "apple_revoke_failed",
  "payload_too_large",
  "unsupported_media_type",
  "internal_error",
  "unavailable",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorSchema = z
  .object({
    error: z.enum(ERROR_CODES),
    allowedAt: z.iso.datetime().optional().openapi({ description: "With username_change_too_soon: when the next change is allowed." }),
  })
  .openapi("Error");

/** Thrown by handlers; the app turns it into `{ error: code }` with the status. */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 502 | 503,
    readonly code: ErrorCode,
    readonly extra: { allowedAt?: string } = {},
  ) {
    super(code);
  }
}

/** Response entries for a route's `responses`. */
export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});
