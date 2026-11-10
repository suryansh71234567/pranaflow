import { AudioLines } from "lucide-react";
import type { BreathState } from "../types";
interface Props {
  state: "idle" | "running" | "paused";
  live: boolean;
  scale: number;
  label: string | undefined;
  caption: string | undefined;
  remaining: number;
  breath: BreathState;
  humming: boolean;
}
export function BreathRing({
  state,
  live,
  scale,
  label,
  caption,
  remaining,
  breath,
  humming,
}: Props) {
  return (
    <div className="ring-space">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="ring-object" style={{ transform: `scale(${scale})` }}>
        <div className="ring-inner" />
        <div className="ring-inner two" />
      </div>
      <div className="ring-copy" aria-live="off">
        <span className="ring-overline">
          {state === "idle"
            ? "BREATHE. BE HERE."
            : live
              ? "LIVE MIRROR"
              : "GUIDED BREATH"}
        </span>
        <h2>{label}</h2>
        <span className="gold-divider" />
        <p>
          {state === "running" && !live
            ? `${remaining.toFixed(1)} s`
            : state === "paused"
              ? "Whenever you’re ready."
              : live && state === "running"
                ? breath.bpm
                  ? `${breath.bpm.toFixed(1)} est. bpm`
                  : `${Math.round(breath.progress * 100)}% calibrated`
                : "Begin at your own pace"}
        </p>
        <small>{caption}</small>
        {humming && state === "running" && (
          <AudioLines className="humming-icon" size={32} />
        )}
      </div>
    </div>
  );
}
