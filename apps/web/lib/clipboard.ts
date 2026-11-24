/** Copies `text` to the clipboard. True when it worked; never throws, and never waits longer than `timeoutMs`. */
export async function copyText(text: string, timeoutMs = 1500): Promise<boolean> {
  const write = globalThis.navigator?.clipboard?.writeText;
  if (!write) return false;
  const attempt = write.call(navigator.clipboard, text).then(
    () => true,
    () => false,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), timeoutMs)));
  return Promise.race([attempt, timeout]).finally(() => clearTimeout(timer));
}
