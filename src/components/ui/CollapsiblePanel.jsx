import { translateDisplay as localize, formatText, useLocale } from '@/i18n/localize'
import { useId, useState } from 'react'

export default function CollapsiblePanel({
  title,
  children,
  widthClass = 'w-60',
  responsive = false,
  side = 'left',
  className = '',
  collapsedContent = null,
}) {
  useLocale()
  const [open, setOpen] = useState(true)
  const contentId = useId()
  const width = responsive
    ? open
      ? `w-full ${widthClass}`
      : 'w-full lg:w-12'
    : open
      ? widthClass
      : 'w-12'
  return (
    <aside
      aria-label={localize(`${title} panel`)}
      className={`flex shrink-0 flex-col min-h-0 overflow-hidden bg-eeg-surface/30 ${side === 'right' ? 'border-s' : 'border-e'} border-eeg-border ${width} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={formatText('{0} {1}', [open ? 'Collapse' : 'Expand', title.toLowerCase()])}
        title={formatText('{0} {1}', [open ? 'Collapse' : 'Expand', title.toLowerCase()])}
        className={`flex shrink-0 items-center gap-2 border-b border-eeg-border h-11 px-3 text-xs font-medium text-eeg-muted hover:text-eeg-text hover:bg-eeg-border/30 ${open ? 'justify-between' : 'justify-center'}`}
      >
        {open && <span>{localize(title)}</span>}
        <svg
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 ${open === (side === 'left') ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m7 4 6 6-6 6" />
        </svg>
      </button>
      <div
        id={contentId}
        hidden={!open}
        className={`${open ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col overflow-y-auto`}
      >
        {localize(children)}
      </div>
      {localize(!open && collapsedContent)}
      {!open && !collapsedContent && (
        <span
          aria-hidden="true"
          className="hidden lg:block text-[10px] font-mono text-eeg-muted mt-5 mx-auto [writing-mode:vertical-rl]"
        >
          {localize(title)}
        </span>
      )}
    </aside>
  )
}
