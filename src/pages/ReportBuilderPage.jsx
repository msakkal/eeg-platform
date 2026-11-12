import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { createContext, useContext, useId, useMemo, useRef, useState } from 'react'
import { DEFAULT_REPORT_DATA, generateEEGReport } from '@/engine/reportGenerator'

const SECTIONS = [
  ['study', 'Study and technique'],
  ['background', 'Background'],
  ['sleep', 'Drowsiness and sleep'],
  ['findings', 'Abnormal findings'],
  ['events', 'Events and seizures'],
  ['correlation', 'Clinical correlation'],
  ['preview', 'Review and export'],
]

const LOCATIONS = [
  ...['left', 'right', 'bilateral'].flatMap((side) =>
    [
      'frontal',
      'frontotemporal',
      'anterior temporal',
      'temporal',
      'centrotemporal',
      'central',
      'parietal',
      'occipital',
      'posterior',
    ].map((region) => `${side} ${region} region`),
  ),
  'left hemisphere',
  'right hemisphere',
  'both hemispheres',
  'midline region',
  'multiple independent regions',
]
const EVENT_DESCRIPTIONS = [
  'behavioral arrest',
  'impaired responsiveness',
  'staring',
  'motor automatisms',
  'left arm clonic movements',
  'right arm clonic movements',
  'bilateral tonic-clonic movements',
  'myoclonic jerks',
  'subjective sensory symptoms',
  'the patient?s typical event',
]
const displayLabel = (value) => (value ? value[0].toUpperCase() + value.slice(1) : 'Not specified')

const GuidanceContext = createContext(false)

