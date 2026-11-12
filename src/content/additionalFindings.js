import { ADDITIONAL_PATTERN_CONFIG } from '@/engine/additionalPatterns'

const ACNS = [
  'https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/',
  'ACNS critical-care EEG terminology (2021)',
]
const TEMPORAL = [
  'https://www.epilepsydiagnosis.org/seizure/temporal-eeg.html',
  'ILAE: temporal lobe seizure EEG',
]
const DETAILS = {
  tirda: {
    title: 'Temporal intermittent rhythmic delta activity (TIRDA)',
    description:
      'Short, non-evolving trains of rhythmic delta with an anterior temporal maximum. This example uses left temporal 2 Hz runs on a drowsy background.',
    keyFeatures: [
      'Left anterior temporal field, clearest around F7/T7',
      'Intermittent runs separated by background activity',
      'Stable frequency within each run; no progressive spread',
    ],
    etiology: [
      'Associated with temporal lobe epilepsy; assess alongside the clinical history and other EEG findings.',
    ],
    differential: [
      'RMTD: theta rather than delta frequency',
      'Polymorphic temporal slowing',
      'Focal ictal rhythm: inspect for evolution and duration',
    ],
    pitfalls: ['TIRDA is an interictal finding, not automatically a seizure.'],
    spectrum:
      'F7/T7 should show a peak near 2 Hz during each run, stronger than the right temporal channels.',
    spectrogram: 'Intermittent horizontal delta bands remain stable in frequency and field.',
    source: TEMPORAL,
  },
  oirda: {
    title: 'Occipital intermittent rhythmic delta activity (OIRDA)',
    description:
      'Intermittent, approximately 3 Hz sinusoidal activity with a bilateral occipital maximum. The example contrasts organized rhythmic posterior delta with isolated posterior slow waves of youth.',
    keyFeatures: [
      'Synchronous posterior runs, maximal at O1/O2',
      'Smooth, monomorphic delta rather than a spike-wave complex',
      'No sustained evolution in frequency or spatial field',
    ],
    etiology: [
      'Seen in children, including those with absence or focal epilepsies; the pattern alone does not define an epilepsy syndrome.',
    ],
    differential: [
      'Posterior slow waves of youth with preserved alpha',
      'Occipital seizure',
      'Posterior artifact',
    ],
    pitfalls: [
      'Do not classify an occipital delta run as an absence seizure solely because its frequency is near 3 Hz.',
    ],
    spectrum: 'Occipital channels show a transient peak near 3 Hz with much less frontal power.',
    spectrogram:
      'Look for discrete, symmetric posterior delta bands without frequency progression.',
    source: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8353336/',
      'OIRDA in pediatric focal epilepsies: case series',
    ],
  },
  lrda: {
    title: 'Lateralized rhythmic delta activity (LRDA)',
    description: 'Sustained left-hemispheric rhythmic delta on a slowed background.',
    keyFeatures: [
      '1.5 Hz example without discharge-free intervals',
      'No evolution in this example',
    ],
    differential: ['LPDs: discrete discharges with intervals', 'Focal seizure'],
    pitfalls: ['LRDA is not automatically a seizure; assess modifiers and context.'],
    spectrum: 'Left-sided delta peak.',
    spectrogram: 'Sustained left-sided delta band.',
    source: ACNS,
  },
  bipds: {
    title: 'Bilateral independent periodic discharges (BIPDs)',
    description: 'Simultaneous periodic discharges generated independently in each hemisphere.',
    keyFeatures: ['Different repetition rates on each side', 'No fixed interhemispheric delay'],
    differential: ['Synchronous GPDs', 'Bilateral asynchronous LPDs'],
    pitfalls: ['Independence requires overlapping populations, not alternating sides.'],
    spectrum: 'Two different repetition rates.',
    spectrogram: 'Compare separate left/right discharge timing.',
    source: ACNS,
  },
  focal_status: {
    title: 'Focal electrographic status epilepticus',
    description:
      'An uninterrupted left-hemispheric ictal rhythm. This screen is an excerpt of a modeled prolonged episode.',
    keyFeatures: [
      'Persistent rhythmic activity with changing frequency and a sharp contour',
      'No intervening background recovery',
    ],
    differential: ['LRDA', 'Repeated discrete focal seizures'],
    pitfalls: [
      'ACNS electrographic status requires at least 10 continuous minutes of seizure activity, or a seizure burden of at least 20% in 60 minutes. A short excerpt alone cannot establish status.',
    ],
    spectrum: 'Sustained left-sided theta and harmonic power.',
    spectrogram: 'Continuous ictal power with slow frequency modulation.',
    source: ACNS,
  },
  generalized_status: {
    title: 'Generalized electrographic status epilepticus',
    description:
      'Sustained generalized 3.1 Hz spike-wave activity without inter-burst recovery, representing one possible status pattern.',
    keyFeatures: [
      'Bilateral synchronous discharges with a frontocentral maximum',
      'Activity continues while the simulation runs',
    ],
    differential: ['Brief generalized seizures', 'Generalized periodic discharges'],
    pitfalls: [
      'The duration framework for electrographic status applies. Clinical manifestations and treatment responses are not modeled; this is not a simulation of convulsive motor activity.',
    ],
    spectrum: 'Persistent spike-wave repetition rate and harmonics.',
    spectrogram: 'Uninterrupted generalized rhythmic and broadband discharge power.',
    source: ACNS,
  },
  gpfa: {
    title: 'Generalized paroxysmal fast activity (GPFA)',
    description:
      'Abrupt, brief bursts of generalized fast activity during a sleep background, with frontocentral predominance. This example uses a 16 Hz dominant component with intervening sleep background.',
    keyFeatures: [
      'Bilateral, synchronous fast bursts',
      'Frontocentral maximum with a broader cerebral field',
      'Sleep-associated recurrence with intervening background',
    ],
    etiology: [
      'Characteristic in Lennox–Gastaut syndrome when the other clinical and EEG criteria are present.',
    ],
    differential: [
      'Sleep spindles: waxing and waning sigma with sleep organization',
      'Muscle artifact: inspect field and video',
      'Tonic seizure: assess clinical correlation',
    ],
    pitfalls: [
      'A fast burst alone does not diagnose Lennox–Gastaut syndrome or establish a tonic seizure.',
    ],
    spectrum:
      'Transient frontocentral beta-range power is stronger during bursts than between them.',
    spectrogram:
      'Abrupt bilateral fast bands occur on the sleep background rather than a sustained beta increase.',
    source: [
      'https://www.epilepsydiagnosis.org/syndrome/lgs-eeg.html',
      'ILAE: Lennox–Gastaut syndrome EEG',
    ],
  },
  extreme_delta_brush: {
    title: 'Extreme delta brush',
    description:
      'Rhythmic delta with fast activity nested on recurring portions of the slow cycles.',
    keyFeatures: ['Generalized delta-plus-fast morphology'],
    differential: ['Medication-related beta with slowing', 'Neonatal delta brushes'],
    pitfalls: ['Associated with anti-NMDA receptor encephalitis but not diagnostic by itself.'],
    spectrum: 'Delta and beta components.',
    spectrogram: 'Fast packets follow slow-cycle timing.',
    source: ACNS,
  },
  suppressed_background: {
    title: 'Suppressed background',
    description: 'Persistent very low-voltage activity, distinct from burst-suppression.',
    keyFeatures: ['Under 10 µV throughout this example', 'No intervening bursts'],
    differential: ['Technical attenuation', 'Electrocerebral inactivity'],
    pitfalls: ['Suppression alone does not establish brain death or prognosis.'],
    spectrum: 'Very low total power.',
    spectrogram: 'Uniformly low energy without bursts.',
    source: ACNS,
  },
}

export const ADDITIONAL_FINDINGS = Object.entries(DETAILS).map(([id, detail]) => ({
  id,
  sandboxPattern: id,
  category: ADDITIONAL_PATTERN_CONFIG[id].group,
  color: ADDITIONAL_PATTERN_CONFIG[id].color,
  tags: [ADDITIONAL_PATTERN_CONFIG[id].label],
  ...detail,
}))

export const ADDITIONAL_PATTERN_ANALYSIS = Object.fromEntries(
  ADDITIONAL_FINDINGS.map(({ id, spectrum, spectrogram }) => [id, { spectrum, spectrogram }]),
)
