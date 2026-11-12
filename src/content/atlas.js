import { WAVEFORM_PATTERNS } from '@/engine/waveforms'
import { translateDisplay } from '@/i18n/localize'
import { CLINICAL_FINDINGS } from './clinicalFindings'

export const ATLAS_CATEGORIES = [
  ['waveforms', 'Waveforms'],
  ['awake', 'Normal awake EEG'],
  ['sleep', 'Normal sleep'],
  ['variants', 'Normal variants'],
  ['slowing', 'Slowing'],
  ['epileptiform', 'Epileptiform patterns'],
  ['periodic', 'Rhythmic and periodic patterns'],
  ['background', 'Abnormal background patterns'],
  ['activation', 'Activation procedures'],
  ['artifacts', 'Artifacts'],
]

export const ATLAS_KINDS = [
  ['waveform', 'Individual waveform'],
  ['pattern', 'Recording pattern'],
  ['comparison', 'Pattern comparison'],
]

// Explicit editorial decisions: a matching illustrative trace is not enough
// to merge two concepts (e.g. theta is not REM sleep or encephalopathy).
// Extra feature indices retain observations not already owned by the waveform
// table. Clinical context, differential, pitfalls and prognosis are retained.
export const MERGED_TOPICS = {
  mu: { waveform: 'mu', kind: 'waveform', extra: [] },
  central_midline_theta: { waveform: 'central_midline_theta', kind: 'waveform', extra: [3] },
  wicket_rhythm: { waveform: 'wicket_rhythm', kind: 'waveform', extra: [3, 4] },
  sreda: { waveform: 'sreda', kind: 'pattern', extra: [2] },
  small_sharp_spikes: { waveform: 'small_sharp_spikes', kind: 'waveform', extra: [4] },
  phantom_spike_wave: { waveform: 'phantom_spike_wave', kind: 'waveform', extra: [3, 4] },
  positive_spikes_14_6: { waveform: 'positive_spikes_14_6', kind: 'waveform', extra: [] },
  posterior_slow_waves_youth: {
    waveform: 'posterior_slow_waves_youth',
    kind: 'waveform',
    extra: [4],
  },
  spike_wave_3hz: { waveform: 'spike_wave', kind: 'pattern', extra: [2, 4] },
  birds: { waveform: 'birds', kind: 'pattern', extra: [3] },
  hypsarrhythmia: { waveform: 'hypsarrhythmia', kind: 'pattern', extra: [3] },
  gpds: { waveform: 'gpds', kind: 'pattern', extra: [3, 4] },
  lpds: { waveform: 'lpds', kind: 'pattern', extra: [2], context: [3] },
  triphasic: { waveform: 'triphasic_waves', kind: 'pattern', extra: [0] },
  focal_slowing: { waveform: 'focal_slowing', kind: 'pattern', extra: [0, 4] },
  firda: { waveform: 'firda', kind: 'pattern', extra: [4] },
  breach_rhythm: { waveform: 'breach_rhythm', kind: 'waveform', extra: [3] },
  burst_suppression: { waveform: 'burst_suppression', kind: 'pattern', extra: [], context: [4] },
}

// These links describe components or comparisons, never diagnostic equivalence.
const COMPONENTS = {
  tirda: ['focal_slowing', 'theta'],
  oirda: ['delta', 'posterior_slow_waves_youth'],
  lrda: ['focal_slowing', 'lpds'],
  bipds: ['lpds', 'gpds'],
  focal_status: ['birds', 'theta', 'lpds'],
  generalized_status: ['spike_wave', 'gpds'],
  gpfa: ['sleep_spindle', 'polyspike'],
  extreme_delta_brush: ['delta', 'beta'],
  suppressed_background: ['burst_suppression'],
  normal_awake: ['alpha', 'beta'],
  drowsy: ['theta', 'vertex_sharp_wave', 'posts'],
  normal_sleep: ['sleep_spindle', 'k_complex', 'vertex_sharp_wave', 'posts'],
  slow_wave_sleep: ['delta', 'k_complex'],
  rem_sleep: ['theta'],
  activation_procedures: ['delta'],
  fast_alpha_variant: ['alpha'],
  rmtd: ['theta'],
  lambda_posts: ['lambda_waves', 'posts'],
  slow_spike_wave: ['spike_wave'],
  polyspike_jme: ['polyspike'],
  centrotemporal_spikes: ['spike', 'sharp_wave'],
  temporal_sharps: ['spike', 'sharp_wave'],
  photoparoxysmal: ['polyspike', 'spike_wave'],
  diffuse_slowing: ['theta', 'delta'],
  alpha_coma: ['alpha', 'beta', 'sleep_spindle'],
  // Deliberately no beta illustration for electrocerebral inactivity.
  electrocerebral_silence: [],
}