const FIELD_CRITERIA = {
  'Study type':
    'Choose the protocol actually performed; routine, ambulatory, prolonged, and continuous studies have different sampling and clinical aims.',
  'Recording modality':
    'State whether synchronized video was available, because electroclinical correlation depends on it.',
  'Recording duration':
    'Report the usable recording time, excluding setup and prolonged uninterpretable segments.',
  'Number of channels':
    'Enter channels actually recorded; note a reduced array because it lowers spatial sampling and may limit localization.',
  'Electrode system':
    'Select the placement system used. Standard 10–20 coverage is the minimum reference for routine scalp EEG interpretation.',
  'Technical limitations':
    'Document artifact, missing electrodes, cooperation, or other issues only when they materially limit interpretation.',
  'States recorded':
    'Select only states demonstrated on EEG or video; distinguish physiologic sleep from medication-related sedation or coma.',
  'Activation procedures':
    'Select procedures adequately attempted and document why a standard procedure was omitted or stopped early.',
  'Indication / referral question':
    'Use a de-identified clinical question that the EEG can address; avoid assuming the diagnosis being investigated.',
  'Relevant medications':
    'Include agents that may alter background, sleep architecture, epileptiform activity, or level of consciousness, with timing when known.',
  'Hyperventilation response':
    'Expected bilateral slowing should resolve promptly after hyperventilation; persistent focal slowing or epileptiform activation is abnormal.',
  'Photic response':
    'Assess symmetric driving separately from a photoparoxysmal response; a photomyogenic response is muscle artifact, not cerebral epileptiform activity.',
  Continuity:
    'For adult critical-care terminology: continuous has <1% attenuation/suppression, nearly continuous 1–9%, discontinuous 10–49%, burst-suppression 50–99%, and suppression >99%.',
  Organization:
    'Judge whether expected rhythms, gradients, and state transitions form an orderly age- and state-appropriate background.',
  Symmetry:
    'Compare homologous regions in the same state and montage; persistent differences in frequency or amplitude are more meaningful than brief variation.',
  Voltage:
    "Interpret amplitude in montage and context. ACNS adult critical-care voltage categories are normal ≥20 µV, low 10–<20 µV, and suppressed <10 µV.",
  'Predominant frequencies':
    'Describe activity occupying most of the background, relative to age, vigilance, medication, and recording conditions.',
  'Anterior–posterior gradient':
    'Present means relatively faster, lower-amplitude activity anteriorly with an organized posterior rhythm during appropriate wakefulness.',
  'Variability / state changes':
    'Look for spontaneous, reproducible shifts with vigilance; reduced or absent variability should be judged over adequate recording time.',
  Reactivity:
    'Present requires a reproducible EEG change in frequency or amplitude after stimulation; muscle or movement artifact alone is not reactivity.',
  'Posterior dominant rhythm identified':
    'Mark present only for a sustained posterior rhythm during relaxed wakefulness, best assessed with eye closure.',
  'PDR frequency (Hz)':
    'Measure the dominant posterior frequency over several clean cycles. Interpret by age and state; a typical awake adult PDR is 8–13 Hz.',
  'PDR symmetry':
    'Compare frequency and amplitude at O1/O2 across adequate epochs; describe persistent asymmetry rather than transient waxing and waning.',
  'Reactive to eye opening':
    'Normal reactivity is clear attenuation or blocking with eye opening and return after eye closure.',
  'Sleep obtained':
    'Mark present only when physiologic sleep is supported by state change or recognizable sleep graphoelements.',
  'Stages reached':
    'Stage from the deepest clearly demonstrated state; N2 requires a spindle or K-complex, and N3 requires age-appropriate high-amplitude slow-wave criteria.',
  'Sleep architecture':
    'Assess expected progression, cycling, arousals, and age-appropriate graphoelements; a brief routine EEG may limit this assessment.',
  'Vertex waves':
    'Normal N1–N2 vertex transients are maximal at Cz with a symmetric central field; persistent asymmetry requires context.',
  'Sleep spindles':
    'Identify waxing–waning sigma bursts, usually 11–16 Hz and central; assess age appropriateness and persistent asymmetry or asynchrony.',
  'K-complexes':
    'Identify a well-delineated negative sharp wave followed by a positive slow component in N2; separate dyshormia from a benign K-complex.',
  'Additional sleep observations':
    'Record state-specific elements not captured above, including POSTS, arousals, REM features, or abnormal sleep activation.',
  'Finding status':
    'Select present only when the raw EEG supports the finding after excluding artifact and normal age- or state-related activity.',
  Distribution:
    'Choose the spatial extent supported by the voltage field: focal, lateralized, multifocal/independent, or generalized.',
  'Location / maximum':
    'Name the electrode or region of maximum expression and laterality; localization should follow the field, not one channel alone.',
  'Frequency content':
    'Theta is 4–<8 Hz and delta is <4 Hz; report slowing only when excessive for age, state, and medication.',
  Persistence:
    'Intermittent slowing comes and goes; persistent slowing occupies the region throughout most comparable, artifact-free epochs.',
  Morphology:
    'Choose the observed waveform shape. Sharp contour alone is insufficient—consider duration, field, background disruption, and after-going slow wave.',
  'State dependence':
    'State the vigilance state in which discharges occur and whether sleep activates them; compare equivalent amounts of each state.',
  Field:
    'A physiologic field should involve adjacent electrodes with a plausible gradient and polarity; a single-electrode transient suggests artifact.',
  Pattern:
    'Periodic discharges recur at near-regular intervals; rhythmic delta has no interval between cycles; spike-wave contains a spike or sharp component with a slow wave.',
  Location:
    'Specify predominance and laterality using the electrodes or lobar/hemispheric region that best represents the pattern.',
  'Typical frequency (Hz)':
    'Measure cycles per second over a representative stable segment and report a range when the rate varies.',
  Modifiers:
    'Apply +F, +R, or +S only when the superimposed feature is distinct from the main pattern; fluctuation is not the same as definite evolution.',
  'Stimulus-induced':
    'Mark present only when the pattern is reproducibly triggered or worsened by stimulation; name the stimulus in the narrative when relevant.',
  'Recording result':
    'A seizure requires a qualifying ictal EEG pattern; an event without scalp correlate should be described without assigning etiology from EEG alone.',
  'Number captured':
    'Count only the patient’s typical clinical events that were adequately recorded on EEG and, when available, video.',
  'Event description':
    'Describe observed semiology, responsiveness, onset/offset, and duration without inferring cause.',
  'Number recorded':
    'Count distinct electrographic or electroclinical seizures, or select multiple when an exact count is impractical.',
  Type: 'Electroclinical requires a time-locked clinical correlate; electrographic seizures have no definite clinical correlate.',
  'Electrographic onset':
    'Describe first unequivocal EEG change, localization, frequency, morphology, and earliest spread—separate from clinical onset.',
  Evolution:
    'Definite evolution requires unequivocal sequential changes in frequency, morphology, or location according to standardized criteria; amplitude change alone is insufficient.',
  'Clinical correlate':
    'Document the time-locked sign or symptom and its relationship to EEG onset; do not infer an unobserved correlate.',
  'Additional descriptive finding':
    'Use objective EEG language: morphology, frequency, field, prevalence, state, evolution, and reactivity.',
  'Additional impression statement':
    'Summarize clinical significance with calibrated certainty; avoid unsupported etiology, prognosis, or treatment advice.',
  'Clinical correlation':
    'Answer the referral question, integrate relevant context, and state important limitations or uncertainty.',
}

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))

