import { describe, it, expect, beforeEach } from 'vitest'
import { useEEGStore } from '../src/store/eegStore.js'
import { useAnnotationStore } from '../src/store/annotationStore.js'
import { DEFAULT_MONTAGE } from '../src/engine/montages.js'

describe('eegStore', () => {
  beforeEach(() => {
    useEEGStore.setState({
      montageId: DEFAULT_MONTAGE,
      pattern: 'normal_awake',
      amplitude: 50,
      noiseLevel: 0.25,
      sweepSpeed: 25,
      isPlaying: true,
      pendingSpike: false,
      pendingArtifact: false,
      eyesClosed: true,
      blinksEnabled: true,
      blinkRate: 18,
      sidebarOpen: true,
    })
  })

  it('has default montage', () => {
    expect(useEEGStore.getState().montageId).toBe(DEFAULT_MONTAGE)
  })

  it('has default pattern', () => {
    expect(useEEGStore.getState().pattern).toBe('normal_awake')
  })

  it('has default amplitude 50', () => {
    expect(useEEGStore.getState().amplitude).toBe(50)
  })

  it('starts playing', () => {
    expect(useEEGStore.getState().isPlaying).toBe(true)
  })

  it('eyes closed by default', () => {
    expect(useEEGStore.getState().eyesClosed).toBe(true)
  })

  it('toggles play state', () => {
    const store = useEEGStore.getState()
    store.togglePlay()
    expect(useEEGStore.getState().isPlaying).toBe(false)
    useEEGStore.getState().togglePlay()
    expect(useEEGStore.getState().isPlaying).toBe(true)
  })

  it('sets amplitude with value', () => {
    useEEGStore.getState().setAmplitude(75)
    expect(useEEGStore.getState().amplitude).toBe(75)
  })

  it('sets amplitude with updater function', () => {
    useEEGStore.getState().setAmplitude((v) => v + 25)
    expect(useEEGStore.getState().amplitude).toBe(75)
  })

  it('triggers spike flag', () => {
    useEEGStore.getState().triggerSpike()
    expect(useEEGStore.getState().pendingSpike).toBe(true)
    useEEGStore.getState().clearPending()
    expect(useEEGStore.getState().pendingSpike).toBe(false)
  })

  it('toggles eyes state', () => {
    expect(useEEGStore.getState().eyesClosed).toBe(true)
    useEEGStore.getState().toggleEyes()
    expect(useEEGStore.getState().eyesClosed).toBe(false)
  })

  it('sidebar defaults open', () => {
    expect(useEEGStore.getState().sidebarOpen).toBe(true)
  })
})

describe('annotationStore', () => {
  beforeEach(() => {
    useAnnotationStore.setState({ annotations: [] })
  })

  it('starts with empty annotations', () => {
    expect(useAnnotationStore.getState().annotations).toEqual([])
  })

  it('adds an annotation with timestamp', () => {
    useAnnotationStore.getState().addAnnotation({
      timeS: 2.5,
      label: 'Spike',
      channelLabel: 'F3',
    })
    const anns = useAnnotationStore.getState().annotations
    expect(anns).toHaveLength(1)
    expect(anns[0].timeS).toBe(2.5)
    expect(anns[0].label).toBe('Spike')
    expect(anns[0].channelLabel).toBe('F3')
    expect(anns[0].id).toEqual(expect.any(Number))
    expect(anns[0].id).toBeGreaterThan(0)
  })

  it('removes an annotation by id', () => {
    useAnnotationStore.getState().addAnnotation({ timeS: 1.0, label: 'A', channelLabel: 'F3' })
    const first = useAnnotationStore.getState().annotations[0]
    useAnnotationStore.getState().addAnnotation({ timeS: 2.0, label: 'B', channelLabel: 'Cz' })
    expect(useAnnotationStore.getState().annotations).toHaveLength(2)
    useAnnotationStore.getState().removeAnnotation(first.id)
    expect(useAnnotationStore.getState().annotations).toHaveLength(1)
    expect(useAnnotationStore.getState().annotations[0].label).toBe('B')
  })

  it('clears all annotations', () => {
    useAnnotationStore.getState().addAnnotation({ timeS: 1.0, label: 'A' })
    useAnnotationStore.getState().clearAnnotations()
    expect(useAnnotationStore.getState().annotations).toEqual([])
  })
})