const COMPONENT_EXCLUSIONS = {
  normal_awake: [0, 1], // The alpha entry owns frequency and eye-opening response.
  normal_sleep: [0, 1], // The spindle and K-complex entries own their measurements.
  lambda_posts: [0, 1, 3], // Compare states here; inspect each waveform in its entry.
}

const RECORDING_OVERVIEWS = {
  normal_awake:
    'Assess the awake recording as a whole: posterior organisation, symmetry, background activity, and response to eye opening. The alpha and beta entries describe the individual rhythms.',
  normal_sleep:
    'Review sleep spindles and K-complexes together within the surrounding sleep background. Follow the component links for their morphology and measurements; use this entry to assess the N2 recording as a whole.',
  lambda_posts:
    'Compare two occipital transients by their recording state: lambda during awake visual scanning and POSTS in light sleep. The separate waveform entries describe their morphology and measurements.',
}

function categoryForFinding(finding) {
  if (finding.id === 'activation_procedures' || finding.id === 'photoparoxysmal')
    return 'activation'
  if (finding.id === 'normal_awake') return 'awake'
  if (finding.category === 'coma') return 'background'
  if (finding.category === 'normal') return 'sleep'
  if (finding.category === 'benign_variant' || finding.id === 'breach_rhythm') return 'variants'
  if (finding.category === 'abnormal') return 'slowing'
  return finding.category
}

function categoryForWaveform(waveform) {
  if (['alpha', 'beta', 'theta', 'delta'].includes(waveform.id)) return 'waveforms'
  if (waveform.id === 'lambda_waves') return 'variants'
  if (waveform.group === 'artifact') return 'artifacts'
  return waveform.group === 'abnormal' ? 'slowing' : waveform.group
}

function simulationFor(pattern, label) {
  if (!pattern) return null
  const average = [
    'mu_rhythm',
    'central_midline_theta',
    'lambda_waves',
    'phantom_spike_wave',
    'posterior_slow_waves_youth',
  ].includes(pattern)
  return {
    pattern,
    label,
    montageId:
      pattern === 'positive_spikes_14_6'
        ? 'referential_ears'
        : average
          ? 'average_reference'
          : 'longitudinal_bipolar',
    eyesClosed: pattern !== 'lambda_waves',
  }
}

const waveformOwners = Object.fromEntries(
  Object.entries(MERGED_TOPICS).map(([id, topic]) => [topic.waveform, id]),
)

const clinicalEntries = CLINICAL_FINDINGS.map((finding) => {
  const merge = MERGED_TOPICS[finding.id]
  const waveform = merge ? WAVEFORM_PATTERNS[merge.waveform] : null
  const exclude = COMPONENT_EXCLUSIONS[finding.id] ?? []
  return {
    id: finding.id,
    title: finding.title,
    kind: merge?.kind ?? (finding.id === 'lambda_posts' ? 'comparison' : 'pattern'),
    category: categoryForFinding(finding),
    color: finding.color,
    waveform,
    finding,
    summary: waveform?.morphology ?? RECORDING_OVERVIEWS[finding.id] ?? finding.description,
    overview: RECORDING_OVERVIEWS[finding.id] ?? finding.description,
    features: merge
      ? merge.extra.map((index) => finding.keyFeatures[index])
      : finding.keyFeatures.filter((_, index) => !exclude.includes(index)),
    contextFeatures: (merge?.context ?? []).map((index) => finding.keyFeatures[index]),
    componentIds: (COMPONENTS[finding.id] ?? []).map((id) => waveformOwners[id] ?? id),
    simulation: simulationFor(
      finding.sandboxPattern ?? (finding.id === 'rem_sleep' ? 'normal_rem' : null),
      finding.title,
    ),
    aliases: [finding.id, ...(finding.tags ?? []), waveform?.label, waveform?.id].filter(Boolean),
  }
})

