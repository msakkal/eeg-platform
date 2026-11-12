export const READING_SECTIONS = [
  {
    id: 'context',
    title: 'Clinical context',
    question: 'What question should this EEG answer?',
    introduction:
      'Start with the referral question and the expected background for this patient. Keep the history in mind without letting it determine the waveform label.',
    items: [
      [
        'Indication',
        'Clarify whether the study investigates episodes, epilepsy classification, altered consciousness, or ongoing seizure activity. Identify the symptoms that would make a captured event typical.',
      ],
      [
        'Age and state',
        'Establish age, baseline function, alertness, and whether sleep deprivation or sedation was used. Expected rhythms and sleep features vary with development and vigilance.',
      ],
      [
        'Relevant modifiers',
        'Note antiseizure and sedating medications, recent medication changes, metabolic disturbance, prior surgery, and skull defects when they could affect interpretation.',
      ],
      [
        'Recording scope',
        'Identify routine, sleep-deprived, ambulatory, prolonged video, or continuous EEG. Check the timing of the last suspected event and whether synchronized video is available.',
      ],
    ],
    checkpoint:
      'State a specific clinical question before interpreting the record; EEG observations must still stand on their own.',
  },
  {
    id: 'technical',
    title: 'Technical quality & montage',
    question: 'Can the signal support a reliable interpretation?',
    introduction:
      'Resolve technical uncertainty before assigning physiologic meaning. A display adjustment can clarify a finding, but it can also change its apparent shape.',
    items: [
      [
        'Recording integrity',
        'Verify channel labels, electrode coverage, usable duration, and available impedance information. Look for disconnected electrodes, bridging, drift, clipping, or saturation.',
      ],
      [
        'Display settings',
        'Check polarity, sensitivity, time base, and filters. Inspect both low- and high-amplitude activity; avoid using aggressive filtering to make a suspicious transient look cleaner.',
      ],
      [
        'Montage comparison',
        'Compare bipolar and referential views. A phase reversal identifies a voltage maximum or minimum within that montage; it does not independently establish an epileptiform discharge.',
      ],
      [
        'Supporting channels',
        'Use ECG, EOG, EMG, event markers, technologist notes, and video when available. Confirm that video and EEG timing align before assessing a clinical correlate.',
      ],
    ],
    checkpoint:
      'Document limitations that change what can be assessed, including reduced coverage or prolonged obscuring artifact.',
    link: ['/montages', 'Review montages'],
  },
  {
    id: 'survey',
    title: 'Whole-record survey',
    question: 'What states and important changes occur across the study?',
    introduction:
      'Review the full record before concentrating on individual waveforms. Build a timeline so that each detailed observation has a state and a context.',
    items: [
      [
        'Scan globally',
        'Look for major asymmetry, loss of continuity, sustained rhythmic activity, and abrupt changes in organization. Flag intervals that need a slower second look.',
      ],
      [
        'Map the states',
        'Identify relaxed wakefulness, drowsiness, sleep, arousals, activation procedures, and recovery. Choose representative clean segments from each state.',
      ],
      [
        'Review events',
        'Locate reported symptoms and event markers, then inspect the surrounding recording. Review unmarked changes too; event buttons may be late, accidental, or absent.',
      ],
      [
        'Return deliberately',
        'Revisit suspicious intervals with appropriate time scales and more than one montage. Keep the overview separate from the final classification of any finding.',
      ],
    ],
    checkpoint: 'Do not let one striking transient replace a review of the rest of the recording.',
  },
  {
    id: 'background',
    title: 'Awake background',
    question: 'Is the background organized and appropriate for age and vigilance?',
    introduction:
      'Describe the background before isolated abnormalities. Use comparable, artifact-free epochs and distinguish the awake background from drowsiness or medication effects.',
    items: [
      [
        'Posterior dominant rhythm',
        'When present, measure its frequency in relaxed wakefulness and assess distribution, symmetry, and attenuation with eye opening. Avoid assigning an adult expectation to a child.',
      ],
      [
        'Organization and frequencies',
        'Assess the anterior–posterior gradient and the mix of faster and slower activity. State whether slowing is focal or widespread and whether it is excessive for the observed state.',
      ],
      [
        'Voltage and continuity',
        'Describe unusually low or high voltage in montage context. Assess continuity; reserve critical-care categories such as burst-suppression for recordings that meet their definitions.',
      ],
      [
        'Variability and reactivity',
        'Distinguish spontaneous state-related changes from reproducible responses to stimulation. Movement or muscle artifact alone is not evidence of cerebral reactivity.',
      ],
    ],
    checkpoint:
      'A useful background description covers organization, frequency, symmetry, continuity, and reactivity without listing every normal waveform.',
    example:
      'An organized, symmetric awake background with a 10 Hz posterior dominant rhythm that attenuates with eye opening.',
  },
  {
    id: 'sleep-activation',
    title: 'Sleep & activation',
    question: 'Do state transitions and activation reveal additional information?',
    introduction:
      'Review the response to each recorded state or procedure. Distinguish an expected physiologic change from a newly activated abnormality.',
    items: [
      [
        'Drowsiness and sleep',
        'Follow the transition from wakefulness. Identify vertex waves, spindles, and K-complexes when present; assess symmetry and whether the architecture is appropriate for age.',
      ],
      [
        'Eye opening and arousal',
        'Compare eye closure with opening and inspect arousals. Record whether the posterior rhythm attenuates and whether background changes are reproducible.',
      ],
      [
        'Hyperventilation',
        'Review baseline, the procedure, and recovery. Describe the distribution and persistence of slowing or the emergence of epileptiform discharges; note an inadequate or omitted procedure.',
      ],
      [
        'Photic stimulation',
        'Separate photic driving from muscle responses and epileptiform activation. Review the field and relationship to flashes rather than treating all stimulus-locked activity as cerebral pathology.',
      ],
    ],
    checkpoint:
      'State which sleep stages and procedures were actually recorded; an unperformed activation procedure is not a negative result.',
  },
  {
    id: 'focality',
    title: 'Symmetry & focal slowing',
    question: 'Is there a consistent regional abnormality?',
    introduction:
      'Compare homologous regions in the same state. Localize reproducible abnormalities using their distribution rather than the appearance of a single channel.',
    items: [
      [
        'Compare frequency and amplitude',
        'Distinguish a persistent frequency difference from a voltage difference. Recheck apparent asymmetry across clean epochs and alternative montages.',
      ],
      [
        'Characterize slowing',
        'Describe location, theta or delta content, morphology, prevalence, and persistence. Determine whether it is polymorphic or rhythmic before assigning a more specific pattern name.',
      ],
      [
        'Look for associated changes',
        'Inspect regional attenuation of faster activity, asymmetric sleep features, and changes in the posterior rhythm. Consider a breach effect if skull integrity is altered.',
      ],
      [
        'Challenge the localization',
        'Exclude electrode problems, muscle activity, state mismatch, and reference contamination. A consistent field and repeatability strengthen the observation.',
      ],
    ],
    checkpoint:
      'Report the regional finding and its persistence; focal slowing alone does not identify its underlying cause.',
    example: 'Intermittent polymorphic delta slowing is maximal over the left temporal region.',
  },
  {
    id: 'transients',
    title: 'Transients & epileptiform activity',
    question: 'Does a suspicious transient have convincing epileptiform features?',
    introduction:
      'Pause before labeling a sharp waveform. Evaluate multiple features together and compare repeated examples with the surrounding background.',
    items: [
      [
        'Morphology and duration',
        'Inspect the contour, duration, components, and relationship to the background. Sharpness or amplitude alone is insufficient for an epileptiform classification.',
      ],
      [
        'Field and distribution',
        'Check adjacent electrodes, polarity, and voltage gradients in different montages. Describe the maximum and whether the distribution is focal, multifocal, or generalized.',
      ],
      [
        'Context and recurrence',
        'Assess an after-going slow wave, background disruption, recurrence, and state dependence. Compare with expected sleep transients and sharply contoured background rhythms.',
      ],
      [
        'Description before significance',
        'Document morphology, location, prevalence, and activation by sleep or other procedures. Use calibrated language if artifact or a normal variant cannot be excluded.',
      ],
    ],
    checkpoint:
      'A phase reversal and a pointed contour are observations, not a diagnosis. Confirm a plausible cerebral field and the full pattern.',
    link: ['/atlas', 'Compare patterns in the EEG Atlas'],
  },
  {
    id: 'rhythmic-events',
    title: 'Rhythmic patterns & seizures',
    question: 'Is this a sustained pattern, an electrographic seizure, or a clinical event?',
    introduction:
      'Inspect onset, middle, and offset in raw EEG. Use critical-care terminology within its intended scope and separate electrographic observations from clinical correlation.',
    items: [
      [
        'Describe the pattern',
        'Record distribution, waveform type, frequency, duration, and prevalence. Distinguish periodic discharges from rhythmic activity; specify additional features when relevant.',
      ],
      [
        'Assess evolution',
        'Look for definite sequential changes in frequency, morphology, or location. Simple waxing and waning of amplitude does not establish evolution.',
      ],
      [
        'Apply seizure criteria',
        "In the ACNS 2021 critical-care framework, an electrographic seizure includes epileptiform discharges averaging above 2.5 Hz for at least 10 seconds, or a definitely evolving pattern of at least 10 seconds. Consult the full definitions for classification.",
      ],
      [
        'Match the clinical event',
        'Document semiology, responsiveness, duration, and timing relative to EEG onset. A definite time-locked clinical correlate can support an electroclinical seizure of shorter duration; absence of a scalp correlate alone does not determine an event’s cause.',
      ],
    ],
    checkpoint:
      'Confirm automated detections in raw EEG. An ictal–interictal continuum pattern is not automatically an electrographic seizure.',
    source: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/',
      'ACNS 2021 pattern and seizure definitions',
    ],
  },
  {
    id: 'artifacts',
    title: 'Artifact verification',
    question: 'Could a noncerebral source explain an important finding?',
    introduction:
      'Check artifact throughout the review and repeat this challenge before a finding enters the impression. Use independent evidence rather than appearance alone.',
    items: [
      [
        'Eye and muscle activity',
        'Compare transients with blinks, eye movements, jaw tension, and movement on video. Check EOG or EMG channels where available and inspect the spatial distribution.',
      ],
      [
        'Electrode and environmental sources',
        'Look for activity confined to channels sharing an electrode, abrupt steps, drift, clipping, or regular interference. Inspect unaffected channels for the underlying background.',
      ],
      [
        'Cardiac and movement timing',
        'Compare suspicious waveforms with ECG, pulse, respiration, equipment cycles, and technologist annotations. Look for a consistent time relationship.',
      ],
      [
        'Verify in several ways',
        'Change montage and time base, inspect repeat occurrences, and correlate with video. If uncertainty remains, describe it and explain the resulting limitation.',
      ],
    ],
    checkpoint:
      'Filtering may change the appearance of artifact; disappearance after filtering does not establish its source.',
    link: ['/artifacts', 'Open the artifact guide'],
  },
  {
    id: 'report',
    title: 'Synthesis & report',
    question: 'Which observations matter most, and what can they support?',
    introduction:
      'Turn the review into a concise description and a ranked impression. Separate the recorded evidence from its clinical meaning.',
    items: [
      [
        'Technique and background',
        'Summarize recording type, duration, states, activation, and meaningful limitations. Describe the representative background and sleep features.',
      ],
      [
        'Findings and events',
        'Describe abnormalities with consistent laterality, location, morphology, frequency, and prevalence. Include captured events, EEG evolution, and their clinical relationship.',
      ],
      [
        'Impression and correlation',
        'State whether the study is normal or abnormal, prioritize the main abnormalities, and answer the referral question to the extent supported. State important uncertainty.',
      ],
      [
        'Final consistency check',
        'Ensure the impression is supported by the description, that artifact and normal variants were considered, and that limitations are acknowledged. Follow local communication pathways for urgent findings.',
      ],
    ],
    checkpoint:
      'A normal interictal EEG does not exclude epilepsy. Avoid unsupported statements about etiology, prognosis, or treatment.',
    link: ['/report-builder', 'Build a report'],
  },
]
