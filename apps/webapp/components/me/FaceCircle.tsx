import { AvatarFace, type AvatarParts } from "@yebeyt/avatar";
import { cn } from "../../lib/cn";

/** The face in a white circle (`AvatarView` padded in a white `Circle`): `padding` is the white margin round it, in pixels. */
export function FaceCircle({ parts, size, padding, className }: { parts: AvatarParts; size: number; padding: number; className?: string }) {
  return (
    <span aria-hidden className={cn("block shrink-0 rounded-full bg-white", className)} style={{ width: size, height: size, padding }}>
      <AvatarFace avatar={parts} />
    </span>
  );
}
