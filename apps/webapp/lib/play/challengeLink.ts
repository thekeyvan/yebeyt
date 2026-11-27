/** The link of a challenge in a message: «yebeyt.com/c/7KQ2». A tap on it in a chat opens the board of the challenge in the web app (Play/ChallengeLink.swift). */
const pattern = (): RegExp => /(?:https?:\/\/)?(?:www\.)?yebeyt\.com\/c\/([0-9A-Za-z]{4})(?![0-9A-Za-z])/g;

/** The code of the first challenge link in a text, undefined when there is none. */
export const codeIn = (text: string): string | undefined => pattern().exec(text)?.[1];

/** The code of a link tapped: «https://yebeyt.com/c/7KQ2». */
export const codeOfUrl = (url: string): string | undefined => codeIn(url);

/** The text cut into plain parts and challenge links (each with its code, which the web app opens at `/c/<code>`). */
export function linked(text: string): { text: string; code?: string }[] {
  const parts: { text: string; code?: string }[] = [];
  let from = 0;
  for (const match of text.matchAll(pattern())) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index) });
    parts.push({ text: match[0], code: match[1] });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}

/** Where a challenge's board is in the web app. */
export const boardPath = (code: string): string => `/c/${code}`;
