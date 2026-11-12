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
    explanation: "A spike is a pointed transient lasting 20–<70 ms. Assess its field, morphology, and background context; a sharp contour alone does not establish epileptiform activity.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
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
    explanation: "Sharp waves last 70–200 ms. Epileptiform interpretation requires supporting morphology, field, and context; normal variants and artifacts can also appear sharp.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
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
    explanation: "A polyspike complex contains two or more successive spikes. Epileptiform polyspike-wave discharges occur in generalized epilepsies such as JME, but interpretation still requires the full EEG context.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
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
    explanation: "Burst-suppression alternates bursts with suppression below 10 µV occupying 50–99% of the record. It can reflect severe cerebral dysfunction or anesthetic effects; cause and prognosis depend on context.",
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
    explanation: "Hyperventilation commonly activates childhood absence epilepsy. Photic stimulation elicits generalized spike-wave in 15–20% of patients but does not typically provoke absence seizures. The background is usually normal.",
    reference: "ILAE EpilepsyDiagnosis — Childhood absence epilepsy",
    referenceUrl: "https://www.epilepsydiagnosis.org/syndrome/cae-eeg.html",
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
    explanation: "Focal polymorphic delta suggests regional cerebral dysfunction. Structural lesions, postictal changes, and other focal processes can cause it; slowing alone does not establish the cause. Assess state, reactivity, and persistence.",
    reference: "American Epilepsy Society — EEG Atlas (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390357/",
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
    explanation: "Identical-burst suppression is associated with poor outcome after cardiac arrest. Prognostication requires multimodal assessment after confounders are excluded, generally at ≥72 h; early EEG findings alone must not determine outcome.",
    reference: "ERC–ESICM post-resuscitation care guidelines (2025)",
    referenceUrl: "https://www.erc.edu/media/atqopqm4/gl2025-07-post-resus-e.pdf",
  },

  // ── Feature Questions ─────────────────────────────────────────────────────

  {
    id: 'q_alpha_reactivity',
    type: 'feature',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'alpha',
    question: "Which response is characteristic of the normal posterior alpha rhythm?",
    options: [
      { id: 'a', text: 'Frequency > 8 Hz',                           correct: false },
      { id: 'b', text: 'Occipital predominance',                     correct: false },
      { id: 'c', text: 'Reactivity — attenuation with eye opening',  correct: true  },
      { id: 'd', text: 'Sinusoidal morphology',                      correct: false },
    ],
    explanation: "Eye opening normally attenuates the posterior alpha rhythm. Evaluate reactivity alongside vigilance, distribution, and technical quality; a single absent response does not diagnose alpha coma.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: 'q_spike_duration',
    type: 'feature',
    difficulty: 'beginner',
    module: 'waveforms',
    patternId: 'spike',
    question: "Which duration range conventionally defines an EEG spike?",
    options: [
      { id: 'a', text: '< 20 ms',   correct: false },
      { id: 'b', text: "20–<70 ms",   correct: true  },
      { id: 'c', text: '< 120 ms',  correct: false },
      { id: 'd', text: '< 200 ms',  correct: false },
    ],
    explanation: "Conventional spike duration is 20–<70 ms, versus 70–200 ms for sharp waves. Duration helps name a transient; morphology and field remain essential to interpretation.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: 'q_montage_phase_reversal',
    type: 'feature',
    difficulty: 'intermediate',
    module: 'montages',
    patternId: null,
    question: "In a bipolar montage, what does a phase reversal at a shared electrode identify?",
    options: [
      { id: 'a', text: 'The electrode between them has low impedance',        correct: false },
      { id: 'b', text: "A local maximum or minimum of the scalp potential field",    correct: true  },
      { id: 'c', text: 'The generator is distant from those channels',        correct: false },
      { id: 'd', text: 'There is electrode artifact at those channels',       correct: false },
    ],
    explanation: "Opposite deflections in adjacent bipolar channels identify a local scalp-potential extremum near their shared electrode. Polarity depends on the inputs and display convention; this alone neither precisely locates the cortical source nor proves epileptiform activity.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
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
    question: "Which range is commonly used for delta-band analysis?",
    options: [
      { id: 'a', text: '0.1–2 Hz',   correct: false },
      { id: 'b', text: '0.5–4 Hz',   correct: true  },
      { id: 'c', text: '4–8 Hz',     correct: false },
      { id: 'd', text: '8–13 Hz',    correct: false },
    ],
    explanation: "Delta is activity below 4 Hz; 0.5–4 Hz is a common analysis band. Interpret slow waves by age, vigilance, reactivity, and distribution; drowsiness and normal variants can produce slow activity without disease.",
    reference: "American Epilepsy Society — EEG Atlas (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390357/",
  },

  // Additional practice across all four modules.

  {
    id: "q_sleep_spindle_id",
    type: "identify",
    difficulty: "beginner",
    module: "waveforms",
    patternId: "sleep_spindle",
    question: "Which normal sleep pattern is shown?",
    options: [
      { id: "a", text: "Muscle artifact", correct: false },
      { id: "b", text: "Sleep spindle", correct: true },
      { id: "c", text: "3 Hz spike-and-wave", correct: false },
      { id: "d", text: "Electrode pop", correct: false },
    ],
    explanation: "Sleep spindles are waxing and waning bursts of approximately 11–16 Hz activity, usually maximal centrally. They are a normal feature of N2 sleep.",
    reference: "American Epilepsy Society — The Normal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390343/",
  },

  {
    id: "q_k_complex_id",
    type: "identify",
    difficulty: "beginner",
    module: "waveforms",
    patternId: "k_complex",
    question: "Which normal sleep transient is illustrated?",
    options: [
      { id: "a", text: "Polyspike", correct: false },
      { id: "b", text: "Lambda wave", correct: false },
      { id: "c", text: "K-complex", correct: true },
      { id: "d", text: "Posterior alpha rhythm", correct: false },
    ],
    explanation: "A K-complex is a prominent biphasic sleep transient, often with a frontal maximum. Together with sleep spindles, it helps identify N2 sleep.",
    reference: "American Epilepsy Society — The Normal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390343/",
  },

  {
    id: "q_vertex_sleep",
    type: "feature",
    difficulty: "intermediate",
    module: "waveforms",
    patternId: null,
    question: "Symmetric sharp transients appear over Cz as a patient falls asleep. Which interpretation is most appropriate?",
    options: [
      { id: "a", text: "Normal vertex waves are a likely explanation", correct: true },
      { id: "b", text: "The sharp shape alone proves epilepsy", correct: false },
      { id: "c", text: "This proves a lesion beneath Cz", correct: false },
      { id: "d", text: "All sleep transients are artifacts", correct: false },
    ],
    explanation: "Vertex waves are normal centrally maximal sleep transients. Interpret their field and sleep context before labelling a sharp waveform epileptiform.",
    reference: "American Epilepsy Society — The Normal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390343/",
  },

  {
    id: "q_mu_reactivity",
    type: "feature",
    difficulty: "intermediate",
    module: "waveforms",
    patternId: null,
    question: "An arc-shaped central rhythm attenuates with movement of the opposite hand. Which rhythm does this support?",
    options: [
      { id: "a", text: "Posterior alpha rhythm", correct: false },
      { id: "b", text: "Generalized periodic discharges", correct: false },
      { id: "c", text: "Sleep spindle", correct: false },
      { id: "d", text: "Mu rhythm", correct: true },
    ],
    explanation: "Mu is a sensorimotor rhythm with a central distribution. Attenuation during contralateral movement helps distinguish it from posterior alpha and epileptiform activity.",
    reference: "American Epilepsy Society — The Normal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390343/",
  },

  {
    id: "q_wicket_variant",
    type: "feature",
    difficulty: "advanced",
    module: "waveforms",
    patternId: null,
    question: "Arc-shaped temporal waves occur in brief trains during drowsiness, without a consistent after-going slow wave or background disruption. What should be considered?",
    options: [
      { id: "a", text: "A definite electrographic seizure", correct: false },
      { id: "b", text: "Wicket rhythm, a normal variant", correct: true },
      { id: "c", text: "Burst-suppression", correct: false },
      { id: "d", text: "A diagnostic sign of a temporal tumor", correct: false },
    ],
    explanation: "Wicket waves can look sharp but are a normal variant. Their arc-shaped trains and lack of a typical after-going slow wave help avoid overcalling temporal spikes.",
    reference: "American Epilepsy Society — Benign Variants in the EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390352/",
  },

  {
    id: "q_bipolar_subtraction",
    type: "feature",
    difficulty: "beginner",
    module: "montages",
    patternId: null,
    question: "A bipolar channel displays F3 minus C3. At one instant F3 is +20 µV and C3 is +5 µV relative to the same reference. What is the channel voltage?",
    options: [
      { id: "a", text: "+25 µV", correct: false },
      { id: "b", text: "−15 µV", correct: false },
      { id: "c", text: "+15 µV", correct: true },
      { id: "d", text: "0 µV", correct: false },
    ],
    explanation: "A bipolar derivation subtracts the second electrode potential from the first: +20 − (+5) = +15 µV.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: "q_bipolar_cancellation",
    type: "feature",
    difficulty: "intermediate",
    module: "montages",
    patternId: null,
    question: "Why can widespread synchronous activity look small in a bipolar channel even when both electrodes record large signals?",
    options: [
      { id: "a", text: "Similar potentials at the two inputs cancel during subtraction", correct: true },
      { id: "b", text: "Bipolar montages cannot display slow waves", correct: false },
      { id: "c", text: "The amplifier measures only absolute voltage", correct: false },
      { id: "d", text: "A small channel signal proves cortical inactivity", correct: false },
    ],
    explanation: "A channel measures a voltage difference. Similar simultaneous inputs produce a small difference, so low bipolar amplitude alone does not establish low cerebral activity.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: "q_active_reference",
    type: "feature",
    difficulty: "intermediate",
    module: "montages",
    patternId: null,
    question: "A transient appears simultaneously in many channels sharing one reference. Which technical explanation should be checked?",
    options: [
      { id: "a", text: "Every exploring electrode must be faulty", correct: false },
      { id: "b", text: "A generalized seizure is already proven", correct: false },
      { id: "c", text: "The reference cannot contribute to channel signals", correct: false },
      { id: "d", text: "Activity or artifact at the shared reference", correct: true },
    ],
    explanation: "Reference activity enters every channel using that reference. Review another montage and the electrode signals before assuming a widespread cerebral discharge.",
    reference: "American Epilepsy Society — Principles of Digital EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390353/",
  },

  {
    id: "q_montage_crosscheck",
    type: "feature",
    difficulty: "beginner",
    module: "montages",
    patternId: null,
    question: "A suspicious transient is visible in a longitudinal bipolar montage. What is a useful next review step?",
    options: [
      { id: "a", text: "Diagnose epilepsy from this montage alone", correct: false },
      { id: "b", text: "Compare its field in referential and other bipolar montages", correct: true },
      { id: "c", text: "Remove every channel showing the transient", correct: false },
      { id: "d", text: "Assume a phase reversal excludes artifact", correct: false },
    ],
    explanation: "Different montages reveal different aspects of a scalp field and can expose reference or electrode artifacts. A single display should not determine the diagnosis.",
    reference: "ACNS — Minimum Technical Requirements for Clinical EEG (2016)",
    referenceUrl: "https://www.acns.org/UserFiles/file/Guideline1-MinimumTechnicalRequirementsforPerofrmingClinicalEEG_v1.pdf",
  },

  {
    id: "q_shared_electrode_artifact",
    type: "scenario",
    difficulty: "advanced",
    module: "montages",
    patternId: null,
    question: "An abrupt transient is confined to Fp1–F7 and F7–T7 with opposite deflections and no convincing field elsewhere. Which electrode deserves an early technical check?",
    options: [
      { id: "a", text: "O2", correct: false },
      { id: "b", text: "Cz", correct: false },
      { id: "c", text: "F7", correct: true },
      { id: "d", text: "P4", correct: false },
    ],
    explanation: "F7 is shared by both derivations. An electrode artifact there can mimic a phase reversal; check contact quality and other montages before deciding it is cerebral.",
    reference: "American Epilepsy Society — Common Artifacts During EEG Recording (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390358/",
  },

  {
    id: "q_negative_up_polarity",
    type: "feature",
    difficulty: "intermediate",
    module: "montages",
    patternId: null,
    question: "With negative-up display and channel F3 minus C3, what happens if F3 becomes more negative while C3 is unchanged?",
    options: [
      { id: "a", text: "The trace deflects upward", correct: true },
      { id: "b", text: "The trace deflects downward", correct: false },
      { id: "c", text: "The trace must remain flat", correct: false },
      { id: "d", text: "The channel changes its electrode pair automatically", correct: false },
    ],
    explanation: "F3 − C3 becomes more negative. Under the stated negative-up convention, a more negative channel voltage is drawn upward.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: "q_blink_correlation",
    type: "scenario",
    difficulty: "beginner",
    module: "findings",
    patternId: null,
    question: "Large frontal slow deflections occur with each visible eye blink. What is the most likely explanation?",
    options: [
      { id: "a", text: "A focal seizure with every blink", correct: false },
      { id: "b", text: "Persistent occipital slowing", correct: false },
      { id: "c", text: "A sleep spindle", correct: false },
      { id: "d", text: "Ocular artifact", correct: true },
    ],
    explanation: "Blink-related potentials are often largest frontally. Correlation with video or an eye-movement channel helps distinguish ocular artifact from cerebral slow activity.",
    reference: "American Epilepsy Society — Common Artifacts During EEG Recording (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390358/",
  },

  {
    id: "q_muscle_relaxation",
    type: "scenario",
    difficulty: "beginner",
    module: "findings",
    patternId: null,
    question: "Irregular fast activity over the temporal leads increases with jaw clenching and decreases when the jaw relaxes. What does this favor?",
    options: [
      { id: "a", text: "Muscle artifact", correct: true },
      { id: "b", text: "A posterior dominant rhythm", correct: false },
      { id: "c", text: "Generalized 3 Hz spike-and-wave", correct: false },
      { id: "d", text: "A K-complex", correct: false },
    ],
    explanation: "Muscle contraction produces irregular high-frequency activity. Its relationship to jaw movement and relaxation supports an extracerebral source.",
    reference: "American Epilepsy Society — Common Artifacts During EEG Recording (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390358/",
  },

  {
    id: "q_ecg_artifact",
    type: "scenario",
    difficulty: "intermediate",
    module: "findings",
    patternId: null,
    question: "Sharp transients recur at the heart rate and are time-locked to the QRS complexes in the ECG channel. What is most likely?",
    options: [
      { id: "a", text: "Sleep spindles", correct: false },
      { id: "b", text: "ECG artifact", correct: true },
      { id: "c", text: "A continuous cerebral seizure", correct: false },
      { id: "d", text: "Normal vertex waves", correct: false },
    ],
    explanation: "A consistent relationship to QRS complexes supports ECG contamination. A synchronized ECG channel is valuable when evaluating repetitive sharp transients.",
    reference: "American Epilepsy Society — Common Artifacts During EEG Recording (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390358/",
  },

  {
    id: "q_diffuse_slowing_context",
    type: "scenario",
    difficulty: "intermediate",
    module: "findings",
    patternId: null,
    question: "An awake adult has persistent generalized theta–delta slowing. Which conclusion is best supported by this finding alone?",
    options: [
      { id: "a", text: "Hepatic failure is proven", correct: false },
      { id: "b", text: "Generalized epilepsy is proven", correct: false },
      { id: "c", text: "Diffuse cerebral dysfunction, with an undetermined cause", correct: true },
      { id: "d", text: "A left temporal lesion is localized", correct: false },
    ],
    explanation: "Persistent generalized slowing in an awake adult suggests diffuse dysfunction. Medication effects and metabolic, toxic, or structural causes require clinical correlation.",
    reference: "American Epilepsy Society — The Abnormal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390357/",
  },

  {
    id: "q_normal_eeg_limit",
    type: "scenario",
    difficulty: "beginner",
    module: "findings",
    patternId: null,
    question: "A patient has a convincing history of recurrent unprovoked seizures, but the routine interictal EEG is normal. What does this result mean?",
    options: [
      { id: "a", text: "A normal routine EEG does not exclude epilepsy", correct: true },
      { id: "b", text: "Epilepsy is excluded", correct: false },
      { id: "c", text: "The events must be psychogenic", correct: false },
      { id: "d", text: "Further clinical assessment has no value", correct: false },
    ],
    explanation: "A short interictal recording may miss epileptiform activity. EEG supports the clinical assessment; a normal result must not be used to exclude epilepsy.",
    reference: "NICE NG217 — Diagnosis and assessment of epilepsy",
    referenceUrl: "https://www.nice.org.uk/guidance/ng217/chapter/diagnosis-and-assessment-of-epilepsy",
  },

  {
    id: "q_triphasic_context",
    type: "feature",
    difficulty: "advanced",
    module: "findings",
    patternId: null,
    question: "What is the safest interpretation of generalized periodic discharges with triphasic morphology?",
    options: [
      { id: "a", text: "They uniquely diagnose hepatic encephalopathy", correct: false },
      { id: "b", text: "They always establish nonconvulsive status epilepticus", correct: false },
      { id: "c", text: "They are always harmless normal variants", correct: false },
      { id: "d", text: "Describe the pattern and assess its clinical and EEG context", correct: true },
    ],
    explanation: "Triphasic morphology is a descriptor, not a specific cause. Frequency, evolution, clinical findings, and other EEG features guide interpretation and seizure-risk assessment.",
    reference: "Hirsch et al. — ACNS Standardized Critical Care EEG Terminology (2021)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/",
  },

  {
    id: "q_breach_context",
    type: "scenario",
    difficulty: "advanced",
    module: "findings",
    patternId: null,
    question: "Over a known skull defect, EEG rhythms are higher in amplitude and more sharply contoured than on the opposite side. What should be considered before calling them epileptiform?",
    options: [
      { id: "a", text: "A skull defect has no effect on the EEG", correct: false },
      { id: "b", text: "Breach effect from altered skull filtering", correct: true },
      { id: "c", text: "Every sharp rhythm proves a seizure", correct: false },
      { id: "d", text: "The lower-amplitude side must be electrically silent", correct: false },
    ],
    explanation: "A skull defect can increase amplitude and sharpen normal rhythms. This breach effect can coexist with true abnormalities, so assess the complete field and morphology.",
    reference: "American Epilepsy Society — The Abnormal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390357/",
  },

  {
    id: "q_sensitivity_scale",
    type: "feature",
    difficulty: "beginner",
    module: "concepts",
    patternId: null,
    question: "The same signal is displayed at 5 µV/mm instead of 10 µV/mm. What happens to its displayed height?",
    options: [
      { id: "a", text: "It halves", correct: false },
      { id: "b", text: "It stays unchanged", correct: false },
      { id: "c", text: "It doubles", correct: true },
      { id: "d", text: "Its frequency doubles", correct: false },
    ],
    explanation: "Displayed height equals voltage divided by µV/mm. Halving the µV/mm value doubles the displayed height without changing the recorded signal.",
    reference: "American Epilepsy Society — Principles of Digital EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390353/",
  },

  {
    id: "q_timebase_scale",
    type: "feature",
    difficulty: "beginner",
    module: "concepts",
    patternId: null,
    question: "The same screen width shows 5 seconds instead of 10 seconds of EEG. How does a 1-second event appear?",
    options: [
      { id: "a", text: "Twice as wide, with unchanged true duration", correct: true },
      { id: "b", text: "Half as wide, with unchanged true duration", correct: false },
      { id: "c", text: "Its true duration doubles", correct: false },
      { id: "d", text: "Its frequency becomes zero", correct: false },
    ],
    explanation: "Displaying less time across the same width expands the time axis. The event occupies more pixels, but its measured duration and underlying frequency do not change.",
    reference: "American Epilepsy Society — Principles of Digital EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390353/",
  },

  {
    id: "q_high_pass_effect",
    type: "feature",
    difficulty: "intermediate",
    module: "concepts",
    patternId: null,
    question: "What is a risk of increasing the high-pass cutoff from 0.5 Hz to 5 Hz when reviewing slow activity?",
    options: [
      { id: "a", text: "Slow waves become completely immune to distortion", correct: false },
      { id: "b", text: "All artifacts are reliably removed", correct: false },
      { id: "c", text: "The patient's underlying EEG frequency increases", correct: false },
      { id: "d", text: "Clinically relevant slow waves may be attenuated or distorted", correct: true },
    ],
    explanation: "A high-pass filter attenuates lower frequencies. Raising its cutoff can hide slow activity and alter waveform morphology.",
    reference: "American Epilepsy Society — Principles of Digital EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390353/",
  },

  {
    id: "q_low_pass_effect",
    type: "feature",
    difficulty: "intermediate",
    module: "concepts",
    patternId: null,
    question: "What can happen when the low-pass cutoff is reduced from 70 Hz to 15 Hz?",
    options: [
      { id: "a", text: "All sharp transients become more faithfully represented", correct: false },
      { id: "b", text: "Fast components are attenuated and spikes may look smoother", correct: true },
      { id: "c", text: "Delta activity is selectively removed", correct: false },
      { id: "d", text: "The recording gains new high-frequency information", correct: false },
    ],
    explanation: "Low-pass filtering reduces higher-frequency content. A restrictive setting may suppress fast activity and obscure the sharp contour of a transient.",
    reference: "American Epilepsy Society — Principles of Digital EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390353/",
  },

  {
    id: "q_notch_limit",
    type: "feature",
    difficulty: "intermediate",
    module: "concepts",
    patternId: null,
    question: "What is the primary purpose of a 50 Hz notch filter during EEG review?",
    options: [
      { id: "a", text: "Remove every muscle artifact", correct: false },
      { id: "b", text: "Prove that a discharge is cerebral", correct: false },
      { id: "c", text: "Reduce narrow-band mains interference around 50 Hz", correct: true },
      { id: "d", text: "Restore information lost during acquisition", correct: false },
    ],
    explanation: "A notch filter targets a narrow frequency band. It does not replace correcting poor contacts or other interference sources, and it may alter waveform appearance.",
    reference: "ACNS — Minimum Technical Requirements for Clinical EEG (2016)",
    referenceUrl: "https://www.acns.org/UserFiles/file/Guideline1-MinimumTechnicalRequirementsforPerofrmingClinicalEEG_v1.pdf",
  },

  {
    id: "q_aliasing_risk",
    type: "feature",
    difficulty: "advanced",
    module: "concepts",
    patternId: null,
    question: "A 100 Hz signal is sampled at 150 samples per second without adequate anti-alias filtering. What is the main risk?",
    options: [
      { id: "a", text: "The signal may appear at an incorrect lower frequency", correct: true },
      { id: "b", text: "The amplitude must become exactly zero", correct: false },
      { id: "c", text: "The montage automatically corrects the sampling error", correct: false },
      { id: "d", text: "Increasing display gain recovers the original signal", correct: false },
    ],
    explanation: "150 samples/s is below twice 100 Hz. Without adequate anti-alias filtering, high-frequency content can be misrepresented as lower-frequency activity.",
    reference: "Kane et al. — IFCN EEG glossary (2017)",
    referenceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6123891/",
  },

  {
    id: "q_age_vigilance",
    type: "feature",
    difficulty: "beginner",
    module: "concepts",
    patternId: null,
    question: "Before deciding whether slow activity is abnormal, which information is essential?",
    options: [
      { id: "a", text: "Only the color of the trace", correct: false },
      { id: "b", text: "Only the selected montage name", correct: false },
      { id: "c", text: "Only the number of visible channels", correct: false },
      { id: "d", text: "The patient's age, vigilance state, medications, and distribution of slowing", correct: true },
    ],
    explanation: "Slow activity can be normal during drowsiness or sleep and varies with age. Distribution, persistence, medications, and clinical state determine its significance.",
    reference: "American Epilepsy Society — The Abnormal EEG (2016)",
    referenceUrl: "https://www.ncbi.nlm.nih.gov/books/NBK390357/",
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
