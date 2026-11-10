import type { PracticeId } from "../types";
export interface Phase {
  kind?: "inhale" | "exhale" | "hold-in" | "hold-out";
  label: string;
  seconds: number;
  cue: string;
  expand: boolean;
}
export function sequence(
  id: PracticeId,
  inhale: number,
  exhale: number,
  pause: number,
  inhaleHold = 0,
): Phase[] {
  if (id === "natural") return [];
  const a: Phase[] =
    id === "nadi"
      ? [
          {
            label: "Inhale",
            seconds: inhale,
            cue: "Through the left nostril",
            expand: true,
          },
          {
            label: "Exhale",
            seconds: exhale,
            cue: "Through the right nostril",
            expand: false,
          },
          {
            label: "Inhale",
            seconds: inhale,
            cue: "Through the right nostril",
            expand: true,
          },
          {
            label: "Exhale",
            seconds: exhale,
            cue: "Through the left nostril",
            expand: false,
          },
        ]
      : [
          {
            label: "Inhale",
            seconds: inhale,
            cue: "Slowly, comfortably",
            expand: true,
          },
          {
            label: id === "bhramari" ? "Humming exhale" : "Exhale",
            seconds: exhale,
            cue: id === "bhramari" ? "A soft, gentle hum" : "Let the breath go",
            expand: false,
          },
        ];
  // A zero-length hold is omitted. Existing practices retain their timings.
  if (inhaleHold > 0) {
    for (let i = a.length - 1; i >= 0; i--)
      if (a[i].expand)
        a.splice(i + 1, 0, {
          label: "Hold",
          kind: "hold-in",
          seconds: inhaleHold,
          cue: "Pause only if comfortable",
          expand: false,
        });
  }
  if (pause > 0)
    a.push({
      label: "Rest",
      kind: "hold-out",
      seconds: pause,
      cue: "Pause only if comfortable",
      expand: false,
    });
  return a;
}
export function guideAt(phases: Phase[], elapsed: number) {
  const total = phases.reduce((s, p) => s + p.seconds, 0);
  let t = total ? elapsed % total : 0,
    index = 0;
  while (index < phases.length - 1 && t >= phases[index].seconds) {
    t -= phases[index].seconds;
    index++;
  }
  const phase = phases[index];
  const progress = phase ? t / phase.seconds : 0;
  return {
    index,
    progress,
    remaining: phase ? Math.max(0, phase.seconds - t) : 0,
    scale: !phase
      ? 1
      : phase.kind === "hold-in"
        ? 1
        : phase.label === "Rest"
          ? 0.83
          : phase.expand
            ? 0.83 + 0.17 * progress
            : 1 - 0.17 * progress,
    phase,
  };
}
