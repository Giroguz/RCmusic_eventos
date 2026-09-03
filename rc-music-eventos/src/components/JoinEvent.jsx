import { ArrowRight, CalendarDays, KeyRound, LogOut, Search, Sparkles } from 'lucide-react'
import { Brand, PageContainer } from './Brand'
import { findEvent } from '../lib/storage'
import { getPublicEvent, supabaseEnabled } from '../lib/supabase'
import { useState } from 'react'
import LanguagePicker from './LanguagePicker'
import { useLanguage } from '../lib/i18n'

export default function JoinEvent({ onJoin, onBack }) {
  const { t } = useLanguage(); const [query, setQuery] = useState(''); const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      let found = null; const local = findEvent(query); const localCodeMatch = local && local.code.toUpperCase() === query.trim().toUpperCase()
      if (localCodeMatch) found = { ...local, localOnly: true }
      else if (supabaseEnabled) { try { found = await getPublicEvent(query) } catch { found = null } }
      if (!found) { setError(t('noEvent')); return }
      setError(''); onJoin(found)
    } catch { setError(t('noEvent')) }
  }
  return <div className="party-page min-h-screen bg-ink bg-grid"><PageContainer className="flex min-h-screen flex-col"><div className="flex flex-wrap items-center gap-2 sm:flex-nowrap"><div className="flex w-full min-w-0 items-center sm:w-auto"><Brand compact /></div><div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto"><LanguagePicker /><button onClick={onBack} className="btn-secondary shrink-0 p-2.5" aria-label={t('back')} title={t('back')}><LogOut size={17} /></button></div></div><div className="flex flex-1 items-center justify-center py-14"><div className="w-full max-w-lg"><div className="mb-8 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-neon/15 text-neon"><CalendarDays size={30} /></div><p className="eyebrow">{t('eventAccess')}</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('eventQuestion')}</h1><p className="mt-4 text-sm leading-6 text-white/55">{t('eventHint')}</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">{t('eventCode')}</label><div className="relative"><KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setError('') }} className="input-dark pl-11 uppercase" placeholder={t('codeExample')} /></div>{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button className="btn-primary mt-5 w-full" disabled={!query.trim()}>{t('join')} <ArrowRight size={18} /></button><div className="mt-5 flex items-center gap-2 text-xs text-white/35"><Sparkles size={14} className="text-neon" /> {t('demoHint')} <strong className="text-white/65">RC26</strong></div></form><div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30"><Search size={14} /> {t('searchAfterJoin')}</div></div></div></PageContainer></div>
}
