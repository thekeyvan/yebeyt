const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);

/** What a file must start with for each media type the feedback uploads accept. */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "video/mp4": (b) => startsWith(b, [0x66, 0x74, 0x79, 0x70], 4), // "ftyp"
  "video/webm": (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]), // the EBML header
};

/** True when the first bytes are those of the declared media type. */
export const matchesMediaType = (contentType: string, bytes: Uint8Array): boolean => SIGNATURES[contentType]?.(bytes) ?? false;
