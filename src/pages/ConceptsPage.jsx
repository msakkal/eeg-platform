import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PropagationSection from '@/components/eeg/PropagationSection'

// ─── Section registry ────────────────────────────────────────────────────────
// Each section has either:
//   - `content`: a plain text string rendered as paragraphs, or
//   - `Component`: a React component that takes over rendering for the section.

const SECTIONS = [
  {
    id: 'what',
    titleKey: 'concepts.what_is_eeg',
    content: `Electroencephalography (EEG) is a non-invasive neurophysiological technique that records the electrical activity of the brain through electrodes placed on the scalp. The signals reflect the summed postsynaptic potentials of millions of cortical neurons acting in synchrony — primarily pyramidal cells oriented perpendicular to the cortical surface.

EEG was first recorded in humans by Hans Berger in 1924. Today it remains a cornerstone of epilepsy diagnosis, sleep medicine, intraoperative monitoring, and critical care neurology due to its excellent temporal resolution (milliseconds) and relatively low cost.`,
  },
  {
    id: 'neuron_dipole',
    titleKey: 'concepts.neuron_dipole',
    Component: NeuronDipoleSection,
  },
  {
    id: 'post_synaptic',
    titleKey: 'concepts.post_synaptic',
    Component: PSPSection,
  },
  {
    id: 'summation',
    titleKey: 'concepts.summation',
    Component: SummationSection,
  },
  {
    id: 'electrodes_impedance',
    titleKey: 'concepts.electrodes_impedance',
    Component: ElectrodesSection,
  },
  {
    id: 'differential_amplification',
    titleKey: 'concepts.differential_amplification',
    Component: DifferentialAmpSection,
  },
  {
    id: 'placement_1020',
    titleKey: 'concepts.placement_1020',
    Component: PlacementSection,
  },
  {
    id: 'frequency_bands',
    titleKey: 'concepts.frequency_bands',
    Component: FrequencyBandsSection,
  },
  {
    id: 'propagation',
    titleKey: 'concepts.propagation',
    Component: PropagationSection,
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ConceptsPage() {
  useLocale()
  const { t } = useTranslation()
  const [active, setActive] = useState('what')
  const section = SECTIONS.find(s => s.id === active)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Section nav ─────────────────────────────────────────────────── */}
      <CollapsiblePanel title="Concept topics" widthClass="w-52"><nav className="p-4">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Sections")}</p>
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full text-start px-3 py-2.5 rounded-lg text-sm transition-all
                ${active === s.id
                  ? 'bg-eeg-accent bg-opacity-10 text-eeg-accent border border-eeg-accent border-opacity-20'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="font-body">{t(s.titleKey)}</span>
              {s.id === 'propagation' && (
                <span className="ms-2 text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ color: '#FF6B35', background: '#FF6B3511', border: '1px solid #FF6B3533' }}>{localize("Interactive")}</span>
              )}
            </button>
          ))}
        </div>
      </nav></CollapsiblePanel>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-10 py-10">
        <span className="label-tag mb-4 inline-block">{t('concepts.title')}</span>

        {/* Component-driven sections render their own header + body */}
        {section?.Component && <section.Component />}

        {/* Plain-text sections */}
        {section && !section.Component && section.content && (
          <>
            <h1 className="section-title mb-2">{t(section.titleKey)}</h1>
            <div className="mt-6 space-y-4 max-w-2xl">
              {section.content.split('\n\n').map((para, i) => (
                <p key={i} className="font-body text-eeg-muted leading-relaxed whitespace-pre-line text-sm">
                  {localize(para)}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Reusable presentation primitives ────────────────────────────────────────

function SectionTitle({ tk }) {
  useLocale()
  const { t } = useTranslation()
  return <h1 className="section-title mb-2">{t(tk)}</h1>
}

function Lead({ children }) {
  useLocale()
  return (
    <p className="font-body text-eeg-text leading-relaxed text-base mt-6 max-w-3xl">
      {localize(children)}
    </p>
  )
}

function Para({ children }) {
  useLocale()
  return (
    <p className="font-body text-eeg-muted leading-relaxed text-sm max-w-3xl">
      {localize(children)}
    </p>
  )
}

function Subhead({ children }) {
  useLocale()
  return (
    <h2 className="font-display text-eeg-accent text-lg font-semibold mt-8 mb-3">
      {localize(children)}
    </h2>
  )
}

function Highlight({ children }) {
  useLocale()
  return <span className="text-eeg-text font-medium">{localize(children)}</span>
}

function Key({ children }) {
  useLocale()
  return (
    <span className="font-mono text-eeg-accent text-[0.92em]">{localize(children)}</span>
  )
}

function Figure({ children, caption }) {
  useLocale()
  return (
    <figure className="my-8 max-w-3xl">
      <div className="card p-6 bg-eeg-card border border-eeg-border rounded-xl">
        {localize(children)}
      </div>
      {caption && (
        <figcaption className="text-xs font-mono text-eeg-muted mt-2 px-2">
          {localize(caption)}
        </figcaption>
      )}
    </figure>
  )
}

// ─── Section: The Neuron as a Dipole ─────────────────────────────────────────

function NeuronDipoleSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.neuron_dipole" />
      <Lead>{localize("Every signal you read on an EEG ultimately originates from currents flowing across the membranes of cortical neurons. To understand the trace, it helps to start one cell at a time.")}</Lead>

      <Subhead>{localize("The Resting Membrane Potential")}</Subhead>
      <Para>{localize("At rest, the inside of a neuron sits at about ")}<Highlight>{localize("−70 mV")}</Highlight>{localize(" relative to the extracellular fluid. This negative interior is built and maintained by three cooperating mechanisms:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>1.</Key> <Highlight>{localize("Differential ion permeability.")}</Highlight>{localize(" The membrane is far more permeable to ")}<Key>K⁺</Key>{localize(" than to ")}<Key>{localize("Na⁺")}</Key>{localize(" at rest, so K⁺ leaks outward along its concentration gradient — leaving negative charges behind.")}</li>
        <li>
          <Key>2.</Key> <Highlight>{localize("The Na⁺/K⁺-ATPase pump.")}</Highlight>{localize(" This integral membrane protein expels 3 Na⁺ and imports 2 K⁺ per ATP, sustaining the gradients against passive leak.")}</li>
        <li>
          <Key>3.</Key> <Highlight>{localize("Trapped intracellular anions.")}</Highlight>{localize(" Proteins, phosphates, and other large negatively charged molecules cannot cross the membrane and contribute to the negative interior.")}</li>
      </ul>

      <Subhead>{localize("The Ion Players")}</Subhead>
      <Para>{localize("Approximate concentrations across the neuronal membrane (mM) and the direction ions tend to move when their channels open:")}</Para>
      <div className="my-5 max-w-3xl overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-eeg-border text-eeg-accent">
              <th className="text-start py-2 px-3">{localize("Ion")}</th>
              <th className="text-end py-2 px-3">{localize("Inside")}</th>
              <th className="text-end py-2 px-3">{localize("Outside")}</th>
              <th className="text-start py-2 px-3 ps-6">{localize("Net driving force")}</th>
            </tr>
          </thead>
          <tbody className="text-eeg-muted">
            <tr className="border-b border-eeg-border border-opacity-30">
              <td className="py-2 px-3"><Key>{localize("Na⁺")}</Key></td>
              <td className="text-end py-2 px-3">12</td>
              <td className="text-end py-2 px-3">145</td>
              <td className="py-2 px-3 ps-6">{localize("Strongly inward")}</td>
            </tr>
            <tr className="border-b border-eeg-border border-opacity-30">
              <td className="py-2 px-3"><Key>K⁺</Key></td>
              <td className="text-end py-2 px-3">140</td>
              <td className="text-end py-2 px-3">4</td>
              <td className="py-2 px-3 ps-6">{localize("Mildly outward")}</td>
            </tr>
            <tr className="border-b border-eeg-border border-opacity-30">
              <td className="py-2 px-3"><Key>{localize("Cl⁻")}</Key></td>
              <td className="text-end py-2 px-3">8</td>
              <td className="text-end py-2 px-3">110</td>
              <td className="py-2 px-3 ps-6">{localize("Inward (at rest)")}</td>
            </tr>
            <tr>
              <td className="py-2 px-3"><Key>{localize("Ca²⁺")}</Key></td>
              <td className="text-end py-2 px-3">0.0001</td>
              <td className="text-end py-2 px-3">1.5</td>
              <td className="py-2 px-3 ps-6">{localize("Very strongly inward")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Para>{localize("Calcium\\u2019s vanishing intracellular concentration is what makes it such an effective signaling molecule — even a small Ca²⁺ influx represents an enormous fold-change in cytoplasmic concentration, allowing it to gate enzymes and trigger neurotransmitter release.")}</Para>

      <Subhead>{localize("How a Single Neuron Becomes a Dipole")}</Subhead>
      <Para>{localize("When excitatory input arrives at the apical dendrite of a cortical pyramidal cell — typically near the cortical surface — Na⁺ flows IN at the synapse. Because charge cannot accumulate, an equal current must flow back OUT of the membrane elsewhere on the cell, mostly near the soma in the deeper layers.")}</Para>
      <Para>{localize("Outside the membrane, the active synapse becomes a current ")}<Highlight>{localize("sink")}</Highlight>{localize(" (locally negative) and the soma region becomes a current ")}<Highlight>{localize("source")}</Highlight>{localize(" (locally positive). The cell has become a tiny battery — an electrical")}{localize(' ')}
        <Highlight>{localize("dipole")}</Highlight>{localize(" aligned along its long axis. That dipole radiates a voltage field through the surrounding tissue.")}</Para>

      <Figure caption="A pyramidal neuron acting as a dipole. Excitatory synaptic input at the apical dendrite drives Na⁺ inward (current sink); return current flows outward near the soma (source). The result is a vertical dipole whose extracellular field can be detected at the scalp.">
        <NeuronDipoleDiagram />
      </Figure>

      <Para>{localize("Critically, every cortical pyramidal neuron is oriented the same way — apical dendrite pointing toward the scalp, soma in deeper layers. When many of them receive synaptic input together, their individual dipoles add up coherently rather than cancelling. This geometric alignment is why the cortex is such an effective EEG source — and why deep nuclei with disorganised cell orientations are nearly invisible to scalp electrodes.")}</Para>
    </>
  )
}

function NeuronDipoleDiagram() {
  useLocale()
  // Side-view of a pyramidal neuron with ion flow annotations and dipole overlay.
  return (
    <svg dir="ltr" viewBox="0 0 520 320" className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="arr-pos" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#FF6B35" />
        </marker>
        <marker id="arr-neg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#00D4FF" />
        </marker>
        <marker id="arr-dipole" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8"
          markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#FFD166" />
        </marker>
      </defs>

      {/* Cortical surface marker */}
      <line x1="60" y1="30" x2="460" y2="30" stroke="#1E2A40" strokeWidth="1" strokeDasharray="3 3" />
      <text x="60" y="22" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("cortical surface")}</text>

      {/* Apical dendrite */}
      <line x1="220" y1="40" x2="220" y2="180" stroke="#00FFB0" strokeWidth="2.2" />
      {/* Apical dendrite branches */}
      <line x1="220" y1="55"  x2="200" y2="42" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="220" y1="55"  x2="240" y2="42" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="220" y1="80"  x2="195" y2="68" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="220" y1="80"  x2="245" y2="68" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="220" y1="105" x2="200" y2="100" stroke="#00FFB0" strokeWidth="1.1" />
      <line x1="220" y1="105" x2="240" y2="100" stroke="#00FFB0" strokeWidth="1.1" />

      {/* Soma (pyramidal triangle) */}
      <polygon points="220,180 200,215 240,215" fill="#0C1220" stroke="#00FFB0" strokeWidth="2" />

      {/* Basal dendrites */}
      <line x1="200" y1="215" x2="170" y2="225" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="240" y1="215" x2="270" y2="225" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="200" y1="215" x2="180" y2="240" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="240" y1="215" x2="260" y2="240" stroke="#00FFB0" strokeWidth="1.3" />
      <line x1="210" y1="217" x2="195" y2="245" stroke="#00FFB0" strokeWidth="1.1" />
      <line x1="230" y1="217" x2="245" y2="245" stroke="#00FFB0" strokeWidth="1.1" />

      {/* Axon */}
      <line x1="220" y1="215" x2="220" y2="295" stroke="#00FFB0" strokeWidth="1.6" />
      <text x="226" y="285" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("axon")}</text>

      {/* Synaptic input arrow (excitatory) */}
      <line x1="280" y1="60" x2="244" y2="58" stroke="#FF6B35" strokeWidth="1.6"
        markerEnd="url(#arr-pos)" />
      <text x="285" y="55" fontSize="10" fontFamily="DM Mono, monospace" fill="#FF6B35">{localize("synaptic input")}</text>
      <text x="285" y="68" fontSize="10" fontFamily="DM Mono, monospace" fill="#FF6B35">{localize("(Na⁺ in)")}</text>

      {/* Sink label */}
      <text x="155" y="55" fontSize="11" fontFamily="DM Mono, monospace" fill="#FF6B35"
        fontWeight="bold">SINK</text>
      <text x="155" y="68" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("(extracellular −)")}</text>

      {/* Source label */}
      <text x="295" y="208" fontSize="11" fontFamily="DM Mono, monospace" fill="#00D4FF"
        fontWeight="bold">SOURCE</text>
      <text x="295" y="221" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("(extracellular +)")}</text>

      {/* Return current arrow (out near soma) */}
      <line x1="244" y1="200" x2="290" y2="200" stroke="#00D4FF" strokeWidth="1.6"
        markerEnd="url(#arr-neg)" />
      <text x="295" y="195" fontSize="10" fontFamily="DM Mono, monospace" fill="#00D4FF">{localize("return current")}</text>

      {/* Membrane potential annotation */}
      <line x1="220" y1="155" x2="378" y2="155" stroke="#5A6A82" strokeWidth="0.5"
        strokeDasharray="2 2" />
      <text x="385" y="158" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">
        V_m ≈ −70 mV
      </text>

      {/* Dipole arrow */}
      <line x1="395" y1="215" x2="395" y2="60" stroke="#FFD166" strokeWidth="2.4"
        markerEnd="url(#arr-dipole)" />
      <text x="403" y="140" fontSize="11" fontFamily="DM Mono, monospace" fill="#FFD166"
        fontWeight="bold">{localize("dipole")}</text>
      <text x="403" y="155" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("(− to +)")}</text>

      {/* Layer labels */}
      <text x="60" y="55" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("layer I–II")}</text>
      <text x="60" y="120" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("layer III")}</text>
      <text x="60" y="200" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("layer V")}</text>
      <text x="60" y="270" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("layer VI")}</text>
    </svg>
  )
}

