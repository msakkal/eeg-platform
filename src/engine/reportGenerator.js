import { translateDisplay, formatText, literalText } from '@/i18n/localize'
export const DEFAULT_REPORT_DATA = {
  study: {
    type: 'Routine EEG',
    modality: 'digital video EEG',
    duration: '30 minutes',
    electrodeSystem: 'international 10–20 system',
    channels: '21',
    states: ['awake', 'drowsy', 'sleep'],
    activations: ['hyperventilation', 'photic stimulation'],
    indication: '',
    medications: '',
    limitations: 'None',
  },
  background: {
    continuity: 'continuous',
    organization: 'well organized',
    symmetry: 'symmetric',
    voltage: 'normal voltage',
    predominantFrequencies: 'alpha and beta frequencies',
    pdrPresent: true,
    pdrFrequency: '10',
    pdrSymmetry: 'symmetric',
    pdrReactive: true,
    apGradient: 'present',
    variability: 'present',
    reactivity: 'present',
  },
  sleep: {
    obtained: true,
    stages: 'N1 and N2 sleep',
    architecture: 'normal',
    vertexWaves: 'present and symmetric',
    spindles: 'present and symmetric',
    kComplexes: 'present',
    notes: '',
  },
  slowing: {
    present: false,
    distribution: 'focal',
    location: 'left temporal region',
    frequency: 'theta and delta',
    prevalence: 'occasional',
    persistence: 'intermittent',
    rhythmicity: 'polymorphic',
  },
  epileptiform: {
    present: false,
    distribution: 'focal',
    location: 'left temporal region',
    morphology: 'sharp waves',
    prevalence: 'rare',
    state: 'during sleep',
    field: 'with a plausible physiologic field',
  },
  rhythmicPeriodic: {
    present: false,
    distribution: 'lateralized',
    pattern: 'periodic discharges',
    location: 'left hemisphere',
    frequency: '1',
    prevalence: 'occasional',
    modifiers: 'without plus modifiers',
    stimulusInduced: false,
  },
  events: {
    status: 'none',
    eventDescription: 'the patient’s typical event',
    eventCount: 'one',
    seizureType: 'electroclinical',
    onset: 'left temporal region',
    evolution: 'with evolution in frequency and morphology',
    duration: '60 seconds',
    clinicalCorrelate: 'behavioral arrest',
  },
  activation: {
    hyperventilation: 'no abnormal activation',
    photic: 'symmetric photic driving without a photoparoxysmal response',
  },
  impression: {
    correlation: '',
    customFinding: '',
    customImpression: '',
  },
}

