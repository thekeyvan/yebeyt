import { storyImage } from "./storyCard";

const fileName = "yebeyt-invite.png";

/**
 * «استوری»: the picture of the invite (`storyImage`) through the browser's share sheet where it takes files; elsewhere it is saved as a file, which the person
 * can post from their gallery. A closed share sheet is not a failure.
 */
export async function shareStory(link: string): Promise<void> {
  const blob = await storyImage(link);
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  const address = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href: address, download: fileName });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(address), 1000);
}
