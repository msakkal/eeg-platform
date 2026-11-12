import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '../src/i18n/i18n'
import CollapsiblePanel from '../src/components/ui/CollapsiblePanel'
import Layout from '../src/components/layout/Layout'
import {
  VIEWER_THEME_LIST,
  getViewerTheme,
  getElectrodeSide,
  getChannelSide,
  getChannelThemeColor,
} from '../src/engine/viewerThemes'
import { buildViewerThemeOverrides } from '../src/components/eeg/EEGViewerControls'
import EEGViewer from '../src/components/eeg/EEGViewer'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('collapsible panels', () => {
  it('keeps form values when collapsed and exposes an accessible reopen control', () => {
    render(
      <CollapsiblePanel title="Report sections">
        <label>
          Draft note
          <input defaultValue="" />
        </label>
      </CollapsiblePanel>,
    )
    const input = screen.getByLabelText('Draft note')
    fireEvent.change(input, { target: { value: 'Retain this observation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse report sections' }))
    expect(input).not.toBeVisible()
    const reopen = screen.getByRole('button', { name: 'Expand report sections' })
    expect(reopen).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(reopen.getAttribute('aria-controls'))).toContainElement(input)
    fireEvent.click(reopen)
    expect(input).toBeVisible()
    expect(input).toHaveValue('Retain this observation')
  })

  it('collapses main navigation into accessible icon links while keeping page content visible', () => {
    render(
      <MemoryRouter>
        <Layout>
          <h1>Current page</h1>
        </Layout>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse main navigation' }))
    expect(screen.getByRole('heading', { name: 'Current page' })).toBeVisible()
    const shortcuts = screen.getByRole('navigation', { name: 'Navigation shortcuts' })
    expect(within(shortcuts).getByRole('link', { name: 'EEG Atlas' })).toHaveAttribute(
      'href',
      '/atlas',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Expand main navigation' }))
    expect(
      screen.queryByRole('navigation', { name: 'Navigation shortcuts' }),
    ).not.toBeInTheDocument()
  })
})

describe('hemisphere channel colors', () => {
  it('draws left/right traces and their labels with matching theme colors', () => {
    const strokes = []
    const labels = []
    const ctx = {
      setTransform() {},
      clearRect() {},
      fillRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      fill() {},
      setLineDash() {},
      measureText() {
        return { width: 20 }
      },
      stroke() {
        strokes.push(this.strokeStyle)
      },
      fillText(text) {
        labels.push([text, this.fillStyle])
      },
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640)
    const theme = getViewerTheme('clinical')
    const channels = ['F3–C3', 'F4–C4', 'Fz–Cz'].map((label) => ({
      label,
      data: Float32Array.from([0, 20, -10, 0]),
    }))
    render(<EEGViewer theme="clinical" channels={channels} timeAxis={[0, 0.1, 0.2, 0.3]} />)
    for (const [label, color] of [
      ['F3–C3', theme.signalLeft],
      ['F4–C4', theme.signalRight],
      ['Fz–Cz', theme.signalMidline],
    ]) {
      expect(strokes).toContain(color)
      expect(labels).toContainEqual([label, color])
    }
  })

  it.each([
    ['Fp1', 'left'],
    ['F3–C3', 'left'],
    ['C4-avg', 'right'],
    ['O2–A1', 'right'],
    ['T3–T5', 'left'],
    ['Fz–Cz', 'midline'],
    ['F3-Fz', 'left'],
    ['Fz-F4', 'right'],
    ['C3–C4', 'mixed'],
    ['ECG', 'neutral'],
    ['unknown', 'neutral'],
  ])('classifies %s as %s', (label, side) => expect(getChannelSide(label)).toBe(side))

  it('identifies individual left and right electrode labels', () => {
    expect(getElectrodeSide('Fp1')).toBe('left')
    expect(getElectrodeSide('Fp2')).toBe('right')
    expect(getElectrodeSide('Cz')).toBe('midline')
    expect(getElectrodeSide('ECG1')).toBe('neutral')
  })

  it.each(VIEWER_THEME_LIST)('uses distinct consistent hemisphere colors in $label', (theme) => {
    expect(getChannelThemeColor('F3–C3', theme)).toBe(theme.signalLeft)
    expect(getChannelThemeColor('F4–C4', theme)).toBe(theme.signalRight)
    expect(getChannelThemeColor('Fz–Cz', theme)).toBe(theme.signalMidline)
    expect(getChannelThemeColor('C3–C4', theme)).toBe(theme.signalMixed)
    expect(theme.signalLeft).not.toBe(theme.signalRight)
    expect(theme.signalLeft).not.toBe(theme.plotBg)
    expect(theme.signalRight).not.toBe(theme.plotBg)
  })

  it('gives each preset its own palette with readable trace and label contrast', () => {
    const luminance = (hex) => {
      const channels = hex
        .slice(1)
        .match(/../g)
        .map((value) => Number.parseInt(value, 16) / 255)
      const linear = channels.map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      )
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    expect(new Set(VIEWER_THEME_LIST.map((theme) => theme.signalLeft)).size).toBe(
      VIEWER_THEME_LIST.length,
    )
    expect(new Set(VIEWER_THEME_LIST.map((theme) => theme.signalRight)).size).toBe(
      VIEWER_THEME_LIST.length,
    )
    for (const theme of VIEWER_THEME_LIST) {
      for (const ink of [
        theme.signalLeft,
        theme.signalRight,
        theme.signalMidline,
        theme.signalMixed,
      ]) {
        for (const background of [theme.plotBg, theme.labelBg]) {
          const levels = [luminance(ink), luminance(background)].sort((a, b) => b - a)
          expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('lets custom themes change either hemisphere without losing the other color', () => {
    const theme = {
      ...getViewerTheme('midnight'),
      ...buildViewerThemeOverrides({ leftColor: '#123456', rightColor: '#987654' }),
    }
    expect(getChannelThemeColor('F3–C3', theme)).toBe('#123456')
    expect(getChannelThemeColor('F4–C4', theme)).toBe('#987654')
  })
})