// ─── Section: Post-Synaptic Potentials ───────────────────────────────────────

function PSPSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.post_synaptic" />
      <Lead>{localize("Action potentials are the most dramatic events in a neuron\\u2019s life — but the scalp EEG hardly records them. The signal that actually reaches the electrode is something slower, smaller, and longer-lived: the post-synaptic potential.")}</Lead>

      <Subhead>{localize("EPSPs and IPSPs")}</Subhead>
      <Para>
        A <Highlight>{localize("post-synaptic potential (PSP)")}</Highlight>{localize(" is the small change in membrane voltage that follows neurotransmitter binding on the receiving cell. There are two flavours.")}</Para>

      <div className="grid md:grid-cols-2 gap-4 my-5 max-w-3xl">
        <div className="card p-5 border border-eeg-border rounded-lg">
          <p className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: '#FF6B35' }}>{localize("Excitatory PSP")}</p>
          <Para>
            <Highlight>{localize("Glutamate")}</Highlight>{localize(" binds ")}<Key>AMPA</Key> / <Key>NMDA</Key>{localize(" receptors, opening ligand-gated channels. ")}<Key>{localize("Na⁺")}</Key>{localize(" (and some ")}<Key>{localize("Ca²⁺")}</Key>{localize(") flow inward and the membrane depolarises by 5–15 mV — pushing the cell closer to its action-potential threshold.")}</Para>
        </div>
        <div className="card p-5 border border-eeg-border rounded-lg">
          <p className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: '#00D4FF' }}>{localize("Inhibitory PSP")}</p>
          <Para>
            <Highlight>GABA</Highlight>{localize(" binds ")}<Key>GABA-A</Key>{localize(" receptors, opening Cl⁻ channels (or, via ")}<Key>GABA-B</Key>{localize(", opens K⁺ channels). The cell hyperpolarises by 2–5 mV, moving it AWAY from threshold.")}</Para>
        </div>
      </div>

      <Para>{localize("Both PSPs are small in amplitude but long in duration — typically ")}<Highlight>10–100 ms</Highlight>{localize(", more than an order of magnitude slower than an action potential.")}</Para>

      <Subhead>{localize("Why EEG Records PSPs and Not Action Potentials")}</Subhead>
      <Para>{localize("It might seem natural that EEG would pick up action potentials — after all, they are huge (a 100 mV swing) compared to PSPs. Three reasons explain why the scalp signal is dominated by post-synaptic activity.")}</Para>

      <Figure caption="Action potentials are large but brief and propagating; PSPs are smaller but slow and stationary. The slower, dipole-forming PSP is what summates across populations of neurons to produce a measurable scalp signal.">
        <PSPvsAPDiagram />
      </Figure>

      <ol className="font-body text-eeg-muted text-sm space-y-3 max-w-3xl mt-2 list-none">
        <li>
          <Key>1.</Key> <Highlight>{localize("Duration.")}</Highlight>{localize(" An action potential lasts ~1 ms. A PSP lasts 10–100 ms. Slower events sum more easily across populations: a few thousand neurons all firing within a 1 ms window is exceedingly rare, but having shared synaptic input that lasts for 50 ms is the norm.")}</li>
        <li>
          <Key>2.</Key> <Highlight>{localize("Spatial structure.")}</Highlight>{localize(" An action potential is a brief travelling wave along an axon. The current entering the membrane just ahead of the spike and the current leaving it just behind are equal and opposite, and at any instant they nearly cancel out at a distance. A PSP, by contrast, sets up a STATIC dipole between the synapse and the soma that persists for tens of milliseconds — a much better antenna for the scalp.")}</li>
        <li>
          <Key>3.</Key> <Highlight>{localize("Synchronization.")}</Highlight>{localize(" Producing a measurable scalp voltage requires millions of cells acting in concert. Action potentials are too brief and too unpredictable to align across such a large population. PSPs, with their slower time course, are far easier to synchronise — which is exactly what thalamocortical and intracortical networks do.")}</li>
      </ol>

      <Para>{localize("The practical takeaway: every alpha cycle, every spike-and-wave complex, every slow wave you see on an EEG represents the synchronous arrival of synaptic input at a population of cortical pyramidal cells — not the spikes they fire in response. EEG is a window onto the brain\\u2019s INPUT, not its output.")}</Para>
    </>
  )
}

