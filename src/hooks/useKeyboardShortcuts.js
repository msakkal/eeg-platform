import { useEffect, useCallback } from 'react'

/**
 * useKeyboardShortcuts
 * Registers keyboard shortcuts for the EEG sandbox.
 *
 * @param {object} handlers - keyed by key string (lowercase), value = function
 * @param {boolean} enabled
 */
export function useKeyboardShortcuts(handlers, enabled = true) {
  const handle = useCallback((e) => {
    if (!enabled) return
    // Don't fire inside text inputs
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return

    const key = e.key.toLowerCase()
    if (handlers[key]) {
      e.preventDefault()
      handlers[key](e)
    }
  }, [handlers, enabled])

  useEffect(() => {
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [handle])
}

/**
 * Default sandbox shortcuts descriptor (for help overlay).
 */
export const SANDBOX_SHORTCUTS = [
  { keys: ['Space'],    description: 'Play / Pause' },
  { keys: ['S'],        description: 'Inject spike' },
  { keys: ['A'],        description: 'Inject artifact' },
  { keys: ['E'],        description: 'Toggle eyes open / closed' },
  { keys: ['B'],        description: 'Toggle spontaneous blinks' },
  { keys: ['+', '='],   description: 'Increase amplitude' },
  { keys: ['-'],        description: 'Decrease amplitude' },
  { keys: ['ArrowRight'], description: 'Speed up sweep' },
  { keys: ['ArrowLeft'],  description: 'Slow down sweep' },
  { keys: ['1'],        description: 'Normal awake pattern' },
  { keys: ['2'],        description: 'Drowsy pattern' },
  { keys: ['3'],        description: 'Normal sleep pattern' },
  { keys: ['4'],        description: 'Absence seizure' },
  { keys: ['5'],        description: 'Focal slowing' },
  { keys: ['6'],        description: 'Burst-suppression' },
  { keys: ['?'],        description: 'Toggle help' },
]
