import { createContext, useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const SECTIONS = [
  ['overview', 'Reading sequence'],
  ['context', '1. Clinical context'],
  ['technical', '2. Technical check'],
  ['survey', '3. First-pass survey'],
  ['background', '4. Background'],
  ['focality', '5. Symmetry & focality'],
  ['transients', '6. Transients'],
  ['rhythmic', '7. Rhythmic & ictal patterns'],
  ['activation', '8. State & activation'],
  ['artifacts', '9. Artifact challenge'],
  ['report', '10. Synthesis & report'],
  ['references', '11. References'],
]

const ActiveSectionContext = createContext('overview')

const DESCRIPTORS = [
  ['Morphology', 'spike, sharp wave, slow wave, rhythmic, periodic, attenuation'],
  ['Frequency', 'state the dominant or typical rate in Hz; note acceleration or slowing'],
  ['Amplitude', 'use measured voltage when it matters; avoid judging significance by size alone'],
  ['Location', 'generalized, lateralized, bilateral independent, multifocal, or focal'],
  ['Field', 'electrodes involved, phase reversal, voltage gradient, and plausible physiologic spread'],
  ['Time course', 'sporadic or repetitive; prevalence, duration, fluctuation, and evolution'],
  ['Modulation', 'reactivity to eye opening, stimulation, state change, or medication'],
]

function ReadingAlgorithmPage() {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('overview')

  const openSection = id => {
    setActiveSection(id)
    document.getElementById('reading-algorithm-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ActiveSectionContext.Provider value={activeSection}>
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 flex-shrink-0 border-r border-eeg-border bg-eeg-surface/30">
        <nav className="p-4 h-full overflow-y-auto" aria-label="Reading algorithm subsections">
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">Subsections</p>
          <div className="space-y-1">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => openSection(id)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === id
                    ? 'bg-eeg-accent/10 text-eeg-accent border border-eeg-accent/20'
                    : 'text-eeg-muted hover:text-eeg-accent hover:bg-eeg-border/40'
                }`}
                aria-current={activeSection === id ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <div id="reading-algorithm-content" className="flex-1 px-6 md:px-10 py-10 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <span className="label-tag inline-block mb-4">Systematic interpretation</span>
          <h1 className="section-title mb-3">{t('reading_algorithm.title')}</h1>
          <p className="font-body text-eeg-muted text-base leading-relaxed max-w-3xl">
            A fixed reading order prevents a striking waveform from dominating the study.
            Review the entire record, describe observations before interpreting them, and
            return to the clinical question only after the EEG features are established.
          </p>
          <div className="mt-5 rounded-xl border border-eeg-warn/30 bg-eeg-warn/5 p-4 max-w-3xl">
            <p className="font-body text-sm text-eeg-muted leading-relaxed">
              <strong className="text-eeg-warn">Educational framework:</strong> EEG interpretation
              requires supervised clinical training. Age, state, medication, indication, and
              local reporting standards can change how a finding should be understood.
            </p>
          </div>

          <Section id="overview" number="00" title="The complete reading sequence" accent="#00D4FF">
            <p>
              Use the sequence below on every study. The order is deliberate: technical and
              background abnormalities must be recognized before isolated transients can be
              interpreted safely.
            </p>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                ['01', 'Context'], ['02', 'Technical'], ['03', 'Survey'], ['04', 'Background'],
                ['05', 'Focality'], ['06', 'Transients'], ['07', 'Ictal'], ['08', 'Activation'],
                ['09', 'Artifacts'], ['10', 'Report'],
              ].map(([number, label]) => (
                <button key={number} type="button" onClick={() => openSection(SECTIONS[Number(number)][0])} className="card p-3 text-left group hover:border-eeg-accent transition-colors">
                  <span className="font-mono text-[10px] text-eeg-accent">{number}</span>
                  <p className="font-display text-sm text-eeg-text mt-1 group-hover:text-eeg-accent">{label}</p>
                </button>
              ))}
            </div>
            <Callout title="Core rule">
              Describe first, classify second, interpret last. A label should follow from
              observable features rather than replace them.
            </Callout>
          </Section>

          <Section id="context" number="01" title="Define the clinical context" accent="#00FFB0">
            <p>
              Read the indication and identify the question the recording can reasonably answer.
              Record age, level of consciousness, sleep deprivation, recent events, relevant
              imaging, antiseizure or sedating medication, and the timing of the last suspected event.
            </p>
            <Checklist items={[
              'Is this a routine, sleep, ambulatory, prolonged video, or critical-care EEG?',
              'Was the study requested for events, encephalopathy, epilepsy classification, or monitoring?',
              'What was the patient doing during reported symptoms, and is synchronized video available?',
              'Could medication, metabolic disturbance, skull defect, or prior surgery alter the tracing?',
              'What age- and state-dependent features should be expected?',
            ]} />
            <Callout title="Keep the history separate">
              The history changes pre-test probability, but it must not turn every sharp contour
              into an epileptiform discharge. Establish the EEG evidence independently.
            </Callout>
          </Section>

          <Section id="technical" number="02" title="Verify technical integrity and display" accent="#FFD166">
            <p>
              Before reading physiology, confirm that the signal is trustworthy. Review electrode
              labels and impedances, sampling and recording duration, auxiliary channels, filters,
              sensitivity, time base, and the montage being displayed.
            </p>
            <TwoColumn
              leftTitle="Check the recording"
              leftItems={[
                'Electrode placement and channel labels are plausible',
                'No sustained electrode pop, bridge, drift, clipping, or amplifier saturation',
                'ECG, EOG, EMG, respiration, and event markers are present when indicated',
                'Video and EEG clocks are synchronized',
                'Major technical limitations are documented',
              ]}
              rightTitle="Check the display"
              rightItems={[
                'Know the polarity convention and current montage',
                'Use a standard longitudinal bipolar and a referential comparison',
                'Adjust sensitivity without hiding low-voltage or clipping high-voltage activity',
                'Change time base to inspect morphology and evolution',
                'Avoid aggressive filters that distort phase, amplitude, or sharpness',
              ]}
            />
            <Callout title="Re-montage, do not merely zoom">
              A real cerebral potential should have a coherent field. Reformatting the same data
              can reveal its distribution, while an electrode artifact often remains confined to
              channels containing one electrode.
            </Callout>
          </Section>

          <Section id="survey" number="03" title="Perform a first-pass survey" accent="#7B5EA7">
            <p>
              Page through the complete record at a comfortable time scale before analyzing any
              single discharge. Mark wakefulness, drowsiness, sleep, activation procedures,
              reported events, and major changes in organization.
            </p>
            <ol className="mt-5 space-y-3">
              <NumberedItem n="A" title="Scan globally">Look for continuity, gross asymmetry, major state changes, seizures, and long runs of rhythmic or periodic activity.</NumberedItem>
              <NumberedItem n="B" title="Build a timeline">Identify the best awake background, transition into drowsiness, established sleep, arousals, activation, and recovery.</NumberedItem>
              <NumberedItem n="C" title="Return deliberately">Revisit representative clean segments from every state and each suspicious interval using more than one montage.</NumberedItem>
            </ol>
            <Callout title="Do not read only the marked events">
              Event buttons can be absent, late, or accidental. Conversely, an electrographic
              seizure may have no recognized clinical correlate.
            </Callout>
          </Section>

          <Section id="background" number="04" title="Characterize the background" accent="#00D4FF">
            <p>
              The background is the foundation of the report. Describe it separately for awake
              and sleep states, using age and vigilance as the reference rather than a single
              universal definition of normal.
            </p>
            <DescriptorGrid items={[
              ['Organization', 'Is there an orderly anterior–posterior gradient and a sustained posterior dominant rhythm when expected?'],
              ['Frequency', 'Measure the dominant posterior rhythm and note excess focal or generalized slow or fast activity.'],
              ['Voltage', 'Describe unusually low or high voltage in context; confirm that technical factors do not explain it.'],
              ['Symmetry', 'Compare homologous regions for frequency, amplitude, and waveform differences.'],
              ['Continuity', 'Continuous, nearly continuous, discontinuous, burst-suppression, or suppressed—when those terms apply.'],
              ['Variability', 'Does the background change spontaneously with vigilance and over time?'],
              ['Reactivity', 'Does eye opening, sound, touch, or stimulation produce a reproducible change?'],
              ['Sleep architecture', 'Identify expected vertex waves, spindles, K-complexes, and state cycling when appropriate.'],
            ]} />
            <Callout title="Background checklist">
              State → organization → dominant frequency → voltage → symmetry → continuity →
              variability → reactivity → sleep features.
            </Callout>
          </Section>

          <Section id="focality" number="05" title="Test symmetry and localize focal abnormalities" accent="#FFD166">
            <p>
              Compare left with right and anterior with posterior in matched states. A meaningful
              asymmetry should be persistent or reproducible and should survive reasonable changes
              of montage and display settings.
            </p>
            <TwoColumn
              leftTitle="Possible focal dysfunction"
              leftItems={[
                'Persistent polymorphic delta or theta maximal over one region',
                'Loss or attenuation of expected faster activity',
                'Asymmetric posterior dominant rhythm or sleep architecture',
                'Regional voltage asymmetry with a plausible field',
                'Focal breach effect considered when skull integrity is altered',
              ]}
              rightTitle="Before calling it focal"
              rightItems={[
                'Compare the same state on both sides',
                'Inspect a referential and bipolar montage',
                'Check for electrode impedance, bridge, or muscle artifact',
                'Decide whether the asymmetry is frequency, amplitude, or both',
                'State location and persistence rather than implying an etiology',
              ]}
            />
          </Section>

          <Section id="transients" number="06" title="Evaluate transients before labeling them" accent="#FF6B35">
            <p>
              When a transient appears sharp, pause and describe it. Sharpness alone is not
              epileptiform. Evaluate morphology, duration, field, after-going slow wave,
              disruption of the background, state dependence, and recurrence.
            </p>
            <div className="mt-5 overflow-x-auto rounded-xl border border-eeg-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-eeg-surface text-eeg-text font-display">
                  <tr><th className="p-3">Question</th><th className="p-3">What to inspect</th></tr>
                </thead>
                <tbody className="divide-y divide-eeg-border text-eeg-muted">
                  {DESCRIPTORS.map(([term, detail]) => (
                    <tr key={term}><th className="p-3 font-mono text-eeg-accent font-normal">{term}</th><td className="p-3">{detail}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout title="Use a differential diagnosis">
              Compare a suspicious transient with benign variants, sleep transients, eye or
              muscle activity, electrode artifact, ECG, and sharply contoured background rhythms.
              Review repeated examples before deciding.
            </Callout>
          </Section>

          <Section id="rhythmic" number="07" title="Analyze rhythmic, periodic, and ictal patterns" accent="#7B5EA7">
            <p>
              For any sustained pattern, first determine its spatial distribution and then its
              temporal behavior. In critical-care recordings, apply standardized terminology
              consistently rather than using vague labels.
            </p>
            <Checklist items={[
              'Distribution: generalized, lateralized, bilateral independent, unilateral independent, or multifocal',
              'Pattern: periodic discharges, rhythmic delta activity, or spike-and-wave/sharp-and-wave',
              'Frequency and prevalence: typical rate, duration, and proportion of the record',
              'Modifiers: evolution, fluctuation, superimposed fast/rhythmic/sharp activity, and stimulus association',
              'Ictal evidence: clear evolution in frequency, morphology, or location; duration; and clinical correlate',
              'Response: distinguish electrographic change from a meaningful electroclinical response',
            ]} />
            <Callout title="Inspect raw EEG">
              Trends and automated detections are navigation aids. Confirm every suspected seizure
              or rhythmic/periodic pattern in the raw EEG and review its onset, middle, and offset.
            </Callout>
          </Section>

          <Section id="activation" number="08" title="Review state changes and activation procedures" accent="#00FFB0">
            <p>
              Evaluate eye opening and closure, drowsiness, sleep, arousal, hyperventilation,
              photic stimulation, and other documented maneuvers in their own context. Note both
              normal physiologic responses and newly activated abnormalities.
            </p>
            <DescriptorGrid items={[
              ['Eye opening', 'Does the posterior rhythm attenuate appropriately and return with eye closure?'],
              ['Drowsiness', 'Is alpha attenuation followed by expected theta activity and slow eye movements?'],
              ['Sleep', 'Are sleep transients symmetric and appropriate for age and stage?'],
              ['Hyperventilation', 'Describe the timing, distribution, and recovery of slowing or activated discharges.'],
              ['Photic stimulation', 'Separate photic driving from photomyogenic and photoparoxysmal responses.'],
              ['Stimulation', 'Document the stimulus and whether the EEG response is reproducible.'],
            ]} />
          </Section>

          <Section id="artifacts" number="09" title="Challenge every important finding for artifact" accent="#FF6B35">
            <p>
              Before a finding enters the impression, try to disprove it. Correlate with video and
              auxiliary channels, examine its field, change montage, and test whether it follows
              physiologic or environmental timing.
            </p>
            <TwoColumn
              leftTitle="Clues favoring artifact"
              leftItems={[
                'Restricted to channels sharing one electrode',
                'No plausible voltage field or physiologic propagation',
                'Abrupt vertical edge, clipping, step, or nonphysiologic repetition',
                'Locked to eye, jaw, head, limb, ECG, pulse, ventilator, or movement activity',
                'Changes with electrode manipulation or disappears in unaffected channels',
              ]}
              rightTitle="Verification actions"
              rightItems={[
                'Inspect synchronized video and technologist annotations',
                'Compare ECG, EOG, EMG, respiration, and movement channels',
                'Display referential, longitudinal, and transverse montages',
                'Adjust time base and sensitivity; relax filters when safe',
                'Compare multiple occurrences and search for a cerebral field',
              ]}
            />
            <Link to="/artifacts" className="btn-ghost inline-flex mt-5">Open the artifact guide</Link>
          </Section>

          <Section id="report" number="10" title="Synthesize and write the report" accent="#00D4FF">
            <p>
              The report should allow another clinician to understand what was recorded, what was
              observed, and how those observations were interpreted. Keep the description factual
              and reserve diagnostic meaning for the impression.
            </p>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <ReportBlock title="1. Technique">Recording type and duration; electrode system; relevant states, activation, and technical limitations.</ReportBlock>
              <ReportBlock title="2. Background">Organization, dominant frequency, voltage, symmetry, continuity, variability, reactivity, and sleep features.</ReportBlock>
              <ReportBlock title="3. Abnormal findings">Location, morphology, frequency, field, prevalence, evolution, and state dependence of each finding.</ReportBlock>
              <ReportBlock title="4. Events & seizures">Clinical event, EEG onset and evolution, duration, spatial distribution, and electroclinical relationship.</ReportBlock>
              <ReportBlock title="5. Impression">Normal or abnormal; concise ranked abnormalities; localization and severity where supportable.</ReportBlock>
              <ReportBlock title="6. Correlation">Answer the clinical question, state uncertainty, and avoid claiming an etiology the EEG cannot establish.</ReportBlock>
            </div>
            <div className="mt-6 card p-5 border-eeg-accent/30">
              <p className="font-mono text-xs uppercase tracking-wider text-eeg-accent mb-3">Final sign-off check</p>
              <Checklist items={[
                'The impression follows from findings explicitly described in the body',
                'Laterality and localization are internally consistent',
                'No normal variant or artifact is reported as cerebral pathology',
                'Medication, state, and technical limitations are acknowledged where relevant',
                'Urgent or time-sensitive results follow the local communication pathway',
              ]} compact />
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/sandbox" className="btn-primary">Practice in the Sandbox</Link>
              <Link to="/findings" className="btn-ghost">Review clinical findings</Link>
              <Link to="/quiz" className="btn-ghost">Test your recognition</Link>
            </div>
          </Section>

          <Section id="references" number="11" title="Professional references" accent="#00FFB0">
            <p className="font-body text-sm text-eeg-muted mt-2 max-w-3xl">
              This framework is an educational synthesis. Terminology and recording practice are
              informed by the ACNS and joint IFCN–ILAE guidance.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a className="text-eeg-accent hover:underline" href="https://www.acns.org/practice/guidelines" target="_blank" rel="noreferrer">ACNS guidelines and consensus statements</a></li>
              <li><a className="text-eeg-accent hover:underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/" target="_blank" rel="noreferrer">ACNS Standardized Critical Care EEG Terminology: 2021 Version</a></li>
              <li><a className="text-eeg-accent hover:underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10006292/" target="_blank" rel="noreferrer">IFCN–ILAE minimum recording standards for routine and sleep EEG</a></li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
    </ActiveSectionContext.Provider>
  )
}

function Section({ id, number, title, accent, children }) {
  const activeSection = useContext(ActiveSectionContext)
  if (activeSection !== id) return null

  return (
    <section className="mt-10 pt-8 border-t border-eeg-border animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs px-2.5 py-1 rounded-md" style={{ color: accent, backgroundColor: `${accent}14`, border: `1px solid ${accent}40` }}>{number}</span>
        <h2 className="font-display text-2xl font-semibold text-eeg-text">{title}</h2>
      </div>
      <div className="font-body text-sm text-eeg-muted leading-relaxed max-w-4xl">{children}</div>
    </section>
  )
}

function Checklist({ items, compact = false }) {
  return (
    <ul className={`${compact ? 'mt-0' : 'mt-5'} space-y-2`}>
      {items.map(item => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-1 w-4 h-4 rounded border border-eeg-signal/50 text-eeg-signal flex items-center justify-center text-[10px] flex-shrink-0">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Callout({ title, children }) {
  return (
    <div className="mt-5 rounded-xl border border-eeg-accent/20 bg-eeg-accent/5 p-4">
      <p className="font-display text-sm font-semibold text-eeg-text mb-1">{title}</p>
      <p className="text-sm text-eeg-muted leading-relaxed">{children}</p>
    </div>
  )
}

function TwoColumn({ leftTitle, leftItems, rightTitle, rightItems }) {
  return (
    <div className="mt-5 grid md:grid-cols-2 gap-4">
      <div className="card p-5"><h3 className="font-display font-semibold text-eeg-text">{leftTitle}</h3><Checklist items={leftItems} /></div>
      <div className="card p-5"><h3 className="font-display font-semibold text-eeg-text">{rightTitle}</h3><Checklist items={rightItems} /></div>
    </div>
  )
}

function DescriptorGrid({ items }) {
  return (
    <dl className="mt-5 grid md:grid-cols-2 gap-3">
      {items.map(([term, detail]) => (
        <div key={term} className="card p-4"><dt className="font-display font-semibold text-eeg-text text-sm">{term}</dt><dd className="mt-1 text-sm text-eeg-muted">{detail}</dd></div>
      ))}
    </dl>
  )
}

function NumberedItem({ n, title, children }) {
  return <li className="flex gap-3"><span className="font-mono text-eeg-accent">{n}</span><p><strong className="text-eeg-text">{title}.</strong> {children}</p></li>
}

function ReportBlock({ title, children }) {
  return <div className="card p-4"><h3 className="font-display text-sm font-semibold text-eeg-accent">{title}</h3><p className="mt-2 text-sm text-eeg-muted">{children}</p></div>
}

export default ReadingAlgorithmPage
