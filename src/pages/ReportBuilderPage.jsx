import { useMemo, useState } from 'react'
import { DEFAULT_REPORT_DATA, generateEEGReport } from '@/engine/reportGenerator'

const STEPS = [
  ['study', 'Study & technique', '01'],
  ['background', 'Background', '02'],
  ['sleep', 'Sleep', '03'],
  ['slowing', 'Slowing', '04'],
  ['epileptiform', 'Epileptiform', '05'],
  ['rhythmicPeriodic', 'Rhythmic / periodic', '06'],
  ['events', 'Events & seizures', '07'],
  ['impression', 'Correlation', '08'],
  ['preview', 'Full report', '09'],
]

const FIELD_CRITERIA = {
  'Study type': 'Choose the protocol actually performed; routine, ambulatory, prolonged, and continuous studies have different sampling and clinical aims.',
  'Recording modality': 'State whether synchronized video was available, because electroclinical correlation depends on it.',
  'Duration': 'Report the usable recording time, excluding setup and prolonged uninterpretable segments.',
  'Number of channels': 'Enter channels actually recorded; note a reduced array because it lowers spatial sampling and may limit localization.',
  'Electrode system': 'Select the placement system used. Standard 10–20 coverage is the minimum reference for routine scalp EEG interpretation.',
  'Technical limitations': 'Document artifact, missing electrodes, cooperation, or other issues only when they materially limit interpretation.',
  'States recorded': 'Select only states demonstrated on EEG or video; distinguish physiologic sleep from medication-related sedation or coma.',
  'Activation procedures': 'Select procedures adequately attempted and document why a standard procedure was omitted or stopped early.',
  'Indication / referral question': 'Use a de-identified clinical question that the EEG can address; avoid assuming the diagnosis being investigated.',
  'Relevant medications': 'Include agents that may alter background, sleep architecture, epileptiform activity, or level of consciousness, with timing when known.',
  'Hyperventilation response': 'Expected bilateral slowing should resolve promptly after hyperventilation; persistent focal slowing or epileptiform activation is abnormal.',
  'Photic response': 'Assess symmetric driving separately from a photoparoxysmal response; a photomyogenic response is muscle artifact, not cerebral epileptiform activity.',
  'Continuity': 'For adult critical-care terminology: continuous has <1% attenuation/suppression, nearly continuous 1–9%, discontinuous 10–49%, burst-suppression 50–99%, and suppression >99%.',
  'Organization': 'Judge whether expected rhythms, gradients, and state transitions form an orderly age- and state-appropriate background.',
  'Symmetry': 'Compare homologous regions in the same state and montage; persistent differences in frequency or amplitude are more meaningful than brief variation.',
  'Voltage': 'Interpret amplitude in montage and context. ACNS adult critical-care convention uses normal >20 µV, low 10–<20 µV, and suppressed <10 µV.',
  'Predominant frequencies': 'Describe activity occupying most of the background, relative to age, vigilance, medication, and recording conditions.',
  'Anterior–posterior gradient': 'Present means relatively faster, lower-amplitude activity anteriorly with an organized posterior rhythm during appropriate wakefulness.',
  'Variability / state changes': 'Look for spontaneous, reproducible shifts with vigilance; reduced or absent variability should be judged over adequate recording time.',
  'Reactivity': 'Present requires a reproducible EEG change in frequency or amplitude after stimulation; muscle or movement artifact alone is not reactivity.',
  'Posterior dominant rhythm identified': 'Mark present only for a sustained posterior rhythm during relaxed wakefulness, best assessed with eye closure.',
  'PDR frequency (Hz)': 'Measure the dominant posterior frequency over several clean cycles. Interpret by age and state; a typical awake adult PDR is 8–13 Hz.',
  'PDR symmetry': 'Compare frequency and amplitude at O1/O2 across adequate epochs; describe persistent asymmetry rather than transient waxing and waning.',
  'Reactive to eye opening': 'Normal reactivity is clear attenuation or blocking with eye opening and return after eye closure.',
  'Sleep obtained': 'Mark present only when physiologic sleep is supported by state change or recognizable sleep graphoelements.',
  'Stages reached': 'Stage from the deepest clearly demonstrated state; N2 requires a spindle or K-complex, and N3 requires age-appropriate high-amplitude slow-wave criteria.',
  'Sleep architecture': 'Assess expected progression, cycling, arousals, and age-appropriate graphoelements; a brief routine EEG may limit this assessment.',
  'Vertex waves': 'Normal N1–N2 vertex transients are maximal at Cz with a symmetric central field; persistent asymmetry requires context.',
  'Sleep spindles': 'Identify waxing–waning sigma bursts, usually 11–16 Hz and central; assess age appropriateness and persistent asymmetry or asynchrony.',
  'K-complexes': 'Identify a well-delineated negative sharp wave followed by a positive slow component in N2; separate dyshormia from a benign K-complex.',
  'Additional sleep observations': 'Record state-specific elements not captured above, including POSTS, arousals, REM features, or abnormal sleep activation.',
  'Finding status': 'Select present only when the raw EEG supports the finding after excluding artifact and normal age- or state-related activity.',
  'Distribution': 'Choose the spatial extent supported by the voltage field: focal, lateralized, multifocal/independent, or generalized.',
  'Location / maximum': 'Name the electrode or region of maximum expression and laterality; localization should follow the field, not one channel alone.',
  'Frequency content': 'Theta is 4–<8 Hz and delta is <4 Hz; report slowing only when excessive for age, state, and medication.',
  'Persistence': 'Intermittent slowing comes and goes; persistent slowing occupies the region throughout most comparable, artifact-free epochs.',
  'Morphology': 'Choose the observed waveform shape. Sharp contour alone is insufficient—consider duration, field, background disruption, and after-going slow wave.',
  'State dependence': 'State the vigilance state in which discharges occur and whether sleep activates them; compare equivalent amounts of each state.',
  'Field': 'A physiologic field should involve adjacent electrodes with a plausible gradient and polarity; a single-electrode transient suggests artifact.',
  'Pattern': 'Periodic discharges recur at near-regular intervals; rhythmic delta has no interval between cycles; spike-wave contains a spike or sharp component with a slow wave.',
  'Location': 'Specify predominance and laterality using the electrodes or lobar/hemispheric region that best represents the pattern.',
  'Typical frequency (Hz)': 'Measure cycles per second over a representative stable segment and report a range when the rate varies.',
  'Modifiers': 'Apply +F, +R, or +S only when the superimposed feature is distinct from the main pattern; fluctuation is not the same as definite evolution.',
  'Stimulus-induced': 'Mark present only when the pattern is reproducibly triggered or worsened by stimulation; name the stimulus in the narrative when relevant.',
  'Recording result': 'A seizure requires a qualifying ictal EEG pattern; an event without scalp correlate should be described without assigning etiology from EEG alone.',
  'Number captured': 'Count only the patient’s typical clinical events that were adequately recorded on EEG and, when available, video.',
  'Event description': 'Describe observed semiology, responsiveness, onset/offset, and duration without inferring cause.',
  'Number recorded': 'Count distinct electrographic or electroclinical seizures, or select multiple when an exact count is impractical.',
  'Type': 'Electroclinical requires a time-locked clinical correlate; electrographic seizures have no definite clinical correlate.',
  'Electrographic onset': 'Describe first unequivocal EEG change, localization, frequency, morphology, and earliest spread—separate from clinical onset.',
  'Evolution': 'Definite evolution is sequential change in at least two of frequency, morphology, or location according to standardized criteria.',
  'Clinical correlate': 'Document the time-locked sign or symptom and its relationship to EEG onset; do not infer an unobserved correlate.',
  'Additional descriptive finding': 'Use objective EEG language: morphology, frequency, field, prevalence, state, evolution, and reactivity.',
  'Additional impression statement': 'Summarize clinical significance with calibrated certainty; avoid unsupported etiology, prognosis, or treatment advice.',
  'Clinical correlation': 'Answer the referral question, integrate relevant context, and state important limitations or uncertainty.',
}

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))

