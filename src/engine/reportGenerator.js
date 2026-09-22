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

export function generateEEGReport(data) {
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

  return `EEG REPORT — DRAFT FOR REVIEW\n\n${sections.map(([title, body]) => `${title}\n${body}`).join('\n\n')}`
}

function buildTechnique(study) {
  const states = joinList(study.states)
  const activation = joinList(study.activations)
  const lines = [
    `This is a ${lowerFirst(study.type)} consisting of ${article(study.channels)}-channel ${clean(study.modality)} recorded for ${clean(study.duration)} using electrodes placed according to the ${clean(study.electrodeSystem)}.`,
    states ? `The recording includes ${states}.` : '',
    activation
      ? `${capitalize(activation)} ${study.activations.length === 1 ? 'was' : 'were'} performed.`
      : 'No activation procedures were performed.',
    clean(study.indication) ? `Indication: ${sentence(study.indication)}` : '',
    clean(study.medications) ? `Relevant medications: ${sentence(study.medications)}` : '',
    clean(study.limitations) && study.limitations !== 'None'
      ? `Technical limitations: ${sentence(study.limitations)}`
      : 'There were no significant technical limitations.',
  ]
  return lines.filter(Boolean).join(' ')
}

function buildBackground(background) {
  const lines = [
    `The background is ${clean(background.continuity)}, ${clean(background.organization)}, ${clean(background.symmetry)}, and of ${clean(background.voltage)}, with predominantly ${clean(background.predominantFrequencies)}.`,
    `An anterior–posterior gradient is ${clean(background.apGradient)}.`,
  ]

  if (background.pdrPresent) {
    lines.push(
      `A ${clean(background.pdrFrequency)} Hz posterior dominant rhythm is present, ${clean(background.pdrSymmetry)}, and ${background.pdrReactive ? 'attenuates with eye opening' : 'does not clearly attenuate with eye opening'}.`,
    )
  } else {
    lines.push('A posterior dominant rhythm is not identified.')
  }

  lines.push(
    `Spontaneous variability is ${clean(background.variability)}, and reactivity to stimulation is ${clean(background.reactivity)}.`,
  )
  return lines.join(' ')
}

function buildSleep(sleep) {
  if (!sleep.obtained) return 'Sleep was not obtained.'

  const lines = [
    `${capitalize(clean(sleep.stages))} was obtained with ${clean(sleep.architecture)} sleep architecture.`,
    `Vertex waves are ${clean(sleep.vertexWaves)}; sleep spindles are ${clean(sleep.spindles)}; K-complexes are ${clean(sleep.kComplexes)}.`,
    clean(sleep.notes) ? sentence(sleep.notes) : '',
  ]
  return lines.filter(Boolean).join(' ')
}

function buildActivation(study, activation) {
  const lines = []
  if (study.activations.includes('hyperventilation')) {
    lines.push(`Hyperventilation produced ${clean(activation.hyperventilation)}.`)
  }
  if (study.activations.includes('photic stimulation')) {
    lines.push(`Intermittent photic stimulation produced ${clean(activation.photic)}.`)
  }
  return lines.length ? lines.join(' ') : 'No activation procedures were performed.'
}

