import { useState, useEffect } from 'react'
import { computeSpectrogram } from '@/engine/fft'
import { SAMPLE_RATE } from '@/engine/signalGenerator'

let worker = null
let workerFailed = false
let nextId = 0
const pending = new Map()

function stopWorker(error) {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

// Release the shared worker and pending requests during teardown or HMR.
export function disposeSpectrogramWorker() {
  stopWorker(new Error('Worker unavailable'))
  workerFailed = false
}

function getWorker() {
  if (workerFailed) return null
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/fft.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data: { id, result, error } }) => {
        const request = pending.get(id)
        if (!request) return
        pending.delete(id)
        if (error) request.reject(new Error(error))
        else request.resolve(result)
      }
      const fail = (event) => {
        event.preventDefault?.()
        workerFailed = true
        stopWorker(new Error('Worker unavailable'))
      }
      worker.onerror = fail
      worker.onmessageerror = fail
    } catch {
      workerFailed = true
      stopWorker(new Error('Worker unavailable'))
    }
  }
  return worker
}

function sendToWorker(args) {
  const current = getWorker()
  if (!current) return Promise.reject(new Error('Worker unavailable'))
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      current.postMessage({ id, type: 'spectrogram', args })
    } catch (error) {
      pending.delete(id)
      reject(error)
    }
  })
}

export function useSpectrogramWorker(signal, maxFreq = 40, revision = 0) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let active = true
    if (!signal || signal.length < SAMPLE_RATE) {
      setData(null)
      return
    }
    const args = {
      signal: new Float32Array(signal),
      sampleRate: SAMPLE_RATE,
      opts: { frameSize: SAMPLE_RATE, hopSize: SAMPLE_RATE / 4, maxFreq },
    }
    sendToWorker(args)
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (!active) return
        // Keep the frequency panel usable when workers fail or are blocked.
        try {
          setData(computeSpectrogram(args.signal, args.sampleRate, args.opts))
        } catch {
          setData(null)
        }
      })
    return () => {
      active = false
    }
  }, [signal, maxFreq, revision])
  return data
}

if (import.meta.hot) import.meta.hot.dispose(disposeSpectrogramWorker)
