/**
 * Quiz Question Bank
 * Each question shows an EEG pattern and asks the learner to identify it,
 * or presents a clinical scenario and asks which pattern is expected.
 *
 * Types:
 *   'identify'  - Show a waveform, identify the pattern
 *   'scenario'  - Read a clinical vignette, select the expected EEG finding
 *   'compare'   - Two waveforms, select the correct descriptor
 *   'feature'   - Identify a specific feature of a named pattern
 */

export const QUIZ_QUESTIONS = [

  // ── Identification ────────────────────────────────────────────────────────

  {
    id: 'q_spike_id',
    type: 'identify',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'spike',
    question: 'What waveform is shown in this trace?',
    options: [
      { id: 'a', text: 'Spike',       correct: true  },
      { id: 'b', text: 'Sharp wave',  correct: false },
      { id: 'c', text: 'K-complex',   correct: false },
      { id: 'd', text: 'Alpha burst', correct: false },
    ],
    explanation: 'A spike is a sharply contoured transient with a duration < 70 ms. It typically has a steep rise, a pointed peak, and is predominantly negative. Spikes are strongly associated with epilepsy.',
    reference: 'ILAE 2017 — Operational classification of seizure types',
  },

  {
    id: 'q_sharp_wave_id',
    type: 'identify',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'sharp_wave',
    question: 'What waveform is shown in this trace?',
    options: [
      { id: 'a', text: 'Alpha wave',   correct: false },
      { id: 'b', text: 'Spike',        correct: false },
      { id: 'c', text: 'Sharp wave',   correct: true  },
      { id: 'd', text: 'Polyspike',    correct: false },
    ],
    explanation: 'A sharp wave has a duration of 70–200 ms — broader than a spike but still pointed. It is often followed by a slow wave. Like spikes, sharp waves are epileptiform discharges.',
    reference: 'Noachtar & Rémi, 2009 — Epilepsia',
  },

  {
    id: 'q_polyspike_id',
    type: 'identify',
    difficulty: 'intermediate',
    module: 'waveforms',
    patternId: 'polyspike',
    question: 'What waveform is shown in this trace?',
    options: [
      { id: 'a', text: 'Delta burst',      correct: false },
      { id: 'b', text: 'Sleep spindle',    correct: false },
      { id: 'c', text: 'Spike-and-wave',   correct: false },
      { id: 'd', text: 'Polyspike',        correct: true  },
    ],
    explanation: 'Polyspikes consist of multiple (≥3) consecutive spikes in rapid succession, typically <200 ms total. They are most often seen in generalised epilepsy syndromes such as juvenile myoclonic epilepsy (JME).',
    reference: 'Zifkin & Dravet — Generalized Epilepsies (2013)',
  },

  {
    id: 'q_alpha_id',
    type: 'identify',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'alpha',
    question: 'What rhythm is shown in this trace?',
    options: [
      { id: 'a', text: 'Theta',    correct: false },
      { id: 'b', text: 'Alpha',    correct: true  },
      { id: 'c', text: 'Beta',     correct: false },
      { id: 'd', text: 'Delta',    correct: false },
    ],
    explanation: 'Alpha rhythm (8–13 Hz) is the posterior dominant rhythm of awake adults. It is sinusoidal, maximal over occipital electrodes, and attenuates with eye opening (alpha blocking/reactivity).',
    reference: 'Niedermeyer & da Silva — Electroencephalography, 5th ed.',
  },

  {
    id: 'q_spike_wave_id',
    type: 'identify',
    difficulty: 'intermediate',
    module: 'waveforms',
    patternId: 'spike_wave',
    question: 'Which pattern is shown in this trace?',
    options: [
      { id: 'a', text: 'Burst-suppression',    correct: false },
      { id: 'b', text: 'Hypsarrhythmia',       correct: false },
      { id: 'c', text: '3 Hz spike-and-wave',  correct: true  },
      { id: 'd', text: 'Focal slowing',         correct: false },
    ],
    explanation: '3 Hz generalised spike-and-wave is the hallmark of childhood absence epilepsy. The discharge consists of a spike followed by a slow wave repeating at ~3 Hz, is bilaterally synchronous, and is associated with brief lapses of consciousness.',
    reference: 'Lüders et al. — Epileptic Seizures: Pathophysiology and Clinical Semiology (2000)',
  },

  {
    id: 'q_burst_id',
    type: 'identify',
    difficulty: 'advanced',
    module: 'waveforms',
    patternId: 'burst_suppression',
    question: 'What pattern is shown in this trace?',
    options: [
      { id: 'a', text: 'Sleep delta',         correct: false },
      { id: 'b', text: 'Burst-suppression',   correct: true  },
      { id: 'c', text: 'Hypsarrhythmia',      correct: false },
      { id: 'd', text: 'NCSE pattern',        correct: false },
    ],
    explanation: 'Burst-suppression is characterised by alternating bursts of high-amplitude mixed-frequency activity and periods of very low-voltage suppression (< 10 µV). It indicates profound global brain dysfunction.',
    reference: 'Hirsch et al. — ACNS Standardised EEG Terminology (2021)',
  },

  // ── Clinical Scenarios ────────────────────────────────────────────────────

  {
    id: 'q_scenario_absence',
    type: 'scenario',
    difficulty: 'intermediate',
    module: 'findings',
    patternId: null,
    question: 'A 7-year-old girl has multiple daily episodes of staring and unresponsiveness lasting 5–10 seconds, with abrupt onset and offset. Her teacher reports she "spaces out" frequently. Hyperventilation during the EEG provokes a typical event. What EEG pattern do you expect?',
    options: [
      { id: 'a', text: 'Focal spikes over the left temporal lobe',          correct: false },
      { id: 'b', text: 'Generalised 3 Hz spike-and-wave discharges',         correct: true  },
      { id: 'c', text: 'Burst-suppression',                                  correct: false },
      { id: 'd', text: 'Hypsarrhythmia',                                     correct: false },
    ],
    explanation: 'This is a classic presentation of childhood absence epilepsy (CAE). The EEG hallmark is bilaterally synchronous, generalised 3 Hz spike-and-wave discharges, typically provoked by hyperventilation and photic stimulation. Background EEG is normal.',
    reference: 'Berg & Berkovic — Revised Terminology for the Organisation of Seizures (2010)',
  },

  {
    id: 'q_scenario_focal_slowing',
    type: 'scenario',
    difficulty: 'intermediate',
    module: 'findings',
    patternId: 'focal_slowing',
    question: 'A 58-year-old man presents 3 days after a left MCA territory ischaemic stroke. He has right-sided weakness and expressive aphasia. What EEG finding would you expect over the left hemisphere?',
    options: [
      { id: 'a', text: 'Enhanced left-sided alpha rhythm',       correct: false },
      { id: 'b', text: 'Right hemispheric spike discharges',     correct: false },
      { id: 'c', text: 'Focal polymorphic delta slowing',        correct: true  },
      { id: 'd', text: 'Generalised burst-suppression',          correct: false },
    ],
    explanation: 'Focal cortical or subcortical damage produces focal polymorphic (irregular, arrhythmic) delta activity over the affected region. It is non-reactive and indicates underlying structural pathology. This is distinct from periodic lateralised discharges (PLEDs), which may also occur acutely post-stroke.',
    reference: 'Kaplan — EEG in Acute Encephalopathy (2006)',
  },

  {
    id: 'q_scenario_burst',
    type: 'scenario',
    difficulty: 'advanced',
    module: 'findings',
    patternId: 'burst_suppression',
    question: 'A 65-year-old man is found unresponsive after a witnessed cardiac arrest. He is resuscitated after 8 minutes of CPR and undergoes targeted temperature management. EEG monitoring is started. What pattern is associated with a poor neurological prognosis in this setting?',
    options: [
      { id: 'a', text: 'Normal sleep architecture',            correct: false },
      { id: 'b', text: 'Posterior dominant alpha rhythm',      correct: false },
      { id: 'c', text: 'Burst-suppression with identical bursts', correct: true  },
      { id: 'd', text: 'Sporadic left temporal spikes',        correct: false },
    ],
    explanation: 'After hypoxic-ischaemic encephalopathy (HIE), burst-suppression with identical/stereotyped bursts (BS-SI) is strongly associated with poor neurological outcome. In contrast, burst-suppression with variable bursts may occasionally be seen in survivable injury or medication effect.',
    reference: 'Westhall et al. — Lancet Neurology (2016)',
  },

  // ── Feature Questions ─────────────────────────────────────────────────────

  {
    id: 'q_alpha_reactivity',
    type: 'feature',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'alpha',
    question: 'Which of the following is a key feature that distinguishes physiological alpha rhythm from pathological slow activity?',
    options: [
      { id: 'a', text: 'Frequency > 8 Hz',                           correct: false },
      { id: 'b', text: 'Occipital predominance',                     correct: false },
      { id: 'c', text: 'Reactivity — attenuation with eye opening',  correct: true  },
      { id: 'd', text: 'Sinusoidal morphology',                      correct: false },
    ],
    explanation: 'Reactivity — specifically alpha blocking (attenuation with eye opening) — is the single most important feature distinguishing physiological alpha from pathological alpha-frequency activity. An alpha rhythm that does not react to eye opening is abnormal (e.g., alpha coma).',
    reference: 'Chatrian et al. — A glossary of terms most commonly used... (1974)',
  },

  {
    id: 'q_spike_duration',
    type: 'feature',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'spike',
    question: 'What is the maximum duration of a spike?',
    options: [
      { id: 'a', text: '< 20 ms',   correct: false },
      { id: 'b', text: '< 70 ms',   correct: true  },
      { id: 'c', text: '< 120 ms',  correct: false },
      { id: 'd', text: '< 200 ms',  correct: false },
    ],
    explanation: 'By ILAE definition, a spike has a duration of < 70 ms. Transients between 70–200 ms are classified as sharp waves. This distinction is based on waveform duration, not amplitude or polarity.',
    reference: 'ILAE Commission — Proposal for revised classification (1989)',
  },

  {
    id: 'q_montage_phase_reversal',
    type: 'feature',
    difficulty: 'intermediate',
    module: 'montages',
    patternId: null,
    question: 'In a longitudinal bipolar montage, a phase reversal (where the deflection in two adjacent channels points AWAY from each other) indicates what?',
    options: [
      { id: 'a', text: 'The electrode between them has low impedance',        correct: false },
      { id: 'b', text: 'The generator is at or near the shared electrode',    correct: true  },
      { id: 'c', text: 'The generator is distant from those channels',        correct: false },
      { id: 'd', text: 'There is electrode artifact at those channels',       correct: false },
    ],
    explanation: 'In a bipolar montage, each channel = electrode A minus electrode B. When a generator is at electrode X, channels sharing electrode X as positive will deflect up, while channels sharing it as negative will deflect down — creating a "phase reversal" pointing toward X. This is used to localise focal EEG generators.',
    reference: 'Ebersole & Pedley — Current Practice of Clinical EEG, 3rd ed.',
  },

  {
    id: 'q_10_20_system',
    type: 'feature',
    difficulty: 'beginner',
    module: 'concepts',
    patternId: null,
    question: 'In the 10-20 electrode system, what do even-numbered electrode labels (e.g. F4, T8, O2) indicate?',
    options: [
      { id: 'a', text: 'Midline electrodes',     correct: false },
      { id: 'b', text: 'Left hemisphere',         correct: false },
      { id: 'c', text: 'Right hemisphere',        correct: true  },
      { id: 'd', text: 'Temporal electrodes',     correct: false },
    ],
    explanation: 'In the 10-20 system, odd numbers (1,3,5,7) indicate left hemisphere electrodes, even numbers (2,4,6,8) indicate right hemisphere electrodes, and the letter "z" (e.g. Fz, Cz, Pz) indicates midline electrodes.',
    reference: 'Jasper HH — The 10-20 electrode system of the IFCN (1958)',
  },

  {
    id: 'q_avg_reference',
    type: 'feature',
    difficulty: 'advanced',
    module: 'montages',
    patternId: null,
    question: 'What is a theoretical limitation of the average reference montage?',
    options: [
      { id: 'a', text: 'It cannot detect focal activity',                   correct: false },
      { id: 'b', text: 'It requires more than 32 channels to be valid',      correct: false },
      { id: 'c', text: 'A large discharge contaminates the reference itself', correct: true  },
      { id: 'd', text: 'It only works for temporal lobe epilepsy',           correct: false },
    ],
    explanation: 'The average reference assumes that the sum of all scalp potentials equals zero. When a large generalised discharge occurs, it contributes to the average reference itself, potentially distorting channel derivations. For this reason, active channels are sometimes excluded from the reference average.',
    reference: 'Nunez et al. — Electric Fields of the Brain (2006)',
  },

  {
    id: 'q_delta_frequency',
    type: 'feature',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'delta',
    question: 'What is the frequency range of delta activity?',
    options: [
      { id: 'a', text: '0.1–2 Hz',   correct: false },
      { id: 'b', text: '0.5–4 Hz',   correct: true  },
      { id: 'c', text: '4–8 Hz',     correct: false },
      { id: 'd', text: '8–13 Hz',    correct: false },
    ],
    explanation: 'Delta activity is defined as frequencies below 4 Hz (conventionally 0.5–4 Hz). It is normal in deep NREM sleep (stages 3–4) in all ages and in infants and young children when awake. In awake adults, focal or diffuse delta is always abnormal.',
    reference: 'Niedermeyer — The Normal EEG of the Waking Adult (1999)',
  },

]

