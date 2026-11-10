export type SoundProfile = "Stillness" | "Warmth" | "Space";
export type AudioStatus =
  "idle" | "starting" | "playing" | "paused" | "interrupted" | "error";
export interface AudioSnapshot {
  status: AudioStatus;
  contextState: string;
  muted: boolean;
  volume: number;
  error: string | null;
  phase: string;
  source: string;
}
import { AmbientGraph } from "./audioGraph";
import type { BreathAudioFrame } from "./breathAudio";
export { AmbientGraph } from "./audioGraph";

/** Owns exactly one context and graph; transport is independent of navigation. */
export class AmbientAudio {
  private context: AudioContext | null = null;
  private graph: AmbientGraph | null = null;
  private status: AudioStatus = "idle";
  private error: string | null = null;
  private wanted = false;
  private muted = false;
  private volume = 20;
  private profile: SoundProfile = "Stillness";
  private intensity = 45;
  private guidance = true;
  private frame: BreathAudioFrame = {
    phase: "idle",
    expansion: 0,
    progress: 0,
    remaining: 0,
    source: "none",
  };
  private token = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(state: AudioSnapshot) => void>();
  constructor(private createContext?: () => AudioContext) {}
  get snapshot(): AudioSnapshot {
    return {
      status: this.status,
      contextState: this.context?.state ?? "uninitialized",
      muted: this.muted,
      volume: this.volume,
      error: this.error,
      phase: this.guidance ? this.frame.phase : "idle",
      source: this.frame.source,
    };
  }
  get requestedPlaying() {
    return this.wanted;
  }
  subscribe(listener: (state: AudioSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of this.listeners) listener(this.snapshot);
  }
  private cancelPause() {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }
  private ensureContext() {
    if (this.context && this.context.state !== "closed") return this.context;
    this.graph?.dispose();
    this.graph = null;
    const Constructor =
      globalThis.AudioContext ||
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!this.createContext && !Constructor)
      throw new Error("Web Audio is not available in this browser.");
    const c = this.createContext
      ? this.createContext()
      : new Constructor!({ latencyHint: "playback" });
    this.context = c;
    c.onstatechange = () => {
      if (c !== this.context) return;
      if (!this.wanted) this.status = "paused";
      else if (c.state === "running") this.status = "playing";
      else if (c.state === "closed") {
        this.status = "error";
        this.error =
          "Audio was closed by the browser. Tap Ambient Sound to restart.";
      } else if (this.status !== "starting") this.status = "interrupted";
      this.emit();
    };
    return c;
  }
  async start(volume = this.volume, profile: string = this.profile) {
    this.volume = Math.max(
      0,
      Math.min(100, Number.isFinite(volume) ? volume : 20),
    );
    this.profile = ["Stillness", "Warmth", "Space"].includes(profile)
      ? (profile as SoundProfile)
      : "Stillness";
    this.wanted = true;
    this.error = null;
    this.cancelPause();
    const ticket = ++this.token;
    this.status = "starting";
    this.emit();
    try {
      const c = this.ensureContext();
      // Invoke resume synchronously in the click/tap stack, before any await.
      const resumed = c.resume();
      if (!this.graph) {
        this.graph = new AmbientGraph(c, this.profile);
        this.graph.output.connect(c.destination);
      } else this.graph.setProfile(this.profile);
      this.graph.setVolume(this.volume);
      this.graph.setMuted(this.muted);
      this.graph.setIntensity(this.intensity);
      this.graph.setGuidance(this.guidance);
      this.graph.followBreath(this.frame);
      this.graph.play();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Sound is waiting for browser permission. Tap Ambient Sound again to resume.",
              ),
            ),
          5000,
        );
        resumed.then(
          () => {
            clearTimeout(timer);
            resolve();
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          },
        );
      });
      if (ticket !== this.token) return;
      if (c.state !== "running")
        throw new Error(
          "Sound was interrupted by the browser. Tap Ambient Sound to resume.",
        );
      this.status = "playing";
      this.emit();
    } catch (error) {
      if (ticket !== this.token) return;
      this.wanted = false;
      const failedContext = this.context;
      this.context = null;
      this.graph?.dispose();
      this.graph = null;
      if (failedContext) {
        failedContext.onstatechange = null;
        if (failedContext.state !== "closed")
          void failedContext.close().catch(() => {});
      }
      this.status = "error";
      this.error =
        error instanceof Error
          ? error.message
          : "Sound could not start. Tap Ambient Sound to try again.";
      this.emit();
      throw error;
    }
  }
  async pause() {
    this.wanted = false;
    this.token++;
    this.cancelPause();
    this.status = "paused";
    this.graph?.pause();
    this.emit();
    const c = this.context;
    if (!c || c.state === "closed" || c.state === "suspended") return;
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      if (!this.wanted && c === this.context && c.state !== "closed")
        void c.suspend().catch(() => {});
    }, 4050);
  }
  // Ordinary stop means a resumable pause; teardown uses dispose.
  stop(_fade = true) {
    return this.pause();
  }
  setVolume(value: number) {
    this.volume = Math.max(
      0,
      Math.min(100, Number.isFinite(value) ? value : 20),
    );
    this.graph?.setVolume(this.volume);
    this.emit();
  }
  setMuted(value: boolean) {
    this.muted = value;
    this.graph?.setMuted(value);
    this.emit();
  }
  setProfile(profile: SoundProfile) {
    this.profile = profile;
    this.graph?.setProfile(profile);
  }
  setIntensity(value: number) {
    this.intensity = value;
    this.graph?.setIntensity(value);
  }
  setGuidance(value: boolean) {
    this.guidance = value;
    this.graph?.setGuidance(value);
    this.emit();
  }
  followBreath(frame: BreathAudioFrame) {
    const changed = frame.phase !== this.frame.phase;
    this.frame = frame;
    this.graph?.followBreath(frame);
    if (changed) this.emit();
  }
  recover() {
    if (this.wanted && this.context?.state !== "running") return this.start();
    return Promise.resolve();
  }
  async dispose() {
    this.wanted = false;
    this.token++;
    this.cancelPause();
    const c = this.context;
    this.context = null;
    this.graph?.dispose();
    this.graph = null;
    this.status = "idle";
    this.emit();
    if (c) {
      c.onstatechange = null;
      if (c.state !== "closed") await c.close().catch(() => {});
    }
  }
}
