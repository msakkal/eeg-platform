import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ATLAS_BY_ID,
  ATLAS_CATEGORIES,
  ATLAS_KINDS,
  atlasPath,
  canonicalFindingId,
  canonicalWaveformId,
  relatedEntries,
  searchAtlas,
} from '@/content/atlas'
import { useEEGStore } from '@/store/eegStore'
import DemoTraceViewer from '@/components/eeg/DemoTraceViewer'
import EEGViewer from '@/components/eeg/EEGViewer'
import { useEEGSignal } from '@/hooks/useEEGSignal'
import { MONTAGES } from '@/engine/montages'

export function LegacyAtlasRedirect({ source }) {
  useLocale()
  const [params] = useSearchParams()
  const id = params.get('id')
  const canonical = source === 'waveforms' ? canonicalWaveformId(id) : canonicalFindingId(id)
  const next = new URLSearchParams(params)
  next.delete('id')
  // Unknown bookmarks lead to a search instead of silently showing another topic.
  if (id && !canonical) next.set('q', id.replaceAll('_', ' '))
  const query = next.size ? `?${next}` : ''
  return <Navigate replace to={`${canonical ? atlasPath(canonical) : '/atlas'}${query}`} />
}

function readFilters(params) {
  return {
    query: params.get('q') ?? '',
    category: ATLAS_CATEGORIES.some(([id]) => id === params.get('category'))
      ? params.get('category')
      : 'all',
    kind: ATLAS_KINDS.some(([id]) => id === params.get('kind')) ? params.get('kind') : 'all',
  }
}

