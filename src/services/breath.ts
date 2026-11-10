import type { BreathState } from "../types";
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const median = (a: number[]) =>
  [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)] ?? 0;
export const emptyBreath = (): BreathState => ({
  quality: "No signal",
  phase: "Waiting",
  amplitude: 0.5,
  bpm: null,
  confidence: 0,
  progress: 0,
  samples: 0,
  reason: "Enable the camera and keep your upper torso in view.",
});
// Integrates local optical displacement, detrends and smooths; accepts only repeatable cycles.
export class BreathEstimator {
  private start = 0;
  private last = 0;
  private integral = 0;
  private baseline = 0;
  private filtered = 0;
  private trend = 0;
  private lastPeak = 0;
  private prevSign = 0;
  private candidateSign = 0;
  private candidateAt = 0;
  private extrema: number[] = [];
  private periods: number[] = [];
  private values: { t: number; v: number }[] = [];
  private validTime = 0;
  private badSince = 0;
  reset() {
    this.start = 0;
    this.last = 0;
    this.integral = 0;
    this.baseline = 0;
    this.filtered = 0;
    this.trend = 0;
    this.lastPeak = 0;
    this.prevSign = 0;
    this.candidateSign = 0;
    this.candidateAt = 0;
    this.extrema = [];
    this.periods = [];
    this.values = [];
    this.validTime = 0;
    this.badSince = 0;
  }
  update(t: number, velocity: number, reliable: boolean): BreathState {
    if (this.last && t - this.last > 1500) this.reset();
    if (!this.start) this.start = t;
    const dt = this.last ? Math.min(0.25, (t - this.last) / 1000) : 0.08;
    this.last = t;
    if (!reliable || !Number.isFinite(velocity)) {
      if (!this.badSince) this.badSince = t;
      if (t - this.badSince > 1500) {
        this.reset();
        this.start = t;
      }
      return {
        ...emptyBreath(),
        quality: "Weak",
        reason:
          "Tracking interrupted. Sit still with your torso in view; calibration will restart if the signal stays weak.",
      };
    }
    this.badSince = 0;
    this.validTime += dt;
    this.integral += clamp(velocity, -2, 2);
    this.baseline += (this.integral - this.baseline) * dt * 0.2;
    const old = this.filtered;
    this.filtered +=
      (this.integral - this.baseline - this.filtered) * Math.min(1, dt * 3);
    this.trend = 0.8 * this.trend + 0.2 * (this.filtered - old);
    this.values.push({ t, v: this.filtered });
    this.values = this.values.filter((v) => t - v.t < 30000);
    const vs = this.values.map((v) => v.v),
      range = vs.length ? Math.max(...vs) - Math.min(...vs) : 0;
    const rawSign =
      Math.abs(this.trend) > 0.002 ? Math.sign(this.trend) : this.prevSign;
    if (rawSign !== this.candidateSign) {
      this.candidateSign = rawSign;
      this.candidateAt = t;
    }
    const sign =
      t - this.candidateAt >= 500 ? this.candidateSign : this.prevSign;
    if (this.prevSign === 1 && sign === -1 && range > 0.25) {
      if (this.lastPeak) {
        const period = (t - this.lastPeak) / 1000;
        if (period >= 3 && period <= 20) {
          this.periods.push(period);
          this.periods = this.periods.slice(-6);
        } else if (period > 20 || period < 2) this.periods = [];
      }
      this.lastPeak = t;
      this.extrema.push(this.filtered);
      this.extrema = this.extrema.slice(-8);
    }
    this.prevSign = sign;
    const med = median(this.periods),
      variation = med
        ? Math.sqrt(
            this.periods.reduce((s, p) => s + (p - med) ** 2, 0) /
              this.periods.length,
          ) / med
        : 1;
    const enough =
      this.validTime >= 20 &&
      this.periods.length >= 3 &&
      variation < 0.22 &&
      range > 0.25 &&
      t - this.lastPeak < 20000;
    const confidence = enough
      ? clamp((1 - variation) * Math.min(1, range / 1.5))
      : 0;
    return {
      quality:
        this.validTime < 20
          ? "Calibrating"
          : enough
            ? confidence > 0.65
              ? "Good"
              : "Fair"
            : "Weak",
      phase:
        range > 0.25 ? (sign > 0 ? "Expansion" : "Contraction") : "Observing",
      amplitude:
        range > 0.25 ? clamp((this.filtered - Math.min(...vs)) / range) : 0.5,
      bpm: enough ? 60 / med : null,
      confidence,
      progress: clamp(this.validTime / 20),
      samples: this.values.length,
      reason:
        this.validTime < 20
          ? "Breathe naturally and stay comfortably still."
          : enough
            ? "Estimated from repeatable upper-torso image movement."
            : "No repeatable respiratory pattern yet. Improve lighting and keep your torso still.",
    };
  }
}
// Small-patch frame matching: genuine pixel displacement, no timer or landmark-only respiration.
export function patchFlow(
  prev: Uint8Array,
  next: Uint8Array,
  width: number,
  height: number,
  roi: { x: number; y: number; w: number; h: number },
) {
  const shifts: number[] = [],
    errors: number[] = [];
  let textures = 0;
  for (let gy = 0; gy < 3; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const x = Math.round(roi.x + (roi.w * (gx + 0.5)) / 4),
        y = Math.round(roi.y + (roi.h * (gy + 0.5)) / 3);
      if (x < 7 || y < 7 || x > width - 8 || y > height - 8) continue;
      let mean = 0,
        sq = 0;
      for (let yy = -3; yy <= 3; yy++)
        for (let xx = -3; xx <= 3; xx++) {
          const v = prev[(y + yy) * width + x + xx];
          mean += v;
          sq += v * v;
        }
      if (sq / 49 - (mean / 49) ** 2 < 25) continue;
      textures++;
      let best = Infinity,
        bdy = 0;
      const verticalErrors = new Map<number, number>();
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          let err = 0;
          for (let yy = -3; yy <= 3; yy++)
            for (let xx = -3; xx <= 3; xx++)
              err += Math.abs(
                prev[(y + yy) * width + x + xx] -
                  next[(y + yy + dy) * width + x + xx + dx],
              );
          err /= 49;
          verticalErrors.set(
            dy,
            Math.min(verticalErrors.get(dy) ?? Infinity, err),
          );
          if (err < best) {
            best = err;
            bdy = dy;
          }
        }
      // Parabolic subpixel refinement keeps slow respiratory movement visible
      // instead of rounding every frame to zero or one pixel.
      const before = verticalErrors.get(bdy - 1),
        after = verticalErrors.get(bdy + 1);
      const denominator =
        before !== undefined && after !== undefined
          ? before - 2 * best + after
          : 0;
      const subpixel =
        denominator > 0
          ? Math.max(
              -0.5,
              Math.min(
                0.5,
                ((before ?? best) - (after ?? best)) / (2 * denominator),
              ),
            )
          : 0;
      shifts.push(bdy + subpixel);
      errors.push(best);
    }
  const dy = median(shifts);
  const spread = median(shifts.map((s) => Math.abs(s - dy)));
  return {
    dy,
    reliable:
      textures >= 6 && median(errors) < 22 && spread < 1.5 && Math.abs(dy) < 3,
    texture: textures,
  };
}
