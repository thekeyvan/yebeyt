import type { Fade } from "./clipPlayer";

/**
 * The fade of a clip as a Web Audio gain between the `<audio>` element and the speakers: its ramp runs on the audio clock, so the last syllable falls
 * away exactly at the clip's end, which `<audio>.volume` (set a frame at a time, and not settable at all on iPhones) could not do. Undefined where the
 * browser has no Web Audio.
 */
export function webAudioFade(audio: HTMLAudioElement): Fade | undefined {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return undefined;
  let graph: { context: AudioContext; volume: AudioParam } | undefined;
  return {
    unlock() {
      if (!graph) {
        const context = new Context();
        const gain = context.createGain();
        context.createMediaElementSource(audio).connect(gain).connect(context.destination);
        graph = { context, volume: gain.gain };
      }
      if (graph.context.state !== "running") void graph.context.resume(); // "suspended", or "interrupted" on an iPhone
    },
    start(from, to) {
      if (!graph) return;
      const { context, volume } = graph;
      const now = context.currentTime;
      volume.cancelScheduledValues(now);
      volume.setValueAtTime(1, now);
      volume.setValueAtTime(1, now + Math.max(0, from));
      volume.linearRampToValueAtTime(0, now + Math.max(to, 0.001));
    },
    silent() {
      if (!graph) return;
      graph.volume.cancelScheduledValues(graph.context.currentTime);
      graph.volume.setValueAtTime(0, graph.context.currentTime);
    },
    full() {
      if (!graph) return;
      graph.volume.cancelScheduledValues(graph.context.currentTime);
      graph.volume.setValueAtTime(1, graph.context.currentTime);
    },
    close() {
      void graph?.context.close();
    },
  };
}
