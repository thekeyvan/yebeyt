import type { AvatarParts } from "@yebeyt/avatar";
import { standardParts } from "../../lib/me/avatarCatalogue";
import { FaceCircle } from "../me/FaceCircle";

/** A person's face on a white-bordered round sticker, with the green dot when they are online (Messages/MessageViews.swift `Face`). */
export function ChatFace({ parts, size, padding = 3, online = false }: { parts: AvatarParts | null; size: number; padding?: number; online?: boolean }) {
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <FaceCircle parts={parts ?? standardParts} size={size} padding={padding} className="shadow-[0_1px_4px_rgba(20,17,43,0.22)]" />
      {online && <span aria-hidden data-testid="online-dot" className="absolute -bottom-0.5 -left-0.5 size-3.5 rounded-full border-[3px] border-white bg-green" />}
    </span>
  );
}
