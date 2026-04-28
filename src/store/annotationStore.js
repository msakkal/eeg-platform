import { create } from 'zustand'

/**
 * Annotation store
 * Each annotation: { id, timeS, label, color, channelLabel }
 */
export const useAnnotationStore = create((set, get) => ({
  annotations: [],

  addAnnotation(ann) {
    set(s => ({
      annotations: [
        ...s.annotations,
        { id: Date.now(), color: '#FFD166', ...ann },
      ]
    }))
  },

  removeAnnotation(id) {
    set(s => ({ annotations: s.annotations.filter(a => a.id !== id) }))
  },

  clearAnnotations() {
    set({ annotations: [] })
  },
}))

// Preset annotation labels used in the quick-mark toolbar
export const ANNOTATION_LABELS = [
  { label: 'Spike',        color: '#FF4444', key: 'S' },
  { label: 'Sharp wave',   color: '#FF6B35', key: 'W' },
  { label: 'Artifact',     color: '#888888', key: 'A' },
  { label: 'Eye blink',    color: '#66AAFF', key: 'E' },
  { label: 'Seizure onset',color: '#FF0066', key: 'O' },
  { label: 'Note',         color: '#FFD166', key: 'N' },
]
