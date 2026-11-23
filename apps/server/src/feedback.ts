import { z } from "@hono/zod-openapi";
import { coupletKeySchema } from "./schemas.js";

const TYPES = ["bug", "annoyed", "idea", "game", "liked"] as const;
const text = z.string().trim().min(1).max(2000);

const technicalSchema = z
  .strictObject({
    screen: z.string().min(1).max(64),
    couplet: coupletKeySchema,
    mode: z.string().min(1).max(32),
    recitationPosition: z.number().min(0).max(1_000_000).openapi({ description: "Seconds." }),
    textSettings: z
      .record(z.string().min(1).max(32), z.union([z.string().max(40), z.number(), z.boolean()]))
      .refine((o) => Object.keys(o).length <= 20, "at most 20 settings"),
    network: z.enum(["wifi", "cellular", "offline", "unknown"]),
    accountState: z.enum(["guest", "signedIn"]),
    recentErrors: z.array(z.string().max(200)).max(20),
    steps: z.array(z.string().max(100)).max(20),
  })
  .partial()
  .openapi("FeedbackTechnical", { description: "Only these keys; anything else is refused." });

const gameSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(60).optional(),
    how: text,
    players: z.enum(["solo", "friends", "both"]),
  })
  .openapi("FeedbackGameIdea");

/** Which optional fields each type may carry. `text` is required for every type except `game`, where it is optional. */
const ALLOWED: Record<(typeof TYPES)[number], readonly string[]> = {
  bug: ["frequency", "screen", "technical"],
  annoyed: ["screen"],
  idea: [],
  game: ["game"],
  liked: [],
};

export const feedbackRequestSchema = z
  .strictObject({
    type: z.enum(TYPES),
    text: text.optional(),
    frequency: z.enum(["always", "sometimes", "once"]).optional(),
    game: gameSchema.optional(),
    screen: z.string().min(1).max(64).optional(),
    technical: technicalSchema.optional(),
    appVersion: z.string().min(1).max(20),
    deviceModel: z.string().min(1).max(40),
    osVersion: z.string().min(1).max(20),
  })
  .superRefine((body, ctx) => {
    const allowed = ALLOWED[body.type];
    for (const key of ["frequency", "game", "screen", "technical"] as const) {
      if (body[key] !== undefined && !allowed.includes(key)) ctx.addIssue({ code: "custom", path: [key], message: `not allowed on ${body.type}` });
    }
    if (body.type === "game" ? body.game === undefined : body.text === undefined) {
      ctx.addIssue({ code: "custom", path: [body.type === "game" ? "game" : "text"], message: "required" });
    }
  })
  .openapi("FeedbackRequest", {
    description:
      "Rules per type. bug: text, optional frequency, screen and technical. annoyed: text, optional screen. idea and liked: text only. game: a `game` idea, text optional. appVersion, deviceModel and osVersion go with every type. The body is limited to 32 KB.",
  });

export const feedbackCreatedSchema = z
  .object({
    id: z.uuid(),
    uploadToken: z.string().openapi({ description: "Random, valid 15 minutes: send it as X-Upload-Token when uploading attachments." }),
  })
  .openapi("FeedbackCreated");
