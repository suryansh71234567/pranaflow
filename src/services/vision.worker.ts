import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { BreathEstimator, patchFlow } from "./breath";
import type { Landmark } from "../types";
let model: PoseLandmarker | null = null;
const estimator = new BreathEstimator();
const canvas = new OffscreenCanvas(192, 144),
  ctx = canvas.getContext("2d", { willReadFrequently: true })!;
let previous: Uint8Array | null = null,
  lastHead: number | null = null;
// MediaPipe falls back from importScripts in module workers. Load its ESM
// runtime directly, without Vite rewriting a public asset into a source import.
(self as unknown as { import: (url: string) => Promise<void> }).import =
  async () => {
    const runtimeUrl = new URL(
      "/wasm/vision_wasm_module_internal.js",
      self.location.origin,
    ).href;
    const { default: ModuleFactory } = await import(
      /* @vite-ignore */ runtimeUrl
    );
    (self as unknown as { ModuleFactory: unknown }).ModuleFactory =
      ModuleFactory;
  };
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks("/wasm");
      files.wasmBinaryPath = "/wasm/vision_wasm_module_internal.wasm";
      model = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/models/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: "ready" });
    } catch (error) {
      console.error("Pose model initialization failed", error);
      self.postMessage({
        type: "error",
        error:
          "Posture sensing could not start. Retry the camera or continue with guided timing.",
      });
    }
  }
  if (m.type === "reset") {
    estimator.reset();
    previous = null;
    lastHead = null;
  }
  if (m.type === "frame") {
    const frame = m.frame as ImageBitmap;
    try {
      const result = model?.detectForVideo(frame, m.time);
      const p: Landmark[] = result?.landmarks[0] ?? [];
      ctx.drawImage(frame, 0, 0, 192, 144);
      const rgba = ctx.getImageData(0, 0, 192, 144).data,
        gray = new Uint8Array(192 * 144);
      for (let i = 0; i < gray.length; i++)
        gray[i] = Math.round(
          0.299 * rgba[i * 4] +
            0.587 * rgba[i * 4 + 1] +
            0.114 * rgba[i * 4 + 2],
        );
      let velocity = 0,
        reliable = false;
      if (
        p.length &&
        [0, 11, 12, 23, 24].every((i) => (p[i].visibility ?? 0) > 0.65)
      ) {
        const x = Math.min(p[11].x, p[12].x) * 192,
          y = ((p[11].y + p[12].y) / 2) * 144,
          w = Math.abs(p[11].x - p[12].x) * 192,
          h = ((p[23].y + p[24].y) / 2) * 144 - y;
        const head = p[0].y * 144;
        if (previous && w > 18 && h > 16) {
          const flow = patchFlow(previous, gray, 192, 144, {
            x: x + w * 0.15,
            y: y + h * 0.12,
            w: w * 0.7,
            h: h * 0.64,
          });
          const body = lastHead === null ? 0 : head - lastHead;
          velocity = flow.dy - body;
          reliable = flow.reliable && Math.abs(body) < 1.3;
        }
        lastHead = head;
      } else {
        lastHead = null;
      }
      previous = gray;
      const breath = estimator.update(m.time, velocity, reliable);
      self.postMessage({ type: "result", landmarks: p, breath, time: m.time });
    } catch (error) {
      console.error("Frame processing failed", error);
      self.postMessage({
        type: "error",
        error: "Tracking stopped. Re-enable the camera to retry.",
      });
    } finally {
      frame.close();
    }
  }
  if (m.type === "dispose") {
    model?.close();
    model = null;
    self.close();
  }
};
