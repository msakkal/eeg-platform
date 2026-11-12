import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useRef, useEffect, useLayoutEffect, useCallback, useId, useMemo } from 'react'
import { applyFilterChain } from '@/engine/filters'
import { SAMPLE_RATE } from '@/engine/signalGenerator'
import { createTraceSamplingPlan, sampleTraceAt } from '@/engine/traceSampling'
import { getCanvasResolution } from '@/engine/canvasResolution'
import { eegProfilingEnabled, recordEEGMetric } from '@/engine/eegPerformance'
import { getViewerTheme, getChannelThemeColor, DEFAULT_SENSITIVITY } from '@/engine/viewerThemes'

const EMPTY_ARRAY = []
const DEFAULT_CHANNEL_HEIGHT = 48
const DEFAULT_LEFT_LABEL_WIDTH = 72
const DEFAULT_FOOTER_HEIGHT = 24
const MIN_TRACE_POINT_SPACING_PX = 0.5
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

function drawSmoothedSamplePath(ctx, data, labelW, plotW, cy, pxPerUv, offsetX = 0) {
  const nPts = data.length
  const lastIdx = nPts - 1
  const step = Math.max(1, Math.floor((lastIdx * MIN_TRACE_POINT_SPACING_PX) / Math.max(1, plotW)))
  let prevX = labelW - offsetX
  let prevY = cy - data[0] * pxPerUv

  ctx.moveTo(prevX, prevY)

  for (let i = step; i < lastIdx; i += step) {
    const x = labelW + (i / lastIdx) * plotW - offsetX
    const y = cy - data[i] * pxPerUv
    ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2)
    prevX = x
    prevY = y
  }

  const endX = labelW + plotW - offsetX
  const endY = cy - data[lastIdx] * pxPerUv
  ctx.quadraticCurveTo(prevX, prevY, (prevX + endX) / 2, (prevY + endY) / 2)
  ctx.lineTo(endX, endY)
}

function drawPixelSampledPath(ctx, data, labelW, plotW, cy, pxPerUv, offsetX, plan) {
  const columns = plan.columns
  const lastIdx = data.length - 1
  let prevX = labelW - offsetX
  let prevY = cy - data[0] * pxPerUv

  ctx.moveTo(prevX, prevY)

  for (let col = 1; col < columns; col++) {
    const ratio = col / (columns - 1)
    const x = labelW + ratio * plotW - offsetX
    const y = cy - sampleTraceAt(data, plan, col) * pxPerUv
    // A midpoint quadratic keeps adjacent resampled points tangent to one
    // another. Straight segments make tiny bucket changes look like a jiggle
    // while the live window advances.
    ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2)
    prevX = x
    prevY = y
  }

  const endX = labelW + plotW - offsetX
  const endY = cy - data[lastIdx] * pxPerUv
  ctx.quadraticCurveTo(prevX, prevY, (prevX + endX) / 2, (prevY + endY) / 2)
  ctx.lineTo(endX, endY)
}

function drawSignalPathFast(ctx, data, labelW, plotW, cy, pxPerUv, offsetX, samplingPlans, sampleDensity) {
  const nPts = data.length

  ctx.beginPath()
  ctx.lineJoin = 'round'
  ctx.lineCap  = 'round'

  if (nPts <= plotW * sampleDensity) {
    if (nPts === 1) {
      ctx.moveTo(labelW - offsetX, cy - data[0] * pxPerUv)
      return
    }

    drawSmoothedSamplePath(ctx, data, labelW, plotW, cy, pxPerUv, offsetX)
    return
  }

  // Keep the weighted sampling geometry stable as the recording scrolls.
  // Density follows the backing resolution (at least two points/CSS pixel),
  // retaining extra detail on high-density displays without new signal filters.
  let plan = samplingPlans.get(nPts)
  if (!plan) {
    // Mixed-length inputs are uncommon; keep the geometry cache bounded.
    if (samplingPlans.size >= 4) samplingPlans.clear()
    plan = createTraceSamplingPlan(nPts, plotW, sampleDensity)
    samplingPlans.set(nPts, plan)
  }
  drawPixelSampledPath(ctx, data, labelW, plotW, cy, pxPerUv, offsetX, plan)
}