function PSPvsAPDiagram() {
  useLocale()
  // Side-by-side: Action Potential (left) vs PSP (right), same time/voltage axes.
  // Shared baseline at -70 mV.
  return (
    <svg dir="ltr" viewBox="0 0 540 260" className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="ax-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5A6A82" />
        </marker>
      </defs>

      {/* LEFT: Action Potential */}
      <text x="20" y="24" fontSize="13" fontFamily="DM Mono, monospace"
        fill="#FF6B35" fontWeight="bold">{localize("Action Potential")}</text>
      <text x="20" y="40" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("~1 ms, ~+30 mV peak")}</text>

      {/* AP axes */}
      <line x1="35" y1="180" x2="240" y2="180" stroke="#5A6A82" strokeWidth="1"
        markerEnd="url(#ax-arr)" />
      <line x1="35" y1="200" x2="35" y2="60" stroke="#5A6A82" strokeWidth="1"
        markerEnd="url(#ax-arr)" />
      <text x="120" y="220" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("time (ms)")}</text>
      <text x="10" y="65" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">mV</text>

      {/* AP voltage gridlines */}
      <line x1="35" y1="80"  x2="240" y2="80"  stroke="#1E2A40" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="35" y1="140" x2="240" y2="140" stroke="#1E2A40" strokeWidth="0.5" strokeDasharray="2 2" />
      <text x="0" y="83"  fontSize="9"  fontFamily="DM Mono, monospace" fill="#5A6A82">+30</text>
      <text x="0" y="143" fontSize="9"  fontFamily="DM Mono, monospace" fill="#5A6A82">−40</text>
      <text x="0" y="183" fontSize="9"  fontFamily="DM Mono, monospace" fill="#5A6A82">−70</text>

      {/* AP time labels */}
      <text x="105" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">1</text>
      <text x="170" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">2</text>

      {/* AP waveform: rapid rise to +30, fast fall, brief AHP, return */}
      <path d="M 35,180 L 90,180 Q 95,180 98,165 L 100,82 Q 102,75 105,82 L 108,150 Q 112,182 116,182 Q 122,182 126,178 Q 134,170 142,180 L 240,180"
        fill="none" stroke="#FF6B35" strokeWidth="2" />

      {/* AP marker labels */}
      <text x="100" y="74" fontSize="9" fontFamily="DM Mono, monospace" fill="#FF6B35">{localize("spike")}</text>
      <text x="118" y="200" fontSize="9" fontFamily="DM Mono, monospace" fill="#FF6B35">AHP</text>

      {/* Divider */}
      <line x1="270" y1="20" x2="270" y2="220" stroke="#1E2A40" strokeWidth="0.7"
        strokeDasharray="2 3" />

      {/* RIGHT: PSP */}
      <text x="290" y="24" fontSize="13" fontFamily="DM Mono, monospace"
        fill="#00FFB0" fontWeight="bold">{localize("Post-Synaptic Potential")}</text>
      <text x="290" y="40" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("~30 ms, ~+10 mV peak")}</text>

      {/* PSP axes */}
      <line x1="305" y1="180" x2="520" y2="180" stroke="#5A6A82" strokeWidth="1"
        markerEnd="url(#ax-arr)" />
      <line x1="305" y1="200" x2="305" y2="60" stroke="#5A6A82" strokeWidth="1"
        markerEnd="url(#ax-arr)" />
      <text x="395" y="220" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("time (ms)")}</text>

      {/* PSP gridlines */}
      <line x1="305" y1="140" x2="520" y2="140" stroke="#1E2A40" strokeWidth="0.5" strokeDasharray="2 2" />
      <text x="276" y="143" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">−40</text>
      <text x="276" y="183" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">−70</text>

      {/* PSP time labels (same scale as left, but the curve unfolds over more ticks) */}
      <text x="345" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">10</text>
      <text x="385" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">20</text>
      <text x="425" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">30</text>
      <text x="465" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">40</text>

      {/* EPSP waveform: smooth rise then exponential decay */}
      <path d="M 305,180
               C 320,180 332,178 345,160
               C 358,142 372,135 380,140
               C 398,150 420,170 460,178
               C 480,180 500,180 520,180"
        fill="none" stroke="#00FFB0" strokeWidth="2" />

      <text x="350" y="125" fontSize="9" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("EPSP peak")}</text>

      {/* IPSP overlay (dashed) — small dip below baseline */}
      <path d="M 305,180
               C 318,180 334,182 345,195
               C 358,207 374,205 385,196
               C 410,184 460,182 520,180"
        fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="408" y="218" fontSize="9" fontFamily="DM Mono, monospace" fill="#00D4FF">IPSP</text>
    </svg>
  )
}

// ─── Section: Summation & Volume Conduction ──────────────────────────────────

function SummationSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.summation" />
      <Lead>{localize("A single neuron\\u2019s PSP produces an extracellular voltage of just a few microvolts at the cell surface — far too small to detect through the skull. The EEG signal is what emerges when MASSIVE numbers of pyramidal cells fire in concert and their currents spread passively through the head as a volume conductor.")}</Lead>

      <Subhead>{localize("The Cortical Generator")}</Subhead>
      <Para>{localize("Three anatomical features make the cortex an unusually effective EEG source:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Cell density.")}</Highlight>{localize(" Every square millimetre of cortex contains roughly ")}<Key>10⁵</Key>{localize(" neurons, organised in 6 layers spanning ~3 mm of depth.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Pyramidal cell alignment.")}</Highlight>{localize(" About 75% of cortical neurons are pyramidal cells, and they are uniformly oriented: soma in deeper layers, apical dendrite pointing toward the cortical surface. This \\u201copen-field\\u201d geometry means their dipoles ADD rather than cancel.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Synchronizing networks.")}</Highlight>{localize(" Thalamocortical loops, recurrent intracortical excitation, and shared inhibitory interneurons drive populations of pyramidal cells to receive synaptic input simultaneously — turning a noisy crowd into a coherent chorus.")}</li>
      </ul>
      <Para>{localize("For a measurable scalp signal of ~10 µV, roughly ")}<Highlight>{localize("10⁷ neurons")}</Highlight>{localize(' ')}{localize("spanning ")}<Highlight>{localize("~6 cm² of cortex")}</Highlight>{localize(" must be active in synchrony. This is why sub-clinical activity can hide entirely from scalp electrodes — and why a normal-looking scalp EEG does not, on its own, rule out abnormal cortical activity. Subdural and depth electrodes routinely pick up things scalp recordings miss.")}</Para>

      <Subhead>{localize("Volume Conduction")}</Subhead>
      <Para>{localize("The brain, cerebrospinal fluid, skull, and scalp form a continuous resistive medium. Currents flow through them passively and instantaneously, smoothing and attenuating the cortical field on its way to the electrode.")}</Para>

      <Figure caption="Volume conduction through the head. Synchronously active pyramidal cells in a cortical column produce a coherent dipole. Current spreads through CSF, attenuates ~100× across the high-resistance skull, and produces a smoothed, broadly distributed scalp potential.">
        <VolumeConductionDiagram />
      </Figure>

      <Para>{localize("Each layer the signal passes through has a different role:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Brain tissue (~3 Ω·m).")}</Highlight>{localize(" Conducts current relatively easily but anisotropically — current flows more freely along white-matter tracts than across them.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Cerebrospinal fluid (~0.6 Ω·m).")}</Highlight>{localize(" A thin, highly conductive layer that \\u201csmears\\u201d the cortical field laterally before it reaches the skull.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Skull (~80 Ω·m, ~1 cm thick).")}</Highlight>{localize(" The dominant insulator. The skull is roughly 25× more resistive than the brain beneath it, attenuating signal amplitude by about two orders of magnitude and forcing currents to spread tangentially through the CSF before crossing.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Scalp (~3 Ω·m).")}</Highlight>{localize(" Conducts easily again. The electrode sees a smoothed, attenuated version of the cortical field.")}</li>
      </ul>

      <Subhead>{localize("Why Volume Conduction Matters at the Bedside")}</Subhead>
      <ol className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>1.</Key> <Highlight>{localize("Spatial resolution is intrinsically limited.")}</Highlight>{localize(' ')}{localize("Each scalp electrode samples a region of cortex roughly 4–6 cm in diameter, regardless of how small the underlying generator is.")}</li>
        <li>
          <Key>2.</Key> <Highlight>{localize("Deep sources are undersampled.")}</Highlight>{localize(" Activity in the hippocampus, mesial temporal lobe, or interhemispheric cortex is heavily attenuated and may not appear at the scalp at all — even when the discharge is electrographically obvious on intracranial recording.")}</li>
        <li>
          <Key>3.</Key> <Highlight>{localize("Phase reversal identifies a field extremum.")}</Highlight>{localize(' ')}{localize("Bipolar phase reversal indicates a local scalp-potential extremum. Source depth, orientation, and tissue conductivity affect the field, so phase reversal alone cannot precisely locate the cortical generator.")}</li>
      </ol>
    </>
  )
}

function VolumeConductionDiagram() {
  useLocale()
  // Cross-section through the head: cortex -> CSF -> skull -> scalp -> electrode.
  // Several pyramidal cells (small triangles + dendrites) all aligned vertically;
  // dipole arrows pointing up; field lines fanning out through CSF and skull.
  const cellPositions = [180, 220, 260, 300, 340]
  return (
    <svg dir="ltr" viewBox="0 0 540 360" className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="vc-up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#FFD166" />
        </marker>
      </defs>

      {/* Layered head model — labels on the left */}
      <text x="20" y="42" fontSize="11" fontFamily="DM Mono, monospace" fill="#5A6A82" fontWeight="bold">{localize("scalp")}</text>
      <text x="20" y="80" fontSize="11" fontFamily="DM Mono, monospace" fill="#5A6A82" fontWeight="bold">{localize("skull")}</text>
      <text x="20" y="135" fontSize="11" fontFamily="DM Mono, monospace" fill="#5A6A82" fontWeight="bold">CSF</text>
      <text x="20" y="200" fontSize="11" fontFamily="DM Mono, monospace" fill="#5A6A82" fontWeight="bold">{localize("cortex")}</text>

      {/* Layers as horizontal bands */}
      <rect x="100" y="20"  width="430" height="40" fill="#1A1A30" stroke="#1E2A40" />
      <rect x="100" y="60"  width="430" height="50" fill="#0E1828" stroke="#1E2A40" />
      <rect x="100" y="110" width="430" height="40" fill="#0C1830" stroke="#1E2A40" />
      <rect x="100" y="150" width="430" height="120" fill="#0C1220" stroke="#1E2A40" />
      <rect x="100" y="270" width="430" height="60" fill="#080F1E" stroke="#1E2A40" />

      {/* Layer resistivity annotations on right */}
      <text x="445" y="42" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">~3 Ω·m</text>
      <text x="445" y="90" fontSize="9" fontFamily="DM Mono, monospace" fill="#FFD166">~80 Ω·m</text>
      <text x="445" y="135" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">~0.6 Ω·m</text>
      <text x="445" y="265" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">~3 Ω·m</text>

      {/* Skull insulation hatching */}
      {[105, 125, 145, 165, 185, 205, 225, 245, 265, 285, 305, 325, 345, 365, 385, 405, 425, 445, 465, 485, 505, 525].map(x =>
        <line key={x} x1={x} y1="60" x2={x + 12} y2="110" stroke="#FFD16633" strokeWidth="0.6" />
      )}

      {/* Pyramidal cells in cortical column */}
      {cellPositions.map((x, i) => (
        <g key={i}>
          {/* Apical dendrite */}
          <line x1={x} y1="155" x2={x} y2="225" stroke="#00FFB0" strokeWidth="1.4" />
          {/* Apical branches */}
          <line x1={x} y1="158" x2={x - 8} y2="152" stroke="#00FFB0" strokeWidth="0.8" />
          <line x1={x} y1="158" x2={x + 8} y2="152" stroke="#00FFB0" strokeWidth="0.8" />
          {/* Soma triangle */}
          <polygon points={`${x},225 ${x-7},243 ${x+7},243`}
            fill="#0C1220" stroke="#00FFB0" strokeWidth="1.4" />
          {/* Basal dendrites */}
          <line x1={x - 7} y1="243" x2={x - 14} y2="252" stroke="#00FFB0" strokeWidth="0.8" />
          <line x1={x + 7} y1="243" x2={x + 14} y2="252" stroke="#00FFB0" strokeWidth="0.8" />
          {/* Axon */}
          <line x1={x} y1="243" x2={x} y2="266" stroke="#00FFB0" strokeWidth="1" />
          {/* Synaptic input arrow at apical tip */}
          <line x1={x + 25} y1="148" x2={x + 5} y2="152" stroke="#FF6B35"
            strokeWidth="1" />
          {/* Dipole arrow */}
          <line x1={x} y1="240" x2={x} y2="160" stroke="#FFD166" strokeWidth="2.2"
            markerEnd="url(#vc-up)" opacity="0.85" />
        </g>
      ))}
      <text x="180" y="260" fontSize="9" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("synchronous dipoles")}</text>

      {/* Field lines spreading through CSF and skull, smearing laterally */}
      {localize([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
        const startX = 180 + i * 20
        const arc = 80 - Math.abs(4 - i) * 6
        return (
          <path
            key={i}
            d={`M ${startX},155 Q ${startX + (i < 4 ? -arc/2 : arc/2)},115 ${startX + (i < 4 ? -arc : arc)},90`}
            fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.45"
          />
        )
      }))}
      <text x="365" y="125" fontSize="9" fontFamily="DM Mono, monospace" fill="#00D4FF">{localize("field lines spread laterally")}</text>

      {/* Scalp electrode */}
      <g>
        <line x1="260" y1="0"  x2="260" y2="20"  stroke="#00FFB0" strokeWidth="2.5" />
        <circle cx="260" cy="20" r="6" fill="#0D1424" stroke="#00FFB0" strokeWidth="1.6" />
        <circle cx="260" cy="20" r="2" fill="#00FFB0" />
        <text x="270" y="15" fontSize="11" fontFamily="DM Mono, monospace" fill="#00FFB0"
          fontWeight="bold">{localize("electrode")}</text>
        <text x="270" y="28" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">
          ~10–100 µV
        </text>
      </g>

      {/* Attenuation annotation */}
      <text x="100" y="350" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("skull attenuates the signal by ~100× and smears it across ~6 cm of scalp")}</text>
    </svg>
  )
}

