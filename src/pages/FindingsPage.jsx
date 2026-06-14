import { useState } from 'react'
import { useTranslation }       from 'react-i18next'
import { useNavigate }          from 'react-router-dom'
import { useEEGStore }          from '@/store/eegStore'
import DemoTraceViewer          from '@/components/eeg/DemoTraceViewer'

// ─── Category metadata ───────────────────────────────────────────────────────

// Category metadata — labels come from i18n (`findings.categories.<id>`)
const CATEGORIES = {
  normal:          { color: '#00FFB0' },
  benign_variant:  { color: '#7FFFD4' },
  epileptiform:    { color: '#FF4444' },
  periodic:        { color: '#FFA552' },
  abnormal:        { color: '#FFD166' },
  coma:            { color: '#A0A0FF' },
}

// ─── Findings catalogue ──────────────────────────────────────────────────────

const FINDINGS = [

  // ══════════════ NORMAL ══════════════════════════════════════════════════
  {
    id: 'normal_awake',
    category: 'normal',
    title: 'Normal Awake Adult EEG',
    sandboxPattern: 'normal_awake',
    waveformId: 'alpha',
    tags: ['Posterior dominant rhythm', 'α 8–13 Hz', 'Berger effect'],
    color: '#00FFB0',
    description:
      'The awake adult EEG is defined by a well-formed, reactive posterior dominant rhythm (PDR) in the alpha range, maximal over the occipital electrodes with eyes closed, attenuating on eye opening (Berger effect). Background activity is otherwise low-amplitude with frontal beta and minimal theta/delta.',
    keyFeatures: [
      'PDR 8–13 Hz, occipital-dominant, symmetric (< 50% inter-hemispheric asymmetry)',
      'Reactive: attenuates/blocks with eye opening',
      'Low-amplitude (< 30 µV) frontal beta',
      'No sustained theta or any delta in the awake state',
      'No epileptiform discharges, no focal slowing',
    ],
    etiology: [
      'Physiologic state of normal wakefulness',
      'Slight slowing with aging is within normal limits (≥ 8 Hz at any adult age)',
    ],
    differential: [
      'Slow alpha variant (4–5 Hz harmonics); posterior slow waves of youth (normal < 21 y)',
      'Alpha in coma (non-reactive, diffuse) — morphologically similar but pathologic',
    ],
    pitfalls: [
      'Asymmetric PDR > 50% on one side is abnormal — suggests underlying structural lesion',
      'Failure to attenuate with eye opening in a cooperative patient is pathological',
    ],
  },

  {
    id: 'drowsy',
    category: 'normal',
    title: 'Drowsiness / Stage N1',
    sandboxPattern: 'normal_drowsy',
    waveformId: 'theta',
    tags: ['Drowsy', 'Theta', 'Vertex waves'],
    color: '#88DDAA',
    description:
      'Transitional state between wakefulness and sleep. The PDR fragments, slows, and attenuates; diffuse theta appears. Slow roving eye movements appear on the electro-oculogram. Toward the end of N1, vertex sharp waves appear at Cz.',
    keyFeatures: [
      'Attenuation and fragmentation of the alpha rhythm',
      'Emergence of diffuse symmetric theta (4–7 Hz)',
      'Slow roving horizontal eye movements',
      'Vertex sharp waves (negative, Cz maximum) appear in late N1',
      'POSTS may appear at O1/O2',
    ],
    etiology: [
      'Natural sleep onset',
      'Accentuated / prolonged in sleep-deprived patients (enhances interictal yield)',
    ],
    differential: [
      'Mild encephalopathy with diffuse theta — but drowsy theta is state-reactive',
    ],
  },

  {
    id: 'normal_sleep',
    category: 'normal',
    title: 'Stage N2 Sleep',
    sandboxPattern: 'normal_sleep',
    waveformId: 'sleep_spindle',
    tags: ['Spindles', 'K-complexes', 'N2'],
    color: '#00D4FF',
    description:
      'The defining features of N2 sleep are sleep spindles (12–14 Hz, 0.5–2 s, waxing/waning) and K-complexes (sharp negative followed by a broad positive slow wave, often followed by a spindle). Background is mixed theta/delta.',
    keyFeatures: [
      'Sleep spindles 12–14 Hz, maximal Cz/Fz, 0.5–2 s duration',
      'K-complexes: biphasic ≥ 500 ms, Fz/Cz maximum, often evoked by arousing stimuli',
      'Vertex sharp waves may persist from N1',
      'Background slowed into theta–delta',
      'POSTS often present posteriorly',
    ],
    etiology: [
      'Normal feature of consolidated NREM sleep',
      'Spindles are thalamocortical — reduced in thalamic dysfunction',
    ],
    differential: [
      'Periodic K-complexes can mimic generalised periodic discharges (GPDs) when viewed out of context',
      'Sleep spindles vs beta activity: spindles are state-dependent and waxing/waning',
    ],
    pitfalls: [
      'Spindle coma can occur after brainstem injury — morphologically similar but continuous and non-reactive',
    ],
  },

  {
    id: 'slow_wave_sleep',
    category: 'normal',
    title: 'Slow Wave Sleep (N3)',
    sandboxPattern: 'slow_wave_sleep',
    waveformId: 'delta',
    tags: ['N3', 'Slow wave sleep', 'Delta ≥ 20%'],
    color: '#7B5EA7',
    description:
      'Deep NREM sleep defined polysomnographically as ≥ 20% of an epoch showing high-amplitude (> 75 µV) delta (0.5–2 Hz). K-complexes and spindles become less frequent as N3 deepens.',
    keyFeatures: [
      'High-amplitude diffuse delta (0.5–2 Hz, > 75 µV)',
      'K-complexes embedded in the slow activity',
      'Markedly reduced muscle tone on EMG reference channels',
      'No epileptiform activity should be present',
    ],
    etiology: ['Normal deep NREM sleep; most abundant in the first third of the night'],
    differential: [
      'Pathologic generalised delta slowing (awake encephalopathy) — differentiated by state and reactivity',
    ],
  },

  {
    id: 'rem_sleep',
    category: 'normal',
    title: 'REM Sleep',
    waveformId: 'theta',
    tags: ['REM', 'Saw-tooth', 'Atonia'],
    color: '#44CCFF',
    description:
      'Rapid Eye Movement sleep resembles wakefulness on EEG (low-voltage mixed-frequency activity) but with muscle atonia on chin EMG and rapid lateral eye movements on EOG. Saw-tooth waves — sharply contoured 2–6 Hz — are characteristic.',
    keyFeatures: [
      'Low-voltage, mixed-frequency (theta predominant) EEG',
      'Rapid eye movements on horizontal EOG channels',
      'Chin EMG atonia (lowest of any stage)',
      'Saw-tooth waves: serrated 2–6 Hz vertex-frontal transients',
    ],
    etiology: ['Normal REM sleep; ~20–25% of total sleep in adults'],
    differential: [
      'Drowsy wakefulness — EEG alone cannot distinguish REM from drowsy without EOG/EMG',
    ],
  },

  {
    id: 'activation_procedures',
    category: 'normal',
    title: 'Activation Procedures (HV & Photic)',
    waveformId: 'delta',
    tags: ['Hyperventilation', 'Photic driving', 'Provocation'],
    color: '#9EE493',
    description:
      'Hyperventilation and intermittent photic stimulation are standard activation procedures used to provoke abnormalities. HV produces normal build-up of diffuse bilateral slowing (greatest in children) that resolves within 1–2 min of stopping. Photic driving is a symmetric occipital response time-locked to flash frequency, typically within the alpha range.',
    keyFeatures: [
      'HV: diffuse rhythmic 3–6 Hz slowing, larger in children, resolves post-HV',
      'HV may provoke 3 Hz spike-wave in childhood absence',
      'Photic driving: symmetric occipital following response at the flash frequency',
      'Harmonics (1/2 or 2× flash rate) are acceptable normal responses',
    ],
    etiology: [
      'Normal HV response — hypocapnia-induced cerebral vasoconstriction → slowing',
      'Photic driving is a normal visual-cortex response',
    ],
    differential: [
      'Photoparoxysmal response: generalised epileptiform discharges outlasting the flash — distinct from benign photic driving',
      'Photomyogenic response: frontal EMG artifact time-locked to flash — not cerebral',
    ],
    pitfalls: [
      'Persistent (> 1 min) post-HV slowing is abnormal and suggests encephalopathy',
      'Asymmetric HV response or photic driving suggests focal pathology',
    ],
  },

  // ══════════════ BENIGN VARIANTS ════════════════════════════════════════
  {
    id: 'mu',
    category: 'benign_variant',
    title: 'Mu Rhythm',
    waveformId: 'mu',
    tags: ['Central', 'Arched', 'Motor reactivity'],
    color: '#7FFFD4',
    description:
      'Central alpha-range (8–12 Hz) rhythm with a characteristic arched / comb-shaped morphology, maximal at C3/C4. It attenuates with contralateral hand movement or even the intent to move — a useful bedside confirmation. Can be unilateral or asymmetric in healthy individuals.',
    keyFeatures: [
      'Frequency 8–12 Hz (overlaps with alpha range)',
      'Arciform / comb morphology (sharp negative, rounded positive)',
      'Maximal at C3 and C4 over the rolandic strip',
      'Attenuates with contralateral movement — does NOT block with eye opening',
      'May be asymmetric; unilateral mu can occur in healthy subjects',
    ],
    etiology: ['Normal sensorimotor rhythm; seen in up to 20% of healthy adults'],
    differential: [
      'Central sharp waves or centrotemporal spikes (SeLECTS/BECTS) — true epileptiform activity',
      'Alpha rhythm — mu is reactive to movement, alpha to eye opening',
    ],
    pitfalls: [
      'Easily mistaken for sharp waves due to the arched morphology — the reactivity test is key',
    ],
  },

  {
    id: 'lambda_posts',
    category: 'benign_variant',
    title: 'Lambda Waves & POSTS',
    waveformId: 'posts',
    tags: ['Occipital', 'Benign', 'Visual'],
    color: '#AADDBB',
    description:
      'Lambda waves are surface-positive sharp triangular transients at O1/O2 during visual scanning in the awake state — saccade-locked. POSTS (Positive Occipital Sharp Transients of Sleep) are the same morphology occurring in trains during N1–N2. Both are normal.',
    keyFeatures: [
      'Sharp triangular morphology, surface-POSITIVE polarity',
      'O1 / O2 maximum, bilaterally symmetric',
      'Lambda waves: awake, time-locked to saccades over patterned visual scenes',
      'POSTS: 4–5 Hz trains during light NREM sleep',
      'Benign — should not be reported as epileptiform',
    ],
    etiology: ['Normal physiologic visual-cortex responses'],
    differential: [
      'Occipital sharp waves / spike-wave (abnormal) — these are surface-NEGATIVE',
      'The positive polarity of lambda/POSTS is the key differentiator',
    ],
    pitfalls: [
      'Inverting the display or using an unusual reference can make POSTS appear negative and lead to misinterpretation',
    ],
  },

  {
    id: 'benign_variants_misc',
    category: 'benign_variant',
    title: 'Miscellaneous Benign Variants',
    waveformId: 'sharp_wave',
    tags: ['Wicket', 'SREDA', '14&6', 'Not epileptiform'],
    color: '#B0E0FF',
    description:
      'Several benign variants are important primarily because they are commonly misread as epileptiform. Key examples: wicket spikes (arciform temporal, no after-going slow wave), 14-and-6 positive spikes, small sharp spikes of sleep (SSS/BETS), and subclinical rhythmic electrographic discharge of adults (SREDA).',
    keyFeatures: [
      'Wicket: 6–11 Hz arciform temporal waves; single wave can look sharp but has no after-going slow wave',
      '14-and-6 Hz positive spikes: posterior-temporal, pediatric, drowsiness',
      'Small sharp spikes (SSS/BETS): brief, low-amplitude, drowsy/light sleep',
      'SREDA: rhythmic theta in older adults, abrupt start/stop, no clinical change',
    ],
    etiology: ['All are normal variants; no treatment indicated'],
    differential: [
      'Temporal interictal epileptiform discharges (true sharps have after-going slow wave and a plausible field)',
    ],
    pitfalls: [
      'These variants collectively drive a large fraction of EEG false-positive reports — always require a clear field and after-going slow wave before calling a discharge epileptiform',
    ],
  },

  // ══════════════ EPILEPTIFORM ════════════════════════════════════════════
  {
    id: 'spike_wave_3hz',
    category: 'epileptiform',
    title: 'Generalised 3 Hz Spike-and-Wave',
    sandboxPattern: 'absence',
    waveformId: 'spike_wave',
    tags: ['Absence epilepsy', 'Generalised', 'Hyperventilation'],
    color: '#FF4444',
    description:
      'Hallmark of childhood absence epilepsy (CAE). Bilaterally synchronous, symmetric 3 Hz spike-and-wave complexes with abrupt onset and offset; 4–20 s runs during clinical seizures. Interictal EEG is typically normal.',
    keyFeatures: [
      '3 Hz (2.5–4 Hz) regular spike-and-wave complexes',
      'Bilaterally synchronous, symmetric, generalised (frontally-dominant)',
      'Abrupt onset and termination; runs 4–20 s',
      'Provoked by hyperventilation in most patients',
      'Normal interictal background',
    ],
    etiology: [
      'Childhood absence epilepsy (CAE) — peak 4–10 years, favorable prognosis',
      'Juvenile absence epilepsy — slightly older, may persist into adulthood',
    ],
    differential: [
      'Slow spike-and-wave (< 2.5 Hz) — Lennox-Gastaut syndrome',
      'Polyspike-and-wave — juvenile myoclonic epilepsy (JME)',
    ],
  },

  {
    id: 'slow_spike_wave',
    category: 'epileptiform',
    title: 'Slow Spike-and-Wave (Lennox-Gastaut)',
    sandboxPattern: 'slow_spike_wave',
    waveformId: 'spike_wave',
    tags: ['Lennox-Gastaut', '< 2.5 Hz', 'Epileptic encephalopathy'],
    color: '#FF3377',
    description:
      'Slow (1.5–2.5 Hz) generalised spike-and-wave or sharp-and-slow-wave discharges are characteristic of Lennox-Gastaut syndrome — a severe childhood epileptic encephalopathy. Also seen: generalised paroxysmal fast activity during sleep, and multiple seizure types clinically (tonic, atonic, atypical absence).',
    keyFeatures: [
      'Slow spike-and-wave < 2.5 Hz, often asymmetric and not as well-formed as 3 Hz SWD',
      'Generalised paroxysmal fast activity (10–20 Hz) in sleep — tonic seizure correlate',
      'Background slowing and multifocal discharges',
      'Interictally abundant (not just ictal)',
    ],
    etiology: [
      'Structural/metabolic/genetic brain disease (West syndrome may evolve into LGS)',
      'Developmental delay / cognitive impairment is almost universal',
    ],
    differential: [
      '3 Hz SWD (CAE) — faster, better formed, normal background',
      'Atypical benign partial epilepsy of childhood',
    ],
  },

  {
    id: 'polyspike_jme',
    category: 'epileptiform',
    title: 'Generalised Polyspike / Polyspike-and-Wave',
    sandboxPattern: 'polyspike_jme',
    waveformId: 'polyspike',
    tags: ['JME', 'Photosensitive', 'Morning myoclonus'],
    color: '#FF0066',
    description:
      'Bilaterally synchronous polyspike and polyspike-and-wave discharges at 4–6 Hz are characteristic of juvenile myoclonic epilepsy (JME). Often precipitated by sleep deprivation and photic stimulation. Myoclonic jerks on awakening are the clinical hallmark.',
    keyFeatures: [
      'Generalised 4–6 Hz polyspike-and-wave (3+ spikes per complex)',
      'Frontocentral maximum',
      'Photoparoxysmal response in ~30–40% of JME patients',
      'Activated by sleep deprivation, morning hours, and alcohol withdrawal',
      'Normal background',
    ],
    etiology: ['Juvenile myoclonic epilepsy (most common idiopathic generalised epilepsy)'],
    differential: [
      '3 Hz spike-wave (absence)',
      'Myoclonic epilepsies of infancy (Dravet, progressive myoclonic epilepsies)',
    ],
  },

  {
    id: 'centrotemporal_spikes',
    category: 'epileptiform',
    title: 'Centrotemporal Spikes (SeLECTS / BECTS)',
    sandboxPattern: 'centrotemporal_spikes',
    waveformId: 'sharp_wave',
    tags: ['SeLECTS', 'BECTS', 'Rolandic'],
    color: '#FF6B35',
    description:
      'Self-limited epilepsy with centrotemporal spikes (SeLECTS; formerly BECTS / "Rolandic epilepsy") is the most common self-limited focal epilepsy of childhood. It is characterised by high-amplitude diphasic sharp waves at the centrotemporal region (C3/C4, T7/T8), markedly activated by drowsiness and sleep. Seizures are typically nocturnal, hemifacial, and resolve by mid-adolescence.',
    keyFeatures: [
      'Diphasic (sharp-then-slow) discharges at C3/T7 or C4/T8',
      'Horizontal tangential dipole (positive frontal, negative centrotemporal)',
      'Markedly activated by drowsiness / sleep — may be very rare awake',
      'Normal background and neurological examination',
      'Often bilateral independent',
    ],
    etiology: ['Age-dependent self-limited focal epilepsy; peak onset 5–9 years'],
    differential: [
      'Symptomatic focal epilepsy of the central/temporal region — background would be abnormal',
      'Sharply contoured mu rhythm — reactive to movement, not a true epileptiform discharge',
    ],
    pitfalls: [
      'Overrepresented during sleep — an awake-only EEG may miss the diagnosis',
    ],
  },

  {
    id: 'temporal_sharps',
    category: 'epileptiform',
    title: 'Temporal Interictal Epileptiform Discharges',
    sandboxPattern: 'temporal_sharps',
    waveformId: 'sharp_wave',
    tags: ['TLE', 'Anterior temporal', 'Hippocampal'],
    color: '#FF5544',
    description:
      'Focal interictal sharp waves or spike-and-slow-wave complexes at F7/T7 (left) or F8/T8 (right), often with an anterior-temporal maximum. The defining pattern of temporal lobe epilepsy (TLE), the most common focal epilepsy of adulthood, usually with hippocampal sclerosis as the underlying pathology.',
    keyFeatures: [
      'Maximum at F7/T7 or F8/T8 (anterior/mid-temporal)',
      'Sharp-wave or spike-and-slow-wave morphology',
      'After-going slow wave confirms epileptiform nature',
      'Activated by sleep; often seen in N1–N2',
      'May become bilateral independent',
    ],
    etiology: [
      'Hippocampal sclerosis (most common)',
      'Temporal lobe tumor, cortical dysplasia, post-traumatic gliosis, autoimmune LE',
    ],
    differential: [
      'Wicket spikes (no after-going slow wave, arciform)',
      'Small sharp spikes of sleep (brief, low-amplitude)',
      'Temporal slowing alone (non-epileptiform)',
    ],
  },

  {
    id: 'hypsarrhythmia',
    category: 'epileptiform',
    title: 'Hypsarrhythmia (West Syndrome)',
    sandboxPattern: 'hypsarrhythmia',
    waveformId: 'hypsarrhythmia',
    tags: ['Infantile spasms', 'West', 'Urgent treatment'],
    color: '#FF2255',
    description:
      'The defining EEG of West syndrome / infantile spasms: a chaotic, very high-amplitude (> 300 µV), disorganised background with asynchronous multifocal spikes and sharp waves. Clinically: flexor or extensor spasms in clusters, developmental regression. Requires urgent treatment (ACTH, vigabatrin).',
    keyFeatures: [
      'Amplitudes routinely > 300 µV, often > 500 µV',
      'Chaotic, disorganised slow background',
      'Multifocal asynchronous spikes and sharp waves',
      'Ictal correlate of spasms: electrodecrement ± superimposed fast activity',
      'Fragments (improves) during sleep — "modified hypsarrhythmia"',
    ],
    etiology: [
      'Tuberous sclerosis, perinatal hypoxic-ischaemic injury, cortical malformations, metabolic disorders, or cryptogenic',
    ],
    differential: [
      'Multifocal epilepsy of infancy — less amplitude, more organised background',
    ],
    prognosis:
      'Early treatment is critical to cognitive outcome. Many evolve to Lennox-Gastaut syndrome.',
  },

  {
    id: 'photoparoxysmal',
    category: 'epileptiform',
    title: 'Photoparoxysmal Response',
    sandboxPattern: 'photoparoxysmal',
    waveformId: 'polyspike',
    tags: ['Photosensitivity', 'IPS', 'Generalised'],
    color: '#FF8866',
    description:
      'Generalised epileptiform discharges provoked by intermittent photic stimulation (IPS). The clinically significant response (type IV: generalised polyspike-wave outlasting the flash) predicts photosensitive epilepsy.',
    keyFeatures: [
      'Generalised spike-wave or polyspike-wave during/after photic stimulation',
      'Outlasts the flash train — the defining feature of clinically significant PPR',
      'Most provoked by 15–25 Hz flash rates',
      'Bilateral and symmetric',
    ],
    etiology: [
      'Idiopathic generalised epilepsies (JME highest), photosensitive epilepsies',
      'PPR is common in JME, but prevalence varies with cohort, age, medication status, and IPS protocol',
    ],
    differential: [
      'Photic driving response (benign): symmetric occipital following at flash frequency, does NOT outlast the flash',
      'Photomyogenic response: high-frequency EMG over frontal muscles, time-locked to flash — peripheral, not cerebral',
    ],
    pitfalls: [
      'Stop stimulation immediately when a PPR appears to avoid provoking a seizure',
    ],
  },

  // ══════════════ PERIODIC (ICU) ═══════════════════════════════════════════
  {
    id: 'gpds',
    category: 'periodic',
    title: 'Generalised Periodic Discharges (GPDs)',
    sandboxPattern: 'gpds',
    waveformId: 'gpds',
    tags: ['ICU', 'Encephalopathy', 'Ictal-interictal continuum'],
    color: '#FFA552',
    description:
      'Bilaterally synchronous periodic sharp-wave or sharp-and-slow-wave complexes at regular 0.5–2 Hz intervals. Non-specific but always pathological. In the ICU setting they sit on the ictal-interictal continuum and may warrant treatment depending on background, evolution, and clinical context.',
    keyFeatures: [
      'Regular inter-discharge interval 0.5–2 s',
      'Stereotyped sharp-and-slow-wave morphology',
      'Bilaterally synchronous, generalised',
      'Background between discharges may be suppressed or slow',
      'Classify per ACNS 2021 terminology: frequency, sharpness, amplitude, modifiers (±)',
    ],
    etiology: [
      'Post-anoxic (cardiac arrest) encephalopathy',
      'Severe metabolic derangement (uremia, hepatic, sepsis)',
      'Creutzfeldt-Jakob disease (typically 1 Hz)',
      'Non-convulsive status epilepticus (NCSE) — "ictal" end of the continuum',
    ],
    differential: [
      'Triphasic waves (specific sub-morphology of GPDs)',
      'Generalised periodic K-complexes in sleep (context-dependent)',
    ],
    prognosis:
      'Post-anoxic GPDs on a suppressed background carry poor neurologic prognosis. Evolution, frequency increase, or clinical change → treat as NCSE.',
  },

  {
    id: 'lpds',
    category: 'periodic',
    title: 'Lateralised Periodic Discharges (LPDs / PLEDs)',
    sandboxPattern: 'lpds',
    waveformId: 'lpds',
    tags: ['Acute focal lesion', 'Stroke', 'HSV encephalitis'],
    color: '#FF8B40',
    description:
      'Periodic sharp-and-slow-wave complexes lateralised to one hemisphere, at 0.5–2 Hz. Indicates an acute or subacute focal cortical process. High risk of clinical and electrographic seizures — most patients with LPDs develop seizures within hours to days.',
    keyFeatures: [
      'Unilateral or unilateral-predominant periodic complexes',
      'Inter-discharge interval 0.5–2 s, regular',
      'Background over the affected hemisphere is attenuated/slowed',
      '> 50% seizure risk within 24 h of LPD onset',
    ],
    etiology: [
      'Acute middle cerebral artery stroke',
      'Herpes simplex encephalitis (classically bitemporal LPDs / BiPDs)',
      'Focal cortical lesion (tumor, abscess, contusion)',
      'Post-ictal state after a focal seizure',
    ],
    differential: [
      'GPDs (bilaterally synchronous rather than lateralised)',
      'Bilateral independent periodic discharges (BiPDs) — two separate foci',
    ],
    prognosis:
      'Strongly predicts focal seizures. Consider EEG-guided antiseizure therapy depending on frequency, sharpness, and clinical status.',
  },

  {
    id: 'triphasic',
    category: 'periodic',
    title: 'Triphasic Waves',
    sandboxPattern: 'triphasic_waves',
    waveformId: 'triphasic_waves',
    tags: ['Metabolic', 'Hepatic', 'Uremic'],
    color: '#FFB347',
    description:
      'A specific morphology within the GPD family: three phases (small positive → large negative → large positive), blunt rather than spiky, at 1–2 Hz. Classically described in hepatic and uraemic encephalopathy but also seen post-anoxic, septic, and in CJD. Anterior-to-posterior (or reverse) propagation lag is characteristic.',
    keyFeatures: [
      'Three-phase morphology, blunt (non-sharp)',
      'Frequency 1–2 Hz, generalised',
      'Bifrontal or bioccipital maximum',
      'Short anterior-posterior phase lag across the scalp',
      'Reactive: may briefly attenuate or enhance with stimulation',
    ],
    etiology: [
      'Hepatic encephalopathy (classic association)',
      'Uraemic encephalopathy',
      'Post-anoxic, septic, other metabolic',
      'Medication effects (baclofen, ifosfamide, lithium, cephalosporins)',
      'CJD (with other periodic features)',
    ],
    differential: [
      'Non-convulsive status epilepticus — triphasic waves can evolve into NCSE; a benzodiazepine challenge (with EEG) can help differentiate',
      'Other GPDs — triphasics have distinctive blunt 3-phase morphology',
    ],
    pitfalls: [
      'Overdiagnosis of NCSE when triphasics are the true pattern can lead to unnecessary anaesthetic coma',
    ],
  },

  // ══════════════ NON-EPILEPTIFORM ABNORMAL ════════════════════════════════
  {
    id: 'focal_slowing',
    category: 'abnormal',
    title: 'Focal Polymorphic Delta Slowing',
    sandboxPattern: 'focal_slowing',
    waveformId: 'focal_slowing',
    tags: ['Structural', 'Focal', 'Polymorphic'],
    color: '#FFD166',
    description:
      'Continuous or near-continuous focal polymorphic delta (0.5–3 Hz), irregular and arrhythmic, indicates underlying structural pathology of the white matter or cortex below the affected electrodes. The continuous polymorphic nature differentiates it from intermittent rhythmic delta (which suggests deep/midline dysfunction).',
    keyFeatures: [
      'Continuous or near-continuous delta focally',
      'Polymorphic (irregular morphology, variable frequency)',
      'Maximal over the affected region',
      'Non-reactive to stimulation or eye opening',
      'Attenuation of faster rhythms over the same region',
    ],
    etiology: [
      'Acute ischaemic stroke (classic)',
      'Primary or metastatic brain tumor',
      'Focal encephalitis, abscess',
      'Post-surgical gliosis or contusion',
    ],
    differential: [
      'Intermittent rhythmic delta (TIRDA/FIRDA) — rhythmic bursts rather than continuous polymorphic',
      'Focal sleep activity — state-dependent',
    ],
  },

  {
    id: 'firda',
    category: 'abnormal',
    title: 'FIRDA',
    sandboxPattern: 'firda',
    waveformId: 'firda',
    tags: ['Frontal', 'Intermittent', 'Midline dysfunction'],
    color: '#FFC27A',
    description:
      'Frontal Intermittent Rhythmic Delta Activity — rhythmic, monomorphic 2–3 Hz delta bursts lasting 2–10 seconds, bilateral and bifrontal-maximum. Indicates deep midline / diencephalic or metabolic dysfunction. Usually reactive to stimulation or eye opening.',
    keyFeatures: [
      'Rhythmic (sinusoidal) 2–3 Hz delta',
      'Occurs in bursts of 2–10 s',
      'Bifrontal maximum (Fz, F3, F4); symmetric',
      'Typically reactive — attenuates with eye opening',
      'Interposed on an otherwise preserved or slowed background',
    ],
    etiology: [
      'Raised intracranial pressure (especially third-ventricular obstruction)',
      'Metabolic encephalopathy',
      'Deep midline tumour, thalamic infarct',
      'Sometimes seen in idiopathic generalised epilepsies as a variant',
    ],
    differential: [
      'OIRDA (occipital IRDA): same pattern, occipital maximum, seen in pediatric absence epilepsies',
      'Focal polymorphic delta — continuous rather than rhythmic and intermittent',
    ],
  },

  {
    id: 'diffuse_slowing',
    category: 'abnormal',
    title: 'Diffuse Slowing / Encephalopathy',
    sandboxPattern: 'diffuse_slowing',
    waveformId: 'theta',
    tags: ['Encephalopathy', 'Diffuse', 'Grading'],
    color: '#FFDC7A',
    description:
      'Generalised slowing of the background rhythm is the most common EEG abnormality in hospitalised patients. Severity grading (mild–moderate–severe) correlates with clinical encephalopathy. Aetiology is almost always systemic (metabolic, toxic, septic, hypoxic).',
    keyFeatures: [
      'Mild: PDR slowed to 7–8 Hz, occasional theta',
      'Moderate: Diffuse theta predominant; PDR may be 5–7 Hz or lost',
      'Severe: Continuous delta, poor reactivity, possible triphasic waves',
      'Preserved anterior-to-posterior gradient is a favorable sign',
      'Reactivity (state change with stimulus) indicates preserved cortex',
    ],
    etiology: [
      'Hepatic, uraemic, septic, hypoxic, hypercapnic, thyroid, electrolyte',
      'Drug-induced (benzodiazepines → excess beta on a slowed background)',
      'Post-ictal state',
    ],
    differential: [
      'Drowsiness — state-reactive; the patient can be aroused',
      'Low-voltage EEG (constitutionally) — a normal variant',
    ],
  },

  {
    id: 'breach_rhythm',
    category: 'abnormal',
    title: 'Breach Rhythm',
    sandboxPattern: 'breach_rhythm',
    waveformId: 'breach_rhythm',
    tags: ['Skull defect', 'Benign', 'Post-craniotomy'],
    color: '#BFA4FF',
    description:
      'High-amplitude, sharp-contoured alpha and beta activity over a skull defect (burr hole, craniotomy) — reflecting loss of the normal attenuating effect of intact skull and scalp, NOT cerebral pathology. Frequently misinterpreted as focal epileptiform activity.',
    keyFeatures: [
      'Focally increased amplitude (2–3× surrounding channels)',
      'Prominent sharp-contoured beta and alpha',
      'Overlies a known surgical defect',
      'NOT followed by after-going slow wave (unlike true epileptiform)',
      'Reactive like the underlying normal rhythm',
    ],
    etiology: ['Previous craniotomy, burr hole, or skull fracture'],
    differential: [
      'Focal epileptiform discharges — would have after-going slow wave and a plausible field',
    ],
    pitfalls: [
      'One of the most common benign mimics of focal epileptiform activity — always correlate with prior neurosurgery/imaging',
    ],
  },

  // ══════════════ COMA PATTERNS ═══════════════════════════════════════════
  {
    id: 'burst_suppression',
    category: 'coma',
    title: 'Burst-Suppression',
    sandboxPattern: 'burst_suppression',
    waveformId: 'burst_suppression',
    tags: ['Anoxic injury', 'Anaesthesia', 'Prognostic'],
    color: '#A0A0FF',
    description:
      'Alternating periods of high-voltage mixed-frequency bursts (0.5–3 s) and near-isoelectric suppression (2–10 s). In the post-cardiac-arrest setting, persistent burst-suppression at 72 h is a poor-prognosis marker. Also seen during deep general anaesthesia (titratable).',
    keyFeatures: [
      'Bursts: polymorphic mixed frequencies, often with superimposed sharps',
      'Suppression: < 10 µV, near-flat',
      'Generalised and bilaterally synchronous',
      'Non-reactive in pathological cases; titratable under anaesthesia',
      'Suppression ratio correlates with depth of dysfunction',
    ],
    etiology: [
      'Post-cardiac-arrest hypoxic-ischaemic encephalopathy',
      'Deep general anaesthesia (propofol, pentobarbital, isoflurane)',
      'Severe hypothermia',
      'End-stage metabolic encephalopathy',
    ],
    differential: [
      'Alternating pattern of tracé alternant (normal neonatal quiet sleep) — age is the key',
      'Severe diffuse slowing without true suppression',
    ],
    prognosis:
      'Persistent burst-suppression at > 72 h post cardiac arrest (not due to sedation) is associated with unfavourable neurologic outcome.',
  },

  {
    id: 'alpha_coma',
    category: 'coma',
    title: 'Alpha / Beta / Spindle Coma',
    sandboxPattern: 'alpha_coma',
    waveformId: 'alpha',
    tags: ['Brainstem injury', 'Non-reactive alpha', 'Pontine'],
    color: '#99AACC',
    description:
      'Paradoxical coma patterns that superficially resemble normal awake or sleep rhythms but occur in deeply unresponsive patients. Diffuse, non-reactive alpha / beta / spindle activity implies brainstem or diffuse cortical dysfunction. Despite morphological similarity to normal rhythms, the patient does not respond.',
    keyFeatures: [
      'Alpha coma: widespread 8–12 Hz activity, maximal FRONTALLY (inverted from normal), non-reactive',
      'Beta coma: diffuse beta, often drug-induced (benzodiazepines, barbiturates)',
      'Spindle coma: continuous spindle-like activity after brainstem injury',
      'Common: NON-REACTIVE to any stimulus — the key feature',
    ],
    etiology: [
      'Pontine tegmentum lesions (stroke, haemorrhage)',
      'Post-cardiac-arrest (alpha coma; poor prognosis)',
      'Drug overdose (beta coma from benzodiazepines/barbiturates — better prognosis)',
    ],
    differential: [
      'Normal awake / sleep rhythms — the patient\'s clinical state and reactivity differentiate',
      'Locked-in syndrome — preserved EEG, can demonstrate voluntary vertical eye movements clinically',
    ],
  },

  {
    id: 'electrocerebral_silence',
    category: 'coma',
    title: 'Electrocerebral Inactivity (ECI)',
    sandboxPattern: 'electrocerebral_silence',
    waveformId: 'beta',
    tags: ['ECI', 'Brain death evaluation', 'Ancillary test'],
    color: '#6B7BA0',
    description:
      'Electrocerebral inactivity (ECI) means no cerebral activity over 2 µV when recorded at high sensitivity (2 µV/mm) for at least 30 minutes under strict technical standards. It supports brain-death evaluation only when clinical, legal, and physiologic prerequisites are satisfied.',
    keyFeatures: [
      'No cerebral activity > 2 µV at 2 µV/mm sensitivity for ≥ 30 min',
      'Inter-electrode distances ≥ 10 cm; impedances 100–10,000 Ω',
      'Noise, artifact, and reactivity testing per ACNS technical standards',
      'ECG, EMG, and room noise artefacts must be distinguishable and excluded',
    ],
    etiology: ['Cerebral circulatory arrest (brain death)'],
    differential: [
      'Hypothermia (reversible) — must be excluded',
      'Sedative/neuromuscular blocker overdose (reversible) — must be excluded',
      'Severe hypotension / metabolic crisis (reversible)',
    ],
    pitfalls: [
      'ECG artefact is ubiquitous — do NOT misinterpret it as cerebral activity',
      'EEG alone does not diagnose brain death; it must follow the applicable clinical/legal protocol',
    ],
  },
]

