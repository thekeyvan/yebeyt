import type { Avatar } from "./api";

/**
 * The parts of a face and their colours, as in the app's `AvatarCatalogue` (apps/ios/Yebeyt/Me/Avatar/AvatarParts.swift;
 * test/avatar-parts.test.ts fails when the two drift).
 */
export const SKINS = { peach: "#F2C29B", sand: "#E8B98A", tan: "#C98F63", brown: "#9C6A45", ivory: "#F8DCC4" };
export const HAIRS = { dark: "#3B2A2A", black: "#14112B", amber: "#FFB703", fire: "#FF4D24", magenta: "#FF3D8B", lapis: "#2F35F5" };
export const BACKGROUNDS = { sun: "#FFE08A", sky: "#E8E9FF", mint: "#BDEBA3", rose: "#FFC2DA", paper: "#F1EFEA", lapis: "#2F35F5" };
export const EYES = ["round", "happy", "wink"] as const;
export const MOUTHS = ["smile", "grin", "calm"] as const;
export const ACCESSORIES = ["none", "ney", "rose", "crown", "helmet", "candle"] as const;

export type Eyes = (typeof EYES)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Accessory = (typeof ACCESSORIES)[number];

/** A face with every part known: colours as hex, variants as ids. */
export type Look = { skin: string; hair: string; background: string; eyes: Eyes; mouth: Mouth; accessory: Accessory };

/** The face everyone starts with (the app's `AvatarParts.standard`), which a person without a face shows. */
const STANDARD: Avatar = { face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun" };

const isId = (options: readonly string[] | Record<string, string>, id: string) => (Array.isArray(options) ? options.includes(id) : Object.hasOwn(options, id));

/** The app's `AvatarCatalogue.isValid`: every part is an id it knows. */
const isValid = (a: Avatar) =>
  isId(SKINS, a.face) && isId(EYES, a.eyes) && isId(HAIRS, a.hair) && isId(MOUTHS, a.mouth) && isId(ACCESSORIES, a.accessory) && isId(BACKGROUNDS, a.background);

/** What to draw for the server's `avatar`: the standard face for null, and, as in the app, for a face with any part id unknown. */
export function look(avatar: Avatar | null): Look {
  const parts = avatar && isValid(avatar) ? avatar : STANDARD;
  return {
    skin: SKINS[parts.face as keyof typeof SKINS],
    hair: HAIRS[parts.hair as keyof typeof HAIRS],
    background: BACKGROUNDS[parts.background as keyof typeof BACKGROUNDS],
    eyes: parts.eyes as Eyes,
    mouth: parts.mouth as Mouth,
    accessory: parts.accessory as Accessory,
  };
}
