import { useState, useEffect, useRef } from 'react'

let _worker = null
let _workerFailed = false

function getWorker() {
  if (_workerFailed) return null
  if (!_worker) {
    try {
      _worker = new Worker(new URL('@/workers/fft.worker.js', import.meta.url), {
        type: 'module',
      })
    } catch {
      _workerFailed = true
      return null
    }
  }
  return _worker
}

const pending = new Map()
let nextId = 0

function sendToWorker(type, args) {
  const worker = getWorker()
  if (!worker) return Promise.reject(new Error('Worker unavailable'))
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, type, args })
  })
}

// Global listener attached once
if (typeof window !== 'undefined') {
  const w = getWorker()
  if (w) {
    w.onmessage = (e) => {
      const { id, result, error } = e.data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (error) {
        p.reject(new Error(error))
      } else {
        p.resolve(result)
      }
    }
  }
}

export function useSpectrogramWorker(signal, maxFreq = 40, revision = 0) {
  const [data, setData] = useState(null)
  const reqRef = useRef(0)

  useEffect(() => {
    if (!signal || signal.length < 256) {
      setData(null)
      return
    }

    const reqId = ++reqRef.current
    sendToWorker('spectrogram', {
      signal: new Float32Array(signal),
      sampleRate: 256,
      opts: { frameSize: 256, hopSize: 64, maxFreq },
    })
      .then((result) => {
        if (reqId === reqRef.current) {
          setData(result)
        }
      })
      .catch(() => {
        if (reqId === reqRef.current) {
          setData(null)
        }
      })
  }, [signal, maxFreq, revision])

  return data
}
