/**
 * Montage Engine
 * Defines all standard EEG montages and applies montage transforms
 * to raw referential channel data.
 */

import { ELECTRODES_1020 } from './signalGenerator.js'

// ─── Montage Definitions ─────────────────────────────────────────────────────

/**
 * Each montage is a list of channels.
 * Each channel: { label, pos, neg }
 * where pos and neg are electrode names.
 * For referential: neg = 'avg' | 'A1' | 'A2' | 'Cz'
 */

export const MONTAGES = {

  // ── Longitudinal Bipolar ("Double Banana") ──────────────────────────────
  longitudinal_bipolar: {
    id:          'longitudinal_bipolar',
    label:       'Longitudinal Bipolar',
    shortLabel:  'Long. Bipolar',
    description: 'The most common clinical montage. Electrodes are connected in chains running front-to-back along each hemisphere. Phase reversals localise generators.',
    channels: [
      // Left parasagittal chain
      { label: 'Fp1–F7',  pos: 'Fp1', neg: 'F7'  },
      { label: 'F7–T3',   pos: 'F7',  neg: 'T3'  },
      { label: 'T3–T5',   pos: 'T3',  neg: 'T5'  },
      { label: 'T5–O1',   pos: 'T5',  neg: 'O1'  },
      // Left central chain
      { label: 'Fp1–F3',  pos: 'Fp1', neg: 'F3'  },
      { label: 'F3–C3',   pos: 'F3',  neg: 'C3'  },
      { label: 'C3–P3',   pos: 'C3',  neg: 'P3'  },
      { label: 'P3–O1',   pos: 'P3',  neg: 'O1'  },
      // Midline chain
      { label: 'Fz–Cz',   pos: 'Fz',  neg: 'Cz'  },
      { label: 'Cz–Pz',   pos: 'Cz',  neg: 'Pz'  },
      // Right central chain
      { label: 'Fp2–F4',  pos: 'Fp2', neg: 'F4'  },
      { label: 'F4–C4',   pos: 'F4',  neg: 'C4'  },
      { label: 'C4–P4',   pos: 'C4',  neg: 'P4'  },
      { label: 'P4–O2',   pos: 'P4',  neg: 'O2'  },
      // Right parasagittal chain
      { label: 'Fp2–F8',  pos: 'Fp2', neg: 'F8'  },
      { label: 'F8–T4',   pos: 'F8',  neg: 'T4'  },
      { label: 'T4–T6',   pos: 'T4',  neg: 'T6'  },
      { label: 'T6–O2',   pos: 'T6',  neg: 'O2'  },
    ],
  },

  // ── Transverse Bipolar ───────────────────────────────────────────────────
  transverse_bipolar: {
    id:          'transverse_bipolar',
    label:       'Transverse Bipolar',
    shortLabel:  'Trans. Bipolar',
    description: 'Electrodes connected in chains running left-to-right across the scalp. Useful for lateralising focal activity.',
    channels: [
      { label: 'F7–F3',   pos: 'F7',  neg: 'F3'  },
      { label: 'F3–Fz',   pos: 'F3',  neg: 'Fz'  },
      { label: 'Fz–F4',   pos: 'Fz',  neg: 'F4'  },
      { label: 'F4–F8',   pos: 'F4',  neg: 'F8'  },
      { label: 'T3–C3',   pos: 'T3',  neg: 'C3'  },
      { label: 'C3–Cz',   pos: 'C3',  neg: 'Cz'  },
      { label: 'Cz–C4',   pos: 'Cz',  neg: 'C4'  },
      { label: 'C4–T4',   pos: 'C4',  neg: 'T4'  },
      { label: 'T5–P3',   pos: 'T5',  neg: 'P3'  },
      { label: 'P3–Pz',   pos: 'P3',  neg: 'Pz'  },
      { label: 'Pz–P4',   pos: 'Pz',  neg: 'P4'  },
      { label: 'P4–T6',   pos: 'P4',  neg: 'T6'  },
    ],
  },

  // ── Referential (linked ears / A1+A2) ───────────────────────────────────
  referential_ears: {
    id:          'referential_ears',
    label:       'Referential (Linked Ears)',
    shortLabel:  'Ref. Ears',
    description: 'Each electrode is referenced to the linked ear electrodes (A1+A2 average). Simple but the ears are not truly inactive references.',
    channels: ELECTRODES_1020
      .filter(e => !['A1','A2'].includes(e))
      .map(e => ({ label: `${e}–A`, pos: e, neg: 'ears' })),
  },

  // ── Average Reference ────────────────────────────────────────────────────
  average_reference: {
    id:          'average_reference',
    label:       'Average Reference',
    shortLabel:  'Avg. Ref.',
    description: 'Each electrode is referenced to the average of all scalp electrodes. Minimises reference contamination when generators are widespread.',
    channels: ELECTRODES_1020
      .filter(e => !['A1','A2'].includes(e))
      .map(e => ({ label: `${e}–avg`, pos: e, neg: 'average' })),
  },

  // ── Cz Reference ────────────────────────────────────────────────────────
  referential_cz: {
    id:          'referential_cz',
    label:       'Referential (Cz)',
    shortLabel:  'Ref. Cz',
    description: 'All channels referenced to Cz. Used in some research and sleep recordings. Cz can be contaminated by central activity.',
    channels: ELECTRODES_1020
      .filter(e => e !== 'Cz' && !['A1','A2'].includes(e))
      .map(e => ({ label: `${e}–Cz`, pos: e, neg: 'Cz' })),
  },

}

export const MONTAGE_LIST = Object.values(MONTAGES)
export const DEFAULT_MONTAGE = 'longitudinal_bipolar'

// ─── Montage Transform ───────────────────────────────────────────────────────

/**
 * Apply a montage to a raw channel dataset.
 *
 * @param {object} rawChannels   - { [electrodeLabel]: Float32Array }
 * @param {string} montageId     - key from MONTAGES
 * @returns {Array<{ label, data: Float32Array }>}
 */
export function applyMontage(rawChannels, montageId = DEFAULT_MONTAGE) {
  const montage = MONTAGES[montageId]
  if (!montage) throw new Error(`Unknown montage: ${montageId}`)

  // Pre-compute average reference if needed
  let avgRef = null
  if (montage.channels.some(ch => ch.neg === 'average')) {
    const labels = Object.keys(rawChannels).filter(l => !['A1','A2'].includes(l))
    const n      = labels.length
    const len    = rawChannels[labels[0]].length
    avgRef       = new Float32Array(len)
    labels.forEach(l => {
      const ch = rawChannels[l]
      for (let i = 0; i < len; i++) avgRef[i] += ch[i] / n
    })
  }

  // Pre-compute linked-ears reference
  let earRef = null
  if (montage.channels.some(ch => ch.neg === 'ears')) {
    const a1  = rawChannels['A1']
    const a2  = rawChannels['A2']
    const len = a1.length
    earRef    = new Float32Array(len)
    for (let i = 0; i < len; i++) earRef[i] = (a1[i] + a2[i]) / 2
  }

  return montage.channels.map(({ label, pos, neg }) => {
    const posData = rawChannels[pos]
    if (!posData) return { label, data: new Float32Array(0) }

    let negData
    if (neg === 'average') negData = avgRef
    else if (neg === 'ears') negData = earRef
    else negData = rawChannels[neg] ?? new Float32Array(posData.length)

    const derived = new Float32Array(posData.length)
    for (let i = 0; i < posData.length; i++) {
      derived[i] = posData[i] - negData[i]
    }
    return { label, data: derived }
  })
}
