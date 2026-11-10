import { test } from "node:test";
import assert from "node:assert/strict";
import { AmbientAudio } from "../src/services/audio";
class Param {
  value = 0;
  events: { type: string; value: number; time: number }[] = [];
  cancelAndHoldAtTime(time: number) {
    this.events.push({ type: "hold", value: this.value, time });
  }
  cancelScheduledValues() {}
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "linear", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "exponential", value, time });
  }
}
class Node {
  gain = new Param();
  pan = new Param();
  frequency = new Param();
  detune = new Param();
  Q = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  type = "";
  loop = false;
  buffer: unknown = null;
  onended: () => void = () => {};
  started = false;
  stopped = false;
  disconnected = false;
  targets: unknown[] = [];
  connect(target: unknown) {
    this.targets.push(target);
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
  start() {
    assert.equal(this.started, false, "source starts only once");
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class Context {
  state = "suspended";
  currentTime = 10;
  sampleRate = 100;
  destination = new Node();
  onstatechange: (() => void) | null = null;
  nodes: Node[] = [];
  resumes = 0;
  suspends = 0;
  closes = 0;
  resumeError = false;
  createStereoPanner() {
    return this.node();
  }
  createGain() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createDynamicsCompressor() {
    return this.node();
  }
  node() {
    const n = new Node();
    this.nodes.push(n);
    return n;
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return { getChannelData: (c: number) => data[c] };
  }
  resume() {
    this.resumes++;
    if (this.resumeError) return Promise.reject(new Error("Autoplay blocked"));
    this.state = "running";
    this.onstatechange?.();
    return Promise.resolve();
  }
  suspend() {
    this.suspends++;
    this.state = "suspended";
    this.onstatechange?.();
    return Promise.resolve();
  }
  close() {
    this.closes++;
    this.state = "closed";
    this.onstatechange?.();
    return Promise.resolve();
  }
}
function engine() {
  const contexts: Context[] = [];
  const audio = new AmbientAudio(() => {
    const c = new Context();
    contexts.push(c);
    return c as unknown as AudioContext;
  });
  return { audio, contexts };
}
test("phase changes reuse all sources and drive existing AudioParams", async () => {
  const { audio, contexts } = engine();
  await audio.start();
  const count = contexts[0].nodes.length;
  for (const [phase, expansion, pitch] of [
    ["inhale", 1, 330],
    ["hold-in", 1, 330],
    ["exhale", 0, 220],
    ["hold-out", 0, 220],
  ] as const) {
    audio.followBreath({
      phase,
      expansion,
      progress: 0.5,
      remaining: 2,
      source: "guided",
    });
    assert.equal(contexts[0].nodes.length, count);
    assert.ok(
      contexts[0].nodes.some((n) => n.frequency.events.at(-1)?.value === pitch),
    );
    assert.equal(audio.snapshot.phase, phase);
  }
  audio.setIntensity(0);
  audio.setGuidance(false);
  assert.equal(audio.snapshot.phase, "idle");
  await audio.dispose();
});
test("audio unlock happens synchronously in the gesture and uses one persistent graph", async () => {
  const { audio, contexts } = engine();
  const playing = audio.start(20, "Stillness");
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumes, 1, "resume before returning to event loop");
  await playing;
  const nodes = contexts[0].nodes.length;
  assert.equal(audio.snapshot.status, "playing");
  await audio.pause();
  await audio.start(35, "Warmth");
  audio.setProfile("Space");
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].nodes.length, nodes);
  assert.equal(contexts[0].closes, 0);
  await audio.dispose();
  assert.equal(contexts[0].closes, 1);
  assert.ok(contexts[0].nodes.every((n) => n.disconnected));
});
test("rapid play/pause/play cancels stale transport actions", async () => {
  const { audio, contexts } = engine();
  const first = audio.start();
  await audio.pause();
  const last = audio.start();
  await Promise.all([first, last]);
  assert.equal(audio.snapshot.status, "playing");
  assert.equal(contexts.length, 1);
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(contexts[0].suspends, 0);
  await audio.dispose();
});
test("pause fades to exact silence then suspends without destroying sound phase", async () => {
  const { audio, contexts } = engine();
  await audio.start();
  await audio.pause();
  assert.equal(audio.snapshot.status, "paused");
  assert.ok(
    contexts[0].nodes.some((n) =>
      n.gain.events.some(
        (e) => e.type === "linear" && e.value === 0 && e.time === 14,
      ),
    ),
  );
  await new Promise((r) => setTimeout(r, 4100));
  assert.equal(contexts[0].state, "suspended");
  assert.equal(contexts[0].closes, 0);
  await audio.start();
  assert.equal(contexts.length, 1);
  await audio.dispose();
});
test("mute is exact zero, retains volume, and adaptive layers share one master", async () => {
  const { audio, contexts } = engine();
  await audio.start(42);
  audio.setMuted(true);
  assert.equal(audio.snapshot.volume, 42);
  assert.equal(audio.snapshot.muted, true);
  audio.followBreath({
    phase: "inhale",
    expansion: 0.8,
    progress: 0.8,
    remaining: 0.8,
    source: "guided",
  });
  assert.equal(
    contexts[0].nodes.filter((n) => n.targets.includes(contexts[0].destination))
      .length,
    1,
  );
  assert.ok(contexts[0].nodes.some((n) => n.gain.events.at(-1)?.value === 0));
  audio.setMuted(false);
  audio.setVolume(0);
  assert.equal(audio.snapshot.volume, 0);
  await audio.dispose();
});
test("autoplay failure leaves no graph alive and a retry can recover", async () => {
  const first = new Context();
  first.resumeError = true;
  const second = new Context();
  let calls = 0;
  const audio = new AmbientAudio(
    () => (++calls === 1 ? first : second) as unknown as AudioContext,
  );
  await assert.rejects(audio.start(), /Autoplay blocked/);
  assert.equal(audio.snapshot.status, "error");
  assert.equal(first.closes, 1);
  assert.ok(first.nodes.every((n) => n.disconnected));
  await audio.start();
  assert.equal(audio.snapshot.status, "playing");
  await audio.dispose();
});
test("browser interruption is observable and recover resumes the same context", async () => {
  const { audio, contexts } = engine();
  await audio.start();
  contexts[0].state = "interrupted";
  contexts[0].onstatechange?.();
  assert.equal(audio.snapshot.status, "interrupted");
  await audio.recover();
  assert.equal(audio.snapshot.status, "playing");
  assert.equal(contexts.length, 1);
  await audio.dispose();
});
test("all subscribers unsubscribe; disposing cancels delayed suspension", async () => {
  const { audio, contexts } = engine();
  let calls = 0;
  const unsubscribe = audio.subscribe(() => calls++);
  await audio.start();
  unsubscribe();
  const before = calls;
  await audio.pause();
  await audio.dispose();
  assert.equal(calls, before);
  assert.equal(contexts[0].closes, 1);
});