// ─── Section: Electrodes & Impedance ────────────────────────────────────────

function ElectrodesSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.electrodes_impedance" />
      <Lead>{localize("Before any signal can be recorded, current has to actually flow from the scalp into the recording amplifier — and that\\u2019s a surprisingly difficult problem. Skin is a poor conductor; hair, oils, and the keratinised stratum corneum all stand between the underlying brain potential and the electrode wire.")}</Lead>

      <Subhead>{localize("What an Electrode Actually Does")}</Subhead>
      <Para>{localize("An EEG electrode is a ")}<Highlight>{localize("metal-electrolyte half-cell")}</Highlight>. The
        metal — usually silver coated with silver chloride (<Key>{localize("Ag/AgCl")}</Key>{localize("), sometimes gold or tin — sits in conductive gel that bridges the gap to the skin. Ag/AgCl is preferred because it forms a stable, low-noise junction that passes ions back and forth without polarising. Bare metal in skin contact polarises, drifts, and produces slow artefacts that creep into the lower frequency bands.")}</Para>

      <Subhead>{localize("Skin–Electrode Impedance")}</Subhead>
      <Para>{localize("The contact between gel and skin has electrical impedance — a frequency- dependent resistance. For a clinical recording, the technologist aims for:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>&lt; 5 kΩ</Highlight>{localize(" — ideal contact, clean signal.")}</li>
        <li>
          <Key>•</Key> <Highlight>5–10 kΩ</Highlight>{localize(" — acceptable for routine recording.")}</li>
        <li>
          <Key>•</Key> <Highlight>&gt; 20 kΩ</Highlight>{localize(" — problematic. Re-prep the site before recording.")}</li>
      </ul>

      <Figure caption="Cross-section of an EEG electrode in contact with the scalp. The conductive gel reduces impedance at the gel–skin interface to under 5 kΩ. Higher impedance lets in mains noise and amplifier noise, and creates asymmetry between channels.">
        <ElectrodeContactDiagram />
      </Figure>

      <Para>{localize("High impedance causes three concrete problems at the bedside:")}</Para>
      <ol className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>1.</Key> <Highlight>{localize("Increased noise.")}</Highlight>{localize(" Higher impedance passes more amplifier (Johnson) noise, raising the noise floor of the channel.")}</li>
        <li>
          <Key>2.</Key> <Highlight>{localize("Asymmetric attenuation.")}</Highlight>{localize(" A differential amplifier is only as clean as its WORST input — one bad electrode can degrade an entire chain of bipolar derivations.")}</li>
        <li>
          <Key>3.</Key> <Highlight>{localize("Mains pickup.")}</Highlight>{localize(" 50/60 Hz interference couples capacitively from the environment. Equal impedance at both inputs lets the amplifier reject it; mismatched impedance does not.")}</li>
      </ol>
      <Para>{localize("To reduce impedance, the technologist abrades the stratum corneum lightly, applies conductive paste or gel, and sometimes massages the area. Impedance is checked at the start of every recording and rechecked when artefacts appear.")}</Para>

      <Subhead>{localize("Reference and Ground Electrodes")}</Subhead>
      <Para>{localize("Every EEG recording requires more than a single scalp contact:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Active electrode")}</Highlight>{localize(" — the scalp site of interest (e.g., O1).")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Reference electrode")}</Highlight>{localize(" — a contralateral or quasi-neutral site that the active is compared against.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Ground electrode")}</Highlight>{localize(" — provides a return path to the amplifier and a stable common-mode reference. Modern digital systems often use a \\u201cdriven right leg\\u201d\\u2013style active ground.")}</li>
      </ul>
      <Para>{localize("The choice of reference shapes the entire trace: an \\u201caverage reference\\u201d sums all electrodes and subtracts the mean; a \\u201clinked-ears\\u201d reference uses A1+A2 bridged together. Each has different localising properties — see the Montages section for details.")}</Para>
    </>
  )
}

function ElectrodeContactDiagram() {
  useLocale()
  // Side-view of an electrode disc resting on scalp, with gel layer and skin layers.
  return (
    <svg dir="ltr" viewBox="0 0 540 280" className="w-full max-w-2xl mx-auto">
      {/* Cable */}
      <line x1="280" y1="10" x2="280" y2="50" stroke="#5A6A82" strokeWidth="3" />
      <text x="290" y="25" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("cable to amp")}</text>

      {/* Metal electrode disc */}
      <ellipse cx="280" cy="55" rx="55" ry="9" fill="#0D1424" stroke="#00FFB0" strokeWidth="2" />
      <rect x="225" y="55" width="110" height="14" fill="#0D1424" stroke="#00FFB0" strokeWidth="2" />
      <ellipse cx="280" cy="69" rx="55" ry="9" fill="#0D1424" stroke="#00FFB0" strokeWidth="2" />
      <text x="345" y="63" fontSize="11" fontFamily="DM Mono, monospace" fill="#00FFB0" fontWeight="bold">{localize("Ag/AgCl disc")}</text>
      <text x="345" y="76" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("~10 mm Ø")}</text>

      {/* Conductive gel */}
      <path d="M 230 70 Q 280 92 330 70 L 330 100 Q 280 110 230 100 Z"
        fill="#00D4FF22" stroke="#00D4FF" strokeWidth="1.4" />
      <text x="345" y="92" fontSize="11" fontFamily="DM Mono, monospace" fill="#00D4FF" fontWeight="bold">{localize("conductive gel")}</text>
      <text x="345" y="105" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("wets stratum corneum")}</text>

      {/* Skin layer (stratum corneum) — wavy line */}
      <path d="M 60 110 Q 90 105 120 110 T 180 110 T 240 110 T 300 110 T 360 110 T 420 110 T 480 110"
        stroke="#FFD166" strokeWidth="1.5" fill="none" />
      <text x="60" y="125" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("stratum corneum (high resistance)")}</text>

      {/* Hair follicles (a couple of strands) */}
      <line x1="125" y1="110" x2="118" y2="95" stroke="#5A6A82" strokeWidth="1" />
      <line x1="180" y1="110" x2="184" y2="92" stroke="#5A6A82" strokeWidth="1" />
      <line x1="385" y1="110" x2="392" y2="93" stroke="#5A6A82" strokeWidth="1" />
      <line x1="445" y1="110" x2="439" y2="95" stroke="#5A6A82" strokeWidth="1" />

      {/* Epidermis */}
      <rect x="60" y="110" width="420" height="30" fill="#1A1A30" stroke="none" />
      <text x="60" y="155" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("epidermis")}</text>

      {/* Dermis */}
      <rect x="60" y="140" width="420" height="40" fill="#0E1828" stroke="none" />
      <text x="60" y="175" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("dermis (vasculature)")}</text>

      {/* Skull */}
      <rect x="60" y="180" width="420" height="40" fill="#0C1830" stroke="#1E2A40" />
      <text x="60" y="205" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("skull")}</text>

      {/* Cortex below */}
      <rect x="60" y="220" width="420" height="50" fill="#0C1220" stroke="#1E2A40" />
      <text x="60" y="245" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("cortex (signal source)")}</text>

      {/* Impedance arrow at gel-skin interface */}
      <line x1="160" y1="115" x2="160" y2="105" stroke="#FF6B35" strokeWidth="1.5" />
      <line x1="160" y1="115" x2="155" y2="120" stroke="#FF6B35" strokeWidth="1.5" />
      <line x1="160" y1="115" x2="165" y2="120" stroke="#FF6B35" strokeWidth="1.5" />
      <text x="120" y="98" fontSize="10" fontFamily="DM Mono, monospace" fill="#FF6B35" fontWeight="bold">
        Z &lt; 5 kΩ
      </text>
      <text x="115" y="142" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("impedance")}</text>
    </svg>
  )
}

// ─── Section: Differential Amplification ─────────────────────────────────────

function DifferentialAmpSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.differential_amplification" />
      <Lead>{localize("A scalp electrode picks up not just the ~50 µV of brain activity but also far larger environmental noise — 50/60 Hz from power lines, electromagnetic interference, even radio. The trick that makes EEG possible is the")}{localize(' ')}
        <Highlight>{localize("differential amplifier")}</Highlight>{localize(": it rejects whatever noise is common to two nearby electrodes while preserving the tiny voltage")}{localize(' ')}
        <Highlight>{localize("difference")}</Highlight>{localize(" that represents brain activity.")}</Lead>

      <Subhead>{localize("How Differential Amplification Works")}</Subhead>
      <Para>{localize("A differential amplifier has two inputs (call them V₁ and V₂) and produces:")}</Para>
      <div className="my-4 max-w-3xl">
        <div className="card border border-eeg-border rounded-lg px-6 py-4 bg-eeg-card font-mono text-base"
             style={{ color: '#00FFB0' }}>
          V<sub>{localize("out")}</sub> = G × (V<sub>1</sub> − V<sub>2</sub>)
        </div>
      </div>
      <Para>{localize("where G is the gain, typically ")}<Key>10⁴–10⁵</Key>. Whatever is COMMON to both
        inputs — 60 Hz hum, distant ECG, ambient EMF — cancels in the subtraction.
        Whatever DIFFERS — the local cortical activity at electrode 1 versus
        electrode 2 — gets amplified by G.
      </Para>
      <Para>{localize("The quality figure for an amplifier is its")}{localize(' ')}
        <Highlight>{localize("common-mode rejection ratio (CMRR)")}</Highlight>{localize(": clinical EEG amplifiers typically achieve CMRR > 100 dB, meaning common-mode signals are attenuated by a factor of 10⁵ relative to differential signals. This is the only reason 50 µV of brain activity is visible against thousands of microvolts of mains contamination.")}</Para>

      <Figure caption="Two scalp electrodes feeding a differential amplifier. The 50/60 Hz mains noise that is common to both inputs cancels in the subtraction (CMRR ≫ 100 dB), while the cortical voltage difference between the two sites — typically 10–100 µV — is amplified by the gain G.">
        <DifferentialAmpDiagram />
      </Figure>

      <Subhead>{localize("What This Means in Bipolar Recordings")}</Subhead>
      <Para>{localize("In a ")}<Highlight>{localize("bipolar montage")}</Highlight>{localize(", each displayed channel is not a single electrode. It is the voltage difference between two neighbouring electrodes. For example, the channel ")}<Key>F7-T7</Key>{localize(" is computed as:")}</Para>
      <div className="my-4 max-w-3xl">
        <div className="card border border-eeg-border rounded-lg px-6 py-4 bg-eeg-card font-mono text-base"
             style={{ color: '#00D4FF' }}>
          F7-T7 = V<sub>F7</sub> - V<sub>T7</sub>
        </div>
      </div>
      <Para>{localize("If both electrodes see the same activity, the channel is nearly flat because the two inputs subtract away. If F7 is more positive than T7, the trace deflects one way; if T7 is more positive than F7, it deflects the opposite way. So a bipolar trace is best read as a ")}<Highlight>{localize("comparison between two points")}</Highlight>{localize(", not as the absolute voltage under one electrode.")}</Para>
      <Para>{localize("This is why bipolar recordings are so useful for localisation. A focal discharge at T7 appears in both adjacent channels, but with opposite signs:")}<Key>F7-T7</Key>{localize(" contains T7 as the second input, while ")}<Key>T7-P7</Key>{localize("contains T7 as the first input. The shared electrode flips role from negative input to positive input, so the wave flips polarity. That polarity change is the familiar ")}<Highlight>{localize("phase reversal")}</Highlight>{localize(", identifying a local scalp-potential maximum or minimum.")}</Para>
      <Figure caption="With a negative scalp potential at T7 and negative-up display, F7-T7 deflects downward and T7-P7 upward. The shared electrode is a scalp-potential extremum; the cortical source need not lie directly beneath it.">
        <PhaseReversalDiagram />
      </Figure>
      <Para>{localize("A useful limitation is the ")}<Highlight>{localize("end-of-chain effect")}</Highlight>. A phase
        reversal is easiest to see when the active electrode sits between two
        bipolar derivations, because the same electrode appears once as the negative
        input and once as the positive input. At the end of a chain, such as Fp1 or
        O1 in a longitudinal bipolar montage, there is no neighbouring channel
        beyond the terminal electrode. A focal maximum there may therefore appear as
        a large deflection in only the last channel, without a neat opposite-facing
        partner. In that situation, localisation relies more on field distribution,
        amplitude gradient, and comparison with another montage.
      </Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>-</Key> <Highlight>{localize("Common-mode signals cancel.")}</Highlight>{localize(" Mains hum, movement shared by both inputs, and distant widespread fields are reduced because they appear similarly at both electrodes.")}</li>
        <li>
          <Key>-</Key> <Highlight>{localize("Local differences stand out.")}</Highlight>{localize(" A focal cortical source creates a voltage gradient across nearby electrodes, so adjacent bipolar channels show different amplitudes and sometimes opposite polarity.")}</li>
        <li>
          <Key>-</Key> <Highlight>{localize("The montage determines what you see.")}</Highlight>{localize(" The same stored electrode voltages can be recombined as F7-T7, T7-P7, average reference, or another montage. The brain signal is the same; the displayed comparison changes.")}</li>
      </ul>

      <Subhead>{localize("The Signal Chain")}</Subhead>
      <Para>{localize("From cortex to digital sample, every channel passes through the same pipeline:")}</Para>
      <ol className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>1.</Key> <Highlight>{localize("Scalp electrode")}</Highlight>{localize(" — picks up local potential (mostly brain + noise).")}</li>
        <li>
          <Key>2.</Key> <Highlight>{localize("Differential pre-amplifier")}</Highlight>{localize(" — subtracts active and reference, amplifies by ~10⁴.")}</li>
        <li>
          <Key>3.</Key> <Highlight>{localize("Bandpass filter")}</Highlight>{localize(" — typically 0.5–70 Hz. Removes DC drift, sweat artefact, and high-frequency aliasing precursors.")}</li>
        <li>
          <Key>4.</Key> <Highlight>{localize("Notch filter")}</Highlight>{localize(" — sharp 50 Hz (Europe / Asia) or 60 Hz (Americas) reject to suppress any residual mains interference that the differential stage didn\\u2019t catch.")}</li>
        <li>
          <Key>5.</Key> <Highlight>{localize("Anti-aliasing filter")}</Highlight>{localize(" — low-pass before sampling (mandatory under the Nyquist criterion).")}</li>
        <li>
          <Key>6.</Key> <Highlight>{localize("A/D converter")}</Highlight>{localize(" — digitises at 256–512 Hz routinely; up to 2 kHz for high-frequency oscillation studies.")}</li>
        <li>
          <Key>7.</Key> <Highlight>{localize("Computer")}</Highlight>{localize(" — stores raw referential samples; the displayed montage is computed in software at view time.")}</li>
      </ol>

      <Subhead>{localize("Why the Digital Pipeline Matters Clinically")}</Subhead>
      <Para>{localize("Modern systems record every electrode against a single common reference and defer the montage subtraction to software. This unlocks three workflows that were impossible with analogue paper EEG:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Retrospective montage reformatting.")}</Highlight>{localize(" The same recording can be reviewed in longitudinal bipolar, transverse bipolar, average reference, or Laplacian without re-recording. Phase reversals, field maxima, and asymmetries can be sought from multiple perspectives.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Adjustable digital filters.")}</Highlight>{localize(" The reader can tighten or loosen the bandpass on the fly to investigate a finding (e.g., open the high-pass to 0.1 Hz to chase very slow activity).")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Compatibility with quantitative EEG.")}</Highlight>{localize(' ')}{localize("Spectrograms, source localisation, and machine-learning models all start from the same raw digital stream — no re-recording or re-digitisation needed.")}</li>
      </ul>
    </>
  )
}

function DifferentialAmpDiagram() {
  useLocale()
  return (
    <svg dir="ltr" viewBox="0 0 540 280" className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="da-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5A6A82" />
        </marker>
      </defs>

      {/* Head outline (left) */}
      <ellipse cx="60" cy="140" rx="42" ry="50" fill="none" stroke="#1E2A40"
        strokeWidth="1.4" />
      <path d="M55 92 Q60 88 65 92" fill="none" stroke="#1E2A40" strokeWidth="1" />

      {/* Active electrode */}
      <circle cx="60" cy="100" r="5" fill="#0D1424" stroke="#00FFB0" strokeWidth="1.5" />
      <text x="22" y="92" fontSize="10" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("active")}</text>
      {/* Reference electrode */}
      <circle cx="100" cy="148" r="5" fill="#0D1424" stroke="#00D4FF" strokeWidth="1.5" />
      <text x="105" y="152" fontSize="10" fontFamily="DM Mono, monospace" fill="#00D4FF">{localize("reference")}</text>

      {/* Wire to amp */}
      <path d="M 60 100 L 60 60 L 230 60 L 230 105"
        fill="none" stroke="#00FFB0" strokeWidth="1.4" />
      <path d="M 100 148 L 130 148 L 130 200 L 230 200 L 230 165"
        fill="none" stroke="#00D4FF" strokeWidth="1.4" />

      {/* V1, V2 labels */}
      <text x="125" y="55" fontSize="11" fontFamily="DM Mono, monospace" fill="#00FFB0">V₁</text>
      <text x="135" y="195" fontSize="11" fontFamily="DM Mono, monospace" fill="#00D4FF">V₂</text>

      {/* Common-mode noise indicator: small 60Hz wave on both wires */}
      <path d="M 150 60 q 5 -4 10 0 t 10 0 t 10 0 t 10 0"
        stroke="#FF4444" strokeWidth="1" fill="none" opacity="0.85" />
      <path d="M 150 200 q 5 -4 10 0 t 10 0 t 10 0 t 10 0"
        stroke="#FF4444" strokeWidth="1" fill="none" opacity="0.85" />
      <text x="150" y="48" fontSize="9" fontFamily="DM Mono, monospace" fill="#FF4444">{localize("60 Hz (common)")}</text>

      {/* Op-amp triangle */}
      <polygon points="230,90 230,180 290,135" fill="#0D1424"
        stroke="#FFD166" strokeWidth="1.6" />
      <text x="240" y="115" fontSize="11" fontFamily="DM Mono, monospace" fill="#00FFB0">+</text>
      <text x="240" y="160" fontSize="11" fontFamily="DM Mono, monospace" fill="#00D4FF">−</text>
      <text x="244" y="200" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("diff amp")}</text>
      <text x="244" y="213" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">
        G ≈ 10⁴
      </text>

      {/* Output line */}
      <line x1="290" y1="135" x2="345" y2="135" stroke="#5A6A82" strokeWidth="1.4"
        markerEnd="url(#da-arr)" />
      <text x="295" y="125" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">
        V_out
      </text>

      {/* Output trace */}
      <rect x="350" y="90" width="170" height="90" fill="#0D1424" stroke="#1E2A40" />
      <line x1="350" y1="135" x2="520" y2="135" stroke="#1E2A40" strokeWidth="0.6" strokeDasharray="2 2" />
      {/* Clean alpha-ish trace */}
      <path d="M 355 135 q 4 -10 8 0 t 8 0 t 8 0 t 8 0 q 4 -14 8 0 t 8 0 t 8 0 t 8 0 t 8 0 t 8 0 q 4 -8 8 0 t 8 0 t 8 0 t 8 0 t 8 0 t 8 0 t 8 0"
        stroke="#00FFB0" strokeWidth="1.4" fill="none" />
      <text x="358" y="105" fontSize="10" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("clean differential signal")}</text>
      <text x="358" y="195" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("common-mode rejected: CMRR > 100 dB")}</text>

      {/* Mains-noise label below */}
      <text x="225" y="248" fontSize="10" fontFamily="DM Mono, monospace" fill="#FF4444">{localize("identical noise on both inputs cancels in the subtraction")}</text>
    </svg>
  )
}

