import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, classify } from "../src/services/posture";
import { BreathEstimator, patchFlow } from "../src/services/breath";
import { guideAt, sequence } from "../src/services/guide";
import type { Landmark } from "../src/types";
import { cameraError } from "../src/services/camera";
import { PostureCalibration } from "../src/services/posture";
test("camera failure messages preserve a guided fallback", () => {
  assert.match(cameraError({ name: "NotAllowedError" }), /denied/);
  assert.match(cameraError({ name: "NotFoundError" }), /No camera/);
  assert.match(cameraError({ name: "NotReadableError" }), /in use/);
  assert.match(cameraError({ name: "OverconstrainedError" }), /System default/);
});
test("camera-scale baseline requires visible samples and resets cleanly", () => {
  const c = new PostureCalibration();
  assert.equal(c.sample([]), undefined);
  let width;
  for (let i = 0; i < 22; i++) width = c.sample(body());
  assert.ok(width !== undefined && Math.abs(width - 0.3) < 0.001);
  c.reset();
  assert.equal(c.sample(body()), undefined);
});
test("guided transitions, contraction and sequence wrap stay consistent", () => {
  const p = sequence("equal", 4, 4, 0);
  assert.equal(guideAt(p, 0).phase.label, "Inhale");
  assert.equal(guideAt(p, 4).phase.label, "Exhale");
  assert.equal(guideAt(p, 4).remaining, 4);
  assert.ok(guideAt(p, 5).scale > guideAt(p, 7).scale);
  assert.equal(guideAt(p, 8).phase.label, "Inhale");
  assert.deepEqual(
    sequence("nadi", 4, 4, 0).map((p) => p.cue),
    [
      "Through the left nostril",
      "Through the right nostril",
      "Through the right nostril",
      "Through the left nostril",
    ],
  );
  assert.equal(sequence("bhramari", 4, 6, 2)[1].label, "Humming exhale");
  assert.equal(sequence("natural", 4, 4, 0).length, 0);
});
test("occluded landmarks do not produce green checks or pose guesses", () => {
  assert.ok(
    assess([], null, "sukhasana", "Normal").every((c) => c.state === "unknown"),
  );
  assert.equal(classify([]), null);
});
function body(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  for (const [i, x, y] of [
    [0, 0.5, 0.12],
    [11, 0.35, 0.3],
    [12, 0.65, 0.3],
    [23, 0.4, 0.6],
    [24, 0.6, 0.6],
  ])
    p[i] = { x, y, visibility: 0.99 };
  return p;
}
test("visible shoulder asymmetry yields a correction; invisible knees stay neutral", () => {
  const p = body();
  p[12].y = 0.38;
  assert.equal(assess(p, null, "sukhasana", "Normal")[1].state, "adjust");
  assert.equal(assess(p, null, "vajrasana", "Normal")[4].state, "unknown");
  assert.equal(classify(p), null);
});
test("geometric posture hypotheses require lower-body evidence", () => {
  const p = body();
  for (const [i, x, y] of [
    [25, 0.42, 0.78],
    [26, 0.58, 0.78],
    [27, 0.43, 0.92],
    [28, 0.57, 0.92],
  ])
    p[i] = { x, y, visibility: 0.99 };
  assert.equal(classify(p), "vajrasana");
  p[27].visibility = 0.2;
  assert.equal(classify(p), null);
  const q = body();
  for (const [i, x, y] of [
    [25, 0.2, 0.8],
    [26, 0.8, 0.8],
    [27, 0.65, 0.72],
    [28, 0.35, 0.72],
  ])
    q[i] = { x, y, visibility: 0.99 };
  assert.equal(classify(q), "padmasana");
  q[28].y = 0.88;
  assert.equal(classify(q), "ardha");
  q[27].y = 0.88;
  q[27].x = 0.6;
  q[28].x = 0.4;
  assert.equal(classify(q), "sukhasana");
});
test("flat signal and missing frames never claim a respiratory rate", () => {
  const e = new BreathEstimator();
  let b;
  for (let t = 100; t <= 60000; t += 100) b = e.update(t, 0, true);
  assert.equal(b!.bpm, null);
  assert.equal(b!.quality, "Weak");
  b = e.update(60100, 0, false);
  assert.equal(b.bpm, null);
});
test("long frame gaps invalidate a previously reliable breath estimate", () => {
  const e = new BreathEstimator();
  let b;
  for (let t = 100; t <= 70000; t += 100)
    b = e.update(t, 0.12 * Math.cos(((t / 1000) * Math.PI * 2) / 10), true);
  assert.ok(b!.bpm !== null);
  assert.equal(e.update(80000, 0.1, true).bpm, null);
});
test("repeatable optical displacement yields approximate rate only after enough cycles", () => {
  const e = new BreathEstimator();
  let b;
  let early: number | null = null;
  for (let t = 100; t <= 70000; t += 100) {
    b = e.update(t, 0.12 * Math.cos(((t / 1000) * Math.PI * 2) / 10), true);
    if (t === 10000) early = b.bpm;
  }
  assert.equal(early, null);
  assert.ok(b!.bpm !== null && Math.abs(b!.bpm - 6) < 0.3);
  for (let t = 70100; t <= 73000; t += 100) b = e.update(t, 0, false);
  assert.equal(b!.bpm, null);
  assert.equal(b!.quality, "Weak");
});
test("pixel matcher recovers vertical motion and rejects textureless patches", () => {
  const w = 192,
    h = 144,
    a = new Uint8Array(w * h),
    b = new Uint8Array(w * h);
  let seed = 13;
  for (let i = 0; i < a.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    a[i] = seed >>> 24;
  }
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) b[y * w + x] = a[(y - 1) * w + x];
  const roi = { x: 30, y: 30, w: 100, h: 60 };
  assert.ok(Math.abs(patchFlow(a, b, w, h, roi).dy - 1) < 0.1);
  assert.equal(
    patchFlow(new Uint8Array(w * h), new Uint8Array(w * h), w, h, roi).reliable,
    false,
  );
});
