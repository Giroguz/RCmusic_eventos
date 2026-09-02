import { ArrowLeft, ArrowRight, CalendarDays, KeyRound, Search, Sparkles } from 'lucide-react'
import { Brand, PageContainer } from './Brand'
import { findEvent } from '../lib/storage'
import { getPublicEvent, supabaseEnabled } from '../lib/supabase'
import { useState } from 'react'

export default function JoinEvent({ onJoin, onBack }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    try {
      const found = supabaseEnabled ? await getPublicEvent(query) : findEvent(query)
      if (!found) {
        setError('No encontramos ese evento. Revisa el código o prueba con el nombre exacto.')
        return
      }
      setError('')
      onJoin(found)
    } catch {
      setError('No se pudo conectar con el evento. Inténtalo otra vez en unos segundos.')
    }
  }

  return (
    <div className="min-h-screen bg-ink bg-grid">
      <PageContainer className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between"><Brand /><button onClick={onBack} className="btn-secondary px-3 py-2 text-sm"><ArrowLeft size={16} /> Volver</button></div>
        <div className="flex flex-1 items-center justify-center py-14">
          <div className="w-full max-w-lg">
            <div className="mb-8 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-neon/15 text-neon"><CalendarDays size={30} /></div><p className="eyebrow">Entrar a una fiesta</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">¿Qué evento buscas?</h1><p className="mt-4 text-sm leading-6 text-white/55">Pídele el código al DJ o escribe el nombre del evento para empezar.</p></div>
            <form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7">
              <label className="mb-2 block text-sm font-semibold text-white/75">Código o nombre del evento</label>
              <div className="relative"><KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setError('') }} className="input-dark pl-11 uppercase" placeholder="Ej. RC26" /></div>
              {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
              <button className="btn-primary mt-5 w-full" disabled={!query.trim()}>Entrar al evento <ArrowRight size={18} /></button>
              <div className="mt-5 flex items-center gap-2 text-xs text-white/35"><Sparkles size={14} className="text-neon" /> Prueba la demo con el código <strong className="text-white/65">RC26</strong></div>
            </form>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30"><Search size={14} /> Buscar por canción después de entrar</div>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