function buildAbnormalities(data) {
  const lines = []
  const { slowing, epileptiform, rhythmicPeriodic, impression } = data

  if (slowing.present) {
    const location =
      slowing.distribution === 'generalized'
        ? 'throughout both hemispheres'
        : `maximal in the ${clean(slowing.location)}`
    lines.push(
      `${capitalize(clean(slowing.prevalence))} ${clean(slowing.persistence)}, ${clean(slowing.rhythmicity)} ${clean(slowing.frequency)} slowing is seen ${location}.`,
    )
  }

  if (epileptiform.present) {
    const location =
      epileptiform.distribution === 'generalized'
        ? 'with generalized distribution'
        : `maximal in the ${clean(epileptiform.location)}`
    lines.push(
      `${capitalize(clean(epileptiform.prevalence))} ${clean(epileptiform.morphology)} are seen ${location}, ${clean(epileptiform.field)}, most prominently ${clean(epileptiform.state)}.`,
    )
  }

  if (rhythmicPeriodic.present) {
    const stimulus = rhythmicPeriodic.stimulusInduced ? ' and are stimulus-induced' : ''
    lines.push(
      `${capitalize(rhythmicPeriodic.distribution)} ${clean(rhythmicPeriodic.pattern)} are present over the ${clean(rhythmicPeriodic.location)} at ${clean(rhythmicPeriodic.frequency)} Hz, are ${clean(rhythmicPeriodic.prevalence)}, ${clean(rhythmicPeriodic.modifiers)}${stimulus}.`,
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
    lines.push(`Hyperventilation activated ${clean(data.activation.hyperventilation)}.`)
  }
  if (
    data.study.activations.includes('photic stimulation') &&
    data.activation.photic === 'a photoparoxysmal response'
  ) {
    lines.push('Intermittent photic stimulation produced a photoparoxysmal response.')
  }

  if (clean(impression.customFinding)) lines.push(sentence(impression.customFinding))
  return lines.length
    ? lines.join(' ')
    : 'No focal slowing, epileptiform discharges, or rhythmic/periodic abnormalities are identified.'
}

function buildEvents(events) {
  if (events.status === 'none')
    return 'No clinical events or electrographic seizures were recorded.'

  if (events.status === 'no_correlate') {
    return `${countPhrase(events.eventCount, 'event')} described as ${clean(events.eventDescription)} ${isSingularCount(events.eventCount) ? 'was' : 'were'} captured without an associated ictal EEG pattern.`
  }

  const clinical =
    events.seizureType === 'electroclinical'
      ? `, with a clinical correlate of ${clean(events.clinicalCorrelate)}`
      : ', without a definite clinical correlate'
  return `${countPhrase(events.eventCount, `${clean(events.seizureType)} seizure`)} ${isSingularCount(events.eventCount) ? 'was' : 'were'} recorded, arising from the ${clean(events.onset)}, ${clean(events.evolution)}, lasting approximately ${clean(events.duration)}${clinical}.`
}

function buildImpression(data) {
  const findings = []
  const { background, slowing, epileptiform, rhythmicPeriodic, events, sleep, impression } = data

  if (background.continuity !== 'continuous' || background.organization !== 'well organized') {
    findings.push(
      `Abnormal background characterized by ${clean(background.continuity)} continuity and ${clean(background.organization)} organization.`,
    )
  }
  if (background.symmetry !== 'symmetric') {
    findings.push(`Background activity is ${clean(background.symmetry)}.`)
  }
  if (slowing.present) {
    findings.push(
      slowing.distribution === 'generalized'
        ? `${capitalize(clean(slowing.prevalence))} generalized ${clean(slowing.frequency)} slowing, consistent with diffuse cerebral dysfunction in the appropriate clinical context.`
        : `${capitalize(clean(slowing.prevalence))} ${clean(slowing.frequency)} slowing over the ${clean(slowing.location)}, suggesting focal cerebral dysfunction in that region.`,
    )
  }
  if (epileptiform.present) {
    findings.push(
      epileptiform.distribution === 'generalized'
        ? `${capitalize(clean(epileptiform.prevalence))} generalized ${clean(epileptiform.morphology)}, indicating an increased propensity for generalized seizures.`
        : `${capitalize(clean(epileptiform.prevalence))} ${clean(epileptiform.morphology)} over the ${clean(epileptiform.location)}, indicating an increased propensity for focal seizures arising from that region.`,
    )
  }
  if (rhythmicPeriodic.present) {
    findings.push(
      `${capitalize(rhythmicPeriodic.distribution)} ${clean(rhythmicPeriodic.pattern)} at ${clean(rhythmicPeriodic.frequency)} Hz over the ${clean(rhythmicPeriodic.location)}.`,
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
      `${countPhrase(events.eventCount, `${clean(events.seizureType)} seizure`)} arising from the ${clean(events.onset)}.`,
    )
  } else if (events.status === 'no_correlate') {
    findings.push(`Captured clinical event(s) without an associated ictal EEG pattern.`)
  }
  if (clean(impression.customImpression)) findings.push(sentence(impression.customImpression))
  else if (clean(impression.customFinding))
    findings.push(
      'Additional finding described above; clinical significance requires interpretation.',
    )

  if (!findings.length) {
    if (data.study.limitations === 'Recording is technically limited') {
      return `Technically limited ${sleep.obtained ? 'awake and asleep' : 'awake'} EEG. No epileptiform discharges or electrographic seizures are identified within the interpretable portions.`
    }
    return `Normal ${sleep.obtained ? 'awake and asleep' : 'awake'} EEG. No epileptiform discharges or electrographic seizures were recorded.`
  }

  return findings.map((finding, index) => `${index + 1}. ${finding}`).join('\n')
}

function clean(value) {
  return String(value ?? '').trim()
}

function sentence(value) {
  const text = clean(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function capitalize(value) {
  const text = clean(value)
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

function joinList(items = []) {
  if (items.length < 2) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function article(value) {
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
  return `${count} ${noun}${isSingularCount(value) ? '' : 's'}`
}