function getValidationIssues(data) {
  const issues = []
  const addIssue = (step, message) => issues.push({ step, message })
  if (!data.study.duration.trim()) addIssue('study', 'Enter the recording duration.')
  if (!data.study.channels.trim()) addIssue('study', 'Enter the number of recorded channels.')
  if (!data.study.states.length) addIssue('study', 'Select at least one recorded state.')
  if (data.background.pdrPresent && !data.background.pdrFrequency.trim())
    addIssue('background', 'Enter the posterior dominant rhythm frequency.')
  if (
    data.slowing.present &&
    data.slowing.distribution !== 'generalized' &&
    !data.slowing.location.trim()
  )
    addIssue('findings', 'Enter the location of focal slowing.')
  if (
    data.epileptiform.present &&
    data.epileptiform.distribution !== 'generalized' &&
    !data.epileptiform.location.trim()
  )
    addIssue('findings', 'Enter the location of epileptiform discharges.')
  if (data.rhythmicPeriodic.present && !data.rhythmicPeriodic.location.trim())
    addIssue('findings', 'Enter the rhythmic/periodic pattern location.')
  if (data.rhythmicPeriodic.present && !data.rhythmicPeriodic.frequency.trim())
    addIssue('findings', 'Enter the rhythmic/periodic pattern frequency.')
  if (data.events.status === 'seizures' && !data.events.onset.trim())
    addIssue('events', 'Enter the electrographic seizure onset.')
  if (data.events.status === 'seizures' && !data.events.duration.trim())
    addIssue('events', 'Enter the seizure duration.')
  if (
    data.events.status === 'seizures' &&
    data.events.seizureType === 'electroclinical' &&
    !data.events.clinicalCorrelate.trim()
  )
    addIssue('events', 'Describe the clinical correlate.')
  return issues
}

