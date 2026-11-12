# NeuroLearn EEG Platform

An interactive multilingual EEG education platform built with React + Vite.

See the [project review](docs/project-review.md) for corrected security, numerical,
UI, and clinical-teaching findings and the remaining validation work.

## Tech Stack

| Layer | Tool |
|---|---|
| UI framework | React 18 + React Router 7 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 3 |
| i18n | i18next + react-i18next |
| State | Zustand |
| EEG rendering | Custom Canvas API |
| Signal generation | Custom JS engine (no external deps) |
| Deployment | Static (GitHub Pages / Netlify / Vercel) |

## Project Structure

```
src/
├── engine/
│   ├── signalGenerator.js   # Core EEG signal synthesis (sine, noise, transients)
│   ├── montages.js          # Montage definitions + transform engine
│   ├── waveforms.js         # Waveform pattern catalogue + demo generators
│   ├── artifacts.js         # Artifact synthesis (EMG, blink, ECG, electrode pop, etc.)
│   ├── propagation.js       # Source dipole + scalp field propagation
│   ├── filters.js           # Butterworth IIR (highpass / lowpass / notch) via biquad SOS
│   ├── fft.js               # Cooley–Tukey radix-2 FFT + power spectral density
│   └── quiz.js              # Quiz question bank + scoring engine
│
├── hooks/
│   ├── useEEGSignal.js          # Real-time streaming signal hook (ring buffer + rAF)
│   ├── useI18n.js               # RTL/LTR direction helper
│   └── useKeyboardShortcuts.js  # Global keyboard shortcut bindings
│
├── store/
│   ├── eegStore.js          # Zustand global state (montage, pattern, controls)
│   └── annotationStore.js   # User annotations on the live trace
│
├── i18n/
│   ├── i18n.js              # i18next configuration
│   └── locales/             # English, German and Arabic catalogs
│
├── components/
│   ├── layout/Layout.jsx    # App shell + sidebar navigation
│   ├── eeg/
│   │   ├── EEGViewer.jsx           # Canvas-based multi-channel EEG renderer
│   │   ├── SandboxControls.jsx     # Sandbox playback / pattern / seizure controls
│   │   ├── FilterControls.jsx      # Highpass / lowpass / notch UI
│   │   ├── PropagationSection.jsx  # Interactive scalp field propagation demo
│   │   ├── ScalpElectrodeMap.jsx   # 10-20 electrode SVG map
│   │   ├── ScalpTopoMap.jsx        # Topographic interpolation overlay
│   │   ├── SpectrumViewer.jsx      # Per-channel PSD chart
│   │   └── SpectrogramViewer.jsx   # Time-frequency spectrogram
│   └── ui/
│       ├── LanguageSwitcher.jsx
│       ├── LoadingScreen.jsx
│       └── KeyboardHelpOverlay.jsx
│
└── pages/
    ├── HomePage.jsx         # Landing + module cards
    ├── ConceptsPage.jsx     # EEG basics + 10-20 system map
    ├── MontagesPage.jsx     # Interactive montage switcher
    ├── AtlasPage.jsx        # Combined waveform and clinical reference
    ├── WaveformsPage.jsx    # Redirects legacy waveform links into the atlas
    ├── FindingsPage.jsx     # Redirects legacy clinical-finding links into the atlas
    ├── ArtifactsPage.jsx    # Artifact catalogue + identification guide
    ├── QuizPage.jsx         # Self-assessment module
    └── SandboxPage.jsx      # Full real-time EEG sandbox
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

## Static Deployment

The application uses hash-based client routing, so nested screens continue to
work when a static host does not provide SPA rewrite rules. Set
`VITE_BASE_URL` to the public asset path used by the host:

```bash
# Root domain (default)
VITE_BASE_URL=/ npm run build

