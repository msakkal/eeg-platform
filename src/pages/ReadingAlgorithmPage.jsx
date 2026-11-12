import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { READING_SECTIONS } from '@/content/readingAlgorithm'

const NAVIGATION = [
  ['overview', 'Reading approach'],
  ...READING_SECTIONS.map(({ id, title }) => [id, title]),
  ['references', 'References'],
]

export default function ReadingAlgorithmPage() {
  useLocale()
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('overview')
  const contentRef = useRef(null)

  const trackSection = () => {
    const container = contentRef.current
    if (!container) return
    const top = container.getBoundingClientRect().top + 96
    let current = 'overview'
    for (const heading of container.querySelectorAll('[data-reading-section]')) {
      if (heading.getBoundingClientRect().top <= top) current = heading.id
    }
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 8) {
      current = 'references'
    }
    setActiveSection(current)
  }

  const jumpToSection = (event, id) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    const heading = document.getElementById(id)
    if (!heading) return
    setActiveSection(id)
    heading.focus({ preventScroll: true })
    heading.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }

  return (
    <div className="flex h-screen flex-col lg:flex-row overflow-hidden">
      <CollapsiblePanel title="Reading guide" responsive widthClass="lg:w-60">

        <nav
          aria-label={localize("Reading algorithm subsections")}
          className="flex lg:flex-col gap-1 overflow-x-auto px-3 pb-4 lg:overflow-x-visible"
        >
          {NAVIGATION.map(([id, label], index) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => jumpToSection(event, id)}
              aria-current={activeSection === id ? 'location' : undefined}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors shrink-0 lg:shrink ${activeSection === id ? 'border-eeg-accent/20 bg-eeg-accent/10 text-eeg-accent' : 'border-transparent text-eeg-muted hover:text-eeg-text hover:bg-eeg-border/30'}`}
            >
              {index > 0 && index <= READING_SECTIONS.length && (
                <span aria-hidden="true" className="font-mono text-[10px] pt-0.5 opacity-75">
                  {localize(String(index).padStart(2, '0'))}
                </span>
              )}
              <span className="whitespace-nowrap lg:whitespace-normal">{localize(label)}</span>
            </a>
          ))}
        </nav>
      </CollapsiblePanel>

      <div
        ref={contentRef}
        onScroll={trackSection}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10"
        role="region"
        aria-label={localize("EEG reading guide")}
        tabIndex={0}
      >
        <article className="max-w-4xl mx-auto">
          <header className="pb-8">
            <h1
              id="overview"
              data-reading-section
              tabIndex={-1}
              className="section-title scroll-mt-8 focus:outline-none"
            >
              {t('reading_algorithm.title')}
            </h1>
            <p className="text-eeg-muted text-base leading-relaxed mt-4 max-w-3xl">{localize("A systematic review from clinical context to the final impression. Read in order or use the sidebar to revisit a specific part of the interpretation.")}</p>
            <p className="text-xs text-eeg-muted mt-3">{localize("Educational framework for supervised learning. Interpret findings in the context of age, state, medication, and recording quality.")}</p>
            <div className="mt-6 border-l-2 border-eeg-accent pl-4">
              <h2 className="text-sm font-semibold text-eeg-text">{localize("Describe first, classify second, interpret last.")}</h2>
              <p className="text-sm text-eeg-muted leading-relaxed mt-1">{localize("Survey the whole recording, establish the background, verify important findings, and then answer the clinical question. Keep observed features separate from their possible meaning.")}</p>
            </div>
          </header>

          {READING_SECTIONS.map((section, index) => (
            <section
              key={section.id}
              aria-labelledby={section.id}
              className="border-t border-eeg-border py-8 md:py-10"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-eeg-accent" aria-hidden="true">
                  {localize(String(index + 1).padStart(2, '0'))}
                </span>
                <h2
                  id={section.id}
                  data-reading-section
                  tabIndex={-1}
                  className="font-display text-2xl font-semibold text-eeg-text scroll-mt-8 focus:outline-none"
                >
                  {localize(section.title)}
                </h2>
              </div>
              <p className="text-sm font-medium text-eeg-accent mt-3">{localize(section.question)}</p>
              <p className="text-sm text-eeg-muted leading-relaxed mt-3">{localize(section.introduction)}</p>
              <dl className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
                {section.items.map(([title, description]) => (
                  <div key={title}>
                    <dt className="text-sm font-semibold text-eeg-text">{localize(title)}</dt>
                    <dd className="text-sm text-eeg-muted leading-relaxed mt-1.5">{localize(description)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 rounded-lg bg-eeg-surface/60 px-4 py-3 text-sm text-eeg-muted leading-relaxed">
                <strong className="text-eeg-text">{localize("Before moving on: ")}</strong>
                {localize(section.checkpoint)}
              </div>
              {section.example && (
                <p className="text-sm text-eeg-muted leading-relaxed mt-4">
                  <span className="text-eeg-text font-medium">{localize("Example wording: ")}</span>
                  {localize(section.example)}
                </p>
              )}
              {section.source && (
                <a
                  href={section.source[0]}
                  className="inline-block text-xs text-eeg-accent hover:underline mt-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  {localize(section.source[1])}
                </a>
              )}
              {section.link && (
                <div className="mt-4">
                  <Link
                    to={section.link[0]}
                    className={
                      section.id === 'report'
                        ? 'btn-primary inline-flex'
                        : 'text-sm text-eeg-accent hover:underline'
                    }
                  >
                    {localize(section.link[1])}
                  </Link>
                </div>
              )}
            </section>
          ))}

          <section aria-labelledby="references" className="border-t border-eeg-border pt-8 pb-12">
            <h2
              id="references"
              data-reading-section
              tabIndex={-1}
              className="text-xl font-display font-semibold text-eeg-text scroll-mt-8 focus:outline-none"
            >{localize("References")}</h2>
            <p className="mt-3 text-sm text-eeg-muted leading-relaxed">{localize("This guide is an educational synthesis. Use the original standards for formal definitions and recording requirements; the ACNS critical-care framework is distinct from routine EEG recording guidance.")}</p>
            <ul className="mt-4 space-y-3 text-sm text-eeg-accent">
              <li>
                <a
                  className="hover:underline"
                  href="https://www.acns.org/practice/guidelines"
                  target="_blank"
                  rel="noreferrer"
                >{localize("ACNS guidelines and consensus statements")}</a>
              </li>
              <li>
                <a
                  className="hover:underline"
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8135051/"
                  target="_blank"
                  rel="noreferrer"
                >{localize("ACNS standardized critical-care EEG terminology (2021)")}</a>
              </li>
              <li>
                <a
                  className="hover:underline"
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10006292/"
                  target="_blank"
                  rel="noreferrer"
                >{localize("IFCN and ILAE minimum recording standards for routine and sleep EEG (2023)")}</a>
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  )
}
