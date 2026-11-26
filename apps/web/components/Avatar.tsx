import { AvatarFace } from "@yebeyt/avatar";
import type { Avatar as Parts } from "../lib/api";

/** The face in the amber sticker circle of the link pages (`.avatar` in globals.css); the drawing is the shared package's, the one the web app uses too. */
export function Avatar({ avatar, large = false }: { avatar: Parts | null; large?: boolean }) {
  return (
    <span className={large ? "avatar large" : "avatar"} aria-hidden="true">
      <AvatarFace avatar={avatar} />
    </span>
  );
}
