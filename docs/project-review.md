# Project review — 2026-11-05

Reviewed the EEG engine and numerical helpers, montage and scalp displays, worker
lifecycle, quiz and selected teaching material, language handling, keyboard and
error recovery, dependency security, build configuration, and CI. Existing signal
accuracy and interaction suites were retained and supplemented with regressions.

## Findings corrected

| Priority | Finding | Correction |
| --- | --- | --- |
| High | The dependency audit reported 12 advisories, including 8 high-severity entries. | Updated React Router to 7.18.5 and compatible dependency versions, including Vite 8.3.6 and Vitest 4.1.12. Raised the declared vulnerable direct dependency minimums. Final audit reports zero advisories. |
| High | Quiz explanations treated sharp appearance and awake delta as sufficient evidence of pathology; polyspikes incorrectly required three spikes. | Corrected definitions and contextual interpretation. Polyspikes require two or more spikes. Updated German and Arabic translations and replaced mismatched references with relevant linked sources. |
| High | Childhood absence activation and post-arrest prognosis were overstated. | Distinguished hyperventilation from photic activation and added confounder-aware, multimodal prognostication wording. Removed an unsupported fixed LPD seizure-risk percentage. |
| Medium | Phase reversal was repeatedly presented as an exact cortical-source locator. | Distinguished scalp-potential extrema from cortical generators in quiz, concepts, and propagation teaching. Aligned the propagation viewer, arrows, and legend with negative-up display of negative spikes. |
| Medium | The scalp map assigned bipolar channel RMS to its first electrode. | Restricted mapping to common-reference montages. Used filtered channel data, excluded missing electrodes from interpolation, and described the reference dependence. |
| Medium | Scalp heatmaps ignored device-pixel-ratio scaling and reused streaming buffers could retain old values. | Rendered the heatmap through a scaled offscreen canvas and passed sample revisions into RMS calculations. |
| Medium | Delayed spectrogram responses could restore an old channel after clearing or switching input; worker failures left the view empty. | Invalidated obsolete requests, handled worker failures, provided an inline calculation fallback, and cleared stale canvas pixels. |
| Medium | Invalid FFT sizes produced invalid results, and a zero STFT hop could cause an unbounded loop. | Added size/rate/hop validation and defined empty and single-sample behavior. |
| Medium | Sandbox shortcuts intercepted browser shortcuts and editable or focused controls. | Preserved Ctrl/Meta/Alt combinations, composition, handled events, and native interactive controls. |
| Medium | “Go Home” in the error boundary escaped deployments hosted under a subdirectory. | Based recovery on Vite's deployment base and the application's hash routing. |
| Low | Language selection did not close on Escape or restore keyboard focus. | Added Escape dismissal and trigger focus restoration after selection. |
| Low | The legacy engine-test command, implicit parser dependencies, and configuration/CI assumptions were fragile. | Fixed the test command, declared parser dependencies, added translation checks to CI, switched CI to Node 22, and removed `__dirname` assumptions from ESM configs. |

The ocular-artifact explanation also contained an unsupported approximately
100 mV assertion and an oversimplified eyelid mechanism. It now describes the
standing ocular potential without that numeric claim.

## Clinical sources consulted

- [IFCN EEG glossary, 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/):
  waveform terminology, polyspikes, normal variants, and phase reversal.
- [ACNS critical-care EEG terminology, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/):
  suppression, seizure wording, and voltage categories, including the 20 µV boundary.
- [ILAE childhood absence EEG guidance](https://www.epilepsydiagnosis.org/syndrome/cae-eeg.html):
  activation procedures and their different yields.
- [ERC–ESICM post-resuscitation care, 2025](https://www.erc.edu/media/atqopqm4/gl2025-07-post-resus-e.pdf):
  multimodal prognosis, timing, and confounders.
- [American Epilepsy Society EEG atlas](https://www.ncbi.nlm.nih.gov/books/NBK390357/):
  focal slowing and contextual interpretation.
- [ISCEV electro-oculography standard](https://pmc.ncbi.nlm.nih.gov/articles/PMC5309273/):
  the ocular standing potential.

## Validation

- Full suite: **349 tests passed across 21 files**.
- Production build: passed. The main chunk remains approximately 896 kB
  minified / 305 kB gzip and triggers the existing chunk-size warning.
- Translation coverage: 3,024 scanned source strings covered in German and Arabic;
  placeholder checks passed. This measures coverage rather than medical accuracy.
- Dependency audit: **zero advisories** across all reported severity levels.
- Lint: zero errors; 22 existing warnings remain.
- Source whitespace check: passed, excluding generated dependency/build files.
- Restored development server: HTTP 200 at the original local address.

Regression coverage includes invalid spectral inputs, obsolete and failed worker
requests, worker-free operation, reference-aware scalp amplitudes, high-DPI canvas
coordinates, mutable sample revisions, keyboard behavior, subpath recovery, and
the corrected teaching points. Existing engine, worker, routing, reporting,
translation, timing, and signal-quality tests remain part of the full suite.

The development server was restored after dependency installation. Dependency
installation required a temporary npm 11 CLI because the host's npm 10 encountered
a dependency-graph error; normal project commands continue to use npm.

## Remaining improvements and limits

- **Repository hygiene:** Git currently tracks 10,874 files under `node_modules`
  despite the ignore rule. Dependency updates therefore produce generated-file
  diffs, including vendor whitespace changes. A separate index cleanup should
  retain `package-lock.json` and account for the repository's deployment workflow.
- **Clinical validation:** this pass checked specific high-impact teaching claims;
  the full reference catalog and simulator require specialist clinical review
  before being treated as a validated educational product. The Gaussian scalp
  field and synthesized patterns remain illustrative models.
- **Translation review:** substantial German and Arabic prose still originates
  from machine translation. Critical corrections were translated in this pass,
  but a complete native-language medical proofread remains outstanding.
- **Loading performance:** both translated content catalogs load eagerly. Loading
  them by selected language and reducing duplicate editorial text would improve
  startup size, especially on slower connections.
- **Maintainability:** unused legacy placement helpers and existing lint warnings
  remain. Their removal should follow a focused UI regression pass.
- **Verification scope:** automated component/canvas tests were used; a complete
  real-browser, mobile, screen-reader, and clinical waveform validation was not
  performed in this review.
