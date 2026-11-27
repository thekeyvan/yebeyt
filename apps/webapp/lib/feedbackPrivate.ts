/**
 * Spread on a view that shows message text, a preview of it or text typed (the composer, a note, a search field): `{...feedbackPrivate}`. The feedback screenshot
 * (W9) blanks every element with the attribute, and nothing shown in a recording is left out of it (`.feedbackPrivate()` on the phone).
 */
export const feedbackPrivate = { "data-feedback-private": "" } as const;