export function generateEEGReport(data, language) {
  language = ['de', 'ar'].includes(language?.split('-')[0]) ? language : undefined
  const userText = new Set(
    [
      data.study.indication,
      data.study.medications,
      data.sleep.notes,
      data.impression.correlation,
      data.impression.customFinding,
      data.impression.customImpression,
    ]
      .filter(Boolean)
      .flatMap((value) => [clean(value), capitalize(value), sentence(value)]),
  )
  const tr = (value) =>
    language && !userText.has(value) ? translateDisplay(value, language) : value
  const fmt = (key, values) =>
    language
      ? formatText(
          key,
          values.map((value) => (userText.has(value) ? literalText(value) : value)),
          language,
        )
      : key.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ''))

  const technique = buildTechnique(data.study)
  const background = buildBackground(data.background)
  const sleep = buildSleep(data.sleep)
  const activation = buildActivation(data.study, data.activation)
  const abnormalities = buildAbnormalities(data)
  const events = buildEvents(data.events)
  const impression = buildImpression(data)

  const sections = [
    ['TECHNIQUE', technique],
    ['BACKGROUND', background],
    ['SLEEP', sleep],
    ['ACTIVATION PROCEDURES', activation],
    ['ABNORMAL FINDINGS', abnormalities],
    ['EVENTS / SEIZURES', events],
    ['IMPRESSION', impression],
  ]

  if (clean(data.impression.correlation)) {
    sections.push(['CLINICAL CORRELATION', sentence(data.impression.correlation)])
  }

  return `${tr('EEG REPORT — DRAFT FOR REVIEW')}\n\n${sections.map(([title, body]) => `${tr(title)}\n${body}`).join('\n\n')}`

  function buildTechnique(study) {
    const states = joinList(study.states)
    const activation = joinList(study.activations)
    const lines = [
      fmt(
        'This is a {0} consisting of {1}-channel {2} recorded for {3} using electrodes placed according to the {4}.',
        [
          lowerFirst(study.type),
          article(study.channels),
          clean(study.modality),
          clean(study.duration),
          clean(study.electrodeSystem),
        ],
      ),
      states ? fmt('The recording includes {0}.', [states]) : '',
      activation
        ? fmt('{0} {1} performed.', [
            capitalize(activation),
            study.activations.length === 1 ? 'was' : 'were',
          ])
        : 'No activation procedures were performed.',
      clean(study.indication) ? fmt('Indication: {0}', [sentence(study.indication)]) : '',
      clean(study.medications)
        ? fmt('Relevant medications: {0}', [sentence(study.medications)])
        : '',
      clean(study.limitations) && study.limitations !== 'None'
        ? fmt('Technical limitations: {0}', [sentence(study.limitations)])
        : 'There were no significant technical limitations.',
    ]
    return lines.filter(Boolean).map(tr).join(' ')
  }

  function buildBackground(background) {
    const lines = [
      fmt('The background is {0}, {1}, {2}, and of {3}, with predominantly {4}.', [
        clean(background.continuity),
        clean(background.organization),
        clean(background.symmetry),
        clean(background.voltage),
        clean(background.predominantFrequencies),
      ]),
      fmt('An anterior–posterior gradient is {0}.', [clean(background.apGradient)]),
    ]

    if (background.pdrPresent) {
      lines.push(
        fmt('A {0} Hz posterior dominant rhythm is present, {1}, and {2}.', [
          clean(background.pdrFrequency),
          clean(background.pdrSymmetry),
          background.pdrReactive
            ? 'attenuates with eye opening'
            : 'does not clearly attenuate with eye opening',
        ]),
      )
    } else {
      lines.push('A posterior dominant rhythm is not identified.')
    }

    lines.push(
      fmt('Spontaneous variability is {0}, and reactivity to stimulation is {1}.', [
        clean(background.variability),
        clean(background.reactivity),
      ]),
    )
    return lines.map(tr).join(' ')
  }

  function buildSleep(sleep) {
    if (!sleep.obtained) return tr('Sleep was not obtained.')

    const lines = [
      fmt('{0} was obtained with {1} sleep architecture.', [
        capitalize(clean(sleep.stages)),
        clean(sleep.architecture),
      ]),
      fmt('Vertex waves are {0}; sleep spindles are {1}; K-complexes are {2}.', [
        clean(sleep.vertexWaves),
        clean(sleep.spindles),
        clean(sleep.kComplexes),
      ]),
      clean(sleep.notes) ? sentence(sleep.notes) : '',
    ]
    return lines.filter(Boolean).map(tr).join(' ')
  }

  function buildActivation(study, activation) {
    const lines = []
    if (study.activations.includes('hyperventilation')) {
      lines.push(fmt('Hyperventilation produced {0}.', [clean(activation.hyperventilation)]))
    }
    if (study.activations.includes('photic stimulation')) {
      lines.push(fmt('Intermittent photic stimulation produced {0}.', [clean(activation.photic)]))
    }
    return lines.length ? lines.map(tr).join(' ') : tr('No activation procedures were performed.')
  }

  function buildAbnormalities(data) {
    const lines = []
    const { slowing, epileptiform, rhythmicPeriodic, impression } = data

    if (slowing.present) {
      const location =
        slowing.distribution === 'generalized'
          ? 'throughout both hemispheres'
          : fmt('maximal in the {0}', [clean(slowing.location)])
      lines.push(
        fmt('{0} {1}, {2} {3} slowing is seen {4}.', [
          capitalize(clean(slowing.prevalence)),
          clean(slowing.persistence),
          clean(slowing.rhythmicity),
          clean(slowing.frequency),
          location,
        ]),
      )
    }

    if (epileptiform.present) {
      const location =
        epileptiform.distribution === 'generalized'
          ? 'with generalized distribution'
          : fmt('maximal in the {0}', [clean(epileptiform.location)])
      lines.push(
        fmt('{0} {1} are seen {2}, {3}, most prominently {4}.', [
          capitalize(clean(epileptiform.prevalence)),
          clean(epileptiform.morphology),
          location,
          clean(epileptiform.field),
          clean(epileptiform.state),
        ]),
      )
    }

    if (rhythmicPeriodic.present) {
      const stimulus = rhythmicPeriodic.stimulusInduced ? ' and are stimulus-induced' : ''
      lines.push(
        fmt('{0} {1} are present over the {2} at {3} Hz, are {4}, {5}{6}.', [
          capitalize(rhythmicPeriodic.distribution),
          clean(rhythmicPeriodic.pattern),
          clean(rhythmicPeriodic.location),
          clean(rhythmicPeriodic.frequency),
          clean(rhythmicPeriodic.prevalence),
          clean(rhythmicPeriodic.modifiers),
          stimulus,
        ]),
      )
    }

    if (data.sleep.obtained && data.sleep.kComplexes.includes('dyshormia')) {
      lines.push(
        'Epileptiform discharges are associated with K-complexes during NREM sleep (dyshormia).',
      )
    }

    if (
      data.study.activations.includes('hyperventilation') &&
      data.activation.hyperventilation.includes('epileptiform')
    ) {
      lines.push(fmt('Hyperventilation activated {0}.', [clean(data.activation.hyperventilation)]))
    }
    if (
      data.study.activations.includes('photic stimulation') &&
      data.activation.photic === 'a photoparoxysmal response'
    ) {
      lines.push('Intermittent photic stimulation produced a photoparoxysmal response.')
    }

    if (clean(impression.customFinding)) lines.push(sentence(impression.customFinding))
    return lines.length
      ? lines.map(tr).join(' ')
      : tr(
          'No focal slowing, epileptiform discharges, or rhythmic/periodic abnormalities are identified.',
        )
  }

  function buildEvents(events) {
    if (events.status === 'none')
      return tr('No clinical events or electrographic seizures were recorded.')

    if (events.status === 'no_correlate') {
      return fmt('{0} described as {1} {2} captured without an associated ictal EEG pattern.', [
        countPhrase(events.eventCount, 'event'),
        clean(events.eventDescription),
        isSingularCount(events.eventCount) ? 'was' : 'were',
      ])
    }

    const clinical =
      events.seizureType === 'electroclinical'
        ? fmt(', with a clinical correlate of {0}', [clean(events.clinicalCorrelate)])
        : ', without a definite clinical correlate'
    return fmt('{0} {1} recorded, arising from the {2}, {3}, lasting approximately {4}{5}.', [
      countPhrase(events.eventCount, `${clean(events.seizureType)} seizure`),
      isSingularCount(events.eventCount) ? 'was' : 'were',
      clean(events.onset),
      clean(events.evolution),
      clean(events.duration),
      clinical,
    ])
  }

  function buildImpression(data) {
    const findings = []
    const { background, slowing, epileptiform, rhythmicPeriodic, events, sleep, impression } = data

    if (background.continuity !== 'continuous' || background.organization !== 'well organized') {
      findings.push(
        fmt('Abnormal background characterized by {0} continuity and {1} organization.', [
          clean(background.continuity),
          clean(background.organization),
        ]),
      )
    }
    if (background.symmetry !== 'symmetric') {
      findings.push(fmt('Background activity is {0}.', [clean(background.symmetry)]))
    }
    if (slowing.present) {
      findings.push(
        slowing.distribution === 'generalized'
          ? fmt(
              '{0} generalized {1} slowing, consistent with diffuse cerebral dysfunction in the appropriate clinical context.',
              [capitalize(clean(slowing.prevalence)), clean(slowing.frequency)],
            )
          : fmt(
              '{0} {1} slowing over the {2}, suggesting focal cerebral dysfunction in that region.',
              [
                capitalize(clean(slowing.prevalence)),
                clean(slowing.frequency),
                clean(slowing.location),
              ],
            ),
      )
    }
    if (epileptiform.present) {
      findings.push(
        epileptiform.distribution === 'generalized'
          ? fmt(
              '{0} generalized {1}, indicating an increased propensity for generalized seizures.',
              [capitalize(clean(epileptiform.prevalence)), clean(epileptiform.morphology)],
            )
          : fmt(
              '{0} {1} over the {2}, indicating an increased propensity for focal seizures arising from that region.',
              [
                capitalize(clean(epileptiform.prevalence)),
                clean(epileptiform.morphology),
                clean(epileptiform.location),
              ],
            ),
      )
    }
    if (rhythmicPeriodic.present) {
      findings.push(
        fmt('{0} {1} at {2} Hz over the {3}.', [
          capitalize(rhythmicPeriodic.distribution),
          clean(rhythmicPeriodic.pattern),
          clean(rhythmicPeriodic.frequency),
          clean(rhythmicPeriodic.location),
        ]),
      )
    }
    if (sleep.obtained && sleep.kComplexes.includes('dyshormia')) {
      findings.push(
        'Epileptiform discharges associated with K-complexes during NREM sleep (dyshormia).',
      )
    }
    if (
      data.study.activations.includes('hyperventilation') &&
      data.activation.hyperventilation.includes('epileptiform')
    ) {
      findings.push('Epileptiform discharges activated by hyperventilation.')
    }
    if (
      data.study.activations.includes('photic stimulation') &&
      data.activation.photic === 'a photoparoxysmal response'
    ) {
      findings.push('Photoparoxysmal response during intermittent photic stimulation.')
    }
    if (events.status === 'seizures') {
      findings.push(
        fmt('{0} arising from the {1}.', [
          countPhrase(events.eventCount, `${clean(events.seizureType)} seizure`),
          clean(events.onset),
        ]),
      )
    } else if (events.status === 'no_correlate') {
      findings.push(fmt('Captured clinical event(s) without an associated ictal EEG pattern.', []))
    }
    if (clean(impression.customImpression)) findings.push(sentence(impression.customImpression))
    else if (clean(impression.customFinding))
      findings.push(
        'Additional finding described above; clinical significance requires interpretation.',
      )

    if (!findings.length) {
      if (data.study.limitations === 'Recording is technically limited') {
        return fmt(
          'Technically limited {0} EEG. No epileptiform discharges or electrographic seizures are identified within the interpretable portions.',
          [sleep.obtained ? 'awake and asleep' : 'awake'],
        )
      }
      return fmt(
        'Normal {0} EEG. No epileptiform discharges or electrographic seizures were recorded.',
        [sleep.obtained ? 'awake and asleep' : 'awake'],
      )
    }

    return findings.map((finding, index) => `${index + 1}. ${tr(finding)}`).join('\n')
  }

  function clean(value) {
    return String(value ?? '').trim()
  }

  function sentence(value) {
    const text = capitalize(value)
    if (!text) return ''
    return /[.!?]$/.test(text) ? text : `${text}.`
  }

  function capitalize(value) {
    const text = clean(value)
    return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
  }

  function joinList(items = []) {
    if (items.length < 2) return items[0] || ''
    if (items.length === 2) return fmt('{0} and {1}', [items[0], items[1]])
    return fmt('{0}, and {1}', [items.slice(0, -1).map(tr).join(', '), items.at(-1)])
  }

  function article(value) {
    if (language) return clean(value)
    return /^[aeiou]/i.test(clean(value)) ? `an ${clean(value)}` : `a ${clean(value)}`
  }

  function lowerFirst(value) {
    const text = clean(value)
    return text ? `${text[0].toLowerCase()}${text.slice(1)}` : ''
  }

  function isSingularCount(value) {
    return clean(value).toLowerCase() === 'one' || clean(value) === '1'
  }

  function countPhrase(value, noun) {
    const count = capitalize(value)
    return tr(`${count} ${noun}${isSingularCount(value) ? '' : 's'}`)
  }
}