const standaloneWaveforms = Object.values(WAVEFORM_PATTERNS)
  .filter((waveform) => !waveformOwners[waveform.id])
  .map((waveform) => ({
    id: waveform.id,
    title: waveform.label,
    kind: 'waveform',
    category: categoryForWaveform(waveform),
    color: waveform.color,
    waveform,
    finding: null,
    summary: waveform.morphology,
    features: [],
    contextFeatures: [],
    componentIds: [],
    simulation: simulationFor(
      waveform.id === 'lambda_waves' ? 'lambda_waves' : null,
      waveform.label,
    ),
    artifactId:
      waveform.id === 'muscle_artifact'
        ? 'muscle'
        : waveform.id === 'eye_blink'
          ? 'eye_blink'
          : null,
    aliases: [waveform.id, waveform.label],
  }))

export const ATLAS_ENTRIES = [...clinicalEntries, ...standaloneWaveforms]
export const ATLAS_BY_ID = Object.assign(
  Object.create(null),
  Object.fromEntries(ATLAS_ENTRIES.map((entry) => [entry.id, entry])),
)

export function atlasPath(id) {
  return `/atlas/${encodeURIComponent(id)}`
}

export function canonicalWaveformId(id) {
  return Object.hasOwn(WAVEFORM_PATTERNS, id) ? (waveformOwners[id] ?? id) : null
}

export function canonicalFindingId(id) {
  return clinicalEntries.some((entry) => entry.id === id) ? id : null
}

export function relatedEntries(entry) {
  const ids = new Set([
    ...entry.componentIds,
    ...ATLAS_ENTRIES.filter((other) => other.componentIds.includes(entry.id)).map(
      (other) => other.id,
    ),
  ])
  return [...ids].map((id) => ATLAS_BY_ID[id]).filter(Boolean)
}

// Keep basic rhythms and sleep stages in teaching order within their groups.
const TOPIC_ORDER = [
  'alpha',
  'beta',
  'theta',
  'delta',
  'spike',
  'sharp_wave',
  'polyspike',
  'normal_awake',
  'drowsy',
  'normal_sleep',
  'slow_wave_sleep',
  'rem_sleep',
  'sleep_spindle',
  'k_complex',
  'vertex_sharp_wave',
  'posts',
]

function topicOrder(entry) {
  const index = TOPIC_ORDER.indexOf(entry.id)
  return index < 0 ? TOPIC_ORDER.length : index
}

export function searchAtlas(query = '', category = 'all', kind = 'all') {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return ATLAS_ENTRIES.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false
    if (kind !== 'all' && entry.kind !== kind) return false
    const searchValues = [
      entry.title,
      entry.summary,
      ...entry.aliases,
      entry.waveform?.location,
      entry.waveform?.freq,
      entry.finding?.description,
      ...(entry.finding?.etiology ?? []),
      ...(entry.finding?.differential ?? []),
    ]
    const text = [...searchValues, ...searchValues.map((value) => translateDisplay(value))]
      .join(' ')
      .toLowerCase()
    return terms.every((term) => text.includes(term))
  }).sort((a, b) => {
    const titleMatch = (entry) =>
      terms.length && terms.every((term) => `${entry.title} ${translateDisplay(entry.title)}`.toLowerCase().includes(term)) ? 1 : 0
    return (
      titleMatch(b) - titleMatch(a) ||
      topicOrder(a) - topicOrder(b) ||
      a.title.localeCompare(b.title)
    )
  })
}
