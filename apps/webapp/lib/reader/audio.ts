import type { MakeEngine } from "./player";

/** The recitation's audio underneath `RecitationPlayer`: an `<audio>` element (Reader/RecitationEngine.swift's AVPlayer). */
export const audioEngine: MakeEngine = (url, events) => {
  const audio = new Audio();
  audio.preload = "auto";
  let pending: ((done: boolean) => void) | undefined;
  const listeners: Record<string, () => void> = {
    loadedmetadata: () => events.ready(),
    timeupdate: () => events.tick(audio.currentTime, audio.duration),
    ended: () => events.ended(),
    error: () => events.failed(),
    play: () => events.timeControl(true),
    pause: () => events.timeControl(false),
    seeked: () => {
      const done = pending;
      pending = undefined;
      done?.(true);
    },
  };
  for (const [name, listener] of Object.entries(listeners)) audio.addEventListener(name, listener);
  audio.src = url;

  return {
    get seconds() {
      return audio.currentTime;
    },
    play() {
      // An interrupted play (a pause or a seek that came first) is not a failure.
      audio.play().catch((error: unknown) => {
        if ((error as DOMException).name !== "AbortError") events.failed();
      });
    },
    pause: () => audio.pause(),
    seek(seconds) {
      pending?.(false);
      return new Promise<boolean>((resolve) => {
        pending = resolve;
        audio.currentTime = seconds;
      });
    },
    stop() {
      for (const [name, listener] of Object.entries(listeners)) audio.removeEventListener(name, listener);
      pending?.(false);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
};
