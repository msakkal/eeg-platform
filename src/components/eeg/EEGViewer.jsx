import { useRef, useEffect, useCallback, useMemo } from 'react'
import { applyFilterChain } from '@/engine/filters'
import { SAMPLE_RATE } from '@/engine/signalGenerator'
import { getViewerTheme, DEFAULT_SENSITIVITY } from '@/engine/viewerThemes'

const EMPTY_ARRAY = []
const DEFAULT_CHANNEL_HEIGHT = 48
const DEFAULT_LEFT_LABEL_WIDTH = 72
const DEFAULT_FOOTER_HEIGHT = 24
const MAX_CANVAS_DPR = 2
const TRACE_VERTICAL_DETAIL_THRESHOLD = 4
const NEGATIVE_UP = -1

// Vertical scale of the canvas, in pixels per millimetre.
const PX_PER_MM = 2

function requestDrawFrame(cb) {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : window.setTimeout(cb, 16)
}

function cancelDrawFrame(id) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(id)
  } else {
    window.clearTimeout(id)
  }
}

function setDenseColumnPoint(out, data, nPts, col, columns, samplesPerColumn, labelW, plotW, cy, pxPerUv) {
  const i0 = Math.floor(col * samplesPerColumn)
  const i1 = Math.min(nPts, Math.max(i0 + 1, Math.floor((col + 1) * samplesPerColumn)))
  let min = Infinity
  let max = -Infinity
  for (let i = i0; i < i1; i++) {
    const v = data[i]
    if (v < min) min = v
    if (v > max) max = v
  }

  out.x = labelW + (col / Math.max(1, columns - 1)) * plotW
  out.yMin = cy - max * pxPerUv
  out.yMax = cy - min * pxPerUv
  out.y = (out.yMin + out.yMax) / 2
  return out
}

function drawSignalPathFast(ctx, data, labelW, plotW, cy, pxPerUv, fillColor) {
  const nPts = data.length
  const lastIdx = nPts - 1

  ctx.beginPath()
  ctx.lineJoin = 'round'
  ctx.lineCap  = 'round'

  if (nPts <= plotW * 1.25) {
    if (nPts === 1) {
      ctx.moveTo(labelW, cy - data[0] * pxPerUv)
      return
    }

    ctx.moveTo(labelW, cy - data[0] * pxPerUv)
    for (let i = 1; i < lastIdx; i++) {
      const x = labelW + (i / lastIdx) * plotW
      const y = cy - data[i] * pxPerUv
      const nextX = labelW + ((i + 1) / lastIdx) * plotW
      const nextY = cy - data[i + 1] * pxPerUv
      ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2)
    }
    ctx.lineTo(labelW + plotW, cy - data[lastIdx] * pxPerUv)
    return
  }

  // Dense signal: one column per CSS pixel, preserving narrow spikes with
  // min/max segments while avoiding per-frame envelope allocations.
  const columns = Math.max(1, Math.ceil(plotW))
  const samplesPerColumn = nPts / columns
  const point = { x: 0, y: 0, yMin: 0, yMax: 0 }
  const next = { x: 0, y: 0, yMin: 0, yMax: 0 }
  setDenseColumnPoint(point, data, nPts, 0, columns, samplesPerColumn, labelW, plotW, cy, pxPerUv)
  ctx.moveTo(point.x, point.y)

  for (let col = 1; col < columns; col++) {
    setDenseColumnPoint(next, data, nPts, col, columns, samplesPerColumn, labelW, plotW, cy, pxPerUv)
    const mx = (point.x + next.x) / 2
    const my = (point.y + next.y) / 2
    ctx.quadraticCurveTo(point.x, point.y, mx, my)

    if (fillColor && Math.abs(point.yMax - point.yMin) > TRACE_VERTICAL_DETAIL_THRESHOLD) {
      ctx.moveTo(point.x, point.yMin)
      ctx.lineTo(point.x, point.yMax)
      ctx.moveTo(mx, my)
    }

    point.x = next.x
    point.y = next.y
    point.yMin = next.yMin
    point.yMax = next.yMax
  }

  ctx.lineTo(point.x, point.y)
  if (fillColor && Math.abs(point.yMax - point.yMin) > TRACE_VERTICAL_DETAIL_THRESHOLD) {
    ctx.moveTo(point.x, point.yMin)
    ctx.lineTo(point.x, point.yMax)
  }
}

function hasActiveFilter(filterConfig) {
  return Boolean(filterConfig?.hp || filterConfig?.lp || filterConfig?.notch)
}

function visibleData(ch) {
  const data = ch.data
  const start = ch.visibleStartIndex ?? 0
  return start > 0 ? data?.subarray(start) : data
}

