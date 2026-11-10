import type { BreathState } from "../types";
import type { Phase } from "./guide";
export type SoundPhase =
  | "inhale"
  | "exhale"
  | "hold-in"
  | "hold-out"
  | "paused"
  | "idle"
  | "unavailable";
export interface BreathAudioFrame {
  phase: SoundPhase;
  expansion: number;
  progress: number;
  remaining: number;
  source: "guided" | "live" | "none";
}
const clamp = (n: number) =>
  Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function breathingAudioFrame(input: {
  state: "idle" | "running" | "paused";
  live: boolean;
  scale: number;
  phase?: Phase;
  progress: number;
  remaining: number;
  cameraActive: boolean;
  breath: BreathState;
}): BreathAudioFrame {
  const base = {
    expansion: clamp((input.scale - 0.83) / 0.17),
    progress: clamp(input.progress),
    remaining: Math.max(0, input.remaining),
    source: "none" as BreathAudioFrame["source"],
  };
  if (input.state === "idle") return { ...base, phase: "idle" };
  if (input.state === "paused")
    if (
      input.live &&
      !(
        input.cameraActive &&
        (input.breath.quality === "Good" || input.breath.quality === "Fair") &&
        input.breath.bpm !== null
      )
    )
      return { ...base, phase: "unavailable" };
  if (input.state === "paused")
    return { ...base, phase: "paused", source: input.live ? "live" : "guided" };
  if (input.live) {
    const valid =
      input.cameraActive &&
      (input.breath.quality === "Good" || input.breath.quality === "Fair") &&
      input.breath.bpm !== null;
    if (!valid) return { ...base, phase: "unavailable" };
    return {
      ...base,
      phase:
        input.breath.phase === "Expansion"
          ? "inhale"
          : input.breath.phase === "Contraction"
            ? "exhale"
            : "unavailable",
      source: "live",
      progress: 0,
      remaining: 0,
    };
  }
  const phase =
    input.phase?.kind ??
    (input.phase?.label === "Rest"
      ? "hold-out"
      : input.phase?.expand
        ? "inhale"
        : "exhale");
  return { ...base, phase, source: input.phase ? "guided" : "none" };
}
export interface BreathTimbre {
  phase: SoundPhase;
  expansion: number;
  pitchRatio: number;
  brightness: number;
  guidance: number;
  air: number;
  width: number;
  motion: number;
}
/** Targets depend only on shared ring state: there is no audio breathing clock. */
export function breathTimbre(
  frame: BreathAudioFrame,
  enabled = true,
): BreathTimbre {
  let x = clamp(frame.expansion);
  if (frame.phase === "hold-in") x = 1;
  if (frame.phase === "hold-out") x = 0;
  const present = enabled && !["idle", "unavailable"].includes(frame.phase);
  const moving = frame.phase === "inhale" || frame.phase === "exhale";
  const highHold = frame.phase === "hold-in",
    lowHold = frame.phase === "hold-out";
  return {
    phase: frame.phase,
    expansion: x,
    pitchRatio: 2 * Math.pow(1.5, x),
    brightness: !present
      ? 0.55
      : lowHold
        ? 0.48
        : highHold
          ? 1.45
          : 0.7 + 1.15 * x,
    guidance: !present ? 0 : lowHold ? 0.33 : highHold ? 0.72 : 0.62 + 0.38 * x,
    air: !present ? 0.24 : lowHold ? 0.12 : highHold ? 0.38 : 0.3 + 0.7 * x,
    width: !present ? 0.2 : lowHold ? 0.12 : highHold ? 0.55 : 0.16 + 0.6 * x,
    motion: present && moving ? 1 : 0.06,
  };
}