function hasActiveFilter(filterConfig) {
  return Boolean(filterConfig?.hp || filterConfig?.lp || filterConfig?.notch)
}

function visibleData(ch) {
  const data = ch.data
  const start = ch.visibleStartIndex ?? 0
  return start > 0 ? data?.subarray(start) : data
}

function filteredVisibleData(ch, filterConfig, workspace) {
  if (!ch.data?.length) return ch.data

  const filtered = applyFilterChain(ch.data, SAMPLE_RATE, filterConfig, workspace)
  // Keep the returned frame private to this render. A future filter pass may
  // reuse its scratch buffer, but must not overwrite a still-displayed trace.
  if (workspace.bufA === filtered) workspace.bufA = null
  if (workspace.bufB === filtered) workspace.bufB = null
  const start = ch.visibleStartIndex ?? 0
  return start > 0 ? filtered.subarray(start) : filtered
}

function channelPairFromLabel(label) {
  const parts = String(label ?? '').split(/[\u2013\u2014-]/).map((part) => part.trim())
  return parts.length === 2 && parts[0] && parts[1] ? parts : null
}

function buildChannelLayout(channels, rowH, chainGap, verticalPadding = 0, channelGapBefore = null) {
  const centers = []
  const breakBefore = []
  const gapBefore = []
  let extraY = verticalPadding
  let previousPair = null

  channels.forEach((channel, idx) => {
    const pair = channelPairFromLabel(channel.label)
    const customGap = idx > 0 ? channelGapBefore?.(channel.label, idx) ?? 0 : 0
    const startsNewChain = Boolean(
      idx > 0 &&
      chainGap > 0 &&
      previousPair &&
      pair &&
      previousPair[1] !== pair[0]
    )

    const gap = (startsNewChain ? chainGap : 0) + customGap
    if (gap > 0) extraY += gap
    breakBefore[idx] = startsNewChain || customGap > 0
    gapBefore[idx] = gap
    centers[idx] = idx * rowH + rowH / 2 + extraY
    previousPair = pair
  })

  return {
    breakBefore,
    centers,
    gapBefore,
    totalGap: extraY,
  }
}