// ─── Section: Frequency Bands ────────────────────────────────────────────────

function PhaseReversalDiagram() {
  useLocale()
  return (
    <svg dir="ltr" viewBox="0 0 620 300" className="w-full max-w-3xl mx-auto">
      <defs>
        <marker id="pr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5A6A82" />
        </marker>
      </defs>

      <path d="M 60 70 Q 160 35 260 70" fill="none" stroke="#1E2A40" strokeWidth="1.6" />
      <line x1="70" y1="95" x2="250" y2="95" stroke="#1E2A40" strokeWidth="1" strokeDasharray="4 5" />

      {[
        { label: 'F7', x: 80, color: '#00D4FF' },
        { label: 'T7', x: 155, color: '#FFD166' },
        { label: 'P7', x: 230, color: '#00D4FF' },
      ].map(electrode => (
        <g key={electrode.label}>
          <circle cx={electrode.x} cy="95" r="8" fill="#0D1424" stroke={electrode.color} strokeWidth="1.8" />
          <text x={electrode.x} y="120" textAnchor="middle" fontSize="11" fontFamily="DM Mono, monospace" fill={electrode.color}>
            {localize(electrode.label)}
          </text>
        </g>
      ))}

      <circle cx="155" cy="72" r="18" fill="#FFD166" opacity="0.14" />
      <circle cx="155" cy="72" r="7" fill="#FFD166" stroke="#0D1424" strokeWidth="1.2" />
      <text x="155" y="48" textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("focal generator")}</text>

      <path d="M 80 95 L 80 155 L 330 155" fill="none" stroke="#00D4FF" strokeWidth="1.2" />
      <path d="M 155 95 L 155 175 L 330 175" fill="none" stroke="#FFD166" strokeWidth="1.2" />
      <path d="M 155 95 L 155 225 L 330 225" fill="none" stroke="#FFD166" strokeWidth="1.2" />
      <path d="M 230 95 L 230 245 L 330 245" fill="none" stroke="#00D4FF" strokeWidth="1.2" />

      <rect x="330" y="138" width="92" height="42" rx="6" fill="#0D1424" stroke="#1E2A40" />
      <text x="376" y="155" textAnchor="middle" fontSize="11" fontFamily="DM Mono, monospace" fill="#E6EDF7">
        F7-T7
      </text>
      <text x="376" y="170" textAnchor="middle" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">
        V_F7 - V_T7
      </text>

      <rect x="330" y="210" width="92" height="42" rx="6" fill="#0D1424" stroke="#1E2A40" />
      <text x="376" y="227" textAnchor="middle" fontSize="11" fontFamily="DM Mono, monospace" fill="#E6EDF7">
        T7-P7
      </text>
      <text x="376" y="242" textAnchor="middle" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">
        V_T7 - V_P7
      </text>

      <line x1="422" y1="159" x2="462" y2="159" stroke="#5A6A82" strokeWidth="1.2" markerEnd="url(#pr-arr)" />
      <line x1="422" y1="231" x2="462" y2="231" stroke="#5A6A82" strokeWidth="1.2" markerEnd="url(#pr-arr)" />

      <rect x="465" y="118" width="125" height="70" fill="#0D1424" stroke="#1E2A40" />
      <line x1="465" y1="153" x2="590" y2="153" stroke="#1E2A40" strokeWidth="0.8" strokeDasharray="3 3" />
      <path d="M 472 153 L 500 153 Q 510 180 520 153 T 548 153 L 585 153"
        stroke="#FF6B35" strokeWidth="1.8" fill="none" />
      <text x="468" y="132" fontSize="10" fontFamily="DM Mono, monospace" fill="#FF6B35">{localize("downward")}</text>

      <rect x="465" y="198" width="125" height="70" fill="#0D1424" stroke="#1E2A40" />
      <line x1="465" y1="233" x2="590" y2="233" stroke="#1E2A40" strokeWidth="0.8" strokeDasharray="3 3" />
      <path d="M 472 233 L 500 233 Q 510 206 520 233 T 548 233 L 585 233"
        stroke="#00FFB0" strokeWidth="1.8" fill="none" />
      <text x="468" y="212" fontSize="10" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("upward")}</text>

      <text x="300" y="285" textAnchor="middle" fontSize="10" fontFamily="DM Mono, monospace" fill="#FFD166">{localize("same T7 field, opposite input role = phase reversal")}</text>
    </svg>
  )
}

function FrequencyBandsSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.frequency_bands" />
      <Lead>{localize("The brain produces electrical activity across a wide range of frequencies — from slow waves below 1 Hz to fast oscillations above 80 Hz. By convention, the EEG spectrum is divided into five named bands, each loosely associated with a state of consciousness, an anatomical region, and a clinical context.")}</Lead>

      <Figure caption="The canonical EEG frequency spectrum. Each band is defined by frequency range; typical amplitudes shrink as frequency rises (faster rhythms desynchronise more readily). Boundaries are conventional, not absolute — adjacent bands blend into each other.">
        <FrequencyBandsDiagram />
      </Figure>

      <Subhead>{localize("The Five Canonical Bands")}</Subhead>

      <div className="grid md:grid-cols-1 gap-3 my-4 max-w-3xl">
        <BandRow
          name="Delta (δ)"
          color="#7B5EA7"
          range="0.5–4 Hz"
          amp="100–300 µV"
          context="Largest amplitude, slowest. Normal in N3 sleep and infants. Pathological when persistent in awake adults — focal lesions, encephalopathy, deep midline tumours."
        />
        <BandRow
          name="Theta (θ)"
          color="#00D4FF"
          range="4–8 Hz"
          amp="20–100 µV"
          context="Normal in drowsiness, light sleep, and children. Mid-temporal theta is a normal variant in adults during fatigue. Pathological if dominant in awake, alert adults."
        />
        <BandRow
          name="Alpha (α)"
          color="#00FFB0"
          range="8–13 Hz"
          amp="20–60 µV"
          context="The posterior dominant rhythm of the relaxed awake adult with eyes closed. Attenuates with eye opening — the Berger effect. Symmetric, well-formed alpha is the hallmark of a normal awake EEG."
        />
        <BandRow
          name="Beta (β)"
          color="#FF6B35"
          range="13–30 Hz"
          amp="5–30 µV"
          context="Low amplitude, frontal-dominant rhythm of alert wakefulness. Enhanced by benzodiazepines and barbiturates — a clinically useful finding, since drug-induced beta is often the first sign that medication is on board."
        />
        <BandRow
          name="Gamma (γ)"
          color="#FFD166"
          range="30–80+ Hz"
          amp="< 20 µV"
          context="Associated with active cognition, attention, and binding of perceptual features. Largely overshadowed by EMG at the scalp; mostly studied with intracranial recordings."
        />
      </div>

      <Subhead>{localize("Reading EEG by Frequency")}</Subhead>
      <Para>{localize("Reading EEG is, at its core, asking repeatedly: ")}<em>{localize("what frequencies are in this segment of trace, where on the scalp, and is that appropriate for the patient\\u2019s state?")}</em>{localize(" A few canonical patterns:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Eyes-closed adult, occipital alpha")}</Highlight>{localize(" → normal awake state.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Dominant posterior theta")}</Highlight>{localize(" → drowsiness or mild encephalopathy.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Diffuse delta in an awake adult")}</Highlight>{localize(" → encephalopathy until proven otherwise.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Lateralised slowing (delta over one hemisphere)")}</Highlight>{localize(" → focal structural lesion.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Triphasic delta complexes")}</Highlight>{localize(" → metabolic encephalopathy (hepatic, uraemic; see Findings).")}</li>
      </ul>

      <Subhead>{localize("Quantitative Tools")}</Subhead>
      <Para>{localize("Visual reading remains the foundation of EEG interpretation, but quantitative tools complement it:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Fast Fourier Transform (FFT)")}</Highlight>{localize(' ')}{localize("decomposes a window of EEG into its frequency components, producing a power spectrum (µV²/Hz vs frequency).")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Spectrogram")}</Highlight>{localize(" plots the power spectrum over time — frequency on the y-axis, time on the x-axis, power as colour. It compresses hours of recording into a single image and is invaluable in ICU monitoring (sedation depth, seizure detection, prognostication).")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Power-in-band")}</Highlight>{localize(" (e.g. \\u201calpha power\\u201d) is the integrated power over a band\\u2019s frequency range — useful for tracking sedation depth and seizure burden across long recordings.")}</li>
      </ul>
      <Para>{localize("Try the Spectrum and Spectrogram views in the ")}<Highlight>{localize("Sandbox")}</Highlight>{localize(' ')}{localize("to see real-time band decomposition of the simulated EEG.")}</Para>
    </>
  )
}

function BandRow({ name, color, range, amp, context }) {
  useLocale()
  return (
    <div className="card border border-eeg-border rounded-lg p-4 flex flex-col md:flex-row gap-4">
      <div className="md:w-44 flex-shrink-0">
        <p className="font-mono font-bold text-base" style={{ color }}>{localize(name)}</p>
        <p className="text-xs font-mono text-eeg-muted mt-1">{localize(range)}</p>
        <p className="text-xs font-mono text-eeg-muted">{localize(amp)}</p>
      </div>
      <p className="font-body text-eeg-muted text-sm leading-relaxed flex-1">
        {localize(context)}
      </p>
    </div>
  )
}

