import { AmbientGraph, type SoundProfile } from "../src/services/audio";
import {
  breathingAudioFrame,
  type BreathAudioFrame,
} from "../src/services/breathAudio";
import { sequence, guideAt } from "../src/services/guide";
import { emptyBreath } from "../src/services/breath";
const rate = 22050,
  result = document.querySelector("#results")!;
const frame = (
  phase: BreathAudioFrame["phase"],
  expansion: number,
): BreathAudioFrame => ({
  phase,
  expansion,
  progress: expansion,
  remaining: 2,
  source: "guided",
});
function measure(buffer: AudioBuffer, start: number, end: number) {
  let squared = 0,
    peak = 0,
    jump = 0,
    count = 0,
    peakAt = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (
      let i = Math.floor(start * rate);
      i < Math.min(d.length, Math.floor(end * rate));
      i++
    ) {
      squared += d[i] ** 2;
      if (Math.abs(d[i]) > peak) {
        peak = Math.abs(d[i]);
        peakAt = i / rate;
      }
      if (i) jump = Math.max(jump, Math.abs(d[i] - d[i - 1]));
      count++;
    }
  }
  return { rms: Math.sqrt(squared / count), peak, maxSampleJump: jump, peakAt };
}
function spectrum(buffer: AudioBuffer, time: number) {
  const n = 4096,
    re = new Float64Array(n),
    im = new Float64Array(n),
    d = buffer.getChannelData(0),
    offset = Math.floor(time * rate);
  for (let i = 0; i < n; i++)
    re[i] =
      (d[offset + i] ?? 0) *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let j = 0; j < len / 2; j++) {
        const a = i + j,
          b = a + len / 2,
          c = Math.cos(angle * j),
          s = Math.sin(angle * j),
          tr = re[b] * c - im[b] * s,
          ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
  let peak = 0,
    dominant = 0,
    total = 0,
    weighted = 0;
  for (let i = 1; i < n / 2; i++) {
    const hz = (i * rate) / n,
      power = re[i] ** 2 + im[i] ** 2;
    if (hz > 150 && hz < 400 && power > peak) {
      peak = power;
      dominant = hz;
    }
    if (hz > 50 && hz < 4000) {
      total += power;
      weighted += power * hz;
    }
  }
  return { dominantHz: dominant, centroidHz: weighted / total };
}
async function render(
  profile: SoundProfile,
  options: {
    frame?: BreathAudioFrame;
    volume?: number;
    muted?: boolean;
    pause?: boolean;
    duration?: number;
    cycle?: boolean;
    intensity?: number;
  } = {},
) {
  const length = options.duration ?? 8,
    c = new OfflineAudioContext(2, rate * length, rate),
    g = new AmbientGraph(c, profile);
  g.output.connect(c.destination);
  g.setVolume(options.volume ?? 20);
  g.setMuted(options.muted ?? false);
  g.setIntensity(options.intensity ?? 45);
  g.followBreath(options.frame ?? frame("inhale", options.cycle ? 0 : 0.75));
  g.play();
  const suspensions: Promise<unknown>[] = [];
  if (options.pause)
    suspensions.push(
      c.suspend(3).then(() => {
        g.pause();
        return c.resume();
      }),
    );
  if (options.cycle) {
    const phases = sequence("custom", 4, 6, 2, 2);
    // Integer steps avoid rounding a final suspension onto the render's end.
    for (let step = 1; step < Math.floor(length * 10); step++) {
      const time = step / 10;
      suspensions.push(
        c.suspend(time).then(() => {
          const guide = guideAt(phases, time);
          g.followBreath(
            breathingAudioFrame({
              state: "running",
              live: false,
              scale: guide.scale,
              phase: guide.phase,
              progress: guide.progress,
              remaining: guide.remaining,
              cameraActive: false,
              breath: emptyBreath(),
            }),
          );
          return c.resume();
        }),
      );
    }
  }
  const buffer = await c.startRendering();
  await Promise.all(suspensions);
  g.dispose();
  return buffer;
}
function wav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels,
    length = buffer.length,
    data = new ArrayBuffer(44 + length * channels * 2),
    v = new DataView(data);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, data.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, length * channels * 2, true);
  let at = 44;
  for (let i = 0; i < length; i++)
    for (let ch = 0; ch < channels; ch++) {
      v.setInt16(
        at,
        Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i])) * 32767,
        true,
      );
      at += 2;
    }
  return new Blob([data], { type: "audio/wav" });
}
document.querySelector("#run")!.addEventListener("click", async () => {
  result.textContent = "Rendering…";
  try {
    const rows: { name: string; pass: boolean; measurements: unknown }[] = [];
    for (const profile of ["Stillness", "Warmth", "Space"] as const) {
      const b = await render(profile),
        m = measure(b, 5, 7),
        onset = measure(b, 0, 0.05);
      rows.push({
        name: profile + " guided output / 4-second fade / headroom",
        pass: m.rms > 0.02 && m.peak < 0.95 && onset.rms < m.rms * 0.1,
        measurements: { steady: m, onset },
      });
    }
    const phases: Record<
      string,
      {
        buffer: AudioBuffer;
        levels: ReturnType<typeof measure>;
        spectral: ReturnType<typeof spectrum>;
      }
    > = {};
    for (const [name, f] of [
      ["inhale-start", frame("inhale", 0.1)],
      ["inhale-end", frame("inhale", 0.9)],
      ["exhale-start", frame("exhale", 0.9)],
      ["exhale-end", frame("exhale", 0.1)],
      ["hold-in", frame("hold-in", 1)],
      ["hold-out", frame("hold-out", 0)],
    ] as const) {
      const b = await render("Stillness", { frame: f });
      phases[name] = {
        buffer: b,
        levels: measure(b, 5, 7),
        spectral: spectrum(b, 5.4),
      };
    }
    const read = (name: string) => ({
      levels: phases[name].levels,
      spectral: phases[name].spectral,
    });
    rows.push({
      name: "Inhale rises in audible pitch and brightness",
      pass:
        phases["inhale-end"].spectral.dominantHz >
          phases["inhale-start"].spectral.dominantHz + 50 &&
        phases["inhale-end"].spectral.centroidHz >
          phases["inhale-start"].spectral.centroidHz,
      measurements: { early: read("inhale-start"), late: read("inhale-end") },
    });
    rows.push({
      name: "Exhale audibly descends and softens",
      pass:
        phases["exhale-start"].spectral.dominantHz >
          phases["exhale-end"].spectral.dominantHz + 50 &&
        phases["exhale-start"].levels.rms > phases["exhale-end"].levels.rms,
      measurements: { early: read("exhale-start"), late: read("exhale-end") },
    });
    rows.push({
      name: "Upper and lower holds have distinct sustained signatures",
      pass:
        phases["hold-in"].spectral.dominantHz >
          phases["hold-out"].spectral.dominantHz + 80 &&
        phases["hold-in"].spectral.centroidHz >
          phases["hold-out"].spectral.centroidHz &&
        phases["hold-out"].levels.rms > 0.005,
      measurements: { upper: read("hold-in"), lower: read("hold-out") },
    });
    const mute = measure(await render("Stillness", { muted: true }), 0.5, 7),
      zero = measure(await render("Stillness", { volume: 0 }), 0.5, 7);
    rows.push({
      name: "Mute and zero volume silence every layer",
      pass: mute.peak === 0 && zero.peak === 0,
      measurements: { mute, zero },
    });
    const pause = measure(
      await render("Stillness", { pause: true, duration: 10 }),
      7.5,
      9,
    );
    rows.push({
      name: "Four-second fade-out ends in digital silence",
      pass: pause.peak === 0,
      measurements: pause,
    });
    const max = measure(await render("Space", { volume: 100 }), 5, 7);
    rows.push({
      name: "Full master volume remains unclipped",
      pass: max.peak < 0.95,
      measurements: max,
    });
    const idle = measure(
      await render("Stillness", { frame: frame("unavailable", 0.8) }),
      5,
      7,
    );
    rows.push({
      name: "Signal loss returns to a quiet non-guiding foundation",
      pass: idle.rms > 0 && idle.rms < phases["inhale-end"].levels.rms * 0.5,
      measurements: idle,
    });
    const noAmbient = measure(
      await render("Stillness", { intensity: 0 }),
      5,
      7,
    );
    rows.push({
      name: "Ambient intensity is independent of the primary guide",
      pass: noAmbient.rms > 0.02,
      measurements: noAmbient,
    });
    const cycle = await render("Space", { cycle: true, duration: 32 }),
      continuity = measure(cycle, 4, 32),
      start = spectrum(cycle, 14.5),
      end = spectrum(cycle, 16.5),
      outStart = spectrum(cycle, 21),
      outEnd = spectrum(cycle, 24.5);
    rows.push({
      name: "Rendered custom cycle follows the actual ring state continuously",
      pass:
        start.dominantHz < end.dominantHz &&
        outStart.dominantHz > outEnd.dominantHz &&
        continuity.peak < 0.95 &&
        continuity.maxSampleJump < 0.08,
      measurements: {
        inhaleStart: start,
        inhaleEnd: end,
        exhaleStart: outStart,
        exhaleEnd: outEnd,
        continuity,
      },
    });
    const longCycle = measure(
      await render("Stillness", { cycle: true, duration: 90 }),
      4,
      90,
    );
    rows.push({
      name: "90-second adaptive run crosses repeated texture boundaries without clipping",
      pass:
        longCycle.peak < 0.95 &&
        longCycle.maxSampleJump < 0.08 &&
        longCycle.rms > 0.01,
      measurements: longCycle,
    });
    result.textContent = JSON.stringify(
      { passed: rows.filter((r) => r.pass).length, total: rows.length, rows },
      null,
      2,
    );
    let link = document.querySelector<HTMLAnchorElement>("#sample");
    if (!link) {
      link = document.createElement("a");
      link.id = "sample";
      document.body.append(link);
    }
    if (link.href.startsWith("blob:")) URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(wav(cycle));
    link.download = "adaptive-breathing-sample.wav";
    link.textContent = "Download rendered adaptive breathing sample";
  } catch (error) {
    result.textContent = "FAILED: " + String(error);
  }
});
