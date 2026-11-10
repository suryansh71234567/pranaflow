import type { SoundProfile } from "./audio";
import { breathTimbre, type BreathAudioFrame } from "./breathAudio";
type Source = AudioScheduledSourceNode;
const profiles: Record<SoundProfile, { cutoff: number; noise: number }> = {
  Stillness: { cutoff: 1450, noise: 0.075 },
  Warmth: { cutoff: 1100, noise: 0.06 },
  Space: { cutoff: 2000, noise: 0.095 },
};
const volumeGain = (v: number) =>
  1.2 * Math.pow(Math.max(0, Math.min(100, v)) / 100, 0.65);
export function ramp(
  context: BaseAudioContext,
  param: AudioParam,
  value: number,
  seconds: number,
) {
  const now = context.currentTime;
  // Explicitly anchor the current value before replacing an in-flight ramp.
  // Repeated cancelAndHoldAtTime calls produced discontinuities in Chromium's
  // offline render when suspended at frame boundaries. This also avoids that
  // non-Baseline API in other browsers and keeps interpolation bounded.
  const current = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
  param.linearRampToValueAtTime(value, now + seconds);
}
const idle: BreathAudioFrame = {
  phase: "idle",
  expansion: 0,
  progress: 0,
  remaining: 0,
  source: "none",
};
/** Persistent four-layer synthesis. Only the app's ring state moves the guide. */
export class AmbientGraph {
  readonly output: GainNode;
  private gate: GainNode;
  private master: GainNode;
  private foundation: GainNode;
  private guideEnvelope: GainNode;
  private guideFilter: BiquadFilterNode;
  private profileFilter: BiquadFilterNode;
  private noiseGain: GainNode;
  private airEnvelope: GainNode;
  private airFilter: BiquadFilterNode;
  private voices: OscillatorNode[] = [];
  private pans: StereoPannerNode[] = [];
  private driftDepths: GainNode[] = [];
  private sources: Source[] = [];
  private nodes: AudioNode[] = [];
  private volume = 20;
  private muted = false;
  private disposed = false;
  private frame = idle;
  private enabled = true;
  private intensity = 45;
  constructor(
    private context: BaseAudioContext,
    profile: SoundProfile = "Stillness",
  ) {
    const c = context,
      p = profiles[profile],
      bus = c.createGain(),
      highpass = c.createBiquadFilter(),
      limiter = c.createDynamicsCompressor();
    this.gate = c.createGain();
    this.master = c.createGain();
    this.output = c.createGain();
    this.foundation = c.createGain();
    this.guideEnvelope = c.createGain();
    this.guideFilter = c.createBiquadFilter();
    this.profileFilter = c.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 45;
    this.guideFilter.type = "lowpass";
    this.guideFilter.frequency.value = 700;
    this.guideFilter.Q.value = 0.45;
    this.profileFilter.type = "lowpass";
    this.profileFilter.frequency.value = p.cutoff;
    this.profileFilter.Q.value = 0.35;
    limiter.threshold.value = -12;
    limiter.knee.value = 14;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.03;
    limiter.release.value = 0.6;
    this.foundation.gain.value = this.intensity / 100;
    this.guideEnvelope.gain.value = 0;
    this.foundation.connect(bus);
    this.guideEnvelope.connect(this.guideFilter);
    this.guideFilter.connect(bus);
    bus.connect(this.profileFilter);
    this.profileFilter.connect(highpass);
    highpass.connect(this.gate);
    this.gate.connect(this.master);
    this.master.connect(limiter);
    limiter.connect(this.output);
    this.gate.gain.value = 0;
    this.master.gain.value = volumeGain(20);
    this.nodes.push(
      bus,
      highpass,
      limiter,
      this.gate,
      this.master,
      this.output,
      this.foundation,
      this.guideEnvelope,
      this.guideFilter,
      this.profileFilter,
    );
    // The foundation stays extremely soft; its slow drift cannot impose a cadence.
    for (const [ratio, level] of [
      [1, 0.085],
      [2, 0.018],
    ]) {
      const o = c.createOscillator(),
        g = c.createGain(),
        drift = c.createOscillator(),
        depth = c.createGain();
      o.frequency.value = 110 * ratio;
      g.gain.value = level;
      drift.frequency.value = 0.0083;
      depth.gain.value = 0.35;
      drift.connect(depth);
      depth.connect(o.detune);
      o.connect(g);
      g.connect(this.foundation);
      this.sources.push(o, drift);
      this.nodes.push(g, depth);
      this.driftDepths.push(depth);
    }
    // Guidance and atmosphere share the moving harmonic root. Stereo is optional;
    // all breathing information remains audible on a mono phone speaker.
    [1, 2, 3, 4].forEach((ratio, i) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.value = 220 * ratio;
      o.detune.value = [0, 0, 0, 0][i];
      g.gain.value = [0.3, 0.09, 0.035, 0.012][i];
      o.connect(g);
      if (typeof c.createStereoPanner === "function") {
        const pan = c.createStereoPanner();
        pan.pan.value = i === 0 ? -0.2 : 0.2;
        g.connect(pan);
        pan.connect(this.guideEnvelope);
        this.pans.push(pan);
        this.nodes.push(pan);
      } else g.connect(this.guideEnvelope);
      this.voices.push(o);
      this.sources.push(o);
      this.nodes.push(g);
    });
    // Native, continuously filtered stochastic air has no melody or hard track seam.
    const noise = c.createBufferSource(),
      buffer = c.createBuffer(2, Math.ceil(c.sampleRate * 29), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    noise.loop = true;
    this.noiseGain = c.createGain();
    this.noiseGain.gain.value = p.noise;
    this.airEnvelope = c.createGain();
    this.airEnvelope.gain.value = 0.24;
    this.airFilter = c.createBiquadFilter();
    this.airFilter.type = "lowpass";
    this.airFilter.frequency.value = 700;
    this.airFilter.Q.value = 0.3;
    noise.connect(this.noiseGain);
    this.noiseGain.connect(this.airEnvelope);
    this.airEnvelope.connect(this.airFilter);
    this.airFilter.connect(this.foundation);
    this.sources.push(noise);
    this.nodes.push(this.noiseGain, this.airEnvelope, this.airFilter);
    this.followBreath(idle);
    for (const source of this.sources) source.start();
  }
  play(seconds = 4) {
    if (!this.disposed) ramp(this.context, this.gate.gain, 1, seconds);
  }
  pause(seconds = 4) {
    if (!this.disposed) ramp(this.context, this.gate.gain, 0, seconds);
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 20));
    this.updateMaster();
  }
  setMuted(v: boolean) {
    this.muted = v;
    this.updateMaster();
  }
  private updateMaster() {
    if (!this.disposed)
      ramp(
        this.context,
        this.master.gain,
        this.muted ? 0 : volumeGain(this.volume),
        0.15,
      );
  }
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 45));
    if (!this.disposed)
      ramp(this.context, this.foundation.gain, this.intensity / 100, 0.5);
  }
  setGuidance(enabled: boolean) {
    this.enabled = enabled;
    this.followBreath(this.frame);
  }
  setProfile(profile: SoundProfile) {
    if (this.disposed) return;
    const p = profiles[profile];
    ramp(this.context, this.profileFilter.frequency, p.cutoff, 6);
    ramp(this.context, this.noiseGain.gain, p.noise, 6);
  }
  followBreath(frame: BreathAudioFrame) {
    if (this.disposed) return;
    this.frame = frame;
    const t = breathTimbre(frame, this.enabled);
    // Same 180 ms interpolation as the ring's CSS transform, fed by the same
    // expansion value. No oscillator or separate phase timer is started here.
    this.voices.forEach((o, i) =>
      ramp(
        this.context,
        o.frequency,
        110 * t.pitchRatio * [1, 2, 3, 4][i],
        0.18,
      ),
    );
    ramp(this.context, this.guideFilter.frequency, 1000 * t.brightness, 0.18);
    ramp(
      this.context,
      this.guideEnvelope.gain,
      t.guidance,
      frame.phase === "idle" || frame.phase === "unavailable" ? 1 : 0.3,
    );
    ramp(this.context, this.airEnvelope.gain, t.air, 0.3);
    ramp(this.context, this.airFilter.frequency, 900 * t.brightness, 0.3);
    this.pans.forEach((pan, i) =>
      ramp(this.context, pan.pan, [-0.12, 1, -1, 0.5][i] * t.width, 0.18),
    );
    this.driftDepths.forEach((g) =>
      ramp(this.context, g.gain, 0.35 * t.motion, 0.3),
    );
  }
  get timbre() {
    return breathTimbre(this.frame, this.enabled);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    for (const node of this.nodes) node.disconnect();
    this.sources = [];
  }
}
