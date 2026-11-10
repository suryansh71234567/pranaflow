# PRANA-FLOW verification — 10 November 2026

The audio system has since been replaced by phase-responsive synthesis. See [AUDIO-REPORT.md](AUDIO-REPORT.md) for the current 24-test suite, 13 rendered signal checks, four-phase UI synchronization and retained validation limits. The original checks below document the initial application baseline.

## Automated checks

`npm run build` completes TypeScript checking and produces the Vite production application. The final build uses local model/runtime/fonts, with no unresolved imports or build warnings.

`npm test`: **10 passed, 0 failed**.

1. Camera permission-denied, absent, busy and unavailable-device error messages.
2. Personal image-scale baseline waits for visible samples and resets.
3. Guided phase boundaries, wraparound, contraction and alternate-nostril cues.
4. Occluded landmarks produce unknown checks and no pose hypothesis.
5. Visible shoulder asymmetry produces correction; invisible knees remain unknown.
6. All four geometric posture hypotheses with synthetic landmark configurations.
7. Flat/no-signal input does not invent a respiratory rate.
8. Long gaps invalidate a previously usable estimate.
9. A synthetic 10-second movement cycle yields approximately 6 BPM only after sufficient cycles; tracking loss clears it.
10. Image matching recovers known pixel displacement and rejects textureless images.

These tests verify engine behavior, not physiological or clinical accuracy.

## Browser verification

Tested interactively in the desktop in-app Chromium browser, including the built application served by Vite Preview.

| Area | Observed result |
|---|---|
| Navigation | Practice, Yoga & Breath, Progress and Settings load; direct route refresh works. |
| Desktop/tablet | Two-column desktop and stacked narrower layout inspected. |
| Mobile | 390 px viewport inspected; decorative-wave overflow fixed; document width equals scroll width. |
| Camera | Actual laptop camera preview observed. Camera status transitions to active, and model loads locally. |
| Pose | Actual landmarks detected; visible alignment checks change with movement. Low visibility remains unknown. |
| Calibration | Real frame processing reaches natural-breath calibration; insufficient/weak signals do not display a fabricated BPM. |
| Preview privacy | Hide Preview covers the video while sensing continues; Show Preview is available. |
| Camera shutdown | Camera-off and session stop return status to Standby; stream tracks are stopped by the implementation. |
| Guided session | Start, live phase countdown, pause, frozen timer and resume verified. Bhramari loads humming-exhale/rest phases. |
| Custom timing | 3-second inhale / 5-second exhale changes the rhythm control. |
| Library | Four pose cards and six practice definitions render; Vajrasana card loads its posture, illustration and checklist. |
| Summary | End/stop generates duration and available-data summary. Missing BPM stays a dash. |
| History | A real 25-second QA practice was saved; its record survives refresh and opens in a details dialog. No history is seeded. |
| Deletion | Confirmation dialog opens; cancellation preserves history. Final irreversible deletion was not executed. |
| Preferences | Preview preference and Reduced Motion persistence verified through refresh. |
| Audio | User-triggered ambient start, profile change and stop toggle successfully without browser errors. Speaker/acoustic quality was not independently measured. |
| Assets | Original SVG illustrations and locally bundled model, runtime and fonts load without broken images. |

## Known validation limits

- No ground-truth respiratory instrument was available. Live BPM accuracy and camera-derived phase labels remain experimental.
- Live full-body performance for all four seated poses was not validated. Synthetic geometry checks are not a substitute for a labelled test set.
- Only one physical camera was available, so cross-device switching was not exercised.
- Physical permission denial, hardware-busy failures and camera disconnection were not deliberately induced; failure mapping is covered by tests.
- Actual mobile-device inference, Safari and Firefox have not been verified. Use a current Chromium browser.
- Browser storage failure and full-storage conditions were handled in code but not forced interactively.
- No camera frames were saved as QA artifacts. Preview screenshots show only the camera-off interface.

The shipped experience is functional; image-based breathing estimation and tentative pose classification require further real-world validation before being treated as reliable measurement tools.
