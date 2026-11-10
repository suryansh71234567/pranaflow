export type PoseId = "sukhasana" | "padmasana" | "vajrasana" | "ardha";
export type PracticeId =
  "natural" | "nadi" | "bhramari" | "equal" | "longer" | "custom";
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
export interface Check {
  label: string;
  state: "good" | "adjust" | "unknown";
  detail: string;
}
export interface BreathState {
  quality: "No signal" | "Calibrating" | "Weak" | "Fair" | "Good";
  phase: string;
  amplitude: number;
  bpm: number | null;
  confidence: number;
  progress: number;
  samples: number;
  reason: string;
}
export interface Settings {
  mirror: boolean;
  overlay: boolean;
  preview: boolean;
  tracking: boolean;
  rigor: "Gentle" | "Normal" | "Strict";
  reduced: boolean;
  glow: number;
  textSize: number;
  contrast: boolean;
  volume: number;
  muted: boolean;
  ambientIntensity: number;
  phaseAudio: boolean;
  soundEnabled: boolean;
  profile: "Stillness" | "Warmth" | "Space";
  device: string;
}
export interface Session {
  id: string;
  date: string;
  pose: PoseId;
  practice: PracticeId;
  duration: number;
  bpm: number | null;
  trackedSeconds: number;
  reliableSeconds: number;
  quality: string;
  mode: string;
  cycles: number;
}
export const defaultSettings: Settings = {
  mirror: true,
  overlay: true,
  preview: true,
  tracking: true,
  rigor: "Normal",
  reduced: false,
  glow: 65,
  textSize: 100,
  contrast: false,
  volume: 20,
  muted: false,
  ambientIntensity: 45,
  phaseAudio: true,
  soundEnabled: true,
  profile: "Stillness",
  device: "",
};
