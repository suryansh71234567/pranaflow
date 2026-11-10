# Adaptive breathing sound system

## What changed

The previous graph produced a continuous environment because it never received the breathing ring's phase, expansion or progress. Its oscillators and modulation evolved independently, and the only phase-related call was an optional chime. This was an integration/design limitation, not an audio-file or asset-path failure.

The new graph is a non-verbal breathing companion. It consumes the same `guideAt()` result, ring scale, live movement estimate and session state as the animation. No separate audio breathing timer runs. A session pause freezes the guidance; turning sound off fades and suspends its persistent context.

| Phase | Audible behavior |
| --- | --- |
| Inhale | The guidance root rises from about 220 to 330 Hz; harmonics brighten, air opens and the stereo image widens. |
| Exhale | The same movement reverses: pitch descends, brightness and intensity soften, and the image settles inward. |
| Hold after inhale | A stable upper tonal atmosphere, reduced motion and a sustained harmonic layer. |
| Hold after exhale | A stable lower root, darker filtering and a more minimal atmosphere; the sound remains present. |
| Session pause | Guidance settles at the ring's frozen expansion without inventing another cycle. |
| Missing/weak live signal | Only the quiet foundation remains; there is no timer-generated substitute for detected movement. |

## Four persistent layers

1. **Foundation:** a quiet warm drone and harmonic support. Its tiny, slow drift is not a breathing pulse.
2. **Guidance:** a rising/falling harmonic root, with pitch, filtering and gain derived directly from the ring's expansion and phase.
3. **Harmonic space:** sine partials spread gently across stereo as the ring opens. The main guide stays audible on mono speakers. Headphones are optional.
4. **Organic air:** continuously filtered stereo noise, shaped by the current breath phase and the separate ambient-intensity control.

There are no voices, ticks, metronome beats, melodies, notification cues or per-phase oscillator restarts. This revision removes phase chimes. No neurological entrainment or medical effects are claimed. The stereo harmonic image is an aesthetic effect, not a treatment.

The noise source is a 29-second stochastic buffer processed by continuously running filters; it has no melodic loop or hard track restart. Tonal sources are persistent. Stillness/Warmth/Space change the color smoothly while preserving the guide's harmonic anchor and phase.

## Synchronization and continuity

`src/services/breathAudio.ts` maps shared application state to a typed frame and timbre targets. `src/services/audioGraph.ts` smoothly automates existing nodes. `src/services/audio.ts` owns transport, gesture-time initialization, mute, volume, suspension, recovery and cleanup.

Guided mode uses `guide.phase`, `guide.progress`, `guide.remaining` and the exact normalized scale sent to the ring. Live mode uses the same observed expansion as the ring, gated by valid movement quality; it never forces a speed when sensing is unavailable. Inhale/exhale labels in this audio mapping describe rising/falling estimated movement, not measured airflow.

The existing app publishes session progress at 100 ms intervals. Audio interpolation uses the ring's 180 ms transform duration. This is shared-state synchronization, not a claim of sample-accurate audio/video hardware synchronization.

An offline full-cycle test exposed transient spikes when repeatedly replacing in-flight `cancelAndHoldAtTime()` ramps. The final implementation explicitly anchors the current parameter value before scheduling the replacement linear ramp. The repeated-update render then passed without those spikes. This also avoids dependence on a [non-Baseline automation API](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelAndHoldAtTime).

Master start/stop fades are four seconds. A sound pause suspends after the fade and resumes the same sources. Mute and zero volume silence every layer. The graph has protective filtering/compression, one master path and no ScriptProcessor, per-frame noise generation or additional animation loop.

## Existing interface integration

- The existing sound label plays/pauses; its speaker icon mutes/unmutes.
- Settings retains master volume and sound profile controls.
- One matching Settings row adds **Ambient sound intensity**, independently balancing the background under the primary guide.
- The former phase-chime row is now **Breath-responsive sound**, enabled by default.
- Custom timing adds an optional **Hold after inhale**. The existing rest field serves as **Hold after exhale**. A custom 4/4/4/4 configuration gives a box-style sequence. Holds default to zero and remain optional.
- Equal Breathing, Longer Exhalation, Nadi Shodhana, Bhramari, Natural Breath and Custom all use the shared adapter. Longer Exhalation can be configured for an unhurried relaxation sequence; no extra preset cards were added.
- Begin Practice starts sound from that explicit gesture when sound has not been disabled. Explicit Sound OFF is respected on subsequent starts. After refresh, playback waits for Start or an explicit sound-enable gesture.
- Navigation does not recreate the audio graph. Volume, mute, profile, intensity and guidance preferences persist locally.

