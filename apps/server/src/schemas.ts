import { z } from "@hono/zod-openapi";

export const userSchema = z
  .object({
    id: z.uuid(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    usernameChangedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    providers: z.array(z.enum(["apple", "google"])),
  })
  .openapi("User");

export const sessionSchema = z
  .object({
    accessToken: z.string().openapi({ description: "JWT, valid 15 minutes." }),
    refreshToken: z.string().openapi({ description: "Opaque, valid 60 days, single use: every refresh returns a new one." }),
    user: userSchema,
  })
  .openapi("Session");

export const refreshBodySchema = z.object({ refreshToken: z.string().min(1).max(200) }).openapi("RefreshRequest");

export const usernameSchema = z.string().min(1).max(64).openapi({ example: "hafez_fan" });

export type UserView = z.infer<typeof userSchema>;
