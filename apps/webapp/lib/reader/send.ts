/** What sending and copying need from the browser: the share sheet where there is one, and the clipboard. */
export type SendEnvironment = {
  share?: (data: { text: string }) => Promise<void>;
  writeText: (text: string) => Promise<void>;
};

/**
 * بفرست: the browser's share sheet (`navigator.share`) with the text; where there is none, or it fails (a closed sheet is not a failure), the text
 * is copied and `copied` is told, which says so.
 */
export async function send(text: string, { share, writeText }: SendEnvironment, copied: () => void): Promise<void> {
  if (share) {
    try {
      await share({ text });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  await copy(text, { writeText }, copied);
}

/** «کپی متن»: the text on the clipboard, and `copied` is told. A clipboard that refuses (no permission) says nothing: the text is not copied. */
export async function copy(text: string, { writeText }: Pick<SendEnvironment, "writeText">, copied: () => void): Promise<void> {
  try {
    await writeText(text);
    copied();
  } catch {
    // Not copied, and no pretending it was.
  }
}

/** The browser's own: what `send` and `copy` get. */
export const browserEnvironment = (): SendEnvironment => ({
  share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
  writeText: (text) => navigator.clipboard.writeText(text),
});
