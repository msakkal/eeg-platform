// Supersample thin vector strokes on ordinary displays, retain native detail
// up to 3x, and bound the backing bitmap to roughly 64 MB (16M RGBA pixels).
// Exact transforms account for rounding so time coordinates still map to the
// CSS plot dimensions rather than drifting by a fraction of a backing pixel.
export function getCanvasResolution(width, height, devicePixelRatio = 1) {
  const logicalWidth = Number.isFinite(width) && width > 0 ? width : 1
  const logicalHeight = Number.isFinite(height) && height > 0 ? height : 1
  const nativeScale =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const scale = Math.min(
    Math.max(2, Math.min(3, nativeScale)),
    Math.sqrt(16_000_000 / (logicalWidth * logicalHeight)),
  )
  const bitmapWidth = Math.max(1, Math.floor(logicalWidth * scale))
  const bitmapHeight = Math.max(1, Math.floor(logicalHeight * scale))
  const scaleX = bitmapWidth / logicalWidth
  const scaleY = bitmapHeight / logicalHeight
  return {
    bitmapWidth,
    bitmapHeight,
    scaleX,
    scaleY,
    sampleDensity: Math.max(2, Math.ceil(scaleX)),
  }
}
