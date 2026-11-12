import { createEEGRequestHandler } from './eegSession.js'

// Retain one idle module worker between recordings/sections, not its old
// recording state. Cancel initialization when released and expire after 60s.
const idle = []
const active = new Set()
let nextClientId = 0

function terminate(worker) {
  active.delete(worker)
  worker.onmessage = worker.onerror = worker.onmessageerror = null
  worker.terminate()
}

export function clearEEGWorkerPool() {
  for (const entry of idle.splice(0)) {
    clearTimeout(entry.timer)
    terminate(entry.worker)
  }
}

function park(worker) {
  active.delete(worker)
  if (idle.length) {
    terminate(worker)
    return
  }
  const entry = { worker, timer: null }
  function discard() {
    const index = idle.indexOf(entry)
    if (index >= 0) idle.splice(index, 1)
    clearTimeout(entry.timer)
    terminate(worker)
  }
  worker.onmessage = null
  worker.onerror = worker.onmessageerror = discard
  entry.timer = setTimeout(discard, 60_000)
  entry.timer.unref?.()
  idle.push(entry)
}

function acquire() {
  const entry = idle.pop()
  if (entry) {
    clearTimeout(entry.timer)
    return entry.worker
  }
  return new Worker(new URL('../workers/eeg.worker.js', import.meta.url), { type: 'module' })
}

export function prewarmEEGWorker() {
  if (typeof Worker === 'undefined' || idle.length || active.size) return
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('eegWorker') === '0'
  )
    return
  try {
    park(acquire())
  } catch {
    /* Recording startup retains synchronous fallback. */
  }
}

export function createEEGProcessor(onMessage, onError, useWorker = true) {
  const clientId = ++nextClientId
  let worker = null
  let handle = null
  let firstRequest = null
  let receivedFrame = false
  let disposed = false

  function inline(request) {
    handle ??= createEEGRequestHandler()
    const response = handle(request)
    if (response.frame) receivedFrame = true
    onMessage(response)
  }

  function fail(error) {
    if (disposed) return
    if (worker) terminate(worker)
    worker = null
    if (!receivedFrame && firstRequest) inline(firstRequest)
    else onError(error instanceof Error ? error : new Error('EEG processing worker stopped'))
  }

  if (useWorker && typeof Worker !== 'undefined') {
    try {
      worker = acquire()
      active.add(worker)
      worker.onmessage = ({ data }) => {
        // A pooled worker can still have an old message queued for delivery.
        if (disposed || data.clientId !== clientId) return
        if (data.frame) receivedFrame = true
        onMessage(data)
      }
      worker.onerror = (event) => {
        event.preventDefault?.()
        fail(new Error(event.message || 'EEG processing worker stopped'))
      }
      worker.onmessageerror = () => fail(new Error('Unable to read an EEG worker frame'))
    } catch {
      worker = null
    }
  }

  return {
    get backend() {
      return worker ? 'worker' : 'synchronous'
    },
    post(request) {
      if (disposed) return
      const tagged = { ...request, clientId }
      if (request.type === 'init') firstRequest = tagged
      if (worker) {
        try {
          worker.postMessage(tagged)
        } catch (error) {
          fail(error)
        }
      } else inline(tagged)
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (worker) {
        try {
          worker.postMessage({ type: 'cancel', clientId })
          park(worker)
        } catch {
          terminate(worker)
        }
      }
      worker = null
      handle = firstRequest = null
    },
  }
}
