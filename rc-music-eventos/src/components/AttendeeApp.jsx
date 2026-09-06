import { useEffect, useState } from 'react'
import { searchTracks } from '../lib/music'
import ChatRoom from './ChatRoom'

export default function AttendeeApp({ event, onExit }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onBack = (historyEvent) => setChatOpen(historyEvent.state?.rcMusicOverlay === 'chat')
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])

  function openChat() {
    window.history.pushState({ ...window.history.state, rcMusicOverlay: 'chat' }, '', window.location.href)
    setChatOpen(true)
  }

  function closeChat() {
    if (window.history.state?.rcMusicOverlay === 'chat') window.history.back()
    else setChatOpen(false)
  }

  async function search(event) {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try { setResults(await searchTracks(query)) } finally { setLoading(false) }
  }

  return <main className="mx-auto min-h-screen w-full px-4 py-8 text-white">
    <header className="mb-8 flex w-full items-center justify-between gap-3">
      <button onClick={onExit} className="rounded-xl border border-white/10 px-3 py-2 text-sm">Atrás</button>
      <strong className="text-neon">{event?.code || 'RC'} · Buscar canciones</strong>
      <button onClick={openChat} className="rounded-xl border border-emerald-300/30 px-3 py-2 text-sm text-emerald-200">Sala de chat</button>
    </header>
    <section className="glass w-full rounded-3xl p-5">
      <h1 className="mb-4 text-3xl font-bold">Buscar canciones</h1>
      <form onSubmit={search} className="flex w-full gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="input-dark min-w-0 flex-1" placeholder="Artista o canción" />
        <button disabled={loading} className="btn-primary shrink-0">{loading ? 'Buscando…' : 'Buscar'}</button>
      </form>
      <div className="mt-5 w-full space-y-2">{results.map((track) => <div key={`${track.id}-${track.title}`} className="w-full rounded-xl border border-white/10 p-3"><strong>{track.title}</strong><p className="text-sm text-white/60">{track.artist}</p></div>)}</div>
    </section>
    {chatOpen && <ChatRoom eventId={event.id} onClose={closeChat} />}
  </main>
}
