# NeuroLearn EEG

An interactive EEG education platform in **English, German, and Arabic**, built
with React, Vite, and Tailwind CSS. Arabic includes right-to-left layout support.

Explore EEG concepts, electrode placement, montages, a searchable waveform and
clinical atlas, artifacts, quizzes, a reading algorithm, report drafts, and a
real-time signal sandbox with filters, spectral analysis, and seizure examples.

## Features

| Module | What you can explore |
| --- | --- |
| EEG concepts | Frequency bands, signal fundamentals, and the 10-20 electrode system |
| Montages | Bipolar and referential derivations with interactive examples |
| EEG atlas | Searchable waveforms, clinical findings, normal variants, and artifacts |
| Sandbox | Simulated multichannel recordings, filters, scalp maps, spectra, and spectrograms |
| Quiz | Knowledge checks and electrode-placement exercises |
| Reading algorithm | A structured approach to reviewing an EEG |
| Report builder | Editable report drafts for learning and review |

All EEG recordings are simulated. This is an educational resource. Clinical
content, translations, and generated report drafts require professional review
before clinical use. See the [project review](docs/project-review.md),
[signal accuracy audit](docs/signal-accuracy-audit.md), and
[Arabic translation review](docs/arabic-translation-review.md) for validation scope
and remaining limitations.

The live 3 Hz absence example repeats six-second spike-and-wave runs separated
by six seconds of background, so discharges remain available after the viewer
fills its recording history. This repetition is a teaching schedule, not a model
of an individual patient's seizure frequency.

## Local development

Use Node.js 22 and npm, matching the CI environment.

```sh
npm ci
npm run dev
```

Vite prints the local development URL. No backend, API keys, or environment file
are required. Optional configuration is documented in [.env.example](.env.example).
On Windows, use `npm.cmd` in place of `npm` if PowerShell blocks `npm.ps1`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Check source and tests with ESLint |
| `npm run check:translations` | Check German and Arabic text coverage and template parameters |
| `npm test` | Run the full regression suite |
| `npm run test:watch` | Rerun tests while developing |
| `npm run build` | Create the production site in `dist/` |
| `npm run preview` | Serve the production build locally |

The production site is generated in `dist/`. Dependencies, build output, local
environment files, editor settings, and development logs are excluded from Git.
Only the contents of `dist/` are uploaded for hosting.

## Publish on GitHub Pages

1. Push this project to your GitHub repository's `main` or `master` default branch.
2. In **Settings > Pages > Build and deployment**, select **GitHub Actions** as
   the source.
3. Run the **CI** workflow from the **Actions** tab, or push another commit.
4. Open the site URL shown by the `github-pages` deployment. For the current
   repository, the expected URL is <https://msakkal.github.io/eeg-platform/>.

The URL becomes available after the first successful deployment. Local builds
and repository cleanup do not publish the site by themselves.

The [workflow](.github/workflows/ci.yml) checks lint, translations, and tests
before building and deploying. Pull requests run checks and a build without
publishing. Deployment runs only from the default branch. The workflow obtains
the asset base path from GitHub Pages, supporting repository paths and custom
domains without hardcoding a repository name.

Routes use URL hashes, such as `/#/atlas` or `/eeg-platform/#/sandbox`, so refreshing
a lesson does not need server-side rewrite rules. Worker and lazy-loaded assets
are emitted by Vite under the configured base path.

For a local preview of a repository-path deployment in PowerShell:

```powershell
$env:VITE_BASE_URL = '/eeg-platform/'
npm run build
npm run preview
```

Open the preview URL with `/eeg-platform/` appended. Stop the preview with
**Ctrl+C**, then run `Remove-Item Env:VITE_BASE_URL` to restore the default base
path for subsequent commands. For other static hosts, set
`VITE_BASE_URL` to `/` or the site's subdirectory, beginning and ending with `/`.
See [Vite's deployment guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Languages and translations

| Code | Language | Direction |
| --- | --- | --- |
| `en` | English (default and fallback) | LTR |
| `de` | Deutsch | LTR |
| `ar` | العربية (Arabic) | RTL |

English is used on first visit. Explicit language selections are remembered
locally; unsupported saved languages fall back to English. Translations are
bundled with the app and do not call a translation service.

Navigation catalogs are in `src/i18n/locales/{en,de,ar}.json`. German and Arabic
lesson text, controls, quiz explanations, and report templates are in
`de.content.json` and `ar.content.json`, keyed by English source text. Use
`translateDisplay` for displayed content, `formatText` for templates, and
`literalText` for user-entered text; preserve identifiers and option values.
Run `npm run check:translations` after changing displayed text.

## Deployment troubleshooting

- **No deployment starts:** enable GitHub Actions as the Pages source, confirm
  the workflow file is on the default branch, and run **CI** from the Actions tab.
- **A workflow fails:** inspect the failed lint, translation, test, build, or
  deploy job in Actions. Deployment waits for successful validation and build.
- **Assets return 404:** check that the build base matches the hosting path.
  The Pages workflow supplies this automatically; local subdirectory builds
  require `VITE_BASE_URL`.
- **A lesson URL returns 404:** use the hash route, such as
  `/eeg-platform/#/atlas`, rather than `/eeg-platform/atlas`.

## Source layout

| Directory | Contents |
| --- | --- |
| `src/components/` | App layout, EEG canvases, controls, and shared UI |
| `src/content/` | Atlas and clinical teaching material |
| `src/engine/` | Signal synthesis, montages, filters, FFT, quiz, and reports |
| `src/hooks/`, `src/store/` | Streaming, localization, and application state |
| `src/i18n/` | English, German, and Arabic localization |
| `src/pages/` | Learning modules and sandbox |
| `src/workers/` | Signal-processing and spectrogram workers |
| `tests/` | Numerical, localization, worker, and UI regressions |
| `scripts/` | Translation checks, signal diagnostics, and performance tools |
| `docs/` | Technical and translation review records |

Legacy waveform and findings bookmarks redirect to their canonical atlas entries.
Keep these redirect pages when updating routes.

## Performance diagnostics

Run `node scripts/benchmark-eeg.mjs` or
`node scripts/benchmark-eeg-worker.mjs` for seeded CPU and worker measurements.
These are Node timings, not browser frame rates.

For browser profiling, open `?profileEEG=1&eegSeed=42#/sandbox` under the hosting
base path. In the browser console, use `window.eegProfile.reset()` and
`window.eegProfile.report()`. Add `&eegWorker=0` before the hash for a synchronous
comparison, keeping signal, montage, filters, and viewport settings the same.
Normal use does not enable profiling.
