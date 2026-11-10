# PRANA-FLOW

Contactless yoga posture observation and pranayama guidance. IKO-103 · Viraj, Sarthak & Saksham.

## Run locally

Requires Node.js 20.19+ or 22.12+ (tested with Node 24.13) and npm. Use a current Chrome or Edge browser with WebAssembly SIMD, Web Workers, OffscreenCanvas and camera support.

```powershell
cd 'C:\Saksham Website'
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The port is fixed; stop the existing server before starting another instance. Camera access needs localhost or HTTPS. The app does not require an account, API key, backend or external model server.

For the built application:

```powershell
npm run build
npm run preview
```

Both commands use the same origin so camera permissions and local history remain consistent. To restart after closing the server, run `npm run dev`, or `npm run preview` if the production build already exists. Stop the server with Ctrl+C. A refresh starts an idle session and never automatically enables the camera or sound; an active session warns before refresh and is not automatically saved.

```powershell
npm test
```

## Implemented

- React/TypeScript/Vite application with Practice, Yoga & Breath, Progress and Settings routes, including direct route refresh support in Vite.
- Reference-inspired dark and gold interface, luminous breathing ring, desktop two-column layout, responsive stacked layout, original SVG posture illustrations and locally bundled fonts.
- Four manually selectable postures; cards navigate to the selected posture. Six breathing practices with instructions and configurable timing/session length.
- Real webcam acquisition, enumerated camera selection, mirrored preview, preview hiding, camera-off controls and actual canvas landmarks.
- MediaPipe Pose Landmarker Lite inference in a dedicated worker, using the local `.task` model and local WASM runtime. Approximately 11 inference opportunities per second; a busy guard prevents overlapping work.
- Visibility-gated upper-body geometry checks, camera-scale baseline calibration, conservative tentative posture hypotheses and explicit uncertainty.
- Experimental image-patch movement estimation, natural-breath calibration, signal-quality gating and estimated rate only after sufficient repeatable cycles.
- Guided inhale/exhale/rest or humming sequences; four alternating nostril cues for Nadi Shodhana. No required retention. Natural Breath defaults to Live Mirror.
- Start, pause, resume, stop, duration completion, actual-data summaries, explicit save/discard consent, local session history, record details and deletion controls.
- Phase-responsive synthesis follows the ring through inhale, upper hold, exhale and lower hold. Persistent tones, harmonic space and filtered air provide non-verbal guidance, with four-second start/stop fades. Sound starts only after Start or an explicit enable gesture; there is no automatic playback on refresh.
- The sound label plays/pauses and its speaker icon mutes/unmutes. Settings includes master volume, ambient intensity and breath-responsive guidance. Custom rhythm supports both optional holds. See [AUDIO-REPORT.md](AUDIO-REPORT.md) for the shared-state design and 13 browser signal checks.
- Persistent mirror, landmarks, preview, tracking, sensitivity, reduced motion, glow, text size, contrast, sound-profile, volume, intensity and adaptive-guidance preferences.
- Camera/model error recovery, model-load timeout, stalled-tracking watchdog and guided practice without a camera.

## What the camera actually measures

**Posture:** MediaPipe estimates 33 landmarks. `services/posture.ts` checks normalized shoulder symmetry, nose position relative to shoulder centre, shoulder-to-hip centre-line, movement between frames and visible hip symmetry or knee spacing. A rolling median of visible shoulder width calibrates personal image scale; it does not declare the starting posture correct. Gentle/Normal/Strict change heuristic tolerances. A separate geometric classifier considers visible hip/knee/ankle relationships, requires a stable hypothesis for two seconds and returns unknown when ambiguous. There is no trained yoga classifier, invented confidence percentage, medical score, muscle-relaxation detector or reliable assessment of sagittal forward lean from a frontal view.

**Breathing movement:** `services/vision.worker.ts` downsamples frames to 192×144 grayscale. Twelve textured torso patches are matched between successive frames over a small horizontal/vertical search window. A parabolic refinement estimates subpixel vertical displacement. Median patch motion is corrected by estimated head translation; poor texture, large motion, occlusion or inconsistent matching reject the sample. `services/breath.ts` integrates valid displacement, removes slow drift, smooths the signal, tracks direction changes and rejects implausible cycle lengths. At least 20 seconds of valid samples and three consistent 3–20-second periods are required before showing BPM. Weak/lost tracking clears the rate and restarts calibration after a sustained interruption. Range normalization controls the live ring; the confidence indicator is an amplitude/regularity heuristic, not a validated statistical probability.

**Ring signals:** `components/BreathRing.tsx` renders a reusable CSS/SVG light object. Guided Coach consumes the phase engine's elapsed active session time and expands/contracts according to selected timings. Pausing freezes guided phase time. Live Mirror consumes the filtered movement amplitude and direction from the worker, without substituting guided timing. Reliable observed BPM and target cadence are displayed separately in guided mode. Expansion/contraction is not direct verification of inhale/exhale or nostril airflow.

## Experimental features and limits

The camera observes visible image movement, not airflow, lung volume or physiological state. Breathing estimation is experimental: clothing, lighting, camera distance, low frame rate, occluded hips, unrelated body motion and camera angle can prevent a usable signal. Allow more than 20 seconds; slow breathing can require 40–60 seconds to collect enough cycles. No rate is preferable to an unsupported number.

Seated pose classification is also experimental. Padmasana, Half Lotus and Sukhasana often cannot be distinguished from a frontal webcam. Manual selection stays authoritative; tentative identification is displayed separately. Full-body classifications were tested with synthetic landmark geometry, not validated against a labelled human dataset.

In-browser testing confirmed live upper-body landmarks and changing alignment feedback. The available close-up framing did not support a validated live breathing rate or a complete seated-pose evaluation. Multi-camera switching, physical permission denial, disabled/busy camera hardware, acoustic quality on different speakers and mobile-device camera inference remain unverified. Error-message branches are covered by automated tests. Final irreversible deletion was not executed against the user's saved history.

For wellness and education. Practice within a comfortable range and stop if uncomfortable. No medical accuracy or therapeutic outcomes are claimed.

## Privacy and assets

There is no analytics, recording, microphone acquisition, video upload or cloud history. Frames and landmarks remain transient worker/browser memory. Only explicitly saved summaries and preferences enter localStorage. The camera stops when explicitly disabled, a session ends, Practice is left, a track ends or the component unmounts. Audio contexts, workers and animation callbacks are disposed on teardown. Stored summaries are specific to the browser and origin.

The supplied dashboard images informed the visual design; they are not embedded as backgrounds or substituted for the webcam. Posture artwork is original SVG. MediaPipe Tasks Vision 0.10.35 and its matching WASM assets are bundled, with the official Google Pose Landmarker Lite model downloaded into `public/models`. Fonts are distributed locally through Fontsource. No runtime CDN is needed after installation.

Implementation consulted the [official MediaPipe Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) and [MediaPipe source](https://github.com/google-ai-edge/mediapipe). MediaPipe code is Apache-2.0; DM Sans and Manrope fonts use the SIL Open Font License. Package license files remain in their dependencies.

## Project files

All application files were created in this initially empty workspace:

```text
index.html
package.json / package-lock.json
tsconfig.json / vite.config.ts / .gitignore
README.md / TEST-REPORT.md / FILES.md
src/main.tsx
src/App.tsx
src/types.ts
src/data.ts
src/styles.css
src/useVision.ts
src/wasm.d.ts
src/components/BreathRing.tsx
src/components/PoseArt.tsx
src/services/audio.ts
src/services/audioGraph.ts
src/services/breathAudio.ts
src/services/breath.ts
src/services/camera.ts
src/services/guide.ts
src/services/posture.ts
src/services/vision.worker.ts
tests/engines.test.ts
tests/audio.test.ts
tests/adaptive-audio.test.ts
tests/audio-browser.html / tests/audio-browser.ts
public/models/pose_landmarker_lite.task
public/wasm/*
```

`dist/` is the generated production application. `node_modules/` is reinstallable with `npm ci`. See [TEST-REPORT.md](TEST-REPORT.md) for verification and [FILES.md](FILES.md) for the complete source/asset inventory.