# Repository subpath, for example GitHub Pages
VITE_BASE_URL=/eeg-platform/ npm run build
```

The base URL must begin and end with `/`.

## Supported Languages

| Code | Language | Direction |
|------|----------|-----------|
| en   | English (default) | LTR |
| de   | Deutsch  | LTR |
| ar   | العربية  | RTL |

## Updating Translations

Navigation keys live in `src/i18n/locales/en.json`, `de.json`, and `ar.json`. English
uses the editorial source text for lessons and controls. Translated lessons,
controls, quiz explanations, and report templates live in the corresponding
`*.content.json` catalogs, keyed by normalized editorial source text.
Localize displayed text with `translateDisplay`; keep IDs and option values
unchanged. Use `formatText` for templates and `literalText` for user-entered text.
Run `npm run check:translations` to detect missing strings or damaged placeholders.
The Arabic terminology, quiz explanations, reading guide, figure captions, and
selected reporting guidance have been revised against the English source. Other
long-form passages retain machine translations and require specialist review.
See [the Arabic translation review](docs/arabic-translation-review.md) for scope.

## EEG Engine Overview

### Signal Generation (`signalGenerator.js`)
- `generateBackground()` — additive sine synthesis per frequency band
- `injectSpike()` / `injectSharpWave()` / `injectPolyspike()` — transient injection
- `injectSpikeAndWave()` — 3 Hz spike-wave complex
- `injectMuscleArtifact()` / `injectEyeBlink()` — artefact simulation
- `generateMultiChannelEEG()` — full 19-channel dataset with pattern presets

### Montage Engine (`montages.js`)
- `MONTAGES` — all standard montage definitions (longitudinal bipolar, transverse, referential, average reference)
- `applyMontage()` — applies channel derivation transform to raw electrode data
- Supports average reference, linked-ears reference, and named electrode references

### Streaming (`useEEGSignal.js`)
- 60-second ring buffer with `requestAnimationFrame` loop
- Configurable sweep speed and gain
- One-shot focal/generalized seizure examples with a shared 10?120 second duration slider (default 30 seconds), with clear three-stage evolution, automatic playback, and a stop control
- Continuous focal/generalized electrographic status examples in the Atlas and Sandbox
- Run seizure examples: F for focal, G for generalized
- Choose focal onset, spread route, and spread timing; settings are collapsed by default and apply to both visible buttons and keyboard shortcuts

## EEG Atlas

The atlas replaces the separate Waveforms and Clinical Findings navigation
entries. It retains the original two-pane layout: a searchable, grouped topic
list on the left and the selected entry on the right. Groups include Waveforms,
Normal awake EEG, Normal sleep, Normal variants, Slowing, Epileptiform patterns,
Rhythmic/periodic patterns, Abnormal backgrounds, Activation, and Artifacts.

Each topic has a canonical URL, `/atlas/:entryId`. Existing
`/waveforms?id=...` and `/findings?id=...` bookmarks redirect to the appropriate
entry. Search and subject/type filters stay in the URL and survive navigation.

`src/content/atlas.js` defines the canonical topics and their relationships:

- Eighteen duplicate pairs, including mu and burst suppression, share one entry.
- Alpha/normal awake EEG, spindle/N2 sleep, and sharp-wave/temporal-discharge
  entries remain distinct and link in both directions.
- Waveform measurements come from `src/engine/waveforms.js`. Clinical context,
  comparisons, and pitfalls come from `src/content/clinicalFindings.js`.
- `MERGED_TOPICS` explicitly selects additional clinical features that are not
  already covered by waveform metadata. Its feature indices refer to the clinical
  catalogue, so update these selections when editing or reordering that catalogue.
- Available simulator patterns have a multichannel preview and a shared starting
  configuration for the sandbox. Generic theta or beta examples are not presented
  as complete REM or electrocerebral-inactivity recordings.

The clinical reference material has been reorganised, not independently medically
reviewed. English, German, and Arabic cover navigation, lessons, atlas entries,
quiz content, controls, and report drafts. Technical identifiers remain stable.
English is the default on first visit and the fallback for unsupported saved
languages. An explicitly selected German or Arabic language is remembered;
browser language alone does not override the English default.
Translations are bundled locally; the application does not call a translation service.

## Roadmap

- [x] Quiz / self-assessment module
- [x] Frequency spectrum visualiser (FFT power spectral density)
- [x] Spectrogram (time–frequency view)
- [x] Artifact catalogue + identification guide
- [x] Source propagation / scalp field demo
- [x] Configurable bandpass + notch filters
- [~] EEG case library — annotation store implemented; upload + persistence UI pending
- [~] Sleep staging — sleep waveforms generated; dedicated staging UI pending
- [ ] Electrode impedance map
- [ ] PDF certificate generation
- [ ] More languages (Portuguese, Chinese, Japanese)


## EEG performance checks

Run `node scripts/benchmark-eeg.mjs` to measure seeded 70-second streaming
prefills and the trace-sampling CPU path for 10/30/60-second windows. Measurements
are local Node CPU timings, not browser frame rates; the sampler comparison
excludes geometry setup, which the viewer shares across channels and frames.

The live engine resolves channel settings once per sample block and evaluates
shared rhythm carriers once per timestep. The viewer caches sampling weights
without caching signal values. Published signal frames own their sample arrays,
so asynchronous redraws cannot pair newer curves with older grid timestamps. Its
resize observer stays attached during playback, redundant hover redraws are
cancelled when a newer signal frame arrives, and paused signals schedule no
animation callbacks. Sample rate, waveform formulas, filter behavior, trace timing,
and playback refresh limits are unchanged.

`tests/performanceQuality.test.jsx` checks all 43 patterns against seeded
pre-optimization sample hashes in `tests/fixtures/streaming-waveform-hashes.json`,
compares cached trace sampling with the original integration (including narrow
transients), and checks viewer scheduling and pause/resume behavior.


### Worker processing and browser profiling

Live recordings use a dedicated module worker for signal synthesis, ring-buffer
montage conversion, and display filtering. Raw samples remain available for
analysis. Frame buffers are transferred to the UI along with their timestamp and
fractional offset; private engine and filter scratch buffers stay in the worker.
The viewer draws the processed frame without running the filter a second time.

Only one processing request is in flight per recording. Delayed ticks accumulate
elapsed simulation time rather than queuing full-window jobs, control changes
coalesce, and responses from superseded configurations are discarded. Pausing
flushes elapsed samples and stops the playback clock. Changing pattern or leaving
the page cancels the old recording and retains one idle module worker for reuse,
expiring after 60 seconds. Worker startup failure uses the same seeded processor synchronously;
a runtime failure after playback begins uses the existing page error boundary
rather than silently rewinding the recording.

For browser measurements, open `/?profileEEG=1&eegSeed=42#/sandbox` (prepend the
hosting base path if applicable). With the browser console:

