# Signal generator accuracy audit

Reviewed 2026-11-03. Scope: the live streaming engine, buffered multichannel
generator, and single-channel teaching demos. This is a numerical and morphology
audit of synthetic teaching signals, not validation against a patient dataset.

## Corrections

| Finding | Correction | Verification |
| --- | --- | --- |
| At 256 Hz, 100 requests of 10 ms emitted 300 samples but advanced the clock by only 1 second. | Derive timestamps from an integer emitted-sample count. The clock now advances by 300/256 seconds. A request rounding to zero samples leaves the clock unchanged. | Exact split/bulk sample equality at 256 and 500 Hz; rewind and invalid-input checks. |
| The nominal 120 ms sharp-wave helper had only 58.6 ms of activity above 1% of peak at 256 Hz, and 29.3 ms at 512 Hz. | Use a compact asymmetric pointed transient with the requested baseline-to-baseline duration, with the requested sample index marking its peak. | Approximately 117.2 ms above 1% of peak at both rates after correction; baseline duration within sample quantization at 256, 512, and 1000 Hz. |
| Several transient helpers silently used 256 Hz for duration and spacing. The demo spindle also used 256 Hz for its carrier. | Propagate the caller's sample rate through spikes, sharp waves, polyspikes, spike-wave complexes, triphasic waves, eye artifacts, and demo spindles. Scale scratch-buffer offsets by rate. | Event-extent checks at 256/512 Hz and a spectral check that the demo spindle remains near 13 Hz instead of moving to 26 Hz. |
| The spike-wave helper ignored its frequency argument when sizing the slow component. | Size the slow component to the requested cycle period. | Independent period checks at 2, 3, and 4 Hz, at both 256 and 512 samples/sec. |
| Live interburst background could exceed the suppression voltage criterion (raw channels measured 12.8–13.3 µV peak-to-peak for seeds 1, 42, 2026 at default noise). | Reduce live interburst background preservation from 10% to 2%. Attenuate the buffered generator's interburst floor after reference noise and ambient additions. Burst samples and schedules remain unchanged. Include burst duration in event metadata. | Live longitudinal bipolar interburst ranges measured 3.4–4.4 µV peak-to-peak across those seeds and noise settings 0.25/1. Tests also check 50–99% suppression occupancy, burst duration, and the buffered floor. |

The transient duration and suppression checks use the adult definitions in
[ACNS Standardized Critical Care EEG Terminology, 2021](https://www.acns.org/UserFiles/file/ACNSStandardizedCriticalCareEEGTerminology_rev2021.pdf):
spikes are 20 to less than 70 ms, sharp waves 70–200 ms, and suppression is below
10 µV. ACNS voltage assessment uses peak-to-trough measurements in standard
longitudinal bipolar montage. These duration and voltage criteria alone do not
establish epileptiform significance.

The platform's default 256 samples/sec meets the proposed minimum in the
[IFCN/ILAE routine and sleep EEG recording standards](https://pmc.ncbi.nlm.nih.gov/articles/PMC10006292/).
Higher-rate helper tests verify physical event timing; they do not establish
equivalence of all stochastic background characteristics at arbitrary rates.

## Regression protection and limits

`tests/signalAccuracy.test.js` adds quantitative physical checks. Existing tests
cover posterior alpha reactivity, sleep transients, additional spatial patterns,
seizure evolution, and worker/inline parity. The approved live-waveform corpus
retains the exact previous samples for all 42 other patterns. Only the
`burst_suppression` hash was intentionally updated for the lower interburst floor.

The generators remain heuristic teaching models. These checks do not establish
patient-level realism, diagnostic performance, or clinical validation of every
pattern. Buffered, live, and demo implementations have different background and
event models; matching their labels does not imply sample-for-sample equivalence.
The suppression floor intentionally also attenuates ambient additions to make the
teaching pattern clear; real recordings can retain ECG and technical artifacts
during cerebral suppression.

Run the regression suite with `npm.cmd test -- --maxWorkers=2`.
