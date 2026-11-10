import { useCallback, useEffect, useRef, useState } from "react";
import type { BreathState, Landmark } from "./types";
import { emptyBreath } from "./services/breath";
import { cameraError } from "./services/camera";
export function useVision(device: string, tracking: boolean) {
  const video = useRef<HTMLVideoElement | null>(null),
    stream = useRef<MediaStream | null>(null),
    worker = useRef<Worker | null>(null),
    generation = useRef(0),
    busy = useRef(false),
    frameId = useRef(0);
  const [camera, setCamera] = useState<
    "off" | "requesting" | "active" | "error"
  >("off");
  const [model, setModel] = useState("Not loaded");
  const [error, setError] = useState("");
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [breath, setBreath] = useState<BreathState>(emptyBreath);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [aspect, setAspect] = useState(4 / 3);
  const stop = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frameId.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    worker.current?.terminate();
    worker.current = null;
    busy.current = false;
    setLandmarks([]);
    setBreath(emptyBreath());
    setCamera("off");
    setModel("Not loaded");
  }, []);
  const refreshDevices = useCallback(async () => {
    try {
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch {}
  }, []);
  const start = useCallback(async () => {
    stop();
    const token = ++generation.current;
    setCamera("requesting");
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "This browser does not support camera access. Use localhost or HTTPS.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          ...(device
            ? { deviceId: { exact: device } }
            : { facingMode: "user" }),
        },
        audio: false,
      });
      if (token !== generation.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      s.getVideoTracks()[0].onended = () => {
        stop();
        setError("The camera was disconnected. Reconnect it and try again.");
      };
      setCamera("active");
      await refreshDevices();
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
    } catch (err) {
      if (token !== generation.current) return;
      stop();
      setCamera("error");
      const e = err as DOMException;
      setError(cameraError(e));
    }
  }, [device, stop, refreshDevices]);
  // The video remains mounted across routes; attach whenever React provides a new element.
  const attach = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (el) {
      el.onloadedmetadata = () =>
        setAspect(el.videoWidth / Math.max(1, el.videoHeight));
      if (stream.current) {
        el.srcObject = stream.current;
        void el.play().catch(() => {});
      }
    }
  }, []);
  useEffect(() => {
    void refreshDevices();
    return stop;
  }, [stop, refreshDevices]);
  useEffect(() => {
    if (camera !== "active" || !tracking) {
      setLandmarks([]);
      setBreath(emptyBreath());
      setModel(tracking ? "Not loaded" : "Tracking disabled");
      return;
    }
    let alive = true,
      ready = false,
      last = 0,
      lastResultAt = performance.now();
    const w = new Worker(
      new URL("./services/vision.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = w;
    setModel("Loading local model…");
    const timeout = setTimeout(() => {
      if (alive && !ready) {
        w.terminate();
        busy.current = false;
        setModel("Unavailable");
        setError(
          "The vision model took too long to load. Retry the camera or use guided practice.",
        );
      }
    }, 30000);
    w.onmessage = (e) => {
      if (!alive) return;
      const m = e.data;
      if (m.type === "ready") {
        ready = true;
        setModel("Ready");
        lastResultAt = performance.now();
      }
      if (m.type === "result") {
        busy.current = false;
        lastResultAt = performance.now();
        setLandmarks(m.landmarks);
        setBreath(m.breath);
      }
      if (m.type === "error") {
        busy.current = false;
        ready = false;
        setModel("Unavailable");
        setError(m.error);
      }
    };
    const watchdog = setInterval(() => {
      if (ready && performance.now() - lastResultAt > 2000) {
        setLandmarks([]);
        setBreath({
          ...emptyBreath(),
          reason:
            "Tracking interrupted. Return to the camera to collect fresh movement samples.",
        });
      }
    }, 1000);
    w.onerror = () => {
      if (alive) {
        ready = false;
        busy.current = false;
        setModel("Unavailable");
        setError(
          "Vision worker could not start. Try a current Chrome or Edge browser; guided practice remains available.",
        );
      }
    };
    w.postMessage({ type: "init" });
    const tick = async (t: number) => {
      frameId.current = requestAnimationFrame(tick);
      const v = video.current;
      if (!ready || busy.current || !v || v.readyState < 2 || t - last < 90)
        return;
      last = t;
      busy.current = true;
      try {
        const bitmap = await createImageBitmap(v);
        if (alive)
          w.postMessage({ type: "frame", frame: bitmap, time: t }, [bitmap]);
        else bitmap.close();
      } catch {
        busy.current = false;
      }
    };
    frameId.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      clearTimeout(timeout);
      clearInterval(watchdog);
      cancelAnimationFrame(frameId.current);
      w.terminate();
      worker.current = null;
      busy.current = false;
    };
  }, [camera, tracking]);
  const reset = () => {
    worker.current?.postMessage({ type: "reset" });
    setBreath(emptyBreath());
  };
  return {
    attach,
    video,
    camera,
    model,
    error,
    landmarks,
    breath,
    devices,
    aspect,
    start,
    stop,
    reset,
    refreshDevices,
  };
}