function filteredVisibleData(ch, filterConfig) {
  if (!ch.data?.length) return ch.data

  const filtered = applyFilterChain(ch.data, SAMPLE_RATE, filterConfig)
  const start = ch.visibleStartIndex ?? 0
  return start > 0 ? filtered.subarray(start) : filtered
}

/**
 * EEGViewer
 * Canvas-based multi-channel EEG renderer.
 *
 * Props:
 *   channels       - Array<{ label, data: Float32Array }>
 *   timeAxis       - number[]
 *   sensitivity    - display sensitivity in µV/mm (default 7)
 *   filterConfig   - { hp, lp, notch } | null
 *   annotations    - Array<{ id, timeS, label, color }>
 *   windowStart    - seconds offset for annotation time mapping
 *   onAnnotate     - (timeS, channelLabel) => void, enables crosshair+click
 *   onHoverChannel - (channelLabel | null) => void
 *   theme          - viewer theme id (see engine/viewerThemes.js)
 */
export default function EEGViewer({
  channels = EMPTY_ARRAY,
  timeAxis = EMPTY_ARRAY,
  sensitivity = DEFAULT_SENSITIVITY,
  filterConfig = null,
  annotations = EMPTY_ARRAY,
  windowStart = 0,
  onAnnotate = null,
  onHoverChannel = null,
  theme = 'midnight',
  className = '',
  channelHeight = DEFAULT_CHANNEL_HEIGHT,
  leftLabelWidth = DEFAULT_LEFT_LABEL_WIDTH,
  footerHeight = DEFAULT_FOOTER_HEIGHT,
  scaleMode = 'sensitivity',
  signalColor = null,
  curveWidth = 1.1,
  themeOverrides = null,
  highlightedChannels = EMPTY_ARRAY,
  highlightColor = null,
  channelColor = null,
  showCalibration = true,
  showChannelLabels = true,
  showChannelAmplitudes = false,
  showTimeLabels = true,
  polarity = 'negative-up',
}) {
  const canvasRef = useRef(null)
  const dprRef = useRef(Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR))
  const hoverRef = useRef({ x: null, ch: null })
  const rafRef = useRef(null)
  const lastReportedHoverRef = useRef(null)

  const th = useMemo(
    () => ({ ...getViewerTheme(theme), ...(themeOverrides ?? {}) }),
    [theme, themeOverrides]
  )

  const filteredChannels = useMemo(() => {
    if (!hasActiveFilter(filterConfig)) {
      return channels.map(ch => ({
        ...ch,
        data: visibleData(ch),
      }))
    }
    return channels.map(ch => ({
      ...ch,
      data: filteredVisibleData(ch, filterConfig),
    }))
  }, [channels, filterConfig])

  const channelStats = useMemo(() => {
    const channelMax = filteredChannels.map(ch => {
      if (!ch.data?.length) return 1
      let max = 0
      for (let i = 0; i < ch.data.length; i++) {
        const v = Math.abs(ch.data[i])
        if (v > max) max = v
      }
      return max || 1
    })

    return {
      channelMax,
      globalMax: channelMax.reduce((max, value) => Math.max(max, value), 1),
    }
  }, [filteredChannels])

  const highlightedSet = useMemo(
    () => new Set(highlightedChannels ?? EMPTY_ARRAY),
    [highlightedChannels]
  )

  const reportHoverChannel = useCallback((idx) => {
    if (!onHoverChannel) return
    const label = idx == null ? null : filteredChannels[idx]?.label ?? null
    if (lastReportedHoverRef.current === label) return
    lastReportedHoverRef.current = label
    onHoverChannel(label)
  }, [filteredChannels, onHoverChannel])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR)
    dprRef.current = dpr
    const W = canvas.clientWidth
    const chs = filteredChannels
    const nCh = chs.length
    const rowH = channelHeight
    const labelW = showChannelLabels || showChannelAmplitudes ? leftLabelWidth : 0
    const H = Math.max(footerHeight, nCh * rowH + footerHeight)

    const bitmapW = Math.max(1, Math.round(W * dpr))
    const bitmapH = Math.max(1, Math.round(H * dpr))
    if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
      canvas.width = bitmapW
      canvas.height = bitmapH
      canvas.style.height = `${H}px`
    }

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'low'
    ctx.clearRect(0, 0, W, H)

    const plotW = W - labelW
    const plotH = H - footerHeight
    if (plotW <= 0 || plotH <= 0 || nCh === 0) return

    const duration = timeAxis[timeAxis.length - 1] || 10
    const { channelMax, globalMax } = channelStats
    const fitHalfH = Math.max(1, rowH / 2 - 4)
    const displayPolarity = polarity === 'positive-up' ? 1 : NEGATIVE_UP
    const pxPerUvFor = (idx) => {
      if (scaleMode === 'global-fit') return fitHalfH / globalMax
      if (scaleMode === 'per-channel-fit') return fitHalfH / channelMax[idx]
      return PX_PER_MM / sensitivity
    }
    const baseSignalColor = signalColor ?? th.signal
    const rowHighlightColor = highlightColor ?? baseSignalColor
    const { x: hoverX, ch: hoverCh } = hoverRef.current

    ctx.fillStyle = th.pageBg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = th.plotBg
    ctx.fillRect(labelW, 0, plotW, plotH)

    const pxPerSec = plotW / duration
    const minorTimeStep = 0.2

    {
      const minorStart = Math.ceil(windowStart / minorTimeStep)
      const minorEnd = Math.floor((windowStart + duration) / minorTimeStep)
      for (const major of [false, true]) {
        ctx.strokeStyle = major ? th.gridMajor : th.gridMinor
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let k = minorStart; k <= minorEnd; k++) {
          const isMajor = k % 5 === 0
          if (isMajor !== major) continue
          const t = k * minorTimeStep
          const x = labelW + (t - windowStart) * pxPerSec
          ctx.moveTo(x, 0)
          ctx.lineTo(x, plotH)
        }
        ctx.stroke()
      }
    }

    const majorGridPx = pxPerSec
    const minorGridPx = majorGridPx / 5
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? th.gridMajor : th.gridMinor
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let j = 0; j * minorGridPx <= plotH; j++) {
        if ((j % 5 === 0) !== major) continue
        const y = j * minorGridPx
        ctx.moveTo(labelW, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()
    }

    if (showTimeLabels) {
      ctx.fillStyle = th.axisText
      ctx.font = '10px "DM Mono", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      for (let s = Math.ceil(windowStart); s <= Math.floor(windowStart + duration); s++) {
        const x = labelW + (s - windowStart) * pxPerSec
        if (x < labelW || x > W - 12) continue
        ctx.fillText(`${s}s`, x + 3, H - 8)
      }
    }

    annotations.forEach(ann => {
      const relTime = ann.timeS - windowStart
      if (relTime < 0 || relTime > duration) return
      const x = labelW + (relTime / duration) * plotW
      const annColor = ann.color ?? rowHighlightColor
      const label = String(ann.label ?? '').slice(0, 18)
      ctx.strokeStyle = annColor + '99'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, plotH)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = '10px "DM Mono", monospace'
      const padX = 5
      const textW = Math.ceil(ctx.measureText(label).width)
      const tagW = Math.max(36, textW + padX * 2)
      const tagH = 20
      const pointerW = 7
      const tagX = Math.min(Math.max(x, labelW + 2), W - tagW - pointerW - 2)
      const tagY = 4

      ctx.fillStyle = annColor
      ctx.beginPath()
      ctx.moveTo(tagX, tagY)
      ctx.lineTo(tagX + tagW, tagY)
      ctx.lineTo(tagX + tagW + pointerW, tagY + tagH / 2)
      ctx.lineTo(tagX + tagW, tagY + tagH)
      ctx.lineTo(tagX, tagY + tagH)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = th.annotationText
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, tagX + padX, tagY + tagH / 2)
    })

    if (hoverX !== null) {
      const hoverTime = ((hoverX - labelW) / plotW) * duration
      ctx.strokeStyle = th.cursorLine
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(hoverX, 0)
      ctx.lineTo(hoverX, plotH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = th.cursorBox
      ctx.fillRect(hoverX + 4, 2, 38, 14)
      ctx.fillStyle = th.cursorText
      ctx.font = '8px "DM Mono", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${hoverTime.toFixed(2)}s`, hoverX + 7, 9)
    }

    chs.forEach(({ label, data }, idx) => {
      const cy = idx * rowH + rowH / 2
      const isHovered = hoverCh === idx
      const isHighlighted = highlightedSet.has(label)

      if (isHighlighted) {
        ctx.fillStyle = rowHighlightColor + '12'
        ctx.fillRect(labelW, cy - rowH / 2, plotW, rowH)
      }

      if (isHovered) {
        ctx.fillStyle = th.rowHover
        ctx.fillRect(labelW, cy - rowH / 2, plotW, rowH)
      }

      ctx.strokeStyle = isHovered ? th.baselineHover : th.baseline
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(labelW, cy + rowH / 2)
      ctx.lineTo(W, cy + rowH / 2)
      ctx.stroke()

      ctx.strokeStyle = th.midline
      ctx.beginPath()
      ctx.moveTo(labelW, cy)
      ctx.lineTo(W, cy)
      ctx.stroke()

      if (!data?.length) return

      const customColor = channelColor?.(label, idx)
      const traceColor = customColor ?? (isHighlighted ? rowHighlightColor : baseSignalColor)
      ctx.strokeStyle = isHovered ? th.signalHover : traceColor
      ctx.lineWidth = isHovered
        ? curveWidth + 0.45
        : isHighlighted
          ? curveWidth + 0.15
          : curveWidth
      if (th.glow && (isHovered || isHighlighted)) {
        ctx.shadowColor = isHovered ? th.glowHover : traceColor
        ctx.shadowBlur = isHovered ? th.glowBlur * 1.4 : isHighlighted ? th.glowBlur : th.glowBlur * 0.7
      }
      drawSignalPathFast(ctx, data, labelW, plotW, cy, pxPerUvFor(idx) * displayPolarity, traceColor)
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    if (showCalibration) {
      const calUv = 50
      const calScale = Math.abs(scaleMode === 'per-channel-fit' ? fitHalfH / globalMax : pxPerUvFor(0))
      const calH = calUv * calScale
      const calX = labelW + 14
      const calY = plotH - 12
      if (Number.isFinite(calH) && calH > 3 && calH < plotH) {
        ctx.strokeStyle = th.axisText
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(calX, calY)
        ctx.lineTo(calX, calY - calH)
        ctx.moveTo(calX - 3, calY)
        ctx.lineTo(calX + 3, calY)
        ctx.moveTo(calX - 3, calY - calH)
        ctx.lineTo(calX + 3, calY - calH)
        ctx.stroke()
        ctx.fillStyle = th.axisText
        ctx.font = '9px "DM Mono", monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${calUv} µV`, calX + 7, calY - calH / 2)
      }
    }

    if (labelW > 0) {
      ctx.fillStyle = th.labelBg
      ctx.fillRect(0, 0, labelW, H)
      ctx.strokeStyle = th.divider
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(labelW, 0)
      ctx.lineTo(labelW, plotH)
      ctx.stroke()

      chs.forEach(({ label }, idx) => {
        const cy = idx * rowH + rowH / 2
        const isHovered = hoverCh === idx
        const isHighlighted = highlightedSet.has(label)
        const customColor = channelColor?.(label, idx)
        const labelColor = isHovered ? th.chanLabelHover : customColor ?? (isHighlighted ? rowHighlightColor : th.chanLabel)
        ctx.fillStyle = labelColor
        ctx.font = `${isHovered || isHighlighted ? 'bold ' : ''}10px "DM Mono", monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const labelY = showChannelAmplitudes ? cy - 5 : cy
        if (showChannelLabels) ctx.fillText(label, labelW - 6, labelY)
        if (showChannelAmplitudes) {
          ctx.fillStyle = th.axisText
          ctx.font = '8px "DM Mono", monospace'
          ctx.fillText(`${Math.round(channelMax[idx])}µV`, labelW - 6, cy + 9)
        }
      })
    }
  }, [
    annotations,
    channelColor,
    channelHeight,
    channelStats,
    curveWidth,
    filteredChannels,
    footerHeight,
    highlightedSet,
    highlightColor,
    leftLabelWidth,
    polarity,
    scaleMode,
    sensitivity,
    showCalibration,
    showChannelAmplitudes,
    showChannelLabels,
    showTimeLabels,
    signalColor,
    th,
    timeAxis,
    windowStart,
  ])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestDrawFrame(() => {
      rafRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelDrawFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    reportHoverChannel(hoverRef.current.ch)
  }, [reportHoverChannel])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(scheduleDraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [scheduleDraw])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const labelW = showChannelLabels || showChannelAmplitudes ? leftLabelWidth : 0
    const nextHover = x < labelW
      ? { x: null, ch: null }
      : { x, ch: Math.floor(y / channelHeight) }

    if (nextHover.ch != null && (nextHover.ch < 0 || nextHover.ch >= filteredChannels.length)) {
      nextHover.ch = null
    }

    const cur = hoverRef.current
    if (cur.x === nextHover.x && cur.ch === nextHover.ch) return
    hoverRef.current = nextHover
    reportHoverChannel(nextHover.ch)
    scheduleDraw()
  }

  function handleMouseLeave() {
    const cur = hoverRef.current
    if (cur.x == null && cur.ch == null) return
    hoverRef.current = { x: null, ch: null }
    reportHoverChannel(null)
    scheduleDraw()
  }

  function handleClick(e) {
    if (!onAnnotate) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const labelW = showChannelLabels || showChannelAmplitudes ? leftLabelWidth : 0
    if (x < labelW) return
    const duration = timeAxis[timeAxis.length - 1] || 10
    const plotW = canvas.clientWidth - labelW
    if (plotW <= 0) return
    const relTime = ((x - labelW) / plotW) * duration
    const chIdx = Math.floor((e.clientY - rect.top) / channelHeight)
    onAnnotate(windowStart + relTime, filteredChannels[chIdx]?.label ?? '')
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ imageRendering: 'auto', cursor: onAnnotate ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  )
}
