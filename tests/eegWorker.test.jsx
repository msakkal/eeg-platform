import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { Buffer } from 'node:buffer'
import { Worker as NodeWorker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import {
  EEGSignalSession,
  createEEGRequestHandler,
  frameTransferables,
} from '../src/engine/eegSession'
import { createEngineForPattern } from '../src/engine/streaming'
import { applyMontage, MONTAGES } from '../src/engine/montages'
import { applyFilterChain } from '../src/engine/filters'
import {
  createEEGProcessor,
  clearEEGWorkerPool,
  prewarmEEGWorker,
} from '../src/engine/eegProcessor'
import { clearEEGFrameCache } from '../src/engine/eegFrameCache'
import { useEEGSignal } from '../src/hooks/useEEGSignal'
import EEGViewer from '../src/components/eeg/EEGViewer'
import * as filters from '../src/engine/filters'

afterEach(() => {
  cleanup()
  clearEEGWorkerPool()
  clearEEGFrameCache()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const options = {
  pattern: 'normal_awake',
  montageId: 'longitudinal_bipolar',
  maxWindowSecs: 2,
  windowSecs: 2,
  seed: 42,
  noiseLevel: 0.15,
  blinksEnabled: false,
}

function expectSamples(actual, expected, label = 'samples') {
  expect(actual.length, label).toBe(expected.length)
  const bytes = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)
  expect(bytes(actual).equals(bytes(expected)), label).toBe(true)
}

function expectFrame(actual, expected) {
  const { channels: actualChannels, ...actualMetadata } = actual
  const { channels: expectedChannels, ...expectedMetadata } = expected
  // Worker values originate in another JS realm. Compare metadata structurally
  // and typed sample arrays byte-for-byte rather than comparing prototypes.
  expect(JSON.stringify(actualMetadata)).toBe(JSON.stringify(expectedMetadata))
  expect(actualChannels.length).toBe(expectedChannels.length)
  actualChannels.forEach((channel, index) => {
    expect(channel.label).toBe(expectedChannels[index].label)
    expect(channel.visibleStartIndex).toBe(expectedChannels[index].visibleStartIndex)
    expectSamples(channel.data, expectedChannels[index].data, channel.label)
    if (channel.filteredData)
      expectSamples(
        channel.filteredData,
        expectedChannels[index].filteredData,
        `${channel.label} filtered`,
      )
  })
}

describe('signal worker quality', () => {
  it('preserves generated samples and engine state while applying live controls to future samples', () => {
    const session = new EEGSignalSession(options)
    const control = new EEGSignalSession(options)
    const engine = session.engine
    const ring = session.ring
    const before = session.frame()
    session.configure({ noiseLevel: 0.9, eyesClosed: false, blinksEnabled: true,
      blinkRate: 30, activationProcedure: 'photic_stimulation' })
    expect(session.engine).toBe(engine)
    expect(session.ring).toBe(ring)
    expect(session.engine.clock).toBe(12)
    expect(session.engine.eyesOpen).toBe(true)
    expect(session.engine.noiseScale).toBeCloseTo(3.08)
    expectSamples(session.frame().channels[0].data, before.channels[0].data)
    for (const overlay of engine.overlays) {
      if (Number.isFinite(overlay.nextT)) expect(overlay.nextT).toBeGreaterThan(engine.clock)
      if (Number.isFinite(overlay.nextEventT)) expect(overlay.nextEventT).toBeGreaterThan(engine.clock)
    }
    session.advance(0.5)
    control.advance(0.5)
    const after = session.frame()
    expectSamples(after.channels[0].data.subarray(0, 384), before.channels[0].data.subarray(128))
    expect(after.channels[0].data.subarray(384)).not.toEqual(control.frame().channels[0].data.subarray(384))
    session.configure({ eyesClosed: true, activationProcedure: 'none' })
    expect(engine.overlays.some(overlay => ['BlinkOverlay', 'SaccadeOverlay', 'ActivationProcedureOverlay']
      .includes(overlay.constructor.name))).toBe(false)
  })

  it.each(['normal_awake', 'normal_sleep', 'temporal_sharps'])(
    'matches the previous live montage and filter arithmetic for %s',
    (pattern) => {
      const session = new EEGSignalSession({ ...options, pattern })
      const original = createEngineForPattern(pattern, options)
      const raw = original.fillWindow(12)
      for (const montage of Object.values(MONTAGES)) {
        const filterConfig = { hp: 0.5, lp: 70, notch: 50 }
        session.configure({ montageId: montage.id, filterConfig })
        const frame = session.frame()
        const expected = applyMontage(raw, montage.id, 0)
        if (montage.channels.some((channel) => channel.neg === 'average')) {
          // The previous live hook accumulates its average in Float32 scratch,
          // whereas the standalone montage helper sums in double precision.
          const labels = Object.keys(raw).filter((label) => !['A1', 'A2'].includes(label))
          const average = new Float32Array(raw.Fp1.length)
          for (const label of labels)
            for (let i = 0; i < average.length; i++) average[i] += raw[label][i]
          for (let i = 0; i < average.length; i++) average[i] *= 1 / labels.length
          montage.channels.forEach((channel, index) => {
            for (let i = 0; i < average.length; i++)
              expected[index].data[i] = raw[channel.pos][i] - average[i]
          })
        }
        frame.channels.forEach((channel, index) => {
          expectSamples(channel.data, expected[index].data, `${montage.id}: ${channel.label}`)
          expectSamples(
            channel.filteredData,
            applyFilterChain(expected[index].data, 256, filterConfig).subarray(2560),
            `${montage.id}: ${channel.label} filtered`,
          )
        })
      }
    },
  )

  it('draws already filtered snapshots without filtering again when controls change', () => {
    const filtered = vi.spyOn(filters, 'applyFilterChain')
    const quadraticCurveTo = vi.fn()
    const ctx = new Proxy(
      { quadraticCurveTo, measureText: () => ({ width: 10 }) },
      {
        get: (target, key) => (key in target ? target[key] : () => {}),
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640)
    const channel = {
      label: 'Fp1',
      data: Float32Array.from([0, 999, 0, 0]),
      filteredData: Float32Array.from([0, 10, 0, 0]),
      filterKey: '0.5|70|50',
      processed: true,
    }
    render(
      <EEGViewer
        channels={[channel]}
        timeAxis={[0, 0.1, 0.2, 0.3]}
        filterConfig={{ hp: 3, lp: 35 }}
        showCalibration={false}
      />,
    )
    expect(filtered).not.toHaveBeenCalled()
    expect(Math.max(...quadraticCurveTo.mock.calls.map((call) => call[1]))).toBeCloseTo(
      24 + (10 * 2) / 7,
      10,
    )
  })

  it.each([
    'normal_awake',
    'normal_sleep',
    'temporal_sharps',
    'focal_status',
    'generalized_status',
    'burst_suppression',
    'gpds',
    'absence',
  ])('keeps chunked initialization sample-identical for %s', (pattern) => {
    const config = { ...options, pattern, filterConfig: { hp: 0.5, lp: 70, notch: 50 } }
    const expected = new EEGSignalSession(config).frame()
    const progressive = new EEGSignalSession(config, { deferred: true })
    while (progressive.filledSamples < progressive.ring.length) progressive.initializeChunk(73)
    expectFrame(progressive.frame(), expected)
  })

  it('transfers frame-owned buffers without detaching the recording or filter scratch state', () => {
    const session = new EEGSignalSession({
      ...options,
      filterConfig: { hp: 0.5, lp: 70, notch: 50 },
    })
    const frame = session.frame()
    const first = frame.channels[0].data.slice()
    const received = structuredClone(frame, { transfer: frameTransferables(frame) })
    expect(frame.channels[0].data.byteLength).toBe(0)
    session.advance(0.0217)
    expect(session.frame().channels[0].data.every(Number.isFinite)).toBe(true)
    expectSamples(received.channels[0].data, first)
  })

  it('runs the production worker protocol in a real worker and returns sample-identical frames', async () => {
    const url = pathToFileURL(resolve('src/workers/eeg.worker.js')).href
    const worker = new NodeWorker(
      `
      const { parentPort } = require('node:worker_threads');
      globalThis.self = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer) };
      import(${JSON.stringify(url)}).then(() => parentPort.on('message', data => self.onmessage({ data })));
    `,
      { eval: true },
    )
    try {
      const inline = createEEGRequestHandler()
      let id = 0
      async function compare(type, args) {
        const request = { id: ++id, revision: 0, type, args }
        const received = new Promise((accept, reject) => {
          worker.once('message', accept)
          worker.once('error', reject)
        })
        worker.postMessage(request)
        const response = await received
        const expected = inline(request)
        expect(response.error).toBeUndefined()
        expectFrame(response.frame, expected.frame)
        return response.frame
      }
      await compare('init', { ...options, filterConfig: { hp: 0.5, lp: 70, notch: 50 } })
      for (const elapsedSec of [0.0167, 0.0217, 0.0513]) await compare('tick', { elapsedSec })
      await compare('configure', { montageId: 'average_reference', windowSecs: 1 })
      expect(
        (await compare('startSeizure', { kind: 'focal', settings: { duration: 10 } })).accepted,
      ).toBe(true)
      await compare('tick', { elapsedSec: 0.2 })
      expect((await compare('stopSeizure')).activeSeizure).toBeNull()
    } finally {
      await worker.terminate()
    }
  }, 15000)
})

describe('progressive worker initialization', () => {
  it('returns a preview before full history and cancels an obsolete initialization', async () => {
    const url = pathToFileURL(resolve('src/workers/eeg.worker.js')).href
    const worker = new NodeWorker(
      `
      const { parentPort } = require('node:worker_threads');
      globalThis.self = { postMessage: (message, transfer) => parentPort.postMessage(message, transfer) };
      import(${JSON.stringify(url)}).then(() => parentPort.on('message', data => self.onmessage({ data })));
    `,
      { eval: true },
    )
    const messages = []
    try {
      const final = new Promise((accept, reject) => {
        worker.on('error', reject)
        worker.on('message', (response) => {
          messages.push(response)
          if (response.error) reject(new Error(response.error))
          if (response.id === 1 && response.partial) {
            worker.postMessage({
              id: 2,
              revision: 0,
              clientId: 'second',
              type: 'init',
              args: { ...options, pattern: 'normal_sleep' },
            })
          }
          if (response.id === 2 && !response.partial) accept(response)
        })
      })
      worker.postMessage({
        id: 1,
        revision: 0,
        clientId: 'first',
        type: 'init',
        args: { ...options, maxWindowSecs: 60 },
      })
      const response = await final
      expect(messages[0].partial).toBe(true)
      expect(messages[0].frame.visibleSamples).toBe(512)
      expect(messages.filter((message) => message.id === 1 && !message.partial)).toHaveLength(0)
      expectFrame(
        response.frame,
        new EEGSignalSession({ ...options, pattern: 'normal_sleep' }).frame(),
      )
    } finally {
      await worker.terminate()
    }
  }, 15000)
})

class DelayedWorker {
  static instances = []
  constructor() {
    this.requests = []
    this.handle = createEEGRequestHandler()
    this.terminate = vi.fn()
    DelayedWorker.instances.push(this)
  }
  postMessage(request) {
    DelayedWorker.current = this
    if (request.type === 'cancel') {
      this.requests = []
      this.handle = createEEGRequestHandler()
      return
    }
    this.requests.push(request)
  }
  reply() {
    const response = this.handle(this.requests.shift())
    this.onmessage({
      data: structuredClone(response, {
        transfer: response.frame ? frameTransferables(response.frame) : [],
      }),
    })
  }
}

function delayedRecording(overrides = {}) {
  DelayedWorker.instances = []
  vi.stubGlobal('Worker', DelayedWorker)
  const pending = new Map()
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    pending.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (value) => pending.delete(value))
  const hook = renderHook((props) => useEEGSignal(props), {
    initialProps: { ...options, isPlaying: true, ...overrides },
  })
  const worker = DelayedWorker.current
  return {
    ...hook,
    worker,
    reply: () => act(() => worker.reply()),
    tick: (now) => {
      const [key, callback] = pending.entries().next().value
      pending.delete(key)
      act(() => callback(now))
    },
  }
}

describe('worker scheduling and recovery', () => {
  it('changes live controls without restarting playback or losing history and seizure state', () => {
    const recording = delayedRecording()
    recording.reply()
    act(() => recording.result.current.startSeizure('focal', { duration: 10 }))
    recording.reply()
    const previous = recording.result.current
    recording.tick(1000)
    recording.rerender({ ...options, isPlaying: true, noiseLevel: 0.8,
      eyesClosed: false, blinksEnabled: true, blinkRate: 30,
      activationProcedure: 'photic_stimulation' })
    expect(recording.result.current.isUpdating).toBe(false)
    recording.tick(1030)
    recording.reply()
    expect(recording.worker.requests[0]).toMatchObject({ type: 'configure',
      args: { noiseLevel: 0.8, eyesClosed: false, blinkRate: 30,
        activationProcedure: 'photic_stimulation' } })
    recording.tick(1060)
    recording.reply()
    expect(recording.result.current.windowStart).toBeGreaterThan(previous.windowStart)
    expect(recording.result.current.activeSeizure).toEqual(previous.activeSeizure)
    expect(recording.result.current.events).toEqual(previous.events)
    expect(recording.worker.requests[0]).toMatchObject({ type: 'tick', args: { elapsedSec: 0.06 } })
    recording.reply()
    expect(recording.result.current.windowStart).toBeCloseTo(previous.windowStart + 1 / 60 + 0.06)
    expect(DelayedWorker.instances).toHaveLength(1)
  })

  it('applies controls to a paused recording without advancing or rewriting its samples', () => {
    const recording = delayedRecording({ isPlaying: false })
    recording.reply()
    const previous = recording.result.current
    recording.rerender({ ...options, isPlaying: false, noiseLevel: 1, eyesClosed: false })
    expect(recording.worker.requests[0].type).toBe('configure')
    recording.reply()
    expect(recording.result.current.windowStart).toBe(previous.windowStart)
    expectSamples(recording.result.current.channels[0].data, previous.channels[0].data)
    expect(recording.worker.requests).toHaveLength(0)
  })

  it('bounds queued work, coalesces controls, and rejects frames from superseded settings', () => {
    const recording = delayedRecording()
    expect(recording.result.current.isReady).toBe(false)
    recording.reply()
    const initial = recording.result.current
    recording.tick(1000)
    for (const now of [1010, 1020, 1030]) recording.tick(now)
    expect(recording.worker.requests).toHaveLength(1)
    for (const hp of [0.5, 1, 3])
      recording.rerender({ ...options, isPlaying: true, filterConfig: { hp } })
    expect(recording.worker.requests).toHaveLength(1)
    recording.reply()
    expect(recording.result.current.windowStart).toBe(initial.windowStart)
    expect(recording.worker.requests).toHaveLength(1)
    expect(recording.worker.requests[0]).toMatchObject({
      type: 'configure',
      args: { filterConfig: { hp: 3 } },
    })
    recording.reply()
    expect(recording.result.current.channels[0].filterKey).toBe('3|null|null')
    expect(recording.worker.requests[0]).toMatchObject({ type: 'tick', args: { elapsedSec: 0.03 } })
    const saved = recording.result.current.channels[0].data.slice()
    const previous = recording.result.current
    recording.reply()
    expect(previous.channels[0].data).toEqual(saved)
    expect(recording.result.current.windowStart).toBeGreaterThan(previous.windowStart)
  })

  it('anchors seizure commands after elapsed ticks already waiting for the worker', () => {
    const recording = delayedRecording()
    recording.reply()
    recording.tick(1000)
    recording.tick(1030)
    act(() => recording.result.current.startSeizure('focal', { duration: 10 }))
    recording.reply()
    const before = recording.result.current
    const beforeCursor = before.windowStart + 2 - before.sampleOffset / 256
    expect(recording.worker.requests[0]).toMatchObject({
      type: 'startSeizure',
      args: { elapsedSec: 0.03 },
    })
    recording.reply()
    expect(recording.result.current.activeSeizure.startTime - beforeCursor).toBe(7 / 256)
    expect(recording.worker.requests).toHaveLength(0)
  })

  it('flushes accrued samples before pausing instead of losing delayed playback time', () => {
    const recording = delayedRecording()
    recording.reply()
    recording.tick(1000)
    recording.tick(1030)
    recording.rerender({ ...options, isPlaying: false })
    recording.reply()
    expect(recording.worker.requests[0]).toMatchObject({ type: 'tick', args: { elapsedSec: 0.03 } })
    recording.reply()
    expect(recording.result.current.windowStart).toBeCloseTo(10 + 1 / 60 + 0.03, 12)
    expect(recording.worker.requests).toHaveLength(0)
  })

  it('keeps the previous complete frame visible during pattern changes and rejects old client replies', () => {
    const recording = delayedRecording()
    recording.reply()
    const previous = recording.result.current
    recording.tick(1000)
    const obsolete = recording.worker.handle(recording.worker.requests[0])
    recording.rerender({ ...options, isPlaying: true, pattern: 'normal_sleep' })
    expect(recording.result.current.isReady).toBe(true)
    expect(recording.result.current.isUpdating).toBe(true)
    expect(recording.result.current.channels).toBe(previous.channels)
    expect(recording.result.current.startSeizure('focal')).toBe(false)
    act(() => recording.worker.onmessage({ data: obsolete }))
    expect(recording.result.current.channels).toBe(previous.channels)
    recording.reply()
    expect(recording.result.current.pattern).toBe('normal_sleep')
    expect(recording.result.current.isUpdating).toBe(false)
  })

  it('accepts a usable preview while keeping playback stopped until initialization finishes', () => {
    const recording = delayedRecording({ maxWindowSecs: 60 })
    const request = recording.worker.requests[0]
    const preview = new EEGSignalSession({ ...request.args, maxWindowSecs: 2 }).frame()
    act(() =>
      recording.worker.onmessage({
        data: { ...request, partial: true, frame: preview, processingMs: 1 },
      }),
    )
    expect(recording.result.current.isReady).toBe(true)
    expect(recording.result.current.isUpdating).toBe(true)
    expect(recording.result.current.channels[0].data.length).toBe(512)
    expect(recording.result.current.startSeizure('focal')).toBe(false)
    expect(recording.worker.requests).toHaveLength(1)
    recording.reply()
    expect(recording.result.current.isUpdating).toBe(false)
    expect(recording.result.current.windowStart).toBe(68)
  })

  it('restores a recent frame synchronously when a recording section is revisited', () => {
    const first = delayedRecording()
    first.reply()
    const saved = first.result.current.channels
    first.unmount()
    const second = delayedRecording()
    expect(second.result.current.isReady).toBe(true)
    expect(second.result.current.isUpdating).toBe(true)
    expect(second.result.current.channels).toBe(saved)
    expect(second.worker).toBe(first.worker)
    second.reply()
    expect(second.result.current.isUpdating).toBe(false)
  })

  it('uses a prewarmed worker without constructing another one', () => {
    DelayedWorker.instances = []
    vi.stubGlobal('Worker', DelayedWorker)
    prewarmEEGWorker()
    const warm = DelayedWorker.instances[0]
    const processor = createEEGProcessor(
      () => {},
      () => {},
    )
    processor.post({ id: 1, revision: 0, type: 'init', args: options })
    expect(DelayedWorker.instances).toHaveLength(1)
    expect(warm.requests[0].type).toBe('init')
    processor.dispose()
  })

  it('preserves asynchronous seizure controls and reuses the worker for replaced recordings', () => {
    const recording = delayedRecording()
    recording.reply()
    act(() => {
      expect(recording.result.current.startSeizure('focal', { duration: 10 })).toBe(true)
      expect(recording.result.current.startSeizure('generalized')).toBe(false)
    })
    recording.reply()
    expect(recording.result.current.activeSeizure.kind).toBe('focal')
    act(() => recording.result.current.stopSeizure())
    recording.reply()
    expect(recording.result.current.activeSeizure).toBeNull()
    recording.rerender({ ...options, isPlaying: true, pattern: 'normal_sleep' })
    expect(recording.worker.terminate).not.toHaveBeenCalled()
    expect(DelayedWorker.instances).toHaveLength(1)
    recording.unmount()
    clearEEGWorkerPool()
    expect(recording.worker.terminate).toHaveBeenCalledOnce()
  })

  it('uses seeded inline processing when a worker fails before its first frame', () => {
    const replies = [],
      failures = []
    DelayedWorker.instances = []
    vi.stubGlobal('Worker', DelayedWorker)
    const processor = createEEGProcessor(
      (reply) => replies.push(reply),
      (error) => failures.push(error),
    )
    processor.post({ id: 1, revision: 0, type: 'init', args: options })
    DelayedWorker.instances[0].onerror({ message: 'Module blocked', preventDefault() {} })
    expect(processor.backend).toBe('synchronous')
    expect(replies[0].frame.channels).toEqual(new EEGSignalSession(options).frame().channels)
    expect(failures).toHaveLength(0)
    processor.dispose()
  })

  it('reports runtime worker loss without silently rewinding an established recording', () => {
    const failures = []
    DelayedWorker.instances = []
    vi.stubGlobal('Worker', DelayedWorker)
    const processor = createEEGProcessor(
      () => {},
      (error) => failures.push(error),
    )
    processor.post({ id: 1, revision: 0, type: 'init', args: options })
    DelayedWorker.instances[0].reply()
    DelayedWorker.instances[0].onerror({ message: 'Worker stopped', preventDefault() {} })
    expect(failures[0].message).toBe('Worker stopped')
    processor.dispose()
  })
})
