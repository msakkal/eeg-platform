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

// Preset annotation labels used in the quick-mark toolbar.
// `id` is the i18n key (resolved via `annotations.labels.<id>` at render time).
// `key` is the keyboard hotkey character.
export const ANNOTATION_LABELS = [
  { id: 'spike',         color: '#FF4444', key: 'S' },
  { id: 'sharp_wave',    color: '#FF6B35', key: 'W' },
  { id: 'artifact',      color: '#888888', key: 'A' },
  { id: 'eye_blink',     color: '#66AAFF', key: 'E' },
  { id: 'seizure_onset', color: '#FF0066', key: 'O' },
  { id: 'note',          color: '#FFD166', key: 'N' },
]
