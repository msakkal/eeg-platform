import { MONTAGES } from './montages.js'

// A bipolar difference cannot be assigned to its first electrode. Only channels
// with a shared reference support this per-electrode RMS display.
export function scalpChannelRMS(channels, montageId) {
  const definitions = MONTAGES[montageId]?.channels
  if (!definitions?.length || !definitions.every(({ neg }) => neg === definitions[0].neg))
    return null
  const byLabel = new Map(definitions.map(({ label, pos }) => [label, pos]))
  const amplitudes = {}
  for (const channel of channels) {
    const electrode = byLabel.get(channel.label)
    const data = channel.filteredData ?? channel.data
    if (!electrode || !data?.length) continue
    let sum = 0
    for (const value of data) sum += value * value
    const rms = Math.sqrt(sum / data.length)
    if (Number.isFinite(rms)) amplitudes[electrode] = rms
  }
  return amplitudes
}