export default function ReportBuilderPage() {
  const language = useLocale()
  const [data, setData] = useState(cloneDefaults)
  const [activeSection, setActiveSection] = useState('study')
  const [copyStatus, setCopyStatus] = useState('')
  const [draftVersion, setDraftVersion] = useState(0)
  const [showGuidance, setShowGuidance] = useState(false)
  const contentRef = useRef(null)
  const openSection = (id) => {
    setActiveSection(id)
    const heading = contentRef.current?.querySelector(`#report-${id}`)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }
  const trackSection = () => {
    const container = contentRef.current
    const top = container.getBoundingClientRect().top + 96
    let current = 'study'
    for (const heading of container.querySelectorAll('[data-report-section]')) {
      if (heading.getBoundingClientRect().top <= top) current = heading.dataset.reportSection
    }
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 8)
      current = 'preview'
    setActiveSection(current)
  }
  const report = useMemo(() => generateEEGReport(data, language), [data, language])
  const validationIssues = useMemo(() => getValidationIssues(data), [data])

  const update = (section, key, value) => {
    setData((current) => {
      const next = { ...current, [section]: { ...current[section], [key]: value } }
      if (section === 'sleep' && key === 'obtained') {
        next.study = {
          ...current.study,
          states: value
            ? [...new Set([...current.study.states, 'sleep'])]
            : current.study.states.filter((state) => state !== 'sleep'),
        }
      }
      if (section === 'study' && key === 'states')
        next.sleep = { ...current.sleep, obtained: value.includes('sleep') }
      return next
    })
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
    setDraftVersion((version) => version + 1)
    openSection('study')
    setCopyStatus('Draft reset')
    window.setTimeout(() => setCopyStatus(''), 2000)
  }

  return (
    <GuidanceContext.Provider value={showGuidance}>
      <div className="flex h-screen flex-col lg:flex-row overflow-hidden">
        <CollapsiblePanel title="Report sections" responsive widthClass="lg:w-60">
          <p className="px-5 pt-5 pb-3 text-xs font-mono uppercase tracking-widest text-eeg-muted">{localize("Report sections")}</p>
          <nav
            className="flex lg:flex-col gap-1 overflow-x-auto px-3 pb-4"
            aria-label={localize("Report builder subsections")}
          >
            {SECTIONS.map(([id, label], index) => (
              <a
                key={id}
                href={`#report-${id}`}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return
                  event.preventDefault()
                  openSection(id)
                }}
                aria-current={activeSection === id ? 'location' : undefined}
                className={`flex items-start gap-3 shrink-0 rounded-lg border px-3 py-2.5 text-sm ${activeSection === id ? 'border-eeg-accent/20 bg-eeg-accent/10 text-eeg-accent' : 'border-transparent text-eeg-muted hover:text-eeg-text'}`}
              >
                <span aria-hidden="true" className="font-mono text-[10px] pt-0.5">
                  {localize(String(index + 1).padStart(2, '0'))}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{localize(label)}</span>
              </a>
            ))}
          </nav>
          <div className="hidden lg:block px-5 pb-5">
            <p className="text-xs text-eeg-muted">
              {localize(validationIssues.length
                ? `${validationIssues.length} checks before export`
                : 'Ready to review')}
            </p>
            <button type="button" onClick={resetReport} className="btn-ghost mt-4">{localize("Reset draft")}</button>
          </div>
        </CollapsiblePanel>
        <div
          ref={contentRef}
          onScroll={trackSection}
          tabIndex={0}
          role="region"
          aria-label={localize("Report characteristics")}
          className="flex-1 min-h-0 overflow-y-auto px-5 py-8 md:px-10"
        >
          <div key={draftVersion} className="max-w-4xl mx-auto">
            <header className="flex flex-wrap justify-between items-start gap-4 mb-8">
              <div>
                <h1 className="section-title">{localize("EEG report builder")}</h1>
                <p className="text-sm text-eeg-muted mt-3">{localize("Select observed features, then review the generated draft below.")}</p>
                <p className="text-xs text-eeg-muted mt-2">{localize("Educational draft. Use de-identified details and verify against the source EEG.")}</p>
              </div>
              <button
                type="button"
                aria-pressed={showGuidance}
                onClick={() => setShowGuidance(!showGuidance)}
                className="btn-ghost"
              >
                {localize(showGuidance ? 'Hide guidance' : 'Show guidance')}
              </button>
            </header>
            <FormSection
              id="study"
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
                <SelectField
                  label="Recording duration"
                  value={data.study.duration}
                  onChange={(value) => update('study', 'duration', value)}
                  options={[
                    '15 minutes',
                    '20 minutes',
                    '30 minutes',
                    '45 minutes',
                    '60 minutes',
                    '90 minutes',
                    '2 hours',
                    '4 hours',
                    '12 hours',
                    '24 hours',
                    '48 hours',
                    '72 hours',
                  ]}
                  allowCustom
                />
                <SelectField
                  label="Number of channels"
                  value={data.study.channels}
                  onChange={(value) => update('study', 'channels', value)}
                  options={['8', '16', '19', '21', '25', '32', '64']}
                  allowCustom
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
              <SelectField
                label="Indication / referral question"
                value={data.study.indication}
                onChange={(value) => update('study', 'indication', value)}
                options={[
                  '',
                  'Evaluation of suspected seizures',
                  'Epilepsy classification',
                  'Evaluation of episodic altered awareness',
                  'Evaluation of encephalopathy',
                  'Monitoring for seizures',
                  'Follow-up EEG in known epilepsy',
                ]}
                allowCustom
              />
              <MedicationField
                value={data.study.medications}
                onChange={(value) => update('study', 'medications', value)}
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

            <FormSection
              id="background"
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
                  <SelectField
                    label="PDR frequency (Hz)"
                    value={data.background.pdrFrequency}
                    onChange={(value) => update('background', 'pdrFrequency', value)}
                    options={Array.from({ length: 39 }, (_, index) => String(1 + index * 0.5))}
                    allowCustom
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

            <FormSection
              id="sleep"
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
                  </div>
                  <details className="rounded-lg border border-eeg-border p-4">
                    <summary className="cursor-pointer text-sm text-eeg-text">{localize("Sleep graphoelements and notes")}</summary>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
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
                    <SelectField
                      label="Additional sleep observations"
                      value={data.sleep.notes}
                      onChange={(value) => update('sleep', 'notes', value)}
                      options={[
                        '',
                        'Positive occipital sharp transients of sleep',
                        'Frequent arousals',
                        'Sleep-activated epileptiform discharges',
                        'Limited sleep sampling',
                      ]}
                      allowCustom
                    />
                  </details>
                </div>
              )}
            </FormSection>

            <FormSection
              id="findings"
              title="Abnormal findings"
              description="Enable only findings you observed. Details appear when selected."
            >
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
                    <SelectField
                      label="Location / maximum"
                      value={data.slowing.location}
                      onChange={(value) => update('slowing', 'location', value)}
                      options={LOCATIONS}
                      allowCustom
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
                    <SelectField
                      label="Location / maximum"
                      value={data.epileptiform.location}
                      onChange={(value) => update('epileptiform', 'location', value)}
                      options={LOCATIONS}
                      allowCustom
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
                  <SelectField
                    label="Location"
                    value={data.rhythmicPeriodic.location}
                    onChange={(value) => update('rhythmicPeriodic', 'location', value)}
                    options={LOCATIONS}
                    allowCustom
                  />
                  <SelectField
                    label="Typical frequency (Hz)"
                    value={data.rhythmicPeriodic.frequency}
                    onChange={(value) => update('rhythmicPeriodic', 'frequency', value)}
                    options={['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '8']}
                    allowCustom
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
            </FormSection>
            <FormSection
              id="events"
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
                  <SelectField
                    label="Event description"
                    value={data.events.eventDescription}
                    onChange={(value) => update('events', 'eventDescription', value)}
                    options={EVENT_DESCRIPTIONS}
                    allowCustom
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
                  <SelectField
                    label="Electrographic onset"
                    value={data.events.onset}
                    onChange={(value) => update('events', 'onset', value)}
                    options={LOCATIONS}
                    allowCustom
                  />
                  <SelectField
                    label="Seizure duration"
                    criteria="Measure from electrographic onset to electrographic offset. Under ACNS adult critical-care criteria, a qualifying evolving pattern lasting ≥10 seconds is an electrographic seizure."
                    value={data.events.duration}
                    onChange={(value) => update('events', 'duration', value)}
                    options={[
                      '5 seconds',
                      '10 seconds',
                      '15 seconds',
                      '20 seconds',
                      '30 seconds',
                      '45 seconds',
                      '60 seconds',
                      '90 seconds',
                      '2 minutes',
                      '3 minutes',
                      '5 minutes',
                    ]}
                    allowCustom
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
                  {data.events.seizureType === 'electroclinical' && (
                    <SelectField
                      label="Clinical correlate"
                      value={data.events.clinicalCorrelate}
                      onChange={(value) => update('events', 'clinicalCorrelate', value)}
                      options={EVENT_DESCRIPTIONS}
                      allowCustom
                    />
                  )}
                </div>
              )}
              <InfoBox>{localize("Absence of an ictal scalp EEG correlate does not by itself determine whether a reported event is neurologic; preserve the observed semiology and clinical context.")}</InfoBox>
            </FormSection>

            <FormSection
              id="correlation"
              title="Clinical correlation"
              description="Add any final context, then check the generated report below."
            >
              <details className="rounded-lg border border-eeg-border p-4">
                <summary className="text-sm text-eeg-text cursor-pointer">{localize("Additional findings or impression (optional)")}</summary>
                <TextAreaField
                  label="Additional descriptive finding"
                  value={data.impression.customFinding}
                  onChange={(value) => update('impression', 'customFinding', value)}
                  placeholder={localize("Appears under Abnormal Findings; describe only what is visible")}
                  rows={4}
                />
                <TextAreaField
                  label="Additional impression statement"
                  value={data.impression.customImpression}
                  onChange={(value) => update('impression', 'customImpression', value)}
                  placeholder={localize("Optional qualified interpretation; do not include treatment instructions")}
                  rows={4}
                />
              </details>
              <SelectField
                label="Clinical correlation"
                value={data.impression.correlation}
                onChange={(value) => update('impression', 'correlation', value)}
                options={[
                  '',
                  'A normal interictal EEG does not exclude epilepsy',
                  'Interpret in conjunction with the clinical history and available imaging',
                  'Interpretation is limited by recording quality',
                  'The captured event has no associated ictal scalp EEG pattern; its cause requires clinical assessment',
                ]}
                allowCustom
              />
              <InfoBox>{localize("A normal interictal EEG does not exclude epilepsy. Interictal epileptiform activity increases seizure propensity but does not independently establish a clinical epilepsy diagnosis.")}</InfoBox>
            </FormSection>

            <FormSection
              id="preview"
              title="Review and export"
              description="Review every sentence against the source EEG before using this draft."
            >
              {validationIssues.length > 0 && (
                <div className="mb-5 rounded-xl border border-eeg-warn/30 bg-eeg-warn/5 p-4">
                  <p className="font-display text-sm font-semibold text-eeg-warn">{localize("Complete before export")}</p>
                  <ul className="mt-2 space-y-1 text-xs text-eeg-muted">
                    {validationIssues.map((issue) => (
                      <li key={issue.message}>
                        <button
                          type="button"
                          onClick={() => openSection(issue.step)}
                          className="text-start underline underline-offset-4 hover:text-eeg-text"
                        >
                          {localize(issue.message)}
                        </button>
                      </li>
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
            <div className="pb-6">
              <button type="button" onClick={resetReport} className="btn-ghost">{localize("Start new draft")}</button>
            </div>
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          {localize(copyStatus)}
        </span>
      </div>
    </GuidanceContext.Provider>
  )
}

function FormSection({ id, title, description, children }) {
  useLocale()
  return (
    <section aria-labelledby={`report-${id}`} className="border-t border-eeg-border py-8">
      <h2
        id={`report-${id}`}
        data-report-section={id}
        tabIndex={-1}
        className="font-display text-2xl font-semibold text-eeg-text scroll-mt-8 focus:outline-none"
      >
        {localize(title)}
      </h2>
      <p className="font-body text-sm text-eeg-muted leading-relaxed mt-3 mb-6">{localize(description)}</p>
      {localize(children)}
    </section>
  )
}

function FindingSection({ title, description, present, onPresentChange, children }) {
  useLocale()
  return (
    <section aria-label={localize(title)} className="card p-5 mb-4">
      <ToggleField label={title} value={present} onChange={onPresentChange} compact />
      {present && (
        <>
          <p className="text-sm text-eeg-muted mt-4 mb-4">{localize(description)}</p>
          {localize(children)}
        </>
      )}
    </section>
  )
}

function CriteriaText({ children }) {
  useLocale()
  const showGuidance = useContext(GuidanceContext)
  if (!showGuidance || !children) return null
  return (
    <span className="block font-body text-[10px] leading-relaxed text-eeg-muted mb-2">
      {localize(children)}
    </span>
  )
}

function SelectField({
  label,
  criteria,
  value,
  onChange,
  options,
  allowCustom = false,
  disabled = false,
}) {
  useLocale()
  const id = useId()
  const [customMode, setCustomMode] = useState(false)
  const isCustom = allowCustom && (customMode || !options.includes(value))
  return (
    <div className="block">
      <label htmlFor={id} className="block font-body text-xs font-medium text-eeg-text mb-1.5">
        {localize(label)}
      </label>
      <CriteriaText>{localize(criteria ?? FIELD_CRITERIA[label])}</CriteriaText>
      <select
        id={id}
        disabled={disabled}
        value={isCustom ? '__custom' : value}
        onChange={(event) => {
          const custom = event.target.value === '__custom'
          setCustomMode(custom)
          onChange(custom ? '' : event.target.value)
        }}
        className="w-full rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2.5 text-sm text-eeg-text focus:border-eeg-accent focus:outline-none disabled:opacity-40"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {localize(displayLabel(option))}
          </option>
        ))}
        {allowCustom && <option value="__custom">{localize("Other (specify)")}</option>}
      </select>
      {isCustom && (
        <label className="block mt-2">
          <span className="block text-xs text-eeg-muted mb-1">{localize(label)}{localize(" (custom)")}</span>
          <input
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-lg border border-eeg-accent/40 bg-eeg-bg px-3 py-2 text-sm text-eeg-text focus:border-eeg-accent focus:outline-none disabled:opacity-40"
          />
        </label>
      )}
    </div>
  )
}

