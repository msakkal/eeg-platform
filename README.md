# NeuroLearn EEG Platform

An interactive multilingual EEG education platform built with React + Vite.

## Tech Stack

| Layer | Tool |
|---|---|
| UI framework | React 18 + React Router 6 |
| Build tool | Vite 5 |
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
│   └── locales/             # en, fr, de, es, ar JSON files
│
├── components/
│   ├── layout/Layout.jsx    # App shell + sidebar navigation
│   ├── eeg/
│   │   ├── EEGViewer.jsx           # Canvas-based multi-channel EEG renderer
│   │   ├── SandboxControls.jsx     # Sandbox playback / pattern / artifact controls
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
    ├── WaveformsPage.jsx    # Waveform catalogue with demo traces
    ├── FindingsPage.jsx     # Normal vs pathological findings
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

## Supported Languages

| Code | Language | Direction |
|------|----------|-----------|
| en   | English  | LTR |
| fr   | Français | LTR |
| de   | Deutsch  | LTR |
| es   | Español  | LTR |
| ar   | العربية  | RTL |

## Adding a New Language

1. Add a JSON file to `src/i18n/locales/<code>.json`
2. Import and register it in `src/i18n/i18n.js`
3. Add metadata to the `SUPPORTED_LANGUAGES` array in `i18n.js`

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
- Live spike/artifact injection via pending event flags

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