function getValidationIssues(data) {
  const issues = []
  if (!data.study.duration.trim()) issues.push('Enter the recording duration.')
  if (!data.study.channels.trim()) issues.push('Enter the number of recorded channels.')
  if (!data.study.states.length) issues.push('Select at least one recorded state.')
  if (data.background.pdrPresent && !data.background.pdrFrequency.trim())
    issues.push('Enter the posterior dominant rhythm frequency.')
  if (
    data.slowing.present &&
    data.slowing.distribution !== 'generalized' &&
    !data.slowing.location.trim()
  )
    issues.push('Enter the location of focal slowing.')
  if (
    data.epileptiform.present &&
    data.epileptiform.distribution !== 'generalized' &&
    !data.epileptiform.location.trim()
  )
    issues.push('Enter the location of epileptiform discharges.')
  if (data.rhythmicPeriodic.present && !data.rhythmicPeriodic.location.trim())
    issues.push('Enter the rhythmic/periodic pattern location.')
  if (data.rhythmicPeriodic.present && !data.rhythmicPeriodic.frequency.trim())
    issues.push('Enter the rhythmic/periodic pattern frequency.')
  if (data.events.status === 'seizures' && !data.events.onset.trim())
    issues.push('Enter the electrographic seizure onset.')
  if (data.events.status === 'seizures' && !data.events.duration.trim())
    issues.push('Enter the seizure duration.')
  if (
    data.events.status === 'seizures' &&
    data.events.seizureType === 'electroclinical' &&
    !data.events.clinicalCorrelate.trim()
  )
    issues.push('Describe the clinical correlate.')
  return issues
}

