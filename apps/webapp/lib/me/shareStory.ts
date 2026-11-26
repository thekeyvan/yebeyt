import { storyImage } from "./storyCard";

const fileName = "yebeyt-invite.png";

/** The picture of the invite as a file, drawn ahead of the tap: a share sheet must be opened inside the gesture, which drawing (it waits for the fonts) would outlast. */
export async function storyFile(link: string): Promise<File> {
  return new File([await storyImage(link)], fileName, { type: "image/png" });
}

/**
 * «استوری»: the picture through the browser's share sheet where it takes files; elsewhere it is saved as a file, which the person can post from their gallery.
 * Nothing is awaited before `navigator.share`, so it runs inside the tap. A closed share sheet is not a failure.
 */
export async function shareStory(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  const address = URL.createObjectURL(file);
  const anchor = Object.assign(document.createElement("a"), { href: address, download: fileName });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(address), 1000);
}