const MEDICATION_OPTIONS = [
  'levetiracetam',
  'lamotrigine',
  'valproate',
  'lacosamide',
  'carbamazepine',
  'oxcarbazepine',
  'topiramate',
  'clobazam',
  'clonazepam',
  'lorazepam',
  'midazolam',
  'propofol',
]

function MedicationField({ value, onChange }) {
  useLocale()
  const values = value ? value.split('; ') : []
  const selected = values.filter((item) => MEDICATION_OPTIONS.includes(item))
  const other = values.filter((item) => !MEDICATION_OPTIONS.includes(item)).join('; ')
  const [showOther, setShowOther] = useState(false)
  return (
    <div className="mt-5">
      <ChoiceGroup
        label="Relevant medications"
        values={selected}
        options={MEDICATION_OPTIONS}
        onToggle={(item) =>
          onChange(
            [
              ...(selected.includes(item)
                ? selected.filter((value) => value !== item)
                : [...selected, item]),
              ...(other ? [other] : []),
            ].join('; '),
          )
        }
      />
      <p className="text-xs text-eeg-muted mt-2">{localize("Select all documented medications that affect interpretation. Leave unselected if not provided.")}</p>
      <button
        type="button"
        className="text-xs text-eeg-accent mt-3 hover:underline"
        aria-expanded={showOther || Boolean(other)}
        onClick={() => setShowOther(!showOther)}
      >{localize("Other medication or timing details")}</button>
      {(showOther || other) && (
        <label className="block mt-2 text-xs text-eeg-muted">{localize("Other relevant medications")}<input
            value={other}
            onChange={(event) =>
              onChange(
                [...selected, ...(event.target.value ? [event.target.value] : [])].join('; '),
              )
            }
            className="mt-1 w-full rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2 text-sm text-eeg-text"
          />
        </label>
      )}
    </div>
  )
}

