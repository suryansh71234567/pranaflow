import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breathingAudioFrame,
  breathTimbre,
  type BreathAudioFrame,
} from "../src/services/breathAudio";
import { sequence, guideAt } from "../src/services/guide";
import { emptyBreath } from "../src/services/breath";
const sample = (
  phase: BreathAudioFrame["phase"],
  expansion: number,
): BreathAudioFrame => ({
  phase,
  expansion,
  progress: expansion,
  remaining: 2,
  source: "guided",
});
test("custom box cycle and ring share inhale, upper hold, exhale and lower hold", () => {
  const phases = sequence("custom", 4, 4, 4, 4);
  assert.equal(phases.length, 4);
  assert.deepEqual(
    [0, 4, 8, 12, 16].map((t) => {
      const g = guideAt(phases, t);
      return breathingAudioFrame({
        state: "running",
        live: false,
        scale: g.scale,
        phase: g.phase,
        progress: g.progress,
        remaining: g.remaining,
        cameraActive: false,
        breath: emptyBreath(),
      }).phase;
    }),
    ["inhale", "hold-in", "exhale", "hold-out", "inhale"],
  );
  assert.equal(guideAt(phases, 5).scale, 1);
  assert.equal(guideAt(phases, 7).scale, 1);
  assert.equal(guideAt(phases, 13).scale, 0.83);
});
test("inhale rises and opens, exhale descends and warms from actual expansion", () => {
  const early = breathTimbre(sample("inhale", 0.1)),
    late = breathTimbre(sample("inhale", 0.9));
  assert.ok(late.pitchRatio > early.pitchRatio * 1.3);
  assert.ok(late.brightness > early.brightness);
  assert.ok(late.guidance > early.guidance);
  assert.ok(late.air > early.air);
  assert.ok(late.width > early.width);
  const outStart = breathTimbre(sample("exhale", 0.9)),
    outEnd = breathTimbre(sample("exhale", 0.1));
  assert.ok(outStart.pitchRatio > outEnd.pitchRatio);
  assert.ok(outStart.brightness > outEnd.brightness);
});
test("the two holds are sustained, stable and perceptually distinct", () => {
  const upper = breathTimbre(sample("hold-in", 0.5)),
    lower = breathTimbre(sample("hold-out", 0.5));
  assert.equal(upper.pitchRatio, 3);
  assert.equal(lower.pitchRatio, 2);
  assert.ok(lower.brightness < upper.brightness);
  assert.ok(lower.guidance > 0 && lower.guidance < upper.guidance);
  assert.ok(lower.air < upper.air);
  assert.equal(upper.motion, 0.06);
  assert.deepEqual(
    upper,
    breathTimbre({ ...sample("hold-in", 0.8), progress: 0.9 }),
  );
});
test("natural breath has no timer fallback and rejects weak or missing signals", () => {
  const input = {
    state: "running" as const,
    live: true,
    scale: 0.9,
    progress: 0,
    remaining: 0,
    cameraActive: true,
    breath: emptyBreath(),
  };
  assert.equal(breathingAudioFrame(input).phase, "unavailable");
  assert.equal(
    breathingAudioFrame({ ...input, state: "paused" }).phase,
    "unavailable",
  );
  assert.equal(
    breathingAudioFrame({
      ...input,
      breath: { ...emptyBreath(), quality: "Weak", amplitude: 0.95, bpm: 6 },
    }).phase,
    "unavailable",
  );
  const live = breathingAudioFrame({
    ...input,
    scale: 0.966,
    breath: { ...emptyBreath(), phase: "Expansion", quality: "Good", bpm: 6 },
  });
  assert.equal(live.phase, "inhale");
  assert.equal(live.source, "live");
  assert.ok(Math.abs(live.expansion - 0.8) < 0.001);
  assert.equal(live.remaining, 0);
});
test("all existing practices use their shared phase engine without audio timing", () => {
  for (const id of ["equal", "longer", "nadi", "bhramari", "custom"] as const) {
    const p = sequence(id, 3, 7, 2);
    const g = guideAt(p, 4);
    const f = breathingAudioFrame({
      state: "running",
      live: false,
      scale: g.scale,
      phase: g.phase,
      progress: g.progress,
      remaining: g.remaining,
      cameraActive: false,
      breath: emptyBreath(),
    });
    assert.equal(f.phase, "exhale");
    assert.equal(f.remaining, 6);
    assert.ok(Math.abs(f.expansion - 6 / 7) < 0.001);
  }
});
test("session pause freezes the timbre and invalid input cannot create noise or NaN", () => {
  const f = breathingAudioFrame({
    state: "paused",
    live: false,
    scale: 0.915,
    progress: 0.5,
    remaining: 2,
    cameraActive: false,
    breath: emptyBreath(),
  });
  assert.equal(f.phase, "paused");
  assert.equal(breathTimbre(f).motion, 0.06);
  assert.equal(breathTimbre(sample("inhale", Number.NaN)).expansion, 0);
  assert.equal(breathTimbre(sample("inhale", 2)).expansion, 1);
  assert.equal(breathTimbre(f, false).guidance, 0);
  assert.equal(breathTimbre(sample("unavailable", 0.9)).guidance, 0);
});
