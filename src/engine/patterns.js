/**
 * Central pattern metadata used by the Sandbox UI and engine tests.
 *
 * Keep this registry lightweight: detailed teaching copy still lives in the
 * Findings/Waveforms pages, while this file prevents the live generator from
 * drifting away from the pattern selector.
 */

export const EEG_REFERENCE_LINKS = {
  acnsCriticalCare2021:
    'https://www.acns.org/UserFiles/file/ACNSStandardizedCriticalCareEEGTerminology_rev2021.pdf',
  acnsEci2016:
    'https://www.acns.org/UserFiles/file/Guideline6-MinimumTechnicalStandardsforEEGRecordinginSuspectedCerebralDeath.pdf',
  acnsElectrodeNomenclature:
    'https://www.acns.org/UserFiles/file/Guideline2-GuidelinesforStandardElectrodePositionNomenclature.pdf',
  ilaeIfcnMinimumStandards:
    'https://www.ilae.org/files/dmfile/eeg-minimum-standards.pdf',
  eegGlossary2017:
    'https://bcneps.org/wp-content/uploads/2021/01/Glossary.pdf',
}

export const PATTERN_GROUPS = [
  {
    id: 'normal',
    label: 'Normal',
    color: '#00FFB0',
    patterns: [
      { id: 'normal_awake', label: 'Awake', color: '#00FFB0', implemented: true },
      { id: 'normal_drowsy', label: 'Drowsy (N1)', color: '#88DDAA', implemented: true },
      { id: 'normal_sleep', label: 'Stage N2', color: '#00D4FF', implemented: true },
      { id: 'slow_wave_sleep', label: 'Slow Wave (N3)', color: '#7B5EA7', implemented: true },
    ],
  },
  {
    id: 'epileptiform',
    label: 'Epileptiform',
    color: '#FF4444',
    patterns: [
      { id: 'absence', label: '3 Hz Absence', color: '#FF4444', implemented: true },
      { id: 'slow_spike_wave', label: 'Slow S/W (LGS)', color: '#FF3377', implemented: true },
      { id: 'polyspike_jme', label: 'JME Polyspike', color: '#FF0066', implemented: true },
      {
        id: 'centrotemporal_spikes',
        label: 'SeLECTS / BECTS',
        color: '#FF6B35',
        implemented: true,
        aliases: ['BECTS', 'Rolandic epilepsy'],
      },
      { id: 'temporal_sharps', label: 'TLE Sharps', color: '#FF5544', implemented: true },
      { id: 'hypsarrhythmia', label: 'Hypsarrhythmia', color: '#FF2255', implemented: true },
      { id: 'photoparoxysmal', label: 'Photoparoxysmal', color: '#FF8866', implemented: true },
    ],
  },
  {
    id: 'periodic',
    label: 'Periodic (ICU)',
    color: '#FFA552',
    patterns: [
      { id: 'gpds', label: 'GPDs', color: '#FFA552', implemented: true },
      { id: 'lpds', label: 'LPDs', color: '#FF8B40', implemented: true },
      { id: 'triphasic_waves', label: 'Triphasic Waves', color: '#FFB347', implemented: true },
    ],
  },
  {
    id: 'abnormal',
    label: 'Non-Epileptiform',
    color: '#FFD166',
    patterns: [
      { id: 'focal_slowing', label: 'Focal Slowing', color: '#FFD166', implemented: true },
      { id: 'firda', label: 'FIRDA', color: '#FFC27A', implemented: true },
      { id: 'diffuse_slowing', label: 'Diffuse Slowing', color: '#FFDC7A', implemented: true },
      { id: 'breach_rhythm', label: 'Breach Rhythm', color: '#BFA4FF', implemented: true },
    ],
  },
  {
    id: 'coma',
    label: 'Coma Patterns',
    color: '#A0A0FF',
    patterns: [
      { id: 'burst_suppression', label: 'Burst-Suppression', color: '#A0A0FF', implemented: true },
      { id: 'alpha_coma', label: 'Alpha Coma', color: '#99AACC', implemented: true },
      {
        id: 'electrocerebral_silence',
        label: 'ECI (Brain Death)',
        color: '#6B7BA0',
        implemented: true,
        aliases: ['ECS', 'Electrocerebral inactivity'],
      },
    ],
  },
]

export const SANDBOX_PATTERN_IDS = PATTERN_GROUPS.flatMap(group =>
  group.patterns.map(pattern => pattern.id),
)

export const PATTERN_REGISTRY = Object.fromEntries(
  PATTERN_GROUPS.flatMap(group =>
    group.patterns.map(pattern => [
      pattern.id,
      {
        ...pattern,
        groupId: group.id,
        groupLabel: group.label,
      },
    ]),
  ),
)

export function getPatternMeta(id) {
  return PATTERN_REGISTRY[id] ?? null
}
