import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '../src/i18n/i18n'
import ReadingAlgorithmPage from '../src/pages/ReadingAlgorithmPage'
import ReportBuilderPage from '../src/pages/ReportBuilderPage'
import { READING_SECTIONS } from '../src/content/readingAlgorithm'

afterEach(cleanup)

describe('simplified reading and reporting workflows', () => {
  it('shows the complete reading guide and navigates to its subsections', () => {
    render(
      <MemoryRouter>
        <ReadingAlgorithmPage />
      </MemoryRouter>,
    )
    const navigation = screen.getByRole('navigation', { name: 'Reading algorithm subsections' })
    for (const { id, title } of READING_SECTIONS) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(within(navigation).getByRole('link', { name: title })).toHaveAttribute(
        'href',
        `#${id}`,
      )
    }
    const reportLink = within(navigation).getByRole('link', { name: 'Synthesis & report' })
    const reportHeading = screen.getByRole('heading', { name: 'Synthesis & report' })
    reportHeading.scrollIntoView = vi.fn()
    fireEvent.click(reportLink)
    expect(reportHeading.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'instant',
    })
    expect(screen.getByRole('heading', { name: 'Synthesis & report' })).toHaveFocus()
    expect(reportLink).toHaveAttribute('aria-current', 'location')
    expect(screen.getByRole('heading', { name: 'Clinical context' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Build a report' })).toHaveAttribute(
      'href',
      '/report-builder',
    )
  })

  it('tracks the current subsection when the guide is scrolled', () => {
    render(
      <MemoryRouter>
        <ReadingAlgorithmPage />
      </MemoryRouter>,
    )
    const guide = screen.getByRole('region', { name: 'EEG reading guide' })
    Object.defineProperties(guide, {
      scrollHeight: { configurable: true, value: 10000 },
      clientHeight: { configurable: true, value: 800 },
    })
    guide.getBoundingClientRect = () => ({ top: 0 })
    const headings = guide.querySelectorAll('[data-reading-section]')
    headings.forEach((heading, index) => {
      heading.getBoundingClientRect = () => ({ top: (index - 4) * 500 })
    })
    fireEvent.scroll(guide)
    const navigation = screen.getByRole('navigation', { name: 'Reading algorithm subsections' })
    expect(within(navigation).getByRole('link', { name: 'Awake background' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    fireEvent.scroll(guide, { target: { scrollTop: 9200 } })
    expect(within(navigation).getByRole('link', { name: 'References' })).toHaveAttribute(
      'aria-current',
      'location',
    )
  })

  it('shows one continuous report form with sidebar navigation and preset inputs', () => {
    render(<ReportBuilderPage />)
    const nav = screen.getByRole('navigation', { name: 'Report builder subsections' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(7)
    for (const link of links) {
      expect(document.querySelector(link.getAttribute('href'))).toBeInTheDocument()
    }
    const review = screen.getByRole('heading', { name: 'Review and export' })
    review.scrollIntoView = vi.fn()
    fireEvent.click(within(nav).getByRole('link', { name: 'Review and export' }))
    expect(review).toHaveFocus()
    expect(review.scrollIntoView).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Study and technique' })).toBeVisible()
    expect(document.querySelectorAll('input')).toHaveLength(0)
    for (const textbox of screen.queryAllByRole('textbox')) expect(textbox).not.toBeVisible()
    fireEvent.change(screen.getByLabelText('Recording duration'), {
      target: { value: '45 minutes' },
    })
    fireEvent.change(screen.getByLabelText('PDR frequency (Hz)'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Focal or generalized slowing' }))
    fireEvent.change(screen.getByLabelText('Location / maximum'), {
      target: { value: 'right temporal region' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Levetiracetam' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lamotrigine' }))
    fireEvent.change(screen.getByLabelText('Indication / referral question'), {
      target: { value: 'Evaluation of suspected seizures' },
    })
    const report = document.querySelector('pre').textContent
    expect(report).toContain('45 minutes')
    expect(report).toContain('9 Hz')
    expect(report).toContain('right temporal region')
    expect(report).toContain('Relevant medications: Levetiracetam; lamotrigine.')
    expect(report).toContain('Indication: Evaluation of suspected seizures.')
    expect(screen.getByRole('button', { name: 'Copy report' })).toBeEnabled()
  })

  it('keeps guidance optional, supports custom values, and links validation to its section', () => {
    render(<ReportBuilderPage />)
    expect(screen.queryByText(/Choose the protocol actually performed/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show guidance' }))
    expect(screen.getByText(/Choose the protocol actually performed/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide guidance' }))
    fireEvent.change(screen.getByLabelText('Recording duration'), { target: { value: '__custom' } })
    const customDuration = screen.getByLabelText('Recording duration (custom)')
    expect(screen.getByRole('button', { name: 'Copy report' })).toBeDisabled()
    const study = screen.getByRole('heading', { name: 'Study and technique' })
    study.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: 'Enter the recording duration.' }))
    expect(study).toHaveFocus()
    fireEvent.change(customDuration, { target: { value: '37 minutes' } })
    expect(document.querySelector('pre')).toHaveTextContent('37 minutes')
    expect(screen.getByRole('button', { name: 'Copy report' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Recording duration'), {
      target: { value: '20 minutes' },
    })
    expect(screen.queryByLabelText('Recording duration (custom)')).not.toBeInTheDocument()
    expect(document.querySelector('pre')).toHaveTextContent('20 minutes')
  })

  it('builds seizure and event descriptions from presets without requiring typing', () => {
    render(<ReportBuilderPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Seizure recorded' }))
    fireEvent.change(screen.getByLabelText('Electrographic onset'), {
      target: { value: 'right temporal region' },
    })
    fireEvent.change(screen.getByLabelText('Seizure duration'), { target: { value: '90 seconds' } })
    fireEvent.change(screen.getByLabelText('Clinical correlate'), {
      target: { value: 'impaired responsiveness' },
    })
    expect(document.querySelector('pre')).toHaveTextContent(
      'arising from the right temporal region',
    )
    expect(document.querySelector('pre')).toHaveTextContent(
      'lasting approximately 90 seconds, with a clinical correlate of impaired responsiveness',
    )
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'electrographic' } })
    expect(document.querySelector('pre')).toHaveTextContent('without a definite clinical correlate')
    expect(document.querySelector('pre')).not.toHaveTextContent(
      'with a clinical correlate of impaired responsiveness',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Event without ictal correlate' }))
    fireEvent.change(screen.getByLabelText('Event description'), { target: { value: 'staring' } })
    expect(document.querySelector('pre')).toHaveTextContent(
      'One event described as staring was captured',
    )
    expect(screen.getByRole('button', { name: 'Copy report' })).toBeEnabled()
  })

  it('keeps sleep selections consistent and resets custom inputs with the draft', () => {
    render(<ReportBuilderPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Sleep obtained' }))
    expect(screen.getByRole('button', { name: 'Sleep', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(document.querySelector('pre')).toHaveTextContent('Sleep was not obtained.')
    fireEvent.click(screen.getByRole('button', { name: 'Sleep', exact: true }))
    expect(screen.getByRole('switch', { name: 'Sleep obtained' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Recording duration'), { target: { value: '__custom' } })
    fireEvent.change(screen.getByLabelText('Recording duration (custom)'), {
      target: { value: '37 minutes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start new draft' }))
    expect(screen.getByLabelText('Recording duration')).toHaveValue('30 minutes')
    expect(screen.queryByLabelText('Recording duration (custom)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy report' })).toBeEnabled()
  })
})
