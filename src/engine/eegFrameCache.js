// Immutable received frames only; never cache canvases or transferable worker
// scratch buffers. Bounded history makes revisiting a section paint immediately.
const frames = new Map()
const LIMIT = 6

export function getEEGFrame(key) {
  const frame = frames.get(key)
  if (frame) {
    frames.delete(key)
    frames.set(key, frame)
  }
  return frame
}

export function cacheEEGFrame(key, frame) {
  frames.delete(key)
  frames.set(key, frame)
  while (frames.size > LIMIT) frames.delete(frames.keys().next().value)
}

export function clearEEGFrameCache() {
  frames.clear()
}