function FrequencyBandsDiagram() {
  useLocale()
  // Horizontal frequency strip 0–80 Hz, with example oscillation samples in each band.
  const bands = [
    { name: 'δ', color: '#7B5EA7', start: 0.5,  end: 4,  freq: 2,   sample: 'low' },
    { name: 'θ', color: '#00D4FF', start: 4,    end: 8,  freq: 6,   sample: 'low' },
    { name: 'α', color: '#00FFB0', start: 8,    end: 13, freq: 10,  sample: 'med' },
    { name: 'β', color: '#FF6B35', start: 13,   end: 30, freq: 22,  sample: 'med' },
    { name: 'γ', color: '#FFD166', start: 30,   end: 80, freq: 55,  sample: 'high' },
  ]
  // Map a frequency (Hz) to an x-coordinate using a log-ish scale so all bands
  // are visible. We use a piecewise linear-on-each-band so bands are equal width.
  const innerW = 480
  const padX = 30
  // Equal-width bands across the strip
  const bandWidth = innerW / bands.length

  return (
    <svg dir="ltr" viewBox="0 0 540 320" className="w-full max-w-2xl mx-auto">
      {/* Title */}
      <text x="30" y="22" fontSize="13" fontFamily="DM Mono, monospace"
        fill="#00FFB0" fontWeight="bold">{localize("EEG Frequency Spectrum")}</text>
      <text x="30" y="36" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("slow ↔ fast (0.5 Hz to 80 Hz)")}</text>

      {/* Band strips */}
      {localize(bands.map((b, i) => {
        const x = padX + i * bandWidth
        return (
          <g key={b.name}>
            <rect
              x={x} y={50} width={bandWidth - 2} height={50}
              fill={b.color + '22'} stroke={b.color} strokeWidth="1"
            />
            {/* Greek letter */}
            <text x={x + bandWidth / 2} y={82}
              textAnchor="middle" fontSize="22"
              fontFamily="DM Mono, monospace" fill={b.color}
              fontWeight="bold">{localize(b.name)}</text>
            {/* Frequency range label */}
            <text x={x + bandWidth / 2} y={118} textAnchor="middle"
              fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">
              {localize(b.start)}–{localize(b.end)}
            </text>
            <text x={x + bandWidth / 2} y={130} textAnchor="middle"
              fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("Hz")}</text>
          </g>
        )
      }))}

      {/* Sample waveforms below each band */}
      {localize(bands.map((b, i) => {
        const x = padX + i * bandWidth
        const cx = x + bandWidth / 2
        // Sample waveform: a short snippet of sine at b.freq over a fixed time window
        const waveW = bandWidth - 16
        const waveCenterY = 180
        const ampPx = 20 - i * 1.5  // Higher freq = lower amplitude (clinically typical)
        // Number of cycles to draw scaled visibly
        const cycles = b.freq < 5 ? 0.7 : b.freq < 10 ? 1.5 : b.freq < 20 ? 3 : b.freq < 40 ? 6 : 9
        let path = ''
        const N = 80
        for (let j = 0; j <= N; j++) {
          const px = x + 8 + (j / N) * waveW
          const py = waveCenterY - ampPx * Math.sin((j / N) * cycles * 2 * Math.PI)
          path += (j === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1) + ' '
        }
        return (
          <g key={'wave-' + b.name}>
            <path d={path} stroke={b.color} strokeWidth="1.4" fill="none" />
          </g>
        )
      }))}

      {/* Vertical axis label for amplitude */}
      <text x="20" y="175" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82" transform="rotate(-90 20 175)">{localize("amplitude")}</text>

      {/* Activity / state context row */}
      <line x1="30" y1="225" x2="510" y2="225" stroke="#1E2A40" strokeWidth="0.5" />
      <text x="30" y="245" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("typical state:")}</text>
      {[
        { label: 'deep sleep', color: '#7B5EA7' },
        { label: 'drowsy',     color: '#00D4FF' },
        { label: 'eyes closed',color: '#00FFB0' },
        { label: 'alert',      color: '#FF6B35' },
        { label: 'cognition',  color: '#FFD166' },
      ].map((s, i) => (
        <text key={i}
          x={padX + i * bandWidth + bandWidth / 2}
          y={258}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="DM Mono, monospace"
          fill={s.color}
        >
          {localize(s.label)}
        </text>
      ))}

      {/* Bottom: typical amplitude row */}
      <text x="30" y="285" fontSize="10" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("typical amplitude:")}</text>
      {['100–300 µV', '20–100 µV', '20–60 µV', '5–30 µV', '< 20 µV'].map((a, i) => (
        <text key={i}
          x={padX + i * bandWidth + bandWidth / 2}
          y={300}
          textAnchor="middle"
          fontSize="9"
          fontFamily="DM Mono, monospace"
          fill="#5A6A82"
        >
          {localize(a)}
        </text>
      ))}
    </svg>
  )
}

// ─── Section: Electrode Placement & the 10-20 System ────────────────────────

