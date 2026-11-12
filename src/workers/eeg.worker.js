import {
  EEGSignalSession,
  FILTER_PREROLL_SECONDS,
  frameTransferables,
} from '../engine/eegSession.js'
import { SAMPLE_RATE } from '../engine/signalGenerator.js'

let generation = 0
let session = null
let clientId
// Message tasks avoid nested setTimeout clamping during warm-up while still
// giving new selections/cancellation a chance to interrupt between slices.
const continuations = []
const channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null
if (channel) channel.port1.onmessage = () => continuations.shift()?.()
const yieldToMessages = (forceTimer = false) =>
  new Promise((resolve) => {
    if (channel && !forceTimer) {
      continuations.push(resolve)
      channel.port2.postMessage(null)
    } else setTimeout(resolve, 0)
  })

function reply(request, frame, processingMs, partial = false) {
  self.postMessage(
    {
      id: request.id,
      revision: request.revision,
      clientId: request.clientId,
      frame,
      processingMs,
      partial,
    },
    frameTransferables(frame),
  )
}

self.onmessage = async ({ data: request }) => {
  if (request.type === 'cancel') {
    if (request.clientId === clientId) {
      generation++
      session = null
    }
    return
  }
  if (request.type !== 'init' && request.clientId !== clientId) return
  const started = performance.now()
  try {
    if (request.type === 'init') {
      clientId = request.clientId
      const current = ++generation
      const next = new EEGSignalSession(request.args, { deferred: true })
      session = next
      const config = request.args.filterConfig
      const previewHistory =
        config?.hp || config?.lp || config?.notch ? FILTER_PREROLL_SECONDS * SAMPLE_RATE : 0
      const previewSamples = Math.min(next.ring.length, next.visibleLength + previewHistory)
      let previewSent = false
      let workSinceTimer = 0
      let workMs = performance.now() - started
      while (next.filledSamples < next.ring.length) {
        if (current !== generation) return
        const sliceStart = performance.now()
        do {
          // Stop exactly at the first usable preview, then finish retained
          // history in cancellable slices without blocking worker messages.
          const goal = previewSent ? next.ring.length : previewSamples
          next.initializeChunk(Math.min(SAMPLE_RATE, goal - next.filledSamples))
        } while (
          next.filledSamples < (previewSent ? next.ring.length : previewSamples) &&
          performance.now() - sliceStart < 8
        )
        const sliceMs = performance.now() - sliceStart
        workMs += sliceMs
        workSinceTimer += sliceMs
        let justPreviewed = false
        if (
          !previewSent &&
          next.filledSamples >= previewSamples &&
          next.filledSamples < next.ring.length
        ) {
          const frameStart = performance.now()
          const frame = next.frame()
          workMs += performance.now() - frameStart
          reply(request, frame, workMs, true)
          previewSent = true
          justPreviewed = true
        }
        if (next.filledSamples < next.ring.length) {
          // Periodically cross a timer task as well: some runtimes drain one
          // MessagePort source before servicing incoming worker messages.
          const forceTimer = justPreviewed || workSinceTimer >= 24
          if (forceTimer) workSinceTimer = 0
          await yieldToMessages(forceTimer)
        }
      }
      if (current !== generation) return
      const frameStart = performance.now()
      const frame = next.frame()
      reply(request, frame, workMs + performance.now() - frameStart)
    } else {
      if (!session || session.filledSamples !== session.ring.length)
        throw new Error('EEG recording is still initializing')
      reply(request, session.handle(request.type, request.args), performance.now() - started)
    }
  } catch (error) {
    if (request.clientId === clientId)
      self.postMessage({
        id: request.id,
        revision: request.revision,
        clientId,
        error: error.message,
      })
  }
}
