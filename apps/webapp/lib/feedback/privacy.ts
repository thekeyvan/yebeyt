import { colors } from "../tokens";

/**
 * What a report must never carry: what the person typed and the messages (docs/yebeyt-2.md, privacy). A view that shows such content says
 * `{...feedbackPrivate}` (`lib/feedbackPrivate.ts`), and every field a person types in counts too: an input, a textarea, a select, an editable element. Two things follow from it:
 * the screenshot of the page is taken with each of those drawn as a solid block (`blankPrivate`), and while the screen is recorded they are covered (`lib/feedback/covers.ts`).
 */
export const privateSelector = "[data-feedback-private], input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * Turns every private element of `root` (a clone of the page, not the page) into a blank: its content, its attributes (a value, a placeholder, a label)
 * and its decoration are gone, and what is left is its box, filled with the track colour. It is done to the copy that is drawn, so no text of
 * these elements is ever in the picture, and nothing is painted over it afterwards that could miss. Answers how many it blanked.
 */
export function blankPrivate(root: ParentNode): number {
  let blanked = 0;
  for (const element of root.querySelectorAll<HTMLElement>(privateSelector)) {
    if (!root.contains(element)) continue; // inside one that was blanked, and gone with it
    element.replaceChildren();
    for (const name of element.getAttributeNames()) if (name !== "style") element.removeAttribute(name);
    const { style } = element;
    for (const [name, value] of Object.entries({
      background: colors.trackLight,
      "border-color": "transparent",
      "border-radius": "min(14px, 50%)",
      "box-shadow": "none",
      outline: "none",
      color: "transparent",
      "-webkit-text-fill-color": "transparent",
      "text-shadow": "none",
      appearance: "none",
    })) {
      style.setProperty(name, value, "important");
    }
    blanked++;
  }
  return blanked;
}