The stylesheet, typography, colors and visual animations were not redesigned. The CSS asset is still `index-dB8e-XS2.css`; the source stylesheet SHA-256 is `680A1AB60DE136A6B178A1C4993602D356DC2F9594EB610B04DF1208E8F985B0`. Only required controls were added within the existing styling and configuration dialog.

## Verification

`npm run build` passes TypeScript and production bundling. `npm test`: **24 passed, 0 failed**, covering all original engines plus phase mapping, all six practice configurations, optional holds, ring/audio timing, invalid live signals, source reuse, mute routing, four-second fades, gesture-time startup, rapid transport changes and browser interruption recovery.

The development-only browser harness renders the actual graph with Chromium OfflineAudioContext. **13 of 13 signal checks passed**, including:

- All three profiles produce nonzero, unclipped guidance with a soft onset.
- Inhale's dominant root rises from approximately **231 to 318 Hz**; exhale reverses that movement. Spectral brightness and level change in the intended directions.
- The upper hold sustains approximately **328 Hz**; the darker lower hold approximately **221 Hz**, with nonzero output.
- Mute and zero volume produce exact digital silence. Four-second pause fades end in silence.
- Maximum tested volume remains below full scale.
- Ambient intensity can be zero while the primary guide remains audible.
- The full custom cycle is rendered from the actual `sequence()`/`guideAt()` output, including repeated phase transitions.
- A **90-second adaptive run** crossed multiple texture-buffer boundaries without clipping; measured peak was approximately **0.181** at 20% master volume.

Interactive checks in the built app confirmed:

| Ring heading | Engine phase | AudioContext |
| --- | --- | --- |
| Inhale | inhale | running |
| Hold | hold-in | running |
| Exhale | exhale | running |
| Rest | hold-out | running |

The custom 2/2/2/2 test used the actual Start button. Session pause/resume, navigation, guidance toggle, intensity slider, mobile-width controls and refresh persistence were exercised. Natural Breath without a valid signal reported `unavailable` with no invented cadence. Test playback was muted to avoid overlapping an older open tab's sound. No console errors were observed in the final updated app.

## Artifacts and repeatable checks

- `artifacts/adaptive-audio-signals.json`: final rendered measurements.
- `artifacts/adaptive-phase-checks.json`: the live ring/engine phase checks.
- `artifacts/adaptive-breathing-sample.wav`: a 32-second rendered example of the actual graph, using 4 s inhale / 2 s upper hold / 6 s exhale / 2 s lower hold. It includes the four-second fade and repeated cycles. This is a verification artifact; the website generates live sound rather than playing this file.
- `tests/audio-browser.html` and `tests/audio-browser.ts`: the offline rendering harness.

```powershell
cd 'C:\Saksham Website'
npm test
npm run build
npm run preview
# http://127.0.0.1:5173/
```

To rerun browser measurements separately:

```powershell
npx vite --host 127.0.0.1 --port 5174 --strictPort
# Open http://127.0.0.1:5174/tests/audio-browser.html and run the signal checks.
```

## Limits and retained state

Physical Safari/iPhone/Android testing and an acoustic listening panel were not available. Mobile testing used a 390×844 Chromium viewport. Gesture-time resume, optional stereo fallback and interruption recovery are implemented, but physical WebKit compatibility is not claimed as verified. Hardware output selection, silent switches and system volume remain under the user's control.

Live breathing movement remains experimental, as before. Adapter tests cover valid synthetic movement and real UI signal-loss behavior; they do not validate respiratory accuracy.

The older open tab's unsaved five-minute session summary was left untouched. Save or dismiss that summary before refreshing the older tab to load the new sound system. Verification ran in a separate tab and discarded only its own test summaries.