function TextAreaField({ label, criteria, value, onChange, placeholder, rows = 3 }) {
  useLocale()
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <label className="block mt-5">
      <span className="block font-body text-xs font-medium text-eeg-text mb-1.5">{localize(label)}</span>
      <CriteriaText>{localize(criteriaText)}</CriteriaText>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={localize(placeholder)}
        rows={rows}
        className="w-full resize-y rounded-lg border border-eeg-border bg-eeg-surface px-3 py-2.5 text-sm leading-relaxed text-eeg-text placeholder:text-eeg-muted/60 focus:border-eeg-accent focus:outline-none"
      />
    </label>
  )
}

function ChoiceGroup({ label, criteria, values, options, onToggle }) {
  useLocale()
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <fieldset className="mt-5">
      <legend className="font-body text-xs font-medium text-eeg-text mb-2">{localize(label)}</legend>
      <CriteriaText>{localize(criteriaText)}</CriteriaText>
      <div className="flex flex-wrap gap-2">
        {localize(options.map((option) => {
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
              {localize(displayLabel(option))}
            </button>
          )
        }))}
      </div>
    </fieldset>
  )
}

function ToggleField({ label, criteria, value, onChange, compact = false }) {
  useLocale()
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <div
      className={`${compact ? '' : 'mt-5'} flex items-center justify-between gap-4 rounded-lg border border-eeg-border bg-eeg-surface px-4 py-3`}
    >
      <span className="min-w-0 pr-2">
        <span className="block font-body text-xs font-medium text-eeg-text">{localize(label)}</span>
        <CriteriaText>{localize(criteriaText)}</CriteriaText>
      </span>
      <button
        type="button"
        role="switch"
        aria-label={localize(label)}
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
  useLocale()
  const criteriaText = criteria ?? FIELD_CRITERIA[label]
  return (
    <fieldset>
      <legend className="font-body text-xs font-medium text-eeg-text mb-2">{localize(label)}</legend>
      <CriteriaText>{localize(criteriaText)}</CriteriaText>
      <div className="inline-flex flex-wrap rounded-lg border border-eeg-border bg-eeg-surface p-1 gap-1">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`rounded-md px-3 py-2 text-xs transition-colors ${value === id ? 'bg-eeg-accent text-eeg-bg font-semibold' : 'text-eeg-muted hover:text-eeg-text'}`}
          >
            {localize(text)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function InfoBox({ children }) {
  useLocale()
  const showGuidance = useContext(GuidanceContext)
  if (!showGuidance) return null
  return (
    <div className="mt-6 rounded-xl border border-eeg-accent/20 bg-eeg-accent/5 p-4 text-xs font-body text-eeg-muted leading-relaxed">
      <strong className="text-eeg-accent">{localize("Interpretive note: ")}</strong>
      {localize(children)}
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
  useLocale()
  return (
    <div className="px-5 py-4 border-t border-eeg-border">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyReport}
          disabled={disabled}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >{localize("Copy report")}</button>
        <button
          type="button"
          onClick={downloadReport}
          disabled={disabled}
          className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >{localize("Download .txt")}</button>
      </div>
      <p className="h-4 mt-2 font-mono text-[10px] text-eeg-signal" aria-live="polite">
        {localize(copyStatus)}
      </p>
    </div>
  )
}