function channelIndexAtY(y, centers, rowH) {
  for (let idx = 0; idx < centers.length; idx++) {
    if (y >= centers[idx] - rowH / 2 && y <= centers[idx] + rowH / 2) return idx
  }
  return null
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
 *   eventHighlight - Temporary { timeS, durationS, color } region highlight
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
  eventHighlight = null,
  windowStart = 0,
  sampleOffset = 0,
  onAnnotate = null,
  onHoverChannel = null,
  theme = 'midnight',
  className = '',
  isVisible = true,
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
  channelScale = null,
  channelGapBefore = null,
  showCalibration = true,
  showChannelLabels = true,
  showChannelAmplitudes = false,
  showTimeLabels = true,
  polarity = 'negative-up',
  chainGap = 0,
  verticalPadding = 0,
}) {
  const language = useLocale()
  const accessibilityDescriptionId = useId()
  const canvasRef = useRef(null)
  const hoverRef = useRef({ x: null, ch: null })
  const rafRef = useRef(null)
  const lastReportedHoverRef = useRef(null)
  const filterWorkspacesRef = useRef([])
  const samplingCacheRef = useRef({ width: null, plans: new Map() })
  const drawRef = useRef(null)

  const th = useMemo(
    () => ({ ...getViewerTheme(theme), ...(themeOverrides ?? {}) }),
    [theme, themeOverrides]
  )

  const filteredChannels = useMemo(() => {
    // A processed frame owns its filter settings as well as its timestamp.
    // Keep showing that coherent frame until the worker returns the next one;
    // never re-filter it on the UI thread using newly selected controls.
    if (channels.length && channels.every(channel => channel.processed)) {
      return channels.map(channel => ({ ...channel, data: channel.filteredData ?? visibleData(channel) }))
    }
    if (!hasActiveFilter(filterConfig)) {
      const alreadyVisible = channels.every(ch => !ch.visibleStartIndex)
      if (alreadyVisible) return channels
      return channels.map(ch => ({ ...ch, data: visibleData(ch) }))
    }
    return channels.map((ch, idx) => ({
      ...ch,
      data: filteredVisibleData(
        ch,
        filterConfig,
        filterWorkspacesRef.current[idx] ??= {}
      ),
    }))
  }, [channels, filterConfig])

  const channelStats = useMemo(() => {
    if (scaleMode === 'sensitivity' && !showChannelAmplitudes) {
      return { channelMax: EMPTY_ARRAY, globalMax: 1 }
    }

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
  }, [filteredChannels, scaleMode, showChannelAmplitudes])

  const highlightedSet = useMemo(
    () => new Set(highlightedChannels ?? EMPTY_ARRAY),
    [highlightedChannels]
  )

  const channelLayout = useMemo(
    () => buildChannelLayout(filteredChannels, channelHeight, chainGap, verticalPadding, channelGapBefore),
    [chainGap, channelGapBefore, channelHeight, filteredChannels, verticalPadding]
  )

  const reportHoverChannel = useCallback((idx) => {
    if (!onHoverChannel) return
    const label = idx == null ? null : filteredChannels[idx]?.label ?? null
    if (lastReportedHoverRef.current === label) return
    lastReportedHoverRef.current = label
    onHoverChannel(label)
  }, [filteredChannels, onHoverChannel])

  const draw = useCallback(() => {
    const drawStart = eegProfilingEnabled ? performance.now() : 0
    const canvas = canvasRef.current
    if (!canvas || !isVisible) return

    const W = canvas.getBoundingClientRect().width || canvas.clientWidth
    const chs = filteredChannels
    const nCh = chs.length
    const rowH = channelHeight
    const { breakBefore, centers: rowCenters, gapBefore, totalGap } = channelLayout
    const labelW = showChannelLabels || showChannelAmplitudes ? leftLabelWidth : 0
    const H = Math.max(footerHeight, nCh * rowH + totalGap + verticalPadding + footerHeight)

    const resolution = getCanvasResolution(W, H, window.devicePixelRatio)
    const { bitmapWidth: bitmapW, bitmapHeight: bitmapH, sampleDensity } = resolution
    if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
      canvas.width = bitmapW
      canvas.height = bitmapH
    }
    if (canvas.style.height !== `${H}px`) canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(resolution.scaleX, 0, 0, resolution.scaleY, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, W, H)

    const plotW = W - labelW
    if (samplingCacheRef.current.width !== plotW || samplingCacheRef.current.density !== sampleDensity) {
      samplingCacheRef.current = { width: plotW, density: sampleDensity, plans: new Map() }
    }
    const samplingPlans = samplingCacheRef.current.plans
    const plotH = H - footerHeight
    if (plotW <= 0 || plotH <= 0 || nCh === 0) return

    const duration = timeAxis[timeAxis.length - 1] || 10
    const { channelMax, globalMax } = channelStats
    const fitHalfH = Math.max(1, rowH / 2 - 4)
    const displayPolarity = polarity === 'positive-up' ? 1 : NEGATIVE_UP
    const pxPerUvFor = (idx) => {
      const label = chs[idx]?.label
      const customScale = channelScale?.(label, idx) ?? 1
      const baseScale = scaleMode === 'global-fit'
        ? fitHalfH / globalMax
        : scaleMode === 'per-channel-fit'
          ? fitHalfH / channelMax[idx]
          : PX_PER_MM / sensitivity
      return baseScale * customScale
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

    if (eventHighlight) {
      const durationS = Math.max(0.06, eventHighlight.durationS ?? 0.20)
      const startS = eventHighlight.timeS - Math.min(0.04, durationS * 0.2)
      const endS = startS + durationS
      const visibleStart = Math.max(windowStart, startS)
      const visibleEnd = Math.min(windowStart + duration, endS)

      if (visibleEnd >= visibleStart) {
        const color = eventHighlight.color ?? rowHighlightColor
        const x1 = labelW + (visibleStart - windowStart) * pxPerSec
        const x2 = labelW + (visibleEnd - windowStart) * pxPerSec
        const eventX = labelW + (eventHighlight.timeS - windowStart) * pxPerSec

        ctx.fillStyle = color + '22'
        ctx.fillRect(x1, 0, Math.max(2, x2 - x1), plotH)
        ctx.strokeStyle = color + 'DD'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.moveTo(eventX, 0)
        ctx.lineTo(eventX, plotH)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (showTimeLabels) {
      ctx.fillStyle = th.axisText
      ctx.font = '10px "DM Mono", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      for (let s = Math.ceil(windowStart); s <= Math.floor(windowStart + duration); s++) {
        const x = labelW + (s - windowStart) * pxPerSec
        if (x < labelW || x > W - 12) continue
        ctx.fillText(localize(`${s}s`, language), x + 3, H - 8)
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
      ctx.fillText(localize(label, language), tagX + padX, tagY + tagH / 2)
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
      ctx.fillText(localize(`${hoverTime.toFixed(2)}s`, language), hoverX + 7, 9)
    }

    chs.forEach(({ label, data }, idx) => {
      const cy = rowCenters[idx]
      const isHovered = hoverCh === idx
      const isHighlighted = highlightedSet.has(label)

      if (breakBefore[idx]) {
        const gap = gapBefore[idx] ?? chainGap
        const gapTop = cy - rowH / 2 - gap
        const gapMid = gapTop + gap / 2
        ctx.fillStyle = th.pageBg
        ctx.fillRect(0, gapTop, labelW, gap)
        ctx.strokeStyle = th.divider
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, gapMid)
        ctx.lineTo(labelW, gapMid)
        ctx.stroke()
      }

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
      const traceColor = customColor ?? (isHighlighted ? rowHighlightColor : signalColor ?? getChannelThemeColor(label, th))
      ctx.strokeStyle = traceColor
      ctx.lineWidth = isHovered
        ? curveWidth + 0.45
        : isHighlighted
          ? curveWidth + 0.15
          : curveWidth
      if (th.glow && (isHovered || isHighlighted)) {
        ctx.shadowColor = traceColor
        // Canvas shadows use backing pixels rather than the path transform.
        const glowBlur = isHovered ? th.glowBlur * 1.4 : th.glowBlur
        ctx.shadowBlur = glowBlur * resolution.scaleX
      }
      const offsetX = sampleOffset * plotW / Math.max(1, data.length - 1)
      drawSignalPathFast(
        ctx,
        data,
        labelW,
        plotW,
        cy,
        pxPerUvFor(idx) * displayPolarity,
        offsetX,
        samplingPlans,
        sampleDensity
      )
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
        ctx.fillText(localize(`${calUv} µV`, language), calX + 7, calY - calH / 2)
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
        const cy = rowCenters[idx]
        const isHovered = hoverCh === idx
        const isHighlighted = highlightedSet.has(label)
        const customColor = channelColor?.(label, idx)
        const labelColor = customColor ?? (isHighlighted ? rowHighlightColor : getChannelThemeColor(label, th))
        ctx.fillStyle = labelColor
        ctx.font = `${isHovered || isHighlighted ? 'bold ' : ''}10px "DM Mono", monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const labelY = showChannelAmplitudes ? cy - 5 : cy
        if (showChannelLabels) ctx.fillText(localize(label, language), labelW - 6, labelY)
        if (showChannelAmplitudes) {
          ctx.fillStyle = th.axisText
          ctx.font = '8px "DM Mono", monospace'
          ctx.fillText(localize(`${Math.round(channelMax[idx])}µV`, language), labelW - 6, cy + 9)
        }
      })
    }
    if (eegProfilingEnabled) recordEEGMetric('paintMs', performance.now() - drawStart)
  }, [
    annotations,
    chainGap,
    channelColor,
    channelScale,
    channelHeight,
    channelLayout,
    channelStats,
    curveWidth,
    eventHighlight,
    filteredChannels,
    footerHeight,
    highlightedSet,
    highlightColor,
    isVisible,
    leftLabelWidth,
    language,
    polarity,
    scaleMode,
    sampleOffset,
    sensitivity,
    showCalibration,
    showChannelAmplitudes,
    showChannelLabels,
    showTimeLabels,
    signalColor,
    th,
    timeAxis,
    verticalPadding,
    windowStart,
  ])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestDrawFrame(() => {
      rafRef.current = null
      drawRef.current?.()
    })
  }, [])

  useLayoutEffect(() => {
    drawRef.current = draw
    // A live frame supersedes a pending hover/resize redraw. Cancel it so it
    // cannot redraw stale props or paint the same frame a second time.
    if (rafRef.current != null) {
      cancelDrawFrame(rafRef.current)
      rafRef.current = null
    }
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

  // A paused viewer must also redraw after a monitor/zoom DPR change even
  // when its CSS size did not change (and ResizeObserver therefore stays idle).
  useEffect(() => {
    let media
    function watchDensity() {
      media?.removeEventListener?.('change', densityChanged)
      media = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      media?.addEventListener?.('change', densityChanged)
    }
    function densityChanged() {
      watchDensity()
      scheduleDraw()
    }
    watchDensity()
    window.addEventListener('resize', scheduleDraw)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', scheduleDraw)
    return () => {
      media?.removeEventListener?.('change', densityChanged)
      window.removeEventListener('resize', scheduleDraw)
      viewport?.removeEventListener('resize', scheduleDraw)
    }
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
      : { x, ch: channelIndexAtY(y, channelLayout.centers, channelHeight) }

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
    const plotW = (rect.width || canvas.clientWidth) - labelW
    if (plotW <= 0) return
    const relTime = ((x - labelW) / plotW) * duration
    const chIdx = channelIndexAtY(e.clientY - rect.top, channelLayout.centers, channelHeight)
    onAnnotate(windowStart + relTime, filteredChannels[chIdx]?.label ?? '')
  }

  function handleKeyDown(e) {
    if (!onAnnotate || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    const duration = timeAxis[timeAxis.length - 1] || 10
    const middleChannel = filteredChannels[Math.floor(filteredChannels.length / 2)]
    onAnnotate(windowStart + duration / 2, middleChannel?.label ?? '')
  }

  const accessibilityLabel = onAnnotate
    ? `EEG trace with ${filteredChannels.length} channels. Press Enter or Space to annotate the centre of the visible trace.`
    : `EEG trace with ${filteredChannels.length} channels.`

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <p id={accessibilityDescriptionId} className="sr-only">{localize("Synthetic educational EEG display. Channels are color-coded by left, right, midline, and cross-head derivation. Channel labels: ")}{localize(filteredChannels.map(channel => channel.label).join(', ') || 'none')}.
      </p>
      <canvas dir="ltr"
        ref={canvasRef}
        role={onAnnotate ? 'button' : 'img'}
        aria-label={localize(accessibilityLabel)}
        aria-describedby={accessibilityDescriptionId}
        tabIndex={onAnnotate ? 0 : undefined}
        aria-keyshortcuts={onAnnotate ? 'Enter Space' : undefined}
        className="w-full block"
        style={{ imageRendering: 'auto', cursor: onAnnotate ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {localize(accessibilityLabel)}
      </canvas>
    </div>
  )
}
