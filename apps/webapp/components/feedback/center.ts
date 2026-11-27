import { FeedbackCenter } from "../../lib/feedback/center";
import { capturePage } from "../../lib/feedback/screenshot";
import { currentInfo } from "../../lib/feedback/browser";
import { startCovers } from "../../lib/feedback/covers";
import { currentDevice } from "../../lib/feedback/device";
import { currentRecorder } from "../../lib/feedback/recorder";
import { toast } from "../ui/Toast";

let center: FeedbackCenter | undefined;

/** The feedback flow of this tab, made once: the page, the browser's recorder and the toast are what it is built on. */
export const feedbackCenter = (): FeedbackCenter =>
  (center ??= new FeedbackCenter({
    capture: capturePage,
    recorder: currentRecorder(),
    info: currentInfo,
    device: currentDevice,
    say: toast,
    cover: startCovers,
    drawn: () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    dismissKeyboard: () => (document.activeElement as HTMLElement | null)?.blur(),
  }));

/** The «بازخورد» of the settings, and the shortcut: opens the sheet of choices over the page as it is. */
export const openFeedback = (): void => void feedbackCenter().open();