// ─── Quiz Structure ───────────────────────────────────────────────────────────

export const QUIZ_MODULES = {
  all:       { label: 'Full Quiz',       questions: QUIZ_QUESTIONS.map(q => q.id) },
  waveforms: { label: 'Waveforms',       questions: QUIZ_QUESTIONS.filter(q => q.module === 'waveforms').map(q => q.id) },
  montages:  { label: 'Montages',        questions: QUIZ_QUESTIONS.filter(q => q.module === 'montages').map(q => q.id) },
  findings:  { label: 'Clinical Findings', questions: QUIZ_QUESTIONS.filter(q => q.module === 'findings').map(q => q.id) },
  concepts:  { label: 'Concepts',        questions: QUIZ_QUESTIONS.filter(q => q.module === 'concepts').map(q => q.id) },
}

export const DIFFICULTY_LABELS = {
  beginner:     { label: 'Beginner',     color: '#00FFB0' },
  intermediate: { label: 'Intermediate', color: '#FFD166' },
  advanced:     { label: 'Advanced',     color: '#FF6B35' },
}

/** Shuffle an array (Fisher-Yates) */
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Get questions for a module, optionally shuffled */
export function getQuizQuestions(moduleId = 'all', shuffled = true) {
  const ids = QUIZ_MODULES[moduleId]?.questions ?? []
  const qs  = ids.map(id => QUIZ_QUESTIONS.find(q => q.id === id)).filter(Boolean)
  return shuffled ? shuffle(qs) : qs
}
