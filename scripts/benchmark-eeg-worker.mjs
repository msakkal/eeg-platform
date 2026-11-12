// Node thread-isolation check, not a browser FPS benchmark.
// Run: node scripts/benchmark-eeg-worker.mjs
import { Worker } from 'node:worker_threads'
import { createHash } from 'node:crypto'
import { createEEGRequestHandler } from '../src/engine/eegSession.js'

const url = new URL('../src/workers/eeg.worker.js', import.meta.url).href
let worker
const createWorker = () =>
  new Worker(
    `
  const { parentPort } = require('node:worker_threads');
  globalThis.self = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer) };
  import(${JSON.stringify(url)}).then(() => parentPort.on('message', data => self.onmessage({ data })));
`,
    { eval: true },
  )

const request = {
  id: 1,
  revision: 0,
  type: 'init',
  args: {
    pattern: 'normal_awake',
    montageId: 'longitudinal_bipolar',
    seed: 42,
    maxWindowSecs: 60,
    windowSecs: 10,
    filterConfig: { hp: 0.5, lp: 70, notch: 50 },
  },
}

function fingerprint(frame) {
  const hash = createHash('sha256')
  for (const channel of frame.channels) {
    for (const array of [channel.data, channel.filteredData]) {
      hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    }
  }
  return hash.digest('hex')
}

async function measure(run) {
  const start = performance.now()
  let timerDelayMs
  const heartbeat = new Promise((resolve) =>
    setTimeout(() => {
      timerDelayMs = performance.now() - start
      resolve()
    }, 0),
  )
  const response = await run(start)
  const roundTripMs = performance.now() - start
  await heartbeat
  if (response.error) throw new Error(response.error)
  return { frame: response.frame, timerDelayMs, roundTripMs, workMs: response.processingMs }
}

try {
  const inline = await measure(() => createEEGRequestHandler()(request))
  let previewMs = null
  const threaded = await measure(
    (start) =>
      new Promise((accept, reject) => {
        worker = createWorker()
        worker.on('message', (response) => {
          if (response.partial) previewMs ??= performance.now() - start
          else accept(response)
        })
        worker.once('error', reject)
        worker.postMessage(request)
      }),
  )
  if (fingerprint(inline.frame) !== fingerprint(threaded.frame))
    throw new Error('Worker sample parity failed')
  console.table([
    {
      backend: 'synchronous',
      timerDelayMs: inline.timerDelayMs.toFixed(2),
      roundTripMs: inline.roundTripMs.toFixed(2),
      workMs: inline.workMs.toFixed(2),
    },
    {
      backend: 'worker',
      previewMs: previewMs?.toFixed(2),
      timerDelayMs: threaded.timerDelayMs.toFixed(2),
      roundTripMs: threaded.roundTripMs.toFixed(2),
      workMs: threaded.workMs.toFixed(2),
    },
  ])
  console.log(
    'Raw and filtered frame hashes match. Timer delay measures main-thread blocking; round-trip includes worker startup.',
  )
} finally {
  await worker?.terminate()
}