export default function AtlasPage() {
  useLocale()
  const { entryId } = useParams()
  const [params] = useSearchParams()
  const { query, category, kind } = readFilters(params)
  const filtered = searchAtlas(query, category, kind)
  const defaultEntry =
    !query && category === 'all' && kind === 'all' ? ATLAS_BY_ID.alpha : filtered[0]
  const entry = entryId ? ATLAS_BY_ID[entryId] : defaultEntry
  useEffect(() => {
    const panel = document.getElementById('atlas-detail')
    if (panel) panel.scrollTop = 0
  }, [entry?.id])
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <AtlasTopicList activeId={entry?.id} />
      <div id="atlas-detail" className="flex-1 min-w-0 overflow-y-auto">
        {entry ? (
          <AtlasEntry key={entry.id} entry={entry} />
        ) : (
          <div className="p-8">
            <h1 className="section-title mb-4">
              {localize(entryId ? 'Atlas entry not found' : 'Select a topic')}
            </h1>
            <p className="text-sm text-eeg-muted">
              {localize(entryId
                ? 'Choose an entry from the topic list.'
                : 'Adjust the search or filters to find a topic.')}
            </p>
            {entryId && (
              <Link className="btn-ghost inline-block mt-4" to="/atlas">{localize("Browse the EEG Atlas")}</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AtlasTopicList({ activeId }) {
  useLocale()
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { query, category, kind } = readFilters(params)
  const entries = searchAtlas(query, category, kind)
  const update = (key, value) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value && value !== 'all') next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const querySuffix = params.size ? `?${params}` : ''
  return (
    <CollapsiblePanel title="Atlas topics" widthClass="w-64">
      <nav aria-label={localize("Atlas topics")} className="flex min-h-0 flex-1 flex-col">
        <div className="p-4 border-b border-eeg-border shrink-0">
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
            {t('nav.atlas')}
          </p>
          <label htmlFor="atlas-search" className="sr-only">{localize("Search the atlas")}</label>
          <input
            id="atlas-search"
            type="search"
            value={query}
            onChange={(event) => update('q', event.target.value)}
            placeholder={localize("Search topics...")}
            className="w-full rounded-lg px-3 py-2 text-xs bg-eeg-card border border-eeg-border text-eeg-text focus:outline-none focus:border-eeg-accent"
          />
          <details className="mt-3">
            <summary className="text-xs text-eeg-muted cursor-pointer">{localize("Filter topics")}</summary>
            <label className="block text-xs mt-3">{localize("Subject")}<select
                value={category}
                onChange={(event) => update('category', event.target.value)}
                className="block w-full mt-1 bg-eeg-card rounded-lg border border-eeg-border p-2"
              >
                <option value="all">{localize("All subjects")}</option>
                {ATLAS_CATEGORIES.map(([id, title]) => (
                  <option key={id} value={id}>
                    {localize(title)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs mt-3">{localize("Entry type")}<select
                value={kind}
                onChange={(event) => update('kind', event.target.value)}
                className="block w-full mt-1 bg-eeg-card rounded-lg border border-eeg-border p-2"
              >
                <option value="all">{localize("All entry types")}</option>
                {ATLAS_KINDS.map(([id, title]) => (
                  <option key={id} value={id}>
                    {localize(title)}
                  </option>
                ))}
              </select>
            </label>
          </details>
          <p role="status" aria-label={localize("Matching topics")} className="text-xs text-eeg-muted mt-3">
            {localize(entries.length)} {localize(entries.length === 1 ? 'topic' : 'topics')}
          </p>
        </div>
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          {localize(ATLAS_CATEGORIES.map(([id, title]) => {
            const subjectEntries = entries.filter((entry) => entry.category === id)
            if (!subjectEntries.length) return null
            return (
              <section key={id} aria-label={localize(title)} className="mb-6">
                <h2 className="text-xs font-semibold text-eeg-accent mb-3">{localize(title)}</h2>
                {localize(ATLAS_KINDS.map(([kindId]) => {
                  const items = subjectEntries.filter((entry) => entry.kind === kindId)
                  if (!items.length) return null
                  const groupTitle = {
                    waveform: 'Individual waveforms',
                    pattern: 'Recording patterns',
                    comparison: 'Pattern comparisons',
                  }[kindId]
                  return (
                    <section key={kindId} aria-label={localize(groupTitle)} className="mb-4">
                      <h3 className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted mb-2 px-1">
                        {localize(groupTitle)}
                      </h3>
                      <ul className="space-y-0.5">
                        {items.map((entry) => (
                          <li key={entry.id}>
                            <Link
                              to={`${atlasPath(entry.id)}${querySuffix}`}
                              aria-current={entry.id === activeId ? 'page' : undefined}
                              className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors border ${entry.id === activeId ? 'bg-eeg-card border-eeg-border text-eeg-text' : 'border-transparent text-eeg-muted hover:text-eeg-text hover:bg-eeg-border/40'}`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                                style={{ background: entry.color }}
                                aria-hidden="true"
                              />
                              <span className="font-body leading-tight">{localize(entry.title)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                }))}
              </section>
            )
          }))}
          {!entries.length && (
            <p className="text-xs text-eeg-muted py-3">{localize("No matching entries. Try another term or clear the filters.")}</p>
          )}
          {(query || category !== 'all' || kind !== 'all') && (
            <button
              className="text-xs text-eeg-accent hover:underline mt-3"
              onClick={() => setParams({})}
            >{localize("Clear search and filters")}</button>
          )}
        </div>
      </nav>
    </CollapsiblePanel>
  )
}

function kindLabel(kind) {
  return ATLAS_KINDS.find(([id]) => id === kind)?.[1]
}

function AtlasEntry({ entry }) {
  useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const loadAtlasExample = useEEGStore((state) => state.loadAtlasExample)
  const { waveform, finding, simulation } = entry
  const [view, setView] = useState(
    entry.kind === 'pattern' && simulation ? 'recording' : waveform ? 'waveform' : 'recording',
  )
  const related = relatedEntries(entry)
  const openSimulation = () => {
    loadAtlasExample(simulation)
    navigate(`/sandbox?atlas=${encodeURIComponent(entry.id)}`)
  }
  const category = ATLAS_CATEGORIES.find(([id]) => id === entry.category)?.[1]
  return (
    <article className="max-w-5xl mx-auto p-5 md:p-10">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="label-tag">{localize(category)}</span>
        <span className="text-xs font-mono text-eeg-muted">{localize(kindLabel(entry.kind))}</span>
      </div>
      <h1 className="section-title mb-5">{localize(entry.title)}</h1>

      <section aria-labelledby="atlas-see" className="mb-8">
        <h2 id="atlas-see" className="font-display text-xl font-semibold mb-3">{localize("EEG Examples")}</h2>
        {waveform && simulation && (
          <div role="group" aria-label={localize("Trace view")} className="flex flex-wrap gap-2 mb-4">
            <button
              className={view === 'waveform' ? 'btn-primary' : 'btn-ghost'}
              aria-pressed={view === 'waveform'}
              onClick={() => setView('waveform')}
            >{localize("Waveform shape")}</button>
            <button
              className={view === 'recording' ? 'btn-primary' : 'btn-ghost'}
              aria-pressed={view === 'recording'}
              onClick={() => setView('recording')}
            >{localize("Scalp recording")}</button>
          </div>
        )}
        {view === 'waveform' && waveform ? (
          <div className="card p-4 overflow-hidden">
            <p className="text-xs text-eeg-muted mb-3">{localize("Illustrative single-channel morphology · 3 seconds · Synthesised example")}</p>
            <DemoTraceViewer
              patternId={waveform.id}
              label={waveform.label}
              color={entry.color}
              height={120}
              traceScale={waveform.id === 'beta' ? 0.42 : 1}
            />
          </div>
        ) : simulation ? (
          <RecordingPreview simulation={simulation} />
        ) : (
          <div className="card p-5">
            <p className="text-sm text-eeg-muted">{localize("A complete recording example is not available for this entry. Explore the linked waveform examples below; each illustrates a component or comparison, rather than the whole pattern.")}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="atlas-describe" className="mb-8">
        <h2 id="atlas-describe" className="font-display text-xl font-semibold mb-3">{localize("EEG Characteristics")}</h2>
        {waveform ? (
          <dl className="card divide-y divide-eeg-border">
            {[
              ['Frequency', waveform.freq],
              ['Duration', waveform.duration],
              ['Amplitude', waveform.amplitude],
              ['Morphology', waveform.morphology],
              ['Distribution', waveform.location],
              ['Reactivity / state', waveform.reactivity],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="px-5 py-3 sm:flex gap-5">
                  <dt className="text-xs font-mono text-eeg-muted sm:w-36 shrink-0 mb-1 sm:mb-0">
                    {localize(label)}
                  </dt>
                  <dd className="text-sm leading-relaxed">{localize(value)}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-sm text-eeg-muted leading-relaxed mb-4">{localize(entry.overview)}</p>
        )}
        <BulletList
          items={entry.features}
          label={waveform ? 'Additional observations' : 'Recording features'}
        />
        {entry.componentIds.length > 0 && (
          <div className="mt-5">
            <p className="text-sm text-eeg-muted mb-3">
              {localize(entry.kind === 'comparison'
                ? 'Compare the waveform entries:'
                : 'Inspect components and comparison examples:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {entry.componentIds.map((id) => (
                <Link key={id} className="btn-ghost" to={`${atlasPath(id)}${location.search}`}>
                  {localize(ATLAS_BY_ID[id].title)} →
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="atlas-context" className="mb-8">
        <h2 id="atlas-context" className="font-display text-xl font-semibold mb-3">{localize("Clinical Context")}</h2>
        {finding ? (
          <>
            <BulletList items={finding.etiology} label="Clinical setting" />
            <BulletList items={entry.contextFeatures} label="Interpretive considerations" />
          </>
        ) : (
          <p className="text-sm leading-relaxed text-eeg-muted">{localize(waveform.clinical)}</p>
        )}
        {finding?.prognosis && (
          <details className="card p-5 mt-4">
            <summary className="cursor-pointer text-sm font-medium">{localize("Clinical implications")}</summary>
            <p className="text-sm text-eeg-muted leading-relaxed mt-3">{localize(finding.prognosis)}</p>
          </details>
        )}
        {finding?.source && (
          <a
            className="inline-block mt-4 text-xs text-eeg-accent hover:underline"
            href={finding.source[0]}
            target="_blank"
            rel="noreferrer"
          >
            {localize(finding.source[1])}
          </a>
        )}
      </section>

      <section aria-labelledby="atlas-compare" className="mb-8">
        <h2 id="atlas-compare" className="font-display text-xl font-semibold mb-3">{localize("Differential Diagnosis and Related Patterns")}</h2>
        <BulletList
          items={finding?.differential}
          label="Differential and distinguishing features"
        />
        <BulletList items={finding?.pitfalls} label="Pitfalls and mimics" />
        {related.length > 0 && (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {related
              .filter((other) => !entry.componentIds.includes(other.id))
              .map((other) => (
                <Link
                  key={other.id}
                  to={`${atlasPath(other.id)}${location.search}`}
                  className="card p-4 hover:border-eeg-accent"
                >
                  <span className="text-xs font-mono text-eeg-muted">{localize(kindLabel(other.kind))}</span>
                  <span className="block text-sm text-eeg-accent mt-2">{localize(other.title)} →</span>
                </Link>
              ))}
          </div>
        )}
        {!finding && related.length === 0 && (
          <p className="text-sm text-eeg-muted">{localize("Use the atlas to compare this example with other entries in the same subject.")}</p>
        )}
      </section>

      <section aria-labelledby="atlas-practise" className="card p-5">
        <h2 id="atlas-practise" className="font-display text-xl font-semibold mb-3">{localize("Practical Exercises")}</h2>
        <div className="flex flex-wrap gap-3">
          {simulation && (
            <button type="button" onClick={openSimulation} className="btn-primary">{localize("Open in simulator →")}</button>
          )}
          {entry.artifactId && (
            <Link to={`/artifacts?id=${entry.artifactId}`} className="btn-primary">{localize("Open artifact guide →")}</Link>
          )}
          {!simulation &&
            related
              .filter((other) => other.simulation)
              .map((other) => (
                <Link key={other.id} to={atlasPath(other.id)} className="btn-ghost">{localize("Explore ")}{localize(other.title)} →
                </Link>
              ))}
          <Link to="/quiz" className="btn-ghost">{localize("Test your recognition")}</Link>
          <Link to="/reading-algorithm" className="btn-ghost">{localize("Use the reading checklist")}</Link>
        </div>
      </section>
    </article>
  )
}

function BulletList({ items, label }) {
  useLocale()
  if (!items?.length) return null
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">{localize(label)}</h3>
      <ul className="list-disc ps-5 space-y-2 text-sm leading-relaxed text-eeg-muted">
        {items.map((item) => (
          <li key={item}>{localize(item)}</li>
        ))}
      </ul>
    </div>
  )
}

function RecordingPreview({ simulation }) {
  useLocale()
  const { channels, timeAxis, isReady, isUpdating } = useEEGSignal({
    montageId: simulation.montageId,
    pattern: simulation.pattern,
    eyesClosed: simulation.eyesClosed,
    blinksEnabled: false,
    noiseLevel: 0.15,
    isPlaying: false,
    windowSecs: 10,
    maxWindowSecs: 10,
  })
  return (
    <div className="card overflow-hidden">
      <p className="px-4 py-3 text-xs text-eeg-muted border-b border-eeg-border">{localize("Synthesised scalp recording · ")}{localize(MONTAGES[simulation.montageId].label)}{localize(" · 10 seconds · 7 µV/mm")}</p>
      <div
        className="max-h-[460px] overflow-auto"
        tabIndex={0}
        role="region"
        aria-label={localize(`${simulation.label} multichannel preview`)}
      >
        {isUpdating && isReady && <p role="status" className="px-4 py-2 text-xs text-eeg-muted">{localize("Updating recording? Previous frame remains visible.")}</p>}
        {isReady ? (
          <EEGViewer
            channels={channels}
            timeAxis={timeAxis}
            isPlaying={false}
            sensitivity={7}
            channelHeight={36}
            theme="midnight"
          />
        ) : (
          <p role="status" className="p-6 text-sm text-eeg-muted">{localize("Generating recording…")}</p>
        )}
      </div>
    </div>
  )
}
