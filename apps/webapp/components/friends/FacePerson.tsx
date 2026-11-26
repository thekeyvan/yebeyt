import { AvatarFace, type AvatarParts } from "@yebeyt/avatar";

/** Someone's face in a list: a circle with a white border and a soft shadow. A person who hasn't chosen one has the board's face; a hidden stranger (`plain`) is a bare circle (Friends/FriendParts.swift `FaceCircle`). */
export function FacePerson({ parts, size = 40, plain = false }: { parts: AvatarParts | null; size?: number; plain?: boolean }) {
  return (
    <span aria-hidden className="block shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-ring shadow-[0_1px_2.5px_rgba(20,17,43,0.22)]" style={{ width: size, height: size }}>
      {!plain && <AvatarFace avatar={parts} />}
    </span>
  );
}
