import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Award,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import {
  defaultSettings,
  type Check as PoseCheck,
  type Landmark,
  type PoseId,
  type PracticeId,
  type Session,
  type Settings,
} from "./types";
import { postures, practices } from "./data";
import { assess, classify, PostureCalibration } from "./services/posture";
import { guideAt, sequence } from "./services/guide";
import { AmbientAudio } from "./services/audio";
import { breathingAudioFrame } from "./services/breathAudio";
import { useVision } from "./useVision";
import { BreathRing } from "./components/BreathRing";
import { PoseArt, Skeleton } from "./components/PoseArt";
import "./styles.css";
const fmt = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
const totalTime = (n: number) =>
  n < 60 ? `${Math.round(n)}s` : `${Math.round(n / 60)}m`;
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
const readSettings = () => ({
  ...defaultSettings,
  ...load<Partial<Settings>>("prana-settings", {}),
});
const readSessions = () => {
  const data = load<Session[]>("prana-sessions", []);
  return Array.isArray(data)
    ? data.filter(
        (s) =>
          s &&
          typeof s.id === "string" &&
          typeof s.duration === "number" &&
          postures.some((p) => p.id === s.pose) &&
          practices.some((p) => p.id === s.practice),
      )
    : [];
};
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className={"toggle " + (value ? "on" : "")}
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">PRANA-FLOW</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function AppContent() {
  const navigate = useNavigate(),
    location = useLocation();
  const [settings, setSettings] = useState<Settings>(readSettings),
    [sessions, setSessions] = useState<Session[]>(readSessions);
  const [storageError, setStorageError] = useState("");
  const [poseId, setPoseId] = useState<PoseId>("sukhasana"),
    [practiceId, setPracticeId] = useState<PracticeId>("nadi"),
    [mode, setMode] = useState<"guided" | "mirror">("guided");
  const pose = postures.find((p) => p.id === poseId)!,
    practice = practices.find((p) => p.id === practiceId)!;
  const [inhale, setInhale] = useState(4),
    [exhale, setExhale] = useState(4),
    [rest, setRest] = useState(0),
    [inhaleHold, setInhaleHold] = useState(0),
    [minutes, setMinutes] = useState(5);
  const [state, setState] = useState<"idle" | "running" | "paused">("idle"),
    [elapsed, setElapsed] = useState(0),
    [summary, setSummary] = useState<Session | null>(null),
    [viewRecord, setViewRecord] = useState<Session | null>(null);
  const [filter, setFilter] = useState<"poses" | "breath">("poses"),
    [showConfig, setShowConfig] = useState(false),
    [showCamera, setShowCamera] = useState(false),
    [showProfile, setShowProfile] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const vision = useVision(settings.device, settings.tracking);
  const [audio] = useState(() => new AmbientAudio());
  const [ambient, setAmbient] = useState(false);
  const [audioState, setAudioState] = useState(audio.snapshot);
  const postureCalibration = useRef(new PostureCalibration());
  const previous = useRef<Landmark[] | null>(null),
    [checks, setChecks] = useState<PoseCheck[]>([]),
    [hypothesis, setHypothesis] = useState<PoseId | null>(null),
    candidate = useRef<{ id: PoseId | null; since: number }>({
      id: null,
      since: 0,
    });
  const stats = useRef({ bpms: [] as number[], tracked: 0, reliable: 0 }),
    clock = useRef({ start: 0, accumulated: 0 });
  const active = state !== "idle";
  const phases = sequence(practiceId, inhale, exhale, rest, inhaleHold),
    guide = guideAt(phases, elapsed);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  useEffect(() => {
    try {
      localStorage.setItem("prana-settings", JSON.stringify(settings));
    } catch {
      setStorageError("Preferences could not be saved in this browser.");
    }
  }, [settings]);
  useEffect(() => {
    try {
      localStorage.setItem("prana-sessions", JSON.stringify(sessions));
    } catch {
      setStorageError(
        "Session history could not be saved. Browser storage may be full or disabled.",
      );
    }
  }, [sessions]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const p = vision.landmarks;
    if (p.length) {
      setChecks(
        assess(
          p,
          previous.current,
          poseId,
          settings.rigor,
          postureCalibration.current.sample(p),
        ),
      );
      previous.current = p;
    } else {
      setChecks([]);
      previous.current = null;
      postureCalibration.current.reset();
    }
    const id = classify(p),
      now = performance.now();
    if (id !== candidate.current.id) candidate.current = { id, since: now };
    setHypothesis(id && now - candidate.current.since > 2000 ? id : null);
  }, [vision.landmarks, poseId, settings.rigor]);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (location.pathname !== "/") vision.stop();
  }, [location.pathname, vision.stop]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) update("reduced", true);
  }, []);
  useEffect(() => {
    audio.setVolume(settings.volume);
  }, [settings.volume]);
  useEffect(() => {
    audio.setMuted(settings.muted);
  }, [settings.muted]);
  useEffect(() => {
    audio.setIntensity(settings.ambientIntensity);
  }, [audio, settings.ambientIntensity]);
  useEffect(() => {
    audio.setGuidance(settings.phaseAudio);
  }, [audio, settings.phaseAudio]);
  useEffect(() => {
    const engine = audio;
    const unsubscribe = engine.subscribe((snapshot) => {
      setAudioState(snapshot);
      setAmbient(snapshot.status === "playing");
    });
    // Mobile Safari may suspend/interupt audio after a call or app switch.
    // Recovery runs in the next deliberate gesture, not an autoplay effect.
    const recover = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-audio-control]"))
        return;
      if (engine.requestedPlaying && engine.snapshot.status === "interrupted")
        void engine
          .recover()
          .catch(() => setToast("Tap Ambient Sound to resume audio."));
    };
    const teardown = () => {
      void engine.dispose();
    };
    window.addEventListener("pointerdown", recover);
    window.addEventListener("keydown", recover);
    window.addEventListener("pagehide", teardown);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", recover);
      window.removeEventListener("keydown", recover);
      window.removeEventListener("pagehide", teardown);
      void engine.dispose();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [active]);
  const latest = useRef({ vision, checks, state, elapsed });
  latest.current = { vision, checks, state, elapsed };
  useEffect(() => {
    if (state !== "running") return;
    const timer = setInterval(() => {
      const v = latest.current.vision;
      if (
        v.landmarks.length &&
        latest.current.checks.filter((c) => c.state !== "unknown").length >= 3
      )
        stats.current.tracked += 1;
      if (v.breath.bpm !== null) {
        stats.current.bpms.push(v.breath.bpm);
        stats.current.reliable += 1;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);
  function finish() {
    const seconds =
      state === "running"
        ? clock.current.accumulated +
          (performance.now() - clock.current.start) / 1000
        : clock.current.accumulated;
    setState("idle");
    setElapsed(seconds);
    vision.stop();
    const s = stats.current;
    setSummary({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      pose: poseId,
      practice: practiceId,
      duration: seconds,
      bpm: s.bpms.length
        ? s.bpms.reduce((a, b) => a + b, 0) / s.bpms.length
        : null,
      trackedSeconds: Math.min(seconds, s.tracked),
      reliableSeconds: Math.min(seconds, s.reliable),
      quality: s.reliable > 0 ? "Sufficient samples" : "Insufficient signal",
      mode: practiceId === "natural" ? "mirror" : mode,
      cycles: phases.length
        ? Math.floor(seconds / phases.reduce((a, b) => a + b.seconds, 0))
        : 0,
    });
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => {
      const t =
        clock.current.accumulated +
        (performance.now() - clock.current.start) / 1000;
      setElapsed(t);
      if (t >= minutes * 60) finishRef.current();
    }, 100);
    return () => clearInterval(id);
  }, [state, minutes]);
  async function toggleAudio() {
    try {
      if (
        audio.requestedPlaying &&
        ["playing", "starting"].includes(audio.snapshot.status)
      ) {
        update("soundEnabled", false);
        await audio.pause();
      } else {
        update("soundEnabled", true);
        await audio.start(settings.volume, settings.profile);
      }
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Audio could not start. Tap Ambient Sound to retry.",
      );
    }
  }
  function choosePractice(id: PracticeId) {
    if (active) return;
    const p = practices.find((p) => p.id === id)!;
    setPracticeId(id);
    setInhale(p.inhale || 4);
    setExhale(p.exhale || 4);
    setRest(p.pause);
    setInhaleHold(0);
    setMode(id === "natural" ? "mirror" : "guided");
    setElapsed(0);
    if (id === "custom") setShowConfig(true);
  }
  function start() {
    const initialGuide = guideAt(
      phases,
      state === "paused" ? clock.current.accumulated : 0,
    );
    audio.followBreath(
      breathingAudioFrame({
        state: "running",
        live: ringLive,
        scale: ringLive
          ? 0.83 + 0.17 * vision.breath.amplitude
          : initialGuide.scale,
        phase: initialGuide.phase,
        progress: initialGuide.progress,
        remaining: initialGuide.remaining,
        cameraActive: vision.camera === "active",
        breath: vision.breath,
      }),
    );
    // This call stays inside the user's Start gesture. No autoplay effect.
    if (
      settings.soundEnabled &&
      (!audio.requestedPlaying ||
        audio.snapshot.status === "interrupted" ||
        audio.snapshot.status === "error")
    )
      void audio
        .start(settings.volume, settings.profile)
        .catch((error) =>
          setToast(
            error instanceof Error
              ? error.message
              : "Tap Ambient Sound to resume audio.",
          ),
        );
    if (state === "paused") {
      clock.current.start = performance.now();
      setState("running");
      return;
    }
    clock.current = { start: performance.now(), accumulated: 0 };
    stats.current = { bpms: [], tracked: 0, reliable: 0 };
    setElapsed(0);
    setState("running");
  }
  function pause() {
    clock.current.accumulated +=
      (performance.now() - clock.current.start) / 1000;
    setElapsed(clock.current.accumulated);
    setState("paused");
  }
  const fallbackChecks = [
    "Torso centre-line",
    "Shoulder symmetry",
    "Head alignment",
    "Torso stability",
    poseId === "vajrasana" ? "Knee spacing" : "Hip-level symmetry",
  ];
  const feedback =
    checks.find((c) => c.state === "adjust")?.detail ||
    (checks.length && checks.some((c) => c.state === "good")
      ? "Visible alignment appears stable. Continue comfortably."
      : "Enable your camera to receive visible alignment feedback.");
  const ringLive = practiceId === "natural" || mode === "mirror";
  const ringScale =
    state === "running"
      ? ringLive
        ? 0.83 + vision.breath.amplitude * 0.17
        : guide.scale
      : state === "paused" && !ringLive
        ? guide.scale
        : 0.92;
  const soundFrame = breathingAudioFrame({
    state,
    live: ringLive,
    scale: ringScale,
    phase: guide.phase,
    progress: guide.progress,
    remaining: guide.remaining,
    cameraActive: vision.camera === "active",
    breath: vision.breath,
  });
  useEffect(() => {
    audio.followBreath(soundFrame);
  }, [
    audio,
    soundFrame.phase,
    soundFrame.expansion,
    soundFrame.progress,
    soundFrame.remaining,
    soundFrame.source,
  ]);
  const ringLabel =
    state === "paused"
      ? "Paused"
      : state === "idle"
        ? "Find your rhythm"
        : ringLive
          ? vision.breath.quality === "Good" || vision.breath.quality === "Fair"
            ? vision.breath.phase
            : vision.breath.quality === "Calibrating"
              ? "Calibrating"
              : "Breathe naturally"
          : guide.phase?.label;
  const ringCaption =
    state === "running"
      ? ringLive
        ? vision.breath.bpm
          ? "Estimated movement"
          : "Listening to movement"
        : guide.phase?.cue
      : "A little space. A softer breath.";
  const saveSession = () => {
    if (summary) {
      setSessions((s) => [summary, ...s]);
      setSummary(null);
      setToast("Practice saved on this device.");
      navigate("/progress");
    }
  };
  const clearPrefs = async () => {
    setSettings(defaultSettings);
    setAmbient(false);
    await audio.stop();
    setToast("Preferences reset.");
  };
  return (
    <div
      className={
        (settings.reduced ? "reduced " : "") +
        (settings.contrast ? "high-contrast" : "")
      }
      style={
        {
          "--glow": settings.glow / 100,
          "--text-scale": settings.textSize / 100,
        } as CSSProperties
      }
    >
      <header className="topbar">
        <NavLink to="/" className="wordmark" aria-label="Prana-Flow home">
          PRANA<span>–</span>FLOW
        </NavLink>
        <nav aria-label="Main navigation">
          {[
            ["/", "Practice"],
            ["/library", "Yoga & Breath"],
            ["/progress", "Progress"],
            ["/settings", "Settings"],
          ].map(([path, label]) => (
            <NavLink end={path === "/"} key={path} to={path}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <div
            className={"ambient pill " + (ambient ? "selected" : "")}
            role="group"
            aria-label="Ambient audio"
            data-audio-control
            data-audio-state={audioState.status}
            data-audio-context={audioState.contextState}
            data-audio-phase={audioState.phase}
            data-audio-source={audioState.source}
            data-breath-expansion={soundFrame.expansion.toFixed(3)}
            onClick={() => void toggleAudio()}
          >
            <button
              type="button"
              aria-label={
                settings.muted ? "Unmute ambient sound" : "Mute ambient sound"
              }
              aria-pressed={settings.muted}
              title={
                settings.muted ? "Unmute ambient sound" : "Mute ambient sound"
              }
              style={{ padding: 0, display: "flex", color: "inherit" }}
              onClick={(event) => {
                event.stopPropagation();
                update("muted", !settings.muted);
              }}
            >
              {settings.muted || settings.volume === 0 || !ambient ? (
                <VolumeX size={14} />
              ) : (
                <Volume2 size={14} />
              )}
            </button>
            <button
              type="button"
              aria-label={
                ambient ? "Pause ambient sound" : "Play ambient sound"
              }
              aria-pressed={ambient}
              title={
                ambient
                  ? "Pause ambient sound"
                  : audioState.status === "interrupted"
                    ? "Resume interrupted sound"
                    : "Play ambient sound"
              }
              style={{ padding: 0, font: "inherit", color: "inherit" }}
            >
              <span>Ambient Sound</span>
            </button>
            <AudioLines size={14} aria-hidden="true" />
          </div>
          <span
            className={
              "status pill " + (vision.camera === "active" ? "live" : "")
            }
          >
            <i />
            {vision.camera === "active" ? "LIVE SENSING" : "STANDBY"}
          </span>
          <button
            className="icon-button"
            aria-label="Camera setup"
            onClick={() => setShowCamera(true)}
          >
            <Camera size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Preferences"
            onClick={() => navigate("/settings")}
          >
            <SlidersHorizontal size={17} />
          </button>
          <button
            className="avatar"
            aria-label="About Prana-Flow"
            onClick={() => setShowProfile(true)}
          >
            PF
          </button>
        </div>
      </header>
      {storageError && (
        <div className="error-banner" role="alert">
          {storageError}
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <main className="practice-page">
              <div className="practice-intro">
                <div>
                  <span className="eyebrow">
                    <span className="tiny-line" /> YOUR DAILY MOMENT OF
                    STILLNESS
                  </span>
                  <h1>
                    Come back to <em>yourself.</em>
                  </h1>
                </div>
                <p>
                  Settle into your seat.
                  <br />
                  Let your breath lead the way.
                </p>
              </div>
              <div className="practice-grid">
                <section className="posture-panel" aria-label="Posture coach">
                  <aside className="posture-sidebar">
                    <span className="eyebrow">
                      CURRENT POSTURE <span className="green">+</span>
                    </span>
                    <label className="pose-select-label">
                      <select
                        aria-label="Select posture"
                        value={poseId}
                        disabled={active}
                        onChange={(e) => {
                          setPoseId(e.target.value as PoseId);
                          postureCalibration.current.reset();
                          vision.reset();
                        }}
                      >
                        {postures.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </label>
                    <p className="pose-english">{pose.english}</p>
                    <span className="manual-label">Manually selected</span>
                    <ul className="alignment-list">
                      {fallbackChecks.map((label, i) => {
                        const c = checks[i];
                        return (
                          <li
                            key={label}
                            className={c?.state ?? "unknown"}
                            title={
                              c?.detail ?? "Enable camera tracking to assess"
                            }
                          >
                            <span className="check-dot">
                              {c?.state === "good" ? (
                                <Check size={12} />
                              ) : c?.state === "adjust" ? (
                                "!"
                              ) : (
                                "·"
                              )}
                            </span>
                            <span>{label}</span>
                            <small>
                              {c?.state === "good"
                                ? "✓"
                                : c?.state === "adjust"
                                  ? "↗"
                                  : "—"}
                            </small>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="posture-guide">
                      <span className="eyebrow">
                        POSTURE GUIDE <span className="green">+</span>
                      </span>
                      <div className="guide-art">
                        <PoseArt pose={poseId} />
                      </div>
                      <p>{pose.instruction}</p>
                    </div>
                  </aside>
                  <div className="camera-column">
                    <div className="camera-window">
                      <video
                        ref={vision.attach}
                        className={
                          (settings.mirror ? "mirrored " : "") +
                          (!settings.preview ? "preview-hidden" : "")
                        }
                        muted
                        playsInline
                        aria-label="Live webcam preview"
                      />
                      {settings.preview && settings.overlay && (
                        <Skeleton
                          points={vision.landmarks}
                          mirror={settings.mirror}
                          aspect={vision.aspect}
                        />
                      )}
                      {vision.camera === "active" ? (
                        <>
                          <div className="camera-badge">
                            <i
                              className={
                                vision.landmarks.length
                                  ? "green-dot"
                                  : "amber-dot"
                              }
                            />
                            <div>
                              {vision.landmarks.length
                                ? "Posture tracking active"
                                : vision.model === "Ready"
                                  ? "Position not clear"
                                  : vision.model}
                              <small>
                                {hypothesis
                                  ? `Tentative: ${postures.find((p) => p.id === hypothesis)?.name}`
                                  : "Pose identification uncertain"}
                              </small>
                            </div>
                          </div>
                          {!settings.preview && (
                            <div className="preview-cover">
                              <EyeOff size={28} />
                              <h3>Preview hidden</h3>
                              <p>Local sensing is still active.</p>
                            </div>
                          )}
                          <div className="camera-tools">
                            <button
                              className="icon-button"
                              aria-label={
                                settings.preview
                                  ? "Hide camera preview"
                                  : "Show camera preview"
                              }
                              onClick={() =>
                                update("preview", !settings.preview)
                              }
                            >
                              {settings.preview ? (
                                <Eye size={16} />
                              ) : (
                                <EyeOff size={16} />
                              )}
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Turn camera off"
                              onClick={vision.stop}
                            >
                              <CameraOff size={16} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="camera-empty">
                          <div className="viewfinder">
                            <span />
                            <span />
                            <span />
                            <span />
                            <PoseArt pose={poseId} />
                          </div>
                          <span className="eyebrow">
                            YOUR PRIVATE PRACTICE SPACE
                          </span>
                          <h2>
                            A mindful seat.
                            <br />A clearer connection.
                          </h2>
                          <p>
                            Turn on your camera for gentle posture
                            <br className="desktop-break" /> observations and
                            breath movement sensing.
                          </p>
                          <button
                            className="gold-button"
                            onClick={() => void vision.start()}
                            disabled={vision.camera === "requesting"}
                          >
                            {vision.camera === "requesting" ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : (
                              <Camera size={16} />
                            )}{" "}
                            {vision.camera === "requesting"
                              ? "Connecting…"
                              : "Enable Camera"}
                          </button>
                          <span className="privacy-caption">
                            <ShieldCheck size={13} /> On-device processing.
                            Never recorded.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="camera-feedback">
                      <div className="alignment-meter">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className={checks[i]?.state ?? "unknown"}
                          />
                        ))}
                      </div>
                      <p>{feedback}</p>
                    </div>
                  </div>
                  {vision.error && (
                    <div className="camera-error" role="alert">
                      {vision.error}
                      <button
                        className="text-button"
                        onClick={() => void vision.start()}
                      >
                        Retry camera
                      </button>
                    </div>
                  )}
                </section>
                <section className="breath-panel" aria-label="Breathing coach">
                  <div
                    className="practice-tabs"
                    role="group"
                    aria-label="Breathing practice"
                  >
                    {practices.map((p) => (
                      <button
                        disabled={active}
                        aria-pressed={practiceId === p.id}
                        className={practiceId === p.id ? "active" : ""}
                        key={p.id}
                        onClick={() => choosePractice(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="breath-mode-row">
                    <div className="segmented">
                      <button
                        disabled={active || practiceId === "natural"}
                        className={!ringLive ? "selected" : ""}
                        onClick={() => setMode("guided")}
                      >
                        Guided Coach
                      </button>
                      <button
                        disabled={active}
                        className={ringLive ? "selected" : ""}
                        onClick={() => setMode("mirror")}
                      >
                        Live Mirror
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setShowConfig(true)}
                    >
                      <Settings2 size={13} />{" "}
                      {practiceId === "natural"
                        ? "Session options"
                        : `${inhale}${inhaleHold ? `:${inhaleHold}` : ""}:${exhale}${rest ? `:${rest}` : ""} rhythm`}
                    </button>
                  </div>
                  <div className="ring-stage">
                    <svg
                      className="breath-waves"
                      viewBox="0 0 700 330"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M-20 180 C100 180 120 40 270 160 S470 175 530 160 S650 100 740 150" />
                      <path d="M-20 190 C100 190 125 80 270 175 S470 185 530 175 S650 125 740 160" />
                    </svg>
                    <BreathRing
                      state={state}
                      live={ringLive}
                      scale={ringScale}
                      label={ringLabel}
                      caption={ringCaption}
                      remaining={guide.remaining}
                      breath={vision.breath}
                      humming={practiceId === "bhramari"}
                    />
                    <ol className="phase-timeline">
                      {(ringLive
                        ? [
                            {
                              label: "Observe",
                              seconds: 0,
                              cue: "Your own rhythm",
                              expand: true,
                            },
                          ]
                        : phases
                      ).map((p, i) => (
                        <li
                          key={i}
                          className={
                            !ringLive && i === guide.index ? "current" : ""
                          }
                        >
                          <i />
                          <div>
                            {p.label}
                            <span>
                              {p.seconds
                                ? `${p.seconds.toFixed(1)} s`
                                : "No set timing"}
                            </span>
                            {practiceId === "nadi" && (
                              <small>{p.cue.replace("Through the ", "")}</small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="signal-row">
                    <div className="metric-pill">
                      <Activity size={17} />
                      <span>Estimated rate</span>
                      <strong>
                        {vision.breath.bpm
                          ? `${vision.breath.bpm.toFixed(1)} bpm`
                          : vision.camera === "active"
                            ? "Collecting…"
                            : "—"}
                      </strong>
                    </div>
                    <div className="metric-pill">
                      <span
                        className={
                          "signal-bars " + (vision.breath.bpm ? "green" : "")
                        }
                      >
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>Signal</span>
                      <strong className={vision.breath.bpm ? "green" : ""}>
                        {vision.camera === "active"
                          ? vision.breath.quality
                          : "No signal"}
                      </strong>
                    </div>
                  </div>
                  <div className="signal-detail">
                    {vision.camera === "active"
                      ? vision.breath.bpm
                        ? `Movement confidence ${Math.round(vision.breath.confidence * 100)}%${!ringLive ? ` · Target ${(60 / (inhale + inhaleHold + exhale + rest)).toFixed(1)} bpm · Observed ${vision.breath.bpm.toFixed(1)} bpm` : ""}`
                        : vision.breath.quality === "Calibrating"
                          ? `Natural-breath calibration · ${Math.round(vision.breath.progress * 100)}%`
                          : "Movement estimate unavailable · Keep your torso in view"
                      : ringLive
                        ? "Enable your camera for Live Mirror"
                        : "Camera optional for guided practice"}
                  </div>
                  <div className="session-controls">
                    <button
                      className="round-control"
                      disabled={!active}
                      onClick={finish}
                    >
                      <span>
                        <Leaf size={21} />
                      </span>
                      End Session
                    </button>
                    <button
                      className="round-control primary"
                      onClick={state === "running" ? pause : start}
                    >
                      <span>
                        {state === "running" ? (
                          <Pause size={23} />
                        ) : (
                          <Play size={22} />
                        )}
                      </span>
                      {state === "running"
                        ? "Pause"
                        : state === "paused"
                          ? "Resume"
                          : "Begin Practice"}
                    </button>
                    <button
                      className="round-control"
                      disabled={!active}
                      onClick={finish}
                    >
                      <span>
                        <Square size={17} />
                      </span>
                      Stop
                    </button>
                    <div className="session-time">
                      <small>SESSION / {minutes} MIN</small>
                      <strong>{fmt(elapsed)}</strong>
                    </div>
                  </div>
                  <div className="practice-note">
                    <Sparkles size={15} />
                    <p>
                      {state === "running" && ringLive
                        ? vision.breath.reason
                        : practice.instruction}
                    </p>
                  </div>
                  <div className="breath-footnote">
                    <ShieldCheck size={12} />{" "}
                    {ringLive
                      ? "Camera movement is an estimate, not a measure of airflow."
                      : "Guided timing is a target. Your observed breath is measured separately."}
                  </div>
                </section>
              </div>
              <footer className="practice-footer">
                <span>
                  <i className="tiny-gold-dot" /> A quieter mind begins with one
                  breath.
                </span>
                <span>
                  PRIVATE BY DESIGN <span className="footer-dot">·</span> MADE
                  FOR YOUR RHYTHM
                </span>
              </footer>
            </main>
          }
        />
        <Route
          path="/library"
          element={
            <main className="content-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">EXPLORE YOUR PRACTICE</span>
                  <h1>Yoga Asana & Pranayama Library</h1>
                  <p>
                    Contemplative postures and gentle breathing rhythms, with
                    guidance for every seat.
                  </p>
                </div>
                <div className="segmented library-filter">
                  <button
                    className={filter === "poses" ? "selected" : ""}
                    onClick={() => setFilter("poses")}
                  >
                    Seated Postures (4)
                  </button>
                  <button
                    className={filter === "breath" ? "selected" : ""}
                    onClick={() => setFilter("breath")}
                  >
                    Breathing Practices (6)
                  </button>
                </div>
              </div>
              <div className="library-grid">
                {filter === "poses"
                  ? postures.map((p) => (
                      <article className="library-card" key={p.id}>
                        <div className="card-top">
                          <div>
                            <span className="eyebrow gold">{p.name}</span>
                            <h2>{p.english}</h2>
                          </div>
                          <span className="tag">
                            <Sparkles size={12} /> Seated Asana
                          </span>
                        </div>
                        <div className="library-art">
                          <PoseArt pose={p.id} />
                        </div>
                        <p>{p.intro}</p>
                        <span className="eyebrow">ALIGNMENT CUES</span>
                        <p className="ivory">{p.instruction}</p>
                        <span className="eyebrow">PRACTICE NOTES</span>
                        <ul className="benefits">
                          {p.cues.map((c) => (
                            <li key={c}>
                              <Check size={14} />
                              {c}
                            </li>
                          ))}
                        </ul>
                        <div className="card-bottom">
                          <small>Focus: {p.focus}</small>
                          <button
                            className="gold-button"
                            disabled={active}
                            onClick={() => {
                              setPoseId(p.id);
                              navigate("/");
                            }}
                          >
                            Practice Pose <ArrowRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))
                  : practices.map((p) => (
                      <article className="library-card breath-card" key={p.id}>
                        <div className="card-top">
                          <div>
                            <span className="eyebrow gold">{p.subtitle}</span>
                            <h2>{p.name}</h2>
                          </div>
                          <Waves size={24} className="gold" />
                        </div>
                        <div className="mini-ring">
                          <Waves size={30} />
                        </div>
                        <p>{p.description}</p>
                        <span className="eyebrow">HOW TO PRACTICE</span>
                        <p className="ivory">{p.instruction}</p>
                        <div className="timing-chips">
                          <span>
                            {p.id === "natural"
                              ? "Untimed rhythm"
                              : `${p.inhale}s in · ${p.exhale}s out`}
                          </span>
                          <span>1–30 min</span>
                        </div>
                        <div className="card-bottom">
                          <small>
                            {p.pause
                              ? "Optional rest included"
                              : "No required retention"}
                          </small>
                          <button
                            className="gold-button"
                            disabled={active}
                            onClick={() => {
                              choosePractice(p.id);
                              navigate("/");
                            }}
                          >
                            Start Practice <ArrowRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
              </div>
              {active && (
                <p className="muted">
                  Finish the current session before changing its posture or
                  breathing practice.
                </p>
              )}
            </main>
          }
        />
        <Route
          path="/progress"
          element={
            <main className="content-page progress-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    SMALL MOMENTS, LASTING PRACTICE
                  </span>
                  <h1>Your Practice Journey</h1>
                  <p>Your sessions, your rhythm, your progress.</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="text-button"
                    disabled={!sessions.length}
                    onClick={() => setDeleteId("all")}
                  >
                    <Trash2 size={14} /> Clear History
                  </button>
                  <button className="gold-button" onClick={() => navigate("/")}>
                    Start New Practice <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="stats-grid">
                {[
                  {
                    icon: <Clock3 />,
                    value: totalTime(
                      sessions.reduce((n, s) => n + s.duration, 0),
                    ),
                    label: "Total Practice Time",
                  },
                  {
                    icon: <Award />,
                    value: sessions.length,
                    label: "Completed Sessions",
                  },
                  {
                    icon: <Activity />,
                    value: sessions.some((s) => s.bpm !== null)
                      ? (
                          sessions
                            .filter((s) => s.bpm !== null)
                            .reduce((a, s) => a + s.bpm!, 0) /
                          sessions.filter((s) => s.bpm !== null).length
                        ).toFixed(1)
                      : "—",
                    label: "Average Estimated BPM",
                  },
                  {
                    icon: <CircleCheck />,
                    value: sessions.filter((s) => s.trackedSeconds >= 5).length,
                    label: "Sessions with Posture Data",
                  },
                ].map((s, i) => (
                  <div className="stat-card" key={s.label}>
                    <span className={i % 2 ? "green" : "gold"}>{s.icon}</span>
                    <div>
                      <strong>{s.value}</strong>
                      <small>{s.label}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="table-heading">
                <h2>Recent Practices</h2>
                <span className="eyebrow">STORED ONLY ON THIS DEVICE</span>
              </div>
              <div className="history-table">
                <table>
                  <thead>
                    <tr>
                      {[
                        "DATE & TIME",
                        "POSTURE",
                        "PRANAYAMA",
                        "DURATION",
                        "EST. AVG BPM",
                        "SIGNAL QUALITY",
                        "ACTION",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <button
                            className="record-link"
                            onClick={() => setViewRecord(s)}
                          >
                            <Clock3 size={13} />
                            {new Date(s.date).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </button>
                        </td>
                        <td>
                          <span className="tag">
                            {postures.find((p) => p.id === s.pose)?.name}
                          </span>
                        </td>
                        <td>
                          {practices.find((p) => p.id === s.practice)?.name}
                        </td>
                        <td>{fmt(s.duration)}</td>
                        <td>{s.bpm ? `${s.bpm.toFixed(1)} bpm` : "—"}</td>
                        <td>
                          <span className={s.bpm ? "green" : "muted"}>
                            {s.quality}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label="Delete session"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!sessions.length && (
                  <div className="empty-history">
                    <span className="empty-icon">
                      <Leaf size={28} />
                    </span>
                    <h2>Your journey begins with a breath.</h2>
                    <p>
                      Complete a practice and save its summary.
                      <br />
                      Your moments of stillness will find a home here.
                    </p>
                    <button
                      className="gold-button"
                      onClick={() => navigate("/")}
                    >
                      Begin your first practice <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </main>
          }
        />
        <Route
          path="/settings"
          element={
            <main className="settings-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                  <h1>Preferences & Settings</h1>
                  <p>
                    A few thoughtful adjustments for a practice that feels like
                    you.
                  </p>
                </div>
              </div>
              <section className="settings-card">
                <h2>
                  <Camera size={18} /> Camera & Pose Vision
                </h2>
                <SettingRow
                  title="Camera source"
                  description="Available cameras are listed after browser permission is granted."
                >
                  <select
                    aria-label="Camera source"
                    value={settings.device}
                    onChange={(e) => update("device", e.target.value)}
                  >
                    <option value="">System default</option>
                    {vision.devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow
                  title="Camera status"
                  description={
                    vision.camera === "active"
                      ? "Your camera is active. Frames stay on this device."
                      : "Camera is off. Enable it from the Practice screen."
                  }
                >
                  <span className="tag">
                    {vision.camera === "active" ? "Active" : "Off"}
                  </span>
                </SettingRow>
                {(
                  [
                    [
                      "mirror",
                      "Mirror Camera View",
                      "Flip the video horizontally for a natural mirror.",
                    ],
                    [
                      "overlay",
                      "Show Skeletal Landmarks",
                      "Draw detected joints and connections over your webcam.",
                    ],
                    [
                      "preview",
                      "Show Camera Preview",
                      "Hiding the preview keeps local sensing active.",
                    ],
                    [
                      "tracking",
                      "Enable Pose Tracking",
                      "Process frames locally to observe visible body alignment.",
                    ],
                  ] as const
                ).map(([key, title, description]) => (
                  <SettingRow key={key} title={title} description={description}>
                    <Toggle
                      value={settings[key]}
                      onChange={() => update(key, !settings[key])}
                      label={title}
                    />
                  </SettingRow>
                ))}
                <SettingRow
                  title="Assessment sensitivity"
                  description="Adjust geometric tolerance for visible alignment checks."
                >
                  <div className="segmented">
                    {(["Gentle", "Normal", "Strict"] as const).map((v) => (
                      <button
                        key={v}
                        className={settings.rigor === v ? "selected" : ""}
                        onClick={() => update("rigor", v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow
                  title="Reset calibration"
                  description="Collect a fresh movement baseline on your next camera session."
                >
                  <button
                    className="outline-button"
                    onClick={() => {
                      vision.reset();
                      postureCalibration.current.reset();
                      setToast(
                        "Calibration reset. Enable your camera in Practice to collect fresh samples.",
                      );
                    }}
                  >
                    <RotateCcw size={14} /> Reset sensing
                  </button>
                </SettingRow>
              </section>
              <section className="settings-card">
                <h2>
                  <Sparkles size={18} /> Visual & Audio Ambiance
                </h2>
                <SettingRow
                  title="Reduced Motion"
                  description="Simplify the ring animation and interface transitions."
                >
                  <Toggle
                    value={settings.reduced}
                    onChange={() => update("reduced", !settings.reduced)}
                    label="Reduced Motion"
                  />
                </SettingRow>
                <SettingRow
                  title="Ring glow"
                  description="Choose the intensity of the golden light."
                >
                  <input
                    type="range"
                    aria-label="Ring glow"
                    min="0"
                    max="100"
                    value={settings.glow}
                    onChange={(e) => update("glow", +e.target.value)}
                  />
                </SettingRow>
                <SettingRow
                  title="Text size"
                  description="Adjust body text for comfortable reading."
                >
                  <select
                    aria-label="Text size"
                    value={settings.textSize}
                    onChange={(e) => update("textSize", +e.target.value)}
                  >
                    <option value="100">Standard</option>
                    <option value="110">Larger</option>
                    <option value="120">Largest</option>
                  </select>
                </SettingRow>
                <SettingRow
                  title="Higher contrast"
                  description="Increase the brightness of secondary text and panel borders."
                >
                  <Toggle
                    value={settings.contrast}
                    onChange={() => update("contrast", !settings.contrast)}
                    label="Higher contrast"
                  />
                </SettingRow>
                <SettingRow
                  title="Ambient Sound"
                  description="Soft generated tones, with a gentle fade in and out."
                >
                  <span data-audio-control style={{ display: "contents" }}>
                    <Toggle
                      value={ambient}
                      onChange={() => void toggleAudio()}
                      label="Ambient Sound"
                    />
                  </span>
                </SettingRow>
                <SettingRow
                  title="Volume"
                  description="Keep the background sound at a comfortable level."
                >
                  <input
                    aria-label="Ambient volume"
                    type="range"
                    min="0"
                    max="100"
                    value={settings.volume}
                    aria-valuetext={
                      settings.muted || settings.volume === 0
                        ? "Muted"
                        : `${settings.volume} percent`
                    }
                    onChange={(e) => {
                      update("volume", +e.target.value);
                      if (+e.target.value > 0) update("muted", false);
                    }}
                  />
                </SettingRow>
                <SettingRow
                  title="Ambient sound intensity"
                  description="Balance the soft atmosphere beneath the breathing guide."
                >
                  <input
                    aria-label="Ambient sound intensity"
                    type="range"
                    min="0"
                    max="100"
                    value={settings.ambientIntensity}
                    onChange={(e) =>
                      update("ambientIntensity", +e.target.value)
                    }
                  />
                </SettingRow>
                <SettingRow
                  title="Sound profile"
                  description="A subtle tonal palette. Headphones are optional for a wider sound image."
                >
                  <select
                    aria-label="Sound profile"
                    value={settings.profile}
                    onChange={(e) => {
                      const p = e.target.value as Settings["profile"];
                      update("profile", p);
                      audio.setProfile(p);
                    }}
                  >
                    {["Stillness", "Warmth", "Space"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow
                  title="Breath-responsive sound"
                  description="Let pitch, brightness and space follow the breathing ring. No spoken cues."
                >
                  <Toggle
                    value={settings.phaseAudio}
                    onChange={() => update("phaseAudio", !settings.phaseAudio)}
                    label="Breath-responsive sound"
                  />
                </SettingRow>
              </section>
              <section className="settings-card privacy-card">
                <h2>
                  <ShieldCheck size={19} /> On-Device Privacy
                </h2>
                <p>
                  Your webcam is a window for your practice, never a recording.
                </p>
                <ul className="benefits">
                  {[
                    "Pose and image movement processing run locally in a dedicated browser worker.",
                    "No video, audio, images or body landmarks are uploaded or saved.",
                    "Only session summaries you choose to save are stored on this device.",
                    "The model and runtime are served locally with this application.",
                  ].map((t) => (
                    <li key={t}>
                      <Check size={15} />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  For wellness and education. Camera observations are estimates
                  and cannot measure airflow or replace professional assessment.
                  Stay within your comfortable range and stop if you feel
                  unwell.
                </p>
                <div className="privacy-actions">
                  <button
                    className="outline-button"
                    disabled={!sessions.length}
                    onClick={() => setDeleteId("all")}
                  >
                    <Trash2 size={14} /> Clear local history
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void clearPrefs()}
                  >
                    Reset preferences
                  </button>
                </div>
              </section>
            </main>
          }
        />
        <Route
          path="*"
          element={
            <main className="empty-history">
              <h1>A moment off the path.</h1>
              <p>Let’s return to your practice.</p>
              <button className="gold-button" onClick={() => navigate("/")}>
                Back to Practice
              </button>
            </main>
          }
        />
      </Routes>
      {showConfig && (
        <Modal
          title="Your breathing rhythm"
          onClose={() => setShowConfig(false)}
        >
          <p className="muted">
            Choose a pace that feels comfortable. A pause is always optional.
          </p>
          <div className="config-grid">
            <label>
              Inhale <span>seconds</span>
              <input
                disabled={active || practiceId === "natural"}
                type="number"
                min="2"
                max="10"
                value={inhale}
                onChange={(e) => {
                  const v = Math.max(2, Math.min(10, +e.target.value));
                  setInhale(v);
                  if (practiceId === "equal") setExhale(v);
                }}
              />
            </label>
            <label>
              Exhale <span>seconds</span>
              <input
                disabled={active || practiceId === "natural"}
                type="number"
                min="2"
                max="15"
                value={exhale}
                onChange={(e) => {
                  const v = Math.max(2, Math.min(15, +e.target.value));
                  setExhale(v);
                  if (practiceId === "equal") setInhale(v);
                }}
              />
            </label>
            {practiceId === "custom" && (
              <label>
                Hold after inhale <span>seconds · optional</span>
                <input
                  aria-label="Hold after inhale seconds"
                  type="number"
                  min="0"
                  max="4"
                  value={inhaleHold}
                  disabled={active}
                  onChange={(e) =>
                    setInhaleHold(Math.max(0, Math.min(4, +e.target.value)))
                  }
                />
              </label>
            )}
            <label>
              {practiceId === "custom" ? "Hold after exhale" : "Optional rest"}{" "}
              <span>seconds</span>
              <input
                disabled={active || practiceId === "natural"}
                type="number"
                min="0"
                max="4"
                value={rest}
                onChange={(e) =>
                  setRest(Math.max(0, Math.min(4, +e.target.value)))
                }
              />
            </label>
            <label>
              Session length <span>minutes</span>
              <input
                disabled={active}
                type="number"
                min="1"
                max="30"
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(1, Math.min(30, +e.target.value)))
                }
              />
            </label>
          </div>
          {practiceId === "natural" && (
            <p className="muted">
              Natural Breath follows your own movement; it has no prescribed
              phase timings.
            </p>
          )}
          {active && (
            <p className="muted">
              Finish this session before changing its rhythm.
            </p>
          )}
          <button
            className="gold-button wide"
            onClick={() => setShowConfig(false)}
          >
            Return to practice <ArrowRight size={15} />
          </button>
        </Modal>
      )}
      {showCamera && (
        <Modal
          title="Make space for your practice"
          onClose={() => setShowCamera(false)}
        >
          <div className="camera-setup-art">
            <PoseArt pose={poseId} />
          </div>
          <ol className="setup-steps">
            <li>
              Place your camera around torso height, a little distance away.
            </li>
            <li>
              Include your head, shoulders, hips and knees. Feet help
              distinguish seated postures.
            </li>
            <li>
              Use steady, even lighting and a textured top. Breathe naturally
              for at least 20 seconds.
            </li>
          </ol>
          <p className="muted">
            Some seated poses look similar on a single camera. Your manual
            selection stays in control; tentative identification is shown
            separately.
          </p>
          <div className="modal-actions">
            {vision.camera === "active" ? (
              <button
                className="outline-button"
                onClick={() => {
                  vision.stop();
                  setShowCamera(false);
                }}
              >
                <CameraOff size={15} /> Turn camera off
              </button>
            ) : (
              <button
                className="gold-button"
                onClick={() => {
                  navigate("/");
                  setShowCamera(false);
                  setTimeout(() => void vision.start(), 50);
                }}
              >
                <Camera size={15} /> Enable Camera
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setShowCamera(false);
                navigate("/");
              }}
            >
              Continue without camera
            </button>
          </div>
        </Modal>
      )}
      {showProfile && (
        <Modal
          title="A space to return to yourself"
          onClose={() => setShowProfile(false)}
        >
          <div className="about-symbol">
            <Leaf size={45} />
          </div>
          <p>
            PRANA-FLOW is a contactless yoga posture and pranayama coach,
            designed around a quieter, more attentive practice.
          </p>
          <p className="muted">
            IKO-103 · Digital Product Design
            <br />
            Created by Viraj, Sarthak & Saksham.
          </p>
          <p className="privacy-caption">
            <ShieldCheck size={16} /> No account. No cloud history. Your
            practice stays yours.
          </p>
        </Modal>
      )}
      {(summary || viewRecord) && (
        <Modal
          title={summary ? "A moment well spent." : "Your practice summary"}
          onClose={() => {
            setSummary(null);
            setViewRecord(null);
          }}
        >
          {(() => {
            const s = (summary || viewRecord)!;
            return (
              <>
                <p className="muted">
                  {postures.find((p) => p.id === s.pose)?.name} ·{" "}
                  {practices.find((p) => p.id === s.practice)?.name}
                </p>
                <div className="summary-stats">
                  <div>
                    <strong>{fmt(s.duration)}</strong>
                    <span>Time in practice</span>
                  </div>
                  <div>
                    <strong>{s.bpm ? s.bpm.toFixed(1) : "—"}</strong>
                    <span>Estimated average BPM</span>
                  </div>
                  <div>
                    <strong>{Math.floor(s.trackedSeconds)}s</strong>
                    <span>With posture observations</span>
                  </div>
                  <div>
                    <strong>{Math.floor(s.reliableSeconds)}s</strong>
                    <span>With reliable breath samples</span>
                  </div>
                </div>
                <p className="muted">
                  {s.mode === "guided"
                    ? `${s.cycles} guided sequences completed. `
                    : "Live movement mirror. "}
                  {s.quality}. A dash means there wasn’t enough reliable data.
                </p>
                {summary ? (
                  <>
                    <p className="privacy-caption">
                      <ShieldCheck size={14} /> Save this summary on your
                      device? No images or video are stored.
                    </p>
                    <div className="modal-actions">
                      <button
                        className="text-button"
                        onClick={() => setSummary(null)}
                      >
                        Discard summary
                      </button>
                      <button className="gold-button" onClick={saveSession}>
                        Save Practice <Check size={15} />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="gold-button wide"
                    onClick={() => setViewRecord(null)}
                  >
                    Close summary
                  </button>
                )}
              </>
            );
          })()}
        </Modal>
      )}
      {deleteId && (
        <Modal
          title={
            deleteId === "all"
              ? "Clear your practice history?"
              : "Delete this practice?"
          }
          onClose={() => setDeleteId(null)}
        >
          <p className="muted">
            This removes{" "}
            {deleteId === "all" ? "all saved summaries" : "this summary"} from
            this device. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="text-button" onClick={() => setDeleteId(null)}>
              Keep history
            </button>
            <button
              className="gold-button"
              onClick={() => {
                setSessions((s) =>
                  deleteId === "all" ? [] : s.filter((r) => r.id !== deleteId),
                );
                setDeleteId(null);
                setToast("History updated.");
              }}
            >
              Delete <Trash2 size={14} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