function PlacementSection() {
  useLocale()
  return (
    <>
      <SectionTitle tk="concepts.placement_1020" />
      <Lead>{localize("Reproducible EEG interpretation requires that the same electrode label refer to the same anatomical location across patients, recording centres, and decades. The international ")}<Highlight>{localize("10-20 system")}</Highlight>{localize(" solves this by defining each electrode\\u2019s position as a percentage of the distance between four bony landmarks on the skull.")}</Lead>

      <Subhead>{localize("The Anatomical Landmarks")}</Subhead>
      <Para>{localize("Four palpable reference points anchor every electrode\\u2019s position:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Nasion")}</Highlight>{localize(" — the depression at the bridge of the nose, just below the brow.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Inion")}</Highlight>{localize(" — the external occipital protuberance at the back of the skull.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Left preauricular point (LPA)")}</Highlight>{localize(" — the depression in front of the left ear.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Right preauricular point (RPA)")}</Highlight>{localize(" — the mirror point in front of the right ear.")}</li>
      </ul>
      <Para>{localize("Two great-circle arcs run between these landmarks: nasion → Cz → inion (the")}{localize(' ')}
        <Highlight>{localize("antero-posterior midline")}</Highlight>{localize(") and LPA → Cz → RPA (the")}{localize(' ')}
        <Highlight>{localize("coronal midline")}</Highlight>{localize("). The point where the two arcs cross is ")}<Key>{localize("Cz")}</Key>. Every other electrode is then placed at a defined
        percentage along these arcs.
      </Para>

      <Subhead>{localize("Why \\u201c10-20\\u201d?")}</Subhead>
      <Para>{localize("Along the antero-posterior midline, electrodes are spaced at intervals of")}{localize(' ')}
        <Highlight>10%</Highlight>{localize(" from the nasion (Fp), then four")}{localize(' ')}
        <Highlight>20%</Highlight>{localize(" intervals (F → C → P → O), finishing 10% above the inion. The percentages add up to 100%, so the layout scales to any head size: a 56 cm circumference and a 60 cm circumference both end up with electrodes over the same underlying cortical regions.")}</Para>

      <Figure caption="The 10-20 antero-posterior midline. Electrode positions are defined as percentages of the nasion–inion distance, so the layout scales to any head size — Fp1/Fp2 always overlie prefrontal cortex; O1/O2 always overlie primary visual cortex.">
        <LandmarksDiagram />
      </Figure>

      <Subhead>{localize("How Electrodes Are Named")}</Subhead>
      <Para>{localize("Each electrode is labelled by a region letter plus a number:")}</Para>
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 my-4 max-w-3xl font-body text-sm text-eeg-muted">
        <div><Key>{localize("Fp")}</Key> &nbsp;— <Highlight>{localize("Frontopolar")}</Highlight>{localize(" (prefrontal cortex)")}</div>
        <div><Key>P</Key>  &nbsp;— <Highlight>{localize("Parietal")}</Highlight></div>
        <div><Key>F</Key>  &nbsp;— <Highlight>{localize("Frontal")}</Highlight></div>
        <div><Key>O</Key>  &nbsp;— <Highlight>{localize("Occipital")}</Highlight></div>
        <div><Key>T</Key>  &nbsp;— <Highlight>{localize("Temporal")}</Highlight></div>
        <div><Key>A</Key>  &nbsp;— <Highlight>{localize("Auricular")}</Highlight>{localize(" (ear reference)")}</div>
        <div><Key>C</Key>  &nbsp;— <Highlight>{localize("Central")}</Highlight>{localize(" (motor / sensory cortex)")}</div>
        <div><Key>z</Key>{localize("   — suffix denoting the ")}<Highlight>{localize("midline")}</Highlight></div>
      </div>
      <Para>{localize("The number convention encodes laterality and distance from the midline:")}</Para>
      <ul className="font-body text-eeg-muted text-sm space-y-2 max-w-3xl mt-3 mb-2 list-none">
        <li>
          <Key>•</Key> <Highlight>{localize("Odd numbers")}</Highlight>{localize(" (1, 3, 5, 7) — left hemisphere.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Even numbers")}</Highlight>{localize(" (2, 4, 6, 8) — right hemisphere.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("z suffix")}</Highlight>{localize(" (Cz, Fz, Pz, Oz) — midline.")}</li>
        <li>
          <Key>•</Key> <Highlight>{localize("Lower numbers")}</Highlight>{localize(" are closer to the midline; ")}<Highlight>{localize("higher numbers")}</Highlight>{localize(" are further laterally. So F3 is closer to Fz than F7 is.")}</li>
      </ul>

      <Subhead>{localize("Standard and High-Density Layouts")}</Subhead>
      <Para>{localize("Routine clinical recordings use ")}<Highlight>{localize("19–21 electrodes")}</Highlight>{localize(" — the so-called \\u201cstandard\\u201d 10-20 array. Research and source-localisation studies use high-density layouts of ")}<Highlight>64</Highlight>,{localize(' ')}
        <Highlight>128</Highlight>{localize(", or even ")}<Highlight>256</Highlight>{localize(" channels. The naming convention scales: the")}{localize(' ')}
        <Highlight>{localize("10-10 system")}</Highlight>{localize(" doubles the resolution by adding electrodes at every 10% (introducing combined regions like FC, CP, PO and intermediate numbers); the ")}<Highlight>{localize("10-5 system")}</Highlight>{localize(" takes it down to 5% spacing for the densest research arrays.")}</Para>
      <Para>{localize("Clinical readers should recognise the standard 19-electrode set immediately and know which cortical region each one overlies. The interactive map below lets you hover over any electrode to confirm its label.")}</Para>

      <ElectrodeMap />
    </>
  )
}

function LandmarksDiagram() {
  useLocale()
  // Side-view sagittal head with nasion-inion landmarks and 10-20 percentages.
  // Shows: nasion (front), inion (back), Cz (top), with electrode positions
  // marked at 10/30/50/70/90% along the AP midline.
  const NASION_X = 90
  const INION_X = 470
  const NASION_Y = 200
  const INION_Y = 195
  const TOP_Y = 60
  // Electrode positions along the AP arc (approx)
  const stops = [
    { pct: 10,  label: 'Fp', desc: 'prefrontal',  color: '#00FFB0' },
    { pct: 30,  label: 'F',  desc: 'frontal',     color: '#00FFB0' },
    { pct: 50,  label: 'Cz', desc: 'vertex',      color: '#FFD166' },
    { pct: 70,  label: 'P',  desc: 'parietal',    color: '#00FFB0' },
    { pct: 90,  label: 'O',  desc: 'occipital',   color: '#00FFB0' },
  ]
  // Approximate point on the arc at percentage p
  const arcPoint = (pct) => {
    const t = pct / 100
    // Quadratic Bezier midpoint approximation along nasion -> top -> inion
    // Path: start at nasion, peak at center top, end at inion
    const peakX = (NASION_X + INION_X) / 2
    const peakY = TOP_Y
    const x = (1 - t) * (1 - t) * NASION_X + 2 * (1 - t) * t * peakX + t * t * INION_X
    const y = (1 - t) * (1 - t) * NASION_Y + 2 * (1 - t) * t * peakY + t * t * INION_Y
    return { x, y }
  }

  return (
    <svg dir="ltr" viewBox="0 0 540 280" className="w-full max-w-2xl mx-auto">
      <defs>
        <marker id="lm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
          markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#5A6A82" />
        </marker>
      </defs>

      {/* Title */}
      <text x="30" y="22" fontSize="13" fontFamily="DM Mono, monospace"
        fill="#00FFB0" fontWeight="bold">{localize("Antero-posterior midline (sagittal view)")}</text>
      <text x="30" y="36" fontSize="9" fontFamily="DM Mono, monospace" fill="#5A6A82">{localize("nasion (front) → Cz → inion (back)")}</text>

      {/* Head outline (sagittal) - rough oval */}
      <path d={`M ${NASION_X} ${NASION_Y}
                Q ${(NASION_X+INION_X)/2} ${TOP_Y - 10}
                  ${INION_X} ${INION_Y}
                Q ${INION_X + 18} ${INION_Y + 38}
                  ${INION_X - 12} ${INION_Y + 50}
                L ${NASION_X + 30} ${NASION_Y + 50}
                Q ${NASION_X - 8} ${NASION_Y + 25}
                  ${NASION_X} ${NASION_Y} Z`}
        fill="#0D1424" stroke="#1E2A40" strokeWidth="1.4" />

      {/* Nose hint at front */}
      <path d={`M ${NASION_X - 2} ${NASION_Y - 1}
                L ${NASION_X - 14} ${NASION_Y + 14}
                L ${NASION_X + 5} ${NASION_Y + 18} Z`}
        fill="#0D1424" stroke="#1E2A40" strokeWidth="1" />

      {/* Ear hint at back */}
      <ellipse cx={INION_X - 30} cy={INION_Y + 30} rx="6" ry="9"
        fill="#0D1424" stroke="#1E2A40" strokeWidth="1" />

      {/* Dashed arc representing the AP midline (nasion → top → inion) */}
      <path d={`M ${NASION_X} ${NASION_Y}
                Q ${(NASION_X+INION_X)/2} ${TOP_Y - 10}
                  ${INION_X} ${INION_Y}`}
        fill="none" stroke="#5A6A82" strokeWidth="0.7" strokeDasharray="3 3" />

      {/* Landmarks: Nasion */}
      <circle cx={NASION_X} cy={NASION_Y} r="3.5" fill="#FF6B35" />
      <text x={NASION_X - 28} y={NASION_Y + 4} fontSize="11"
        fontFamily="DM Mono, monospace" fill="#FF6B35" fontWeight="bold">{localize("nasion")}</text>
      <text x={NASION_X - 28} y={NASION_Y + 17} fontSize="9"
        fontFamily="DM Mono, monospace" fill="#5A6A82">0%</text>

      {/* Landmarks: Inion */}
      <circle cx={INION_X} cy={INION_Y} r="3.5" fill="#FF6B35" />
      <text x={INION_X + 8} y={INION_Y + 4} fontSize="11"
        fontFamily="DM Mono, monospace" fill="#FF6B35" fontWeight="bold">{localize("inion")}</text>
      <text x={INION_X + 8} y={INION_Y + 17} fontSize="9"
        fontFamily="DM Mono, monospace" fill="#5A6A82">100%</text>

      {/* Electrode stops */}
      {localize(stops.map((s) => {
        const { x, y } = arcPoint(s.pct)
        return (
          <g key={s.label}>
            <circle cx={x} cy={y} r="5" fill="#0D1424" stroke={s.color} strokeWidth="1.6" />
            <text x={x} y={y - 10} textAnchor="middle" fontSize="11"
              fontFamily="DM Mono, monospace" fill={s.color} fontWeight="bold">
              {localize(s.label)}
            </text>
            <text x={x} y={y + 17} textAnchor="middle" fontSize="9"
              fontFamily="DM Mono, monospace" fill="#5A6A82">
              {localize(s.pct)}%
            </text>
          </g>
        )
      }))}

      {/* Distance brackets along the bottom showing 10-20-20-20-20-10 */}
      <g transform="translate(0, 240)">
        {/* Baseline */}
        <line x1={NASION_X} y1="0" x2={INION_X} y2="0" stroke="#5A6A82"
          strokeWidth="0.6" />
        {/* Tick marks at 0, 10, 30, 50, 70, 90, 100% */}
        {localize([0, 10, 30, 50, 70, 90, 100].map(p => {
          const x = NASION_X + (p / 100) * (INION_X - NASION_X)
          return <line key={p} x1={x} y1="-3" x2={x} y2="3"
            stroke="#5A6A82" strokeWidth="0.8" />
        }))}
        {/* Span labels */}
        {localize([
          { from: 0,  to: 10, label: '10%' },
          { from: 10, to: 30, label: '20%' },
          { from: 30, to: 50, label: '20%' },
          { from: 50, to: 70, label: '20%' },
          { from: 70, to: 90, label: '20%' },
          { from: 90, to: 100, label: '10%' },
        ].map((s, i) => {
          const x = NASION_X + ((s.from + s.to) / 2 / 100) * (INION_X - NASION_X)
          return (
            <text key={i} x={x} y="14" textAnchor="middle" fontSize="9"
              fontFamily="DM Mono, monospace" fill="#FFD166">{localize(s.label)}</text>
          )
        }))}
      </g>
    </svg>
  )
}

// ─── Simple SVG 10-20 electrode head diagram ─────────────────────────────────

const ELECTRODE_POSITIONS = [
  { label: 'Fp1', cx: 38,  cy: 20 }, { label: 'Fp2', cx: 62, cy: 20 },
  { label: 'F7',  cx: 20,  cy: 35 }, { label: 'F3',  cx: 40, cy: 35 },
  { label: 'Fz',  cx: 50,  cy: 35 }, { label: 'F4',  cx: 60, cy: 35 },
  { label: 'F8',  cx: 80,  cy: 35 },
  { label: 'T7',  cx: 14,  cy: 50 }, { label: 'C3',  cx: 35, cy: 50 },
  { label: 'Cz',  cx: 50,  cy: 50 }, { label: 'C4',  cx: 65, cy: 50 },
  { label: 'T8',  cx: 86,  cy: 50 },
  { label: 'P7',  cx: 18,  cy: 65 }, { label: 'P3',  cx: 38, cy: 65 },
  { label: 'Pz',  cx: 50,  cy: 65 }, { label: 'P4',  cx: 62, cy: 65 },
  { label: 'P8',  cx: 82,  cy: 65 },
  { label: 'O1',  cx: 38,  cy: 82 }, { label: 'O2',  cx: 62, cy: 82 },
]

function ElectrodeMap() {
  useLocale()
  const [hovered, setHovered] = useState(null)
  return (
    <div className="mt-10 card p-6 max-w-sm">
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-4">{localize("10-20 Electrode Map")}</p>
      <svg dir="ltr" viewBox="0 0 100 105" className="w-full max-w-xs mx-auto">
        <ellipse cx="50" cy="52" rx="40" ry="44" fill="none" stroke="#1E2A40" strokeWidth="1.5" />
        <path d="M46 8 Q50 3 54 8" fill="none" stroke="#1E2A40" strokeWidth="1" />
        <path d="M10 52 Q7 50 10 48" fill="none" stroke="#1E2A40" strokeWidth="1" />
        <path d="M90 52 Q93 50 90 48" fill="none" stroke="#1E2A40" strokeWidth="1" />
        <line x1="50" y1="8"  x2="50" y2="96" stroke="#1E2A4066" strokeWidth="0.5" strokeDasharray="2,2" />
        <line x1="10" y1="52" x2="90" y2="52" stroke="#1E2A4066" strokeWidth="0.5" strokeDasharray="2,2" />
        {ELECTRODE_POSITIONS.map(e => (
          <g key={e.label}
            onMouseEnter={() => setHovered(e.label)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}>
            <circle cx={e.cx} cy={e.cy} r="3.5"
              fill={hovered === e.label ? '#00D4FF' : '#0D1424'}
              stroke={hovered === e.label ? '#00D4FF' : '#00FFB066'}
              strokeWidth="1" />
            <text x={e.cx} y={e.cy - 4.5} textAnchor="middle" fontSize="2.8"
              fill={hovered === e.label ? '#00D4FF' : '#5A6A82'}
              fontFamily="DM Mono, monospace">
              {localize(e.label)}
            </text>
          </g>
        ))}
      </svg>
      {hovered && <p className="text-center text-xs font-mono text-eeg-accent mt-2">{localize(hovered)}</p>}
    </div>
  )
}
