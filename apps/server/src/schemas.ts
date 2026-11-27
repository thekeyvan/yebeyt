import { z } from "@hono/zod-openapi";

const part = z.string().min(1).max(32).regex(/^[a-z0-9-]+$/);

/** The parts are ids from the app's catalogue; the server only checks their shape. */
export const avatarSchema = z
  .strictObject({ face: part, eyes: part, hair: part, mouth: part, accessory: part, background: part })
  .openapi("Avatar");

export const userSchema = z
  .object({
    id: z.uuid(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    avatar: avatarSchema.nullable(),
    usernameChangedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    providers: z.array(z.enum(["apple", "google"])),
    email: z.string().nullable().openapi({ description: "The verified email Apple or Google gave for this account (the newest sign-in method that has one; Apple's private relay address counts), or null." }),
    newsOptIn: z.boolean().openapi({ description: "Whether the person chose to get news and offers by email. Off by default; `PUT /v1/me/news` changes it." }),
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

/** A couplet on the phone: "<poemPath>#<coupletIndex>". Used by the divan sync and the feedback technical info. */
export const coupletKeySchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^\/[a-z0-9_\-/]+#\d{1,5}$/)
  .openapi({ example: "/hafez/ghazal/sh3#0", description: "<poemPath>#<coupletIndex>" });