// ─── Mini trace demo ─────────────────────────────────────────────────────────

// ─── Page ───────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['normal','benign_variant','epileptiform','periodic','abnormal','coma']

export default function FindingsPage() {
  const { t }      = useTranslation()
  const navigate   = useNavigate()
  const setPattern = useEEGStore(s => s.setPattern)
  const [active, setActive] = useState('normal_awake')
  const [cat,    setCat]    = useState('all')
  const [search, setSearch] = useState('')

  const finding = FINDINGS.find(f => f.id === active) ?? FINDINGS[0]

  const matchesSearch = (f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.title.toLowerCase().includes(q) ||
      f.tags.some(t => t.toLowerCase().includes(q)) ||
      f.description.toLowerCase().includes(q)
    )
  }

  const filtered = FINDINGS.filter(f =>
    (cat === 'all' || f.category === cat) && matchesSearch(f)
  )

  // Group filtered results by category for display in sidebar
  const grouped = CATEGORY_ORDER.map(c => ({
    id: c,
    meta: CATEGORIES[c],
    items: filtered.filter(f => f.category === c),
  })).filter(g => g.items.length > 0)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left nav ─────────────────────────────────────────────────────── */}
      <nav className="w-64 flex-shrink-0 border-r border-eeg-border p-4 overflow-y-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
          {t('findings.title')}
        </p>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search findings…"
          className="w-full mb-3 bg-eeg-card border border-eeg-border rounded-lg px-3 py-1.5
                     text-xs font-body text-eeg-text placeholder-eeg-muted
                     focus:outline-none focus:border-eeg-accent"
        />

        {/* Category filter */}
        <div className="flex flex-wrap gap-1 mb-4">
          <FilterChip id="all" label="All" active={cat === 'all'} onClick={() => setCat('all')} />
          {CATEGORY_ORDER.map(id => (
            <FilterChip
              key={id}
              id={id}
              label={t(`findings.categories.${id}`)}
              color={CATEGORIES[id].color}
              active={cat === id}
              onClick={() => setCat(id)}
            />
          ))}
        </div>

        {/* Grouped results */}
        <div className="space-y-4">
          {grouped.length === 0 && (
            <p className="text-xs font-mono text-eeg-muted px-2 py-4">No results.</p>
          )}
          {grouped.map(g => (
            <div key={g.id}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5 px-1"
                 style={{ color: g.meta.color }}>
                {t(`findings.categories.${g.id}`)}
              </p>
              <div className="space-y-0.5">
                {g.items.map(f => (
                  <button key={f.id} onClick={() => setActive(f.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all
                      ${active === f.id
                        ? 'bg-eeg-card border border-eeg-border text-eeg-text'
                        : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40 border border-transparent'
                      }`}>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                      <span className="font-body leading-tight">{f.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Right: Detail ────────────────────────────────────────────────── */}
      {finding && (
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl">

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono px-2.5 py-1 rounded border"
                style={{
                  color: CATEGORIES[finding.category].color,
                  borderColor: `${CATEGORIES[finding.category].color}44`,
                  background: `${CATEGORIES[finding.category].color}11`,
                }}>
                {t(`findings.categories.${finding.category}`)}
              </span>
            </div>
            <h1 className="section-title mb-3">{finding.title}</h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {finding.tags.map(tag => (
                <span key={tag} className="text-xs font-mono px-2 py-0.5 bg-eeg-card border border-eeg-border rounded text-eeg-muted">
                  {tag}
                </span>
              ))}
            </div>

            {/* Demo trace */}
            {finding.waveformId && (
              <div className="card mb-6 overflow-hidden">
                <div className="px-4 py-2 border-b border-eeg-border flex items-center justify-between">
                  <span className="text-xs font-mono text-eeg-muted">
                    Representative trace — {finding.title}
                  </span>
                  <span className="text-[10px] font-mono text-eeg-muted">3 s @ 256 Hz</span>
                </div>
                <div className="eeg-paper p-2">
                  <DemoTraceViewer
                    patternId={finding.waveformId}
                    color={finding.color}
                    height={84}
                    label={finding.title}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <p className="font-body text-sm text-eeg-muted leading-relaxed mb-6">
              {finding.description}
            </p>

            {/* Sections */}
            <Section title="Key EEG Features" color={finding.color} items={finding.keyFeatures} />
            {finding.etiology    && <Section title="Etiology / Clinical Setting" color="#FFD166" items={finding.etiology} />}
            {finding.differential && <Section title="Differential Diagnosis"     color="#00D4FF" items={finding.differential} />}
            {finding.pitfalls     && <Section title="Pitfalls & Mimics"          color="#FF8866" items={finding.pitfalls} />}

            {finding.prognosis && (
              <div className="card p-5 mb-6 border-l-4" style={{ borderLeftColor: '#BFA4FF' }}>
                <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">
                  Prognosis / Management
                </p>
                <p className="font-body text-sm text-eeg-text leading-relaxed">
                  {finding.prognosis}
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mt-6">
              {finding.sandboxPattern && (
                <button
                  onClick={() => { setPattern(finding.sandboxPattern); navigate('/sandbox') }}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <span>Open in Sandbox</span>
                  <ArrowIcon />
                </button>
              )}
              {finding.waveformId && (
                <button
                  onClick={() => navigate(`/waveforms?id=${finding.waveformId}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                             border border-eeg-border text-eeg-muted hover:text-eeg-text
                             hover:border-eeg-accent transition-all"
                >
                  <span>View Waveform Details</span>
                  <ArrowIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, color, items }) {
  return (
    <div className="card p-5 mb-4">
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm font-body text-eeg-text leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilterChip({ label, color, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
        ${active
          ? 'text-eeg-text border-opacity-60'
          : 'border-eeg-border text-eeg-muted hover:text-eeg-text'
        }`}
      style={active && color
        ? { borderColor: color, background: color + '22', color }
        : {}}
    >
      {label}
    </button>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}