export default function ReportBuilderPage() {
  const [data, setData] = useState(cloneDefaults)
  const [activeStep, setActiveStep] = useState('study')
  const [copyStatus, setCopyStatus] = useState('')
  const report = useMemo(() => generateEEGReport(data), [data])
  const validationIssues = useMemo(() => getValidationIssues(data), [data])

  const update = (section, key, value) => {
    setData((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }))
  }

  const toggleListValue = (section, key, value) => {
    const currentValues = data[section][key]
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value]
    update(section, key, nextValues)
  }

  const copyReport = async () => {
    if (validationIssues.length) {
      setCopyStatus('Resolve the review checks before exporting')
      return
    }
    try {
      await navigator.clipboard.writeText(report)
      setCopyStatus('Report copied')
    } catch {
      setCopyStatus('Copy failed — select the preview text manually')
    }
    window.setTimeout(() => setCopyStatus(''), 2500)
  }

  const downloadReport = () => {
    if (validationIssues.length) {
      setCopyStatus('Resolve the review checks before exporting')
      return
    }
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'eeg-report-draft.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetReport = () => {
    setData(cloneDefaults())
    setActiveStep('study')
    setCopyStatus('Draft reset')
    window.setTimeout(() => setCopyStatus(''), 2000)
  }

  const findingsCount = [
    data.slowing.present,
    data.epileptiform.present,
    data.rhythmicPeriodic.present,
    data.events.status !== 'none',
    Boolean(data.impression.customFinding.trim()),
  ].filter(Boolean).length

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 border-r border-eeg-border bg-eeg-surface/30 p-4 overflow-y-auto">
        <div className="mb-5">
          <span className="label-tag inline-block">Drafting tool</span>
          <h1 className="font-display text-lg font-bold text-eeg-text mt-3">EEG Report Builder</h1>
          <p className="font-body text-xs text-eeg-muted leading-relaxed mt-2">
            Select observed characteristics to assemble a structured report.
          </p>
        </div>

        <nav className="space-y-1" aria-label="Report builder steps">
          {STEPS.map(([id, label, number]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveStep(id)}
              aria-current={activeStep === id ? 'step' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                activeStep === id
                  ? 'bg-eeg-accent/10 text-eeg-accent border border-eeg-accent/20'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border/40 border border-transparent'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">{number}</span>
              <span className="font-body text-sm">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-6 pt-4 border-t border-eeg-border">
          <p className="font-mono text-[10px] uppercase tracking-wider text-eeg-muted">
            Current draft
          </p>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-eeg-muted">Selected findings</span>
            <span className="font-mono text-eeg-signal">{findingsCount}</span>
          </div>
          <div
            className={`mt-3 rounded-lg border p-3 ${validationIssues.length ? 'border-eeg-warn/30 bg-eeg-warn/5' : 'border-eeg-signal/20 bg-eeg-signal/5'}`}
          >
            <p
              className={`font-mono text-[10px] ${validationIssues.length ? 'text-eeg-warn' : 'text-eeg-signal'}`}
            >
              {validationIssues.length
                ? `${validationIssues.length} review check${validationIssues.length === 1 ? '' : 's'}`
                : 'Ready to review'}
            </p>
            {validationIssues.length > 0 && (
              <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-eeg-muted">
                {validationIssues.slice(0, 3).map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
                {validationIssues.length > 3 && <li>• {validationIssues.length - 3} more…</li>}
              </ul>
            )}
          </div>
          <button type="button" onClick={resetReport} className="btn-ghost w-full mt-4">
            Reset all
          </button>
        </div>
      </aside>

      <main
        className="flex-1 min-w-0 overflow-y-auto px-7 py-8"
        aria-label="Report characteristics"
      >
        <div className="max-w-3xl mx-auto">
          <div className="mb-7 rounded-xl border border-eeg-warn/25 bg-eeg-warn/5 p-4">
            <p className="text-xs font-body text-eeg-muted leading-relaxed">
              <strong className="text-eeg-warn">Educational draft only.</strong> Do not enter
              patient identifiers. A qualified EEG interpreter must review the source recording,
              correct the generated text, and sign the final clinical report.
            </p>
          </div>

          {activeStep === 'study' && (
            <FormSection
              eyebrow="Step 1"
              title="Study and technique"
              description="Define what was recorded and whether any technical limitation affects interpretation."
            >
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField
                  label="Study type"
                  value={data.study.type}
                  onChange={(value) => update('study', 'type', value)}
                  options={[
                    'Routine EEG',
                    'Sleep-deprived EEG',
                    'Ambulatory EEG',
                    'Prolonged video EEG',
                    'Continuous video EEG',
                  ]}
                />
                <SelectField
                  label="Recording modality"
                  value={data.study.modality}
                  onChange={(value) => update('study', 'modality', value)}
                  options={[
                    'digital video EEG',
                    'digital EEG without video',
                    'ambulatory digital EEG',
                  ]}
                />
                <TextField
                  label="Duration"
                  value={data.study.duration}
                  onChange={(value) => update('study', 'duration', value)}
                  placeholder="e.g. 30 minutes"
                />
                <TextField
                  label="Number of channels"
                  value={data.study.channels}
                  onChange={(value) => update('study', 'channels', value)}
                  placeholder="e.g. 21"
                />
                <SelectField
                  label="Electrode system"
                  value={data.study.electrodeSystem}
                  onChange={(value) => update('study', 'electrodeSystem', value)}
                  options={[
                    'international 10–20 system',
                    'international 10–10 system',
                    'reduced electrode array',
                  ]}
                />
                <SelectField
                  label="Technical limitations"
                  value={data.study.limitations}
                  onChange={(value) => update('study', 'limitations', value)}
                  options={[
                    'None',
                    'Intermittent movement and muscle artifact',
                    'Persistent electrode artifact',
                    'Limited patient cooperation',
                    'Recording is technically limited',
                  ]}
                  allowCustom
                />
              </div>
              <ChoiceGroup
                label="States recorded"
                values={data.study.states}
                options={['awake', 'drowsy', 'sleep', 'sedated', 'comatose']}
                onToggle={(value) => toggleListValue('study', 'states', value)}
              />
              <ChoiceGroup
                label="Activation procedures"
                values={data.study.activations}
                options={['hyperventilation', 'photic stimulation']}
                onToggle={(value) => toggleListValue('study', 'activations', value)}
              />
              <TextAreaField
                label="Indication / referral question"
                value={data.study.indication}
                onChange={(value) => update('study', 'indication', value)}
                placeholder="De-identified clinical indication"
              />
              <TextAreaField
                label="Relevant medications"
                value={data.study.medications}
                onChange={(value) => update('study', 'medications', value)}
                placeholder="Optional; include only clinically relevant medication context"
              />
              {data.study.activations.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4 mt-5">
                  {data.study.activations.includes('hyperventilation') && (
                    <SelectField
                      label="Hyperventilation response"
                      value={data.activation.hyperventilation}
                      onChange={(value) => update('activation', 'hyperventilation', value)}
                      options={[
                        'no abnormal activation',
                        'expected generalized slowing with prompt recovery',
                        'generalized epileptiform discharges',
                        'focal slowing',
                        'not adequately performed',
                      ]}
                      allowCustom
                    />
                  )}
                  {data.study.activations.includes('photic stimulation') && (
                    <SelectField
                      label="Photic response"
                      value={data.activation.photic}
                      onChange={(value) => update('activation', 'photic', value)}
                      options={[
                        'symmetric photic driving without a photoparoxysmal response',
                        'no definite photic driving and no photoparoxysmal response',
                        'a photoparoxysmal response',
                        'a photomyogenic response',
                        'not adequately performed',
                      ]}
                      allowCustom
                    />
                  )}
                </div>
              )}
            </FormSection>
          )}

          {activeStep === 'background' && (
            <FormSection
              eyebrow="Step 2"
              title="Background"
              description="Describe the background independently of isolated abnormalities and interpret it relative to age, state, and medication."
            >
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField
                  label="Continuity"
                  value={data.background.continuity}
                  onChange={(value) => update('background', 'continuity', value)}
                  options={[
                    'continuous',
                    'nearly continuous',
                    'discontinuous',
                    'burst-suppression',
                    'suppressed',
                  ]}
                />
                <SelectField
                  label="Organization"
                  value={data.background.organization}
                  onChange={(value) => update('background', 'organization', value)}
                  options={[
                    'well organized',
                    'fairly organized',
                    'poorly organized',
                    'disorganized',
                  ]}
                />
                <SelectField
                  label="Symmetry"
                  value={data.background.symmetry}
                  onChange={(value) => update('background', 'symmetry', value)}
                  options={['symmetric', 'mildly asymmetric', 'markedly asymmetric']}
                />
                <SelectField
                  label="Voltage"
                  value={data.background.voltage}
                  onChange={(value) => update('background', 'voltage', value)}
                  options={['normal voltage', 'low voltage', 'high voltage', 'variable voltage']}
                />
                <SelectField
                  label="Predominant frequencies"
                  value={data.background.predominantFrequencies}
                  onChange={(value) => update('background', 'predominantFrequencies', value)}
                  options={[
                    'alpha and beta frequencies',
                    'theta and alpha frequencies',
                    'predominantly theta frequencies',
                    'predominantly delta frequencies',
                    'mixed delta and theta frequencies',
                  ]}
                  allowCustom
                />
                <SelectField
                  label="Anterior–posterior gradient"
                  value={data.background.apGradient}
                  onChange={(value) => update('background', 'apGradient', value)}
                  options={['present', 'reduced', 'absent', 'not assessable']}
                />
                <SelectField
                  label="Variability / state changes"
                  value={data.background.variability}
                  onChange={(value) => update('background', 'variability', value)}
                  options={['present', 'reduced', 'absent', 'not assessable']}
                />
                <SelectField
                  label="Reactivity"
                  value={data.background.reactivity}
                  onChange={(value) => update('background', 'reactivity', value)}
                  options={['present', 'reduced', 'absent', 'not tested', 'not assessable']}
                />
              </div>
              <ToggleField
                label="Posterior dominant rhythm identified"
                value={data.background.pdrPresent}
                onChange={(value) => update('background', 'pdrPresent', value)}
              />
              {data.background.pdrPresent && (
                <div className="grid md:grid-cols-3 gap-4 mt-4 p-4 card">
                  <TextField
                    label="PDR frequency (Hz)"
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={data.background.pdrFrequency}
                    onChange={(value) => update('background', 'pdrFrequency', value)}
                  />
                  <SelectField
                    label="PDR symmetry"
                    value={data.background.pdrSymmetry}
                    onChange={(value) => update('background', 'pdrSymmetry', value)}
                    options={[
                      'symmetric',
                      'higher on the left',
                      'higher on the right',
                      'asymmetric in frequency',
                    ]}
                  />
                  <ToggleField
                    compact
                    label="Reactive to eye opening"
                    value={data.background.pdrReactive}
                    onChange={(value) => update('background', 'pdrReactive', value)}
                  />
                </div>
              )}
            </FormSection>
          )}

          {activeStep === 'sleep' && (
            <FormSection
              eyebrow="Step 3"
              title="Drowsiness and sleep"
              description="Document whether sleep was obtained and whether its graphoelements were appropriate and symmetric."
            >
              <ToggleField
                label="Sleep obtained"
                value={data.sleep.obtained}
                onChange={(value) => update('sleep', 'obtained', value)}
              />
              {data.sleep.obtained && (
                <div className="mt-5 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <SelectField
                      label="Stages reached"
                      value={data.sleep.stages}
                      onChange={(value) => update('sleep', 'stages', value)}
                      options={[
                        'N1 sleep',
                        'N1 and N2 sleep',
                        'N1, N2, and N3 sleep',
                        'NREM and REM sleep',
                      ]}
                    />
                    <SelectField
                      label="Sleep architecture"
                      value={data.sleep.architecture}
                      onChange={(value) => update('sleep', 'architecture', value)}
                      options={[
                        'normal',
                        'mildly abnormal',
                        'poorly formed',
                        'disorganized',
                        'not assessable',
                      ]}
                    />
                    <SelectField
                      label="Vertex waves"
                      value={data.sleep.vertexWaves}
                      onChange={(value) => update('sleep', 'vertexWaves', value)}
                      options={[
                        'present and symmetric',
                        'present but asymmetric',
                        'poorly formed',
                        'not identified',
                      ]}
                    />
                    <SelectField
                      label="Sleep spindles"
                      value={data.sleep.spindles}
                      onChange={(value) => update('sleep', 'spindles', value)}
                      options={[
                        'present and symmetric',
                        'present but asymmetric',
                        'asynchronous',
                        'poorly formed',
                        'not identified',
                      ]}
                    />
                    <SelectField
                      label="K-complexes"
                      value={data.sleep.kComplexes}
                      onChange={(value) => update('sleep', 'kComplexes', value)}
                      options={[
                        'present',
                        'present with associated epileptiform discharges (dyshormia)',
                        'poorly formed',
                        'not identified',
                      ]}
                    />
                  </div>
                  <TextAreaField
                    label="Additional sleep observations"
                    value={data.sleep.notes}
                    onChange={(value) => update('sleep', 'notes', value)}
                    placeholder="POSTS, arousals, state-specific findings, or other observations"
                  />
                </div>
              )}
            </FormSection>
          )}

          {activeStep === 'slowing' && (
            <FindingSection
              title="Focal or generalized slowing"
              description="Add slowing only when it is not explained by normal drowsiness, sleep, or artifact."
              present={data.slowing.present}
              onPresentChange={(value) => update('slowing', 'present', value)}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField
                  label="Distribution"
                  value={data.slowing.distribution}
                  onChange={(value) => update('slowing', 'distribution', value)}
                  options={[
                    'focal',
                    'lateralized',
                    'bilateral independent',
                    'multifocal',
                    'generalized',
                  ]}
                />
                {data.slowing.distribution !== 'generalized' && (
                  <TextField
                    label="Location / maximum"
                    value={data.slowing.location}
                    onChange={(value) => update('slowing', 'location', value)}
                  />
                )}
                <SelectField
                  label="Frequency content"
                  value={data.slowing.frequency}
                  onChange={(value) => update('slowing', 'frequency', value)}
                  options={['theta', 'delta', 'theta and delta']}
                />
                <SelectField
                  label="Prevalence"
                  criteria="Estimate the portion of comparable artifact-free recording occupied by slowing; use local conventions and describe uncertainty when sampling is limited."
                  value={data.slowing.prevalence}
                  onChange={(value) => update('slowing', 'prevalence', value)}
                  options={['rare', 'occasional', 'frequent', 'abundant', 'continuous']}
                />
                <SelectField
                  label="Persistence"
                  value={data.slowing.persistence}
                  onChange={(value) => update('slowing', 'persistence', value)}
                  options={['intermittent', 'persistent']}
                />
                <SelectField
                  label="Morphology"
                  value={data.slowing.rhythmicity}
                  onChange={(value) => update('slowing', 'rhythmicity', value)}
                  options={['polymorphic', 'rhythmic', 'semi-rhythmic']}
                />
              </div>
            </FindingSection>
          )}

          {activeStep === 'epileptiform' && (
            <FindingSection
              title="Interictal epileptiform discharges"
              description="Describe the waveform and field. Do not infer epilepsy from an isolated selection."
              present={data.epileptiform.present}
              onPresentChange={(value) => update('epileptiform', 'present', value)}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField
                  label="Distribution"
                  value={data.epileptiform.distribution}
                  onChange={(value) => update('epileptiform', 'distribution', value)}
                  options={['focal', 'multifocal', 'generalized']}
                />
                {data.epileptiform.distribution !== 'generalized' && (
                  <TextField
                    label="Location / maximum"
                    value={data.epileptiform.location}
                    onChange={(value) => update('epileptiform', 'location', value)}
                  />
                )}
                <SelectField
                  label="Morphology"
                  value={data.epileptiform.morphology}
                  onChange={(value) => update('epileptiform', 'morphology', value)}
                  options={[
                    'spikes',
                    'sharp waves',
                    'spike-and-wave discharges',
                    'sharp-and-wave discharges',
                    'polyspikes',
                    'polyspike-and-wave discharges',
                  ]}
                />
                <SelectField
                  label="Prevalence"
                  criteria="For sporadic epileptiform discharges, ACNS defines rare as <1/hour, occasional as 1/hour to <1/minute, frequent as 1/minute to <1/10 seconds, and abundant as >1/10 seconds."
                  value={data.epileptiform.prevalence}
                  onChange={(value) => update('epileptiform', 'prevalence', value)}
                  options={['rare', 'occasional', 'frequent', 'abundant']}
                />
                <SelectField
                  label="State dependence"
                  value={data.epileptiform.state}
                  onChange={(value) => update('epileptiform', 'state', value)}
                  options={[
                    'during wakefulness',
                    'during drowsiness',
                    'during sleep',
                    'in wakefulness and sleep',
                    'without clear state dependence',
                  ]}
                />
                <SelectField
                  label="Field"
                  value={data.epileptiform.field}
                  onChange={(value) => update('epileptiform', 'field', value)}
                  options={[
                    'with a plausible physiologic field',
                    'with a broad field',
                    'with a restricted field',
                    'with shifting laterality',
                  ]}
                  allowCustom
                />
              </div>
            </FindingSection>
          )}

          {activeStep === 'rhythmicPeriodic' && (
            <FindingSection
              title="Rhythmic and periodic patterns"
              description="Use standardized adult critical-care terminology only when it applies; this builder does not apply neonatal criteria."
              present={data.rhythmicPeriodic.present}
              onPresentChange={(value) => update('rhythmicPeriodic', 'present', value)}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField
                  label="Distribution"
                  value={data.rhythmicPeriodic.distribution}
                  onChange={(value) => update('rhythmicPeriodic', 'distribution', value)}
                  options={[
                    'generalized',
                    'lateralized',
                    'bilateral independent',
                    'unilateral independent',
                    'multifocal',
                  ]}
                />
                <SelectField
                  label="Pattern"
                  value={data.rhythmicPeriodic.pattern}
                  onChange={(value) => update('rhythmicPeriodic', 'pattern', value)}
                  options={[
                    'periodic discharges',
                    'rhythmic delta activity',
                    'spike-and-wave activity',
                  ]}
                />
                <TextField
                  label="Location"
                  value={data.rhythmicPeriodic.location}
                  onChange={(value) => update('rhythmicPeriodic', 'location', value)}
                />
                <TextField
                  label="Typical frequency (Hz)"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={data.rhythmicPeriodic.frequency}
                  onChange={(value) => update('rhythmicPeriodic', 'frequency', value)}
                />
                <SelectField
                  label="Prevalence"
                  criteria="For rhythmic/periodic patterns, ACNS defines rare as <1%, occasional 1–9%, frequent 10–49%, abundant 50–89%, and continuous ≥90% of the record or epoch."
                  value={data.rhythmicPeriodic.prevalence}
                  onChange={(value) => update('rhythmicPeriodic', 'prevalence', value)}
                  options={['rare', 'occasional', 'frequent', 'abundant', 'continuous']}
                />
                <SelectField
                  label="Modifiers"
                  value={data.rhythmicPeriodic.modifiers}
                  onChange={(value) => update('rhythmicPeriodic', 'modifiers', value)}
                  options={[
                    'without plus modifiers',
                    'with superimposed fast activity (+F)',
                    'with superimposed rhythmic activity (+R)',
                    'with superimposed sharp waves or spikes (+S)',
                    'with fluctuation',
                    'with evolution',
                  ]}
                />
              </div>
              <ToggleField
                label="Stimulus-induced"
                value={data.rhythmicPeriodic.stimulusInduced}
                onChange={(value) => update('rhythmicPeriodic', 'stimulusInduced', value)}
              />
            </FindingSection>
          )}

          {activeStep === 'events' && (
            <FormSection
              eyebrow="Step 7"
              title="Events and seizures"
              description="Record whether typical events were captured and whether a definite ictal EEG pattern was present."
            >
              <SegmentedField
                label="Recording result"
                value={data.events.status}
                onChange={(value) => update('events', 'status', value)}
                options={[
                  ['none', 'No events / seizures'],
                  ['no_correlate', 'Event without ictal correlate'],
                  ['seizures', 'Seizure recorded'],
                ]}
              />
              {data.events.status === 'no_correlate' && (
                <div className="grid md:grid-cols-2 gap-4 mt-5">
                  <SelectField
                    label="Number captured"
                    value={data.events.eventCount}
                    onChange={(value) => update('events', 'eventCount', value)}
                    options={['one', 'two', 'three', 'multiple']}
                  />
                  <TextField
                    label="Event description"
                    value={data.events.eventDescription}
                    onChange={(value) => update('events', 'eventDescription', value)}
                  />
                </div>
              )}
              {data.events.status === 'seizures' && (
                <div className="grid md:grid-cols-2 gap-4 mt-5">
                  <SelectField
                    label="Number recorded"
                    value={data.events.eventCount}
                    onChange={(value) => update('events', 'eventCount', value)}
                    options={['one', 'two', 'three', 'multiple']}
                  />
                  <SelectField
                    label="Type"
                    value={data.events.seizureType}
                    onChange={(value) => update('events', 'seizureType', value)}
                    options={['electrographic', 'electroclinical']}
                  />
                  <TextField
                    label="Electrographic onset"
                    value={data.events.onset}
                    onChange={(value) => update('events', 'onset', value)}
                  />
                  <TextField
                    label="Duration"
                    criteria="Measure from electrographic onset to electrographic offset. Under ACNS adult critical-care criteria, a qualifying evolving pattern lasting ≥10 seconds is an electrographic seizure."
                    value={data.events.duration}
                    onChange={(value) => update('events', 'duration', value)}
                  />
                  <SelectField
                    label="Evolution"
                    value={data.events.evolution}
                    onChange={(value) => update('events', 'evolution', value)}
                    options={[
                      'with evolution in frequency and morphology',
                      'with evolution in frequency and location',
                      'with evolution in morphology and location',
                    ]}
                    allowCustom
                  />
                  <TextField
                    label="Clinical correlate"
                    value={data.events.clinicalCorrelate}
                    onChange={(value) => update('events', 'clinicalCorrelate', value)}
                    disabled={data.events.seizureType === 'electrographic'}
                    placeholder={
                      data.events.seizureType === 'electrographic'
                        ? 'No definite clinical correlate'
                        : ''
                    }
                  />
                </div>
              )}
              <InfoBox>
                Absence of an ictal scalp EEG correlate does not by itself determine whether a
                reported event is neurologic; preserve the observed semiology and clinical context.
              </InfoBox>
            </FormSection>
          )}

          {activeStep === 'impression' && (
            <FormSection
              eyebrow="Step 8"
              title="Additional findings and correlation"
              description="Add observations not represented by the controls. The generated impression prioritizes selected abnormalities automatically."
            >
              <TextAreaField
                label="Additional descriptive finding"
                value={data.impression.customFinding}
                onChange={(value) => update('impression', 'customFinding', value)}
                placeholder="Appears under Abnormal Findings; describe only what is visible"
                rows={4}
              />
              <TextAreaField
                label="Additional impression statement"
                value={data.impression.customImpression}
                onChange={(value) => update('impression', 'customImpression', value)}
                placeholder="Optional qualified interpretation; do not include treatment instructions"
                rows={4}
              />
              <TextAreaField
                label="Clinical correlation"
                value={data.impression.correlation}
                onChange={(value) => update('impression', 'correlation', value)}
                placeholder="Answer the referral question, acknowledge uncertainty, or suggest correlation with clinical data"
                rows={5}
              />
              <InfoBox>
                A normal interictal EEG does not exclude epilepsy. Interictal epileptiform activity
                increases seizure propensity but does not independently establish a clinical
                epilepsy diagnosis.
              </InfoBox>
            </FormSection>
          )}

          {activeStep === 'preview' && (
            <FormSection
              eyebrow="Step 9"
              title="Full report preview"
              description="Review every sentence against the source EEG before using this draft."
            >
              {validationIssues.length > 0 && (
                <div className="mb-5 rounded-xl border border-eeg-warn/30 bg-eeg-warn/5 p-4">
                  <p className="font-display text-sm font-semibold text-eeg-warn">
                    Complete before export
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-eeg-muted">
                    {validationIssues.map((issue) => (
                      <li key={issue}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ReportPreview report={report} tall />
              <ReportActions
                copyReport={copyReport}
                downloadReport={downloadReport}
                copyStatus={copyStatus}
                disabled={validationIssues.length > 0}
              />
            </FormSection>
          )}
        </div>
      </main>

      <aside className="hidden xl:flex w-[38%] max-w-2xl flex-shrink-0 border-l border-eeg-border bg-eeg-surface/20 flex-col">
        <div className="px-5 py-4 border-b border-eeg-border flex items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-eeg-text">Live report</p>
            <p className="font-mono text-[10px] text-eeg-muted mt-0.5">
              Updates with every selection
            </p>
          </div>
          <span
            className={`font-mono text-[10px] px-2 py-1 rounded border ${findingsCount ? 'text-eeg-warn border-eeg-warn/30 bg-eeg-warn/5' : 'text-eeg-signal border-eeg-signal/30 bg-eeg-signal/5'}`}
          >
            {findingsCount
              ? `${findingsCount} finding${findingsCount === 1 ? '' : 's'}`
              : 'No findings'}
          </span>
        </div>
        <div className="flex-1 min-h-0 p-5">
          <ReportPreview report={report} />
        </div>
        <ReportActions
          copyReport={copyReport}
          downloadReport={downloadReport}
          copyStatus={copyStatus}
          disabled={validationIssues.length > 0}
        />
      </aside>

      <div className="xl:hidden fixed bottom-5 right-5 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveStep('preview')}
          className="btn-primary shadow-xl"
        >
          View report
        </button>
        <button
          type="button"
          onClick={copyReport}
          disabled={validationIssues.length > 0}
          className="btn-ghost bg-eeg-surface shadow-xl disabled:opacity-40"
        >
          Copy
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copyStatus}
      </span>
    </div>
  )
}

function FormSection({ eyebrow, title, description, children }) {
  return (
    <section className="animate-fade-in pb-24">
      <span className="font-mono text-xs uppercase tracking-widest text-eeg-accent">{eyebrow}</span>
      <h2 className="font-display text-3xl font-bold text-eeg-text mt-2">{title}</h2>
      <p className="font-body text-sm text-eeg-muted leading-relaxed mt-3 mb-7 max-w-2xl">
        {description}
      </p>
      {children}
    </section>
  )
}

function FindingSection({ title, description, present, onPresentChange, children }) {
  return (
    <FormSection eyebrow="Finding" title={title} description={description}>
      <SegmentedField
        label="Finding status"
        value={present ? 'present' : 'absent'}
        onChange={(value) => onPresentChange(value === 'present')}
        options={[
          ['absent', 'Not present'],
          ['present', 'Present'],
        ]}
      />
      {present ? (
        <div className="mt-6 p-5 card border-eeg-accent/20">{children}</div>
      ) : (
        <div className="mt-6 card p-6 text-center">
          <p className="font-body text-sm text-eeg-muted">
            This finding will be documented as absent in the generated report.
          </p>
        </div>
      )}
    </FormSection>
  )
}

function CriteriaText({ children }) {
  if (!children) return null
  return (
    <span className="block font-body text-[10px] leading-relaxed text-eeg-muted mb-2">
      {children}
    </span>
  )
}

function SelectField({ label, criteria, value, onChange, options, allowCustom = false }) {
  const isCustom = allowCustom && !options.includes(value)
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <label className="block">
      <span className="block font-body text-xs font-medium text-eeg-text mb-1.5">{label}</span>
      <CriteriaText>{criteriaText}</CriteriaText>
      <select
        value={isCustom ? '__custom' : value}
        onChange={(event) => onChange(event.target.value === '__custom' ? '' : event.target.value)}
        className="w-full rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2.5 text-sm text-eeg-text focus:border-eeg-accent focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {allowCustom && <option value="__custom">Custom…</option>}
      </select>
      {isCustom && (
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter custom description"
          className="mt-2 w-full rounded-lg border border-eeg-accent/40 bg-eeg-bg px-3 py-2 text-sm text-eeg-text focus:border-eeg-accent focus:outline-none"
        />
      )}
    </label>
  )
}

function TextField({ label, criteria, value, onChange, placeholder = '', disabled = false, ...inputProps }) {
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <label className="block">
      <span className="block font-body text-xs font-medium text-eeg-text mb-1.5">{label}</span>
      <CriteriaText>{criteriaText}</CriteriaText>
      <input
        {...inputProps}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2.5 text-sm text-eeg-text placeholder:text-eeg-muted/60 focus:border-eeg-accent focus:outline-none disabled:opacity-40"
      />
    </label>
  )
}

function TextAreaField({ label, criteria, value, onChange, placeholder, rows = 3 }) {
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <label className="block mt-5">
      <span className="block font-body text-xs font-medium text-eeg-text mb-1.5">{label}</span>
      <CriteriaText>{criteriaText}</CriteriaText>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2.5 text-sm leading-relaxed text-eeg-text placeholder:text-eeg-muted/60 focus:border-eeg-accent focus:outline-none"
      />
    </label>
  )
}

function ChoiceGroup({ label, criteria, values, options, onToggle }) {
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <fieldset className="mt-5">
      <legend className="font-body text-xs font-medium text-eeg-text mb-2">{label}</legend>
      <CriteriaText>{criteriaText}</CriteriaText>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(option)}
              className={`px-3 py-2 rounded-lg border text-xs transition-colors ${selected ? 'border-eeg-accent/40 bg-eeg-accent/10 text-eeg-accent' : 'border-eeg-border text-eeg-muted hover:text-eeg-text'}`}
            >
              {selected && <span aria-hidden="true">✓ </span>}
              {option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ToggleField({ label, criteria, value, onChange, compact = false }) {
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <div
      className={`${compact ? '' : 'mt-5'} flex items-center justify-between gap-4 rounded-lg border border-eeg-border bg-eeg-surface px-4 py-3`}
    >
      <span className="min-w-0 pr-2">
        <span className="block font-body text-xs font-medium text-eeg-text">{label}</span>
        <span className="block font-body text-[10px] leading-relaxed text-eeg-muted mt-1">
          {criteriaText}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-eeg-accent' : 'bg-eeg-border'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}

function SegmentedField({ label, criteria, value, onChange, options }) {
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <fieldset>
      <legend className="font-body text-xs font-medium text-eeg-text mb-2">{label}</legend>
      <CriteriaText>{criteriaText}</CriteriaText>
      <div className="inline-flex flex-wrap rounded-lg border border-eeg-border bg-eeg-surface p-1 gap-1">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`rounded-md px-3 py-2 text-xs transition-colors ${value === id ? 'bg-eeg-accent text-eeg-bg font-semibold' : 'text-eeg-muted hover:text-eeg-text'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function InfoBox({ children }) {
  return (
    <div className="mt-6 rounded-xl border border-eeg-accent/20 bg-eeg-accent/5 p-4 text-xs font-body text-eeg-muted leading-relaxed">
      <strong className="text-eeg-accent">Interpretive note: </strong>
      {children}
    </div>
  )
}

function ReportPreview({ report, tall = false }) {
  return (
    <pre
      tabIndex={0}
      className={`h-full ${tall ? 'min-h-[36rem]' : ''} overflow-auto whitespace-pre-wrap rounded-xl border border-eeg-border bg-eeg-bg p-5 font-mono text-xs leading-relaxed text-eeg-text selection:bg-eeg-accent/30`}
    >
      {report}
    </pre>
  )
}

function ReportActions({ copyReport, downloadReport, copyStatus, disabled = false }) {
  return (
    <div className="px-5 py-4 border-t border-eeg-border">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyReport}
          disabled={disabled}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Copy report
        </button>
        <button
          type="button"
          onClick={downloadReport}
          disabled={disabled}
          className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Download .txt
        </button>
      </div>
      <p className="h-4 mt-2 font-mono text-[10px] text-eeg-signal" aria-live="polite">
        {copyStatus}
      </p>
    </div>
  )
}