```js
window.eegProfile.reset()
// Play for 30 seconds, then inspect or save this report:
window.eegProfile.report()
```

The report includes canvas paint time, request latency, processing time, and
animation-frame intervals, with median/p95/max and counts. Long-task data and heap
size are included where supported by the browser; absence of support is reported.
Recent percentile history is capped at 2048 samples per metric. Normal use does
not enable the profiler or store measurements.

For an A/B comparison, use
`/?profileEEG=1&eegSeed=42&eegWorker=0#/sandbox` for synchronous processing. Keep the
same pattern, montage, filters, sweep duration, zoom, and window size. Check both
10-second and 60-second sweeps and repeat pause/resume and montage/filter changes.
These browser measurements are distinct from `node scripts/benchmark-eeg-worker.mjs`,
which checks raw/filtered sample parity and Node main-thread timer delay during a
70-second prefill. Node timings do not establish browser FPS improvements.

`tests/eegWorker.test.jsx` runs the actual worker entry point in a Node worker and
checks filter/montage parity, transfers, coalescing, stale replies, seizure
controls, cleanup, and startup fallback. The synchronization regressions in
`tests/viewerTiming.test.jsx` remain applicable to the shared inline processor.


### Canvas anti-aliasing

The EEG viewer renders thin vector curves into a supersampled backing bitmap:
2x on standard-density displays and up to 3x on higher-density displays, bounded
by a 16-million-pixel budget. CSS size, sensitivity, waveform values, and time
coordinates are preserved. This smooths raster edges without adding a blur or
low-pass filter to the signal.

Trace sampling density follows backing resolution while retaining at least two
points per CSS pixel. Higher-density screens therefore retain more visible
narrow-transient detail. The existing weighted integration and quadratic curve
construction remain in place. Fractional CSS widths use exact backing transforms,
and annotation clicks use the same plot width as painting. Resolution-change and
viewport listeners also refresh paused canvases after monitor or zoom changes.

`tests/antiAliasing.test.jsx` covers backing resolution and memory bounds,
unchanged curve coordinates, constant signals, transient detail, density-change
cleanup, and annotation alignment at fractional widths.


### Recording and section transitions

Pattern changes retain the current frame with an updating status instead of
unmounting the viewer. Input for annotations and seizure playback waits for the
new recording to finish initialization. A valid visible-window preview is sent
before full retained history is ready; filter-enabled previews include the same
10-second filter pre-roll. Initialization yields in bounded slices so rapid new
selections can cancel obsolete work. Final seeded samples remain byte-identical
to a full synchronous prefill.

A single prewarmed/idle worker is reused across sections. Request client IDs
prevent messages from a previous owner from being accepted after reuse. A bounded
six-frame LRU cache restores recent section/recording views immediately. The
Sandbox trace canvas stays mounted across its tabs and does no drawing while
hidden. Navigation preloads page modules on hover/focus and uses a React
transition to retain the current section while a lazy page module loads.

Regression coverage includes `tests/sandboxTransitions.test.jsx`,
`tests/navigationTransitions.test.jsx`, and the progressive initialization,
cancellation, worker reuse, and cached-frame cases in `tests/eegWorker.test.jsx`.
The worker benchmark also reports first-preview latency separately from full
prefill latency; those are Node measurements rather than browser paint times.
