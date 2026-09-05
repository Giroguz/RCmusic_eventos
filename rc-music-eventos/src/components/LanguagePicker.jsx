import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LANGUAGES, useLanguage } from '../lib/i18n'

const FLAGS = { es: '🇪🇸', en: '🇬🇧', pt: '🇵🇹', fr: '🇫🇷', ja: '🇯🇵', zh: '🇨🇳', hi: '🇮🇳' }

export default function LanguagePicker({ compact = false }) {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0]
  const currentFlag = FLAGS[current.code] || '🌐'
  const chooseLanguage = (code) => { setLanguage(code); setOpen(false) }

  return <div className={`relative inline-flex min-w-0 rounded-xl border border-white/10 bg-white/[.05] text-white/65 ${compact ? 'p-1' : 'p-1.5'}`} title={t('languageLabel')} style={{ userSelect: 'none' }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={t('languageLabel')} aria-haspopup="listbox" aria-expanded={open} className={`inline-flex min-w-0 items-center rounded-lg text-white hover:bg-white/[.07] ${compact ? 'gap-1 px-1 py-0.5 text-[11px]' : 'gap-1.5 px-1 py-0.5 text-xs'}`}>
      <span aria-hidden="true" className="shrink-0 text-sm leading-none">{currentFlag}</span>
      <span className="truncate font-semibold">{current.label}</span>
      <ChevronDown size={compact ? 12 : 13} className={`ml-0.5 shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <>
      <div aria-hidden="true" className="fixed inset-0 z-[99998] bg-transparent" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false) }} onClick={(event) => event.stopPropagation()} />
      <div role="listbox" aria-label={t('languageLabel')} style={{ backgroundColor: '#08050d', background: '#08050d', opacity: 1, isolation: 'isolate', pointerEvents: 'auto', zIndex: 100000, boxShadow: '0 18px 40px rgba(0,0,0,.75)', userSelect: 'none' }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} className="absolute right-0 top-full z-[100] mt-1.5 min-w-[168px] overflow-hidden rounded-xl border border-white/20 p-1 shadow-2xl shadow-black/70 ring-1 ring-black/40">
      {LANGUAGES.map((item) => <button type="button" role="option" aria-selected={item.code === language} key={item.code} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerUp={(event) => { event.stopPropagation(); chooseLanguage(item.code) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseLanguage(item.code) } }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${item.code === language ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/[.08] hover:text-white'}`}>
        <span aria-hidden="true" className="text-base leading-none">{FLAGS[item.code] || '🌐'}</span><span>{item.label}</span>
      </button>)}
      </div>
    </>}
  </div>
}
