import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Clock3, Heart, Loader2, MessageCircleHeart, Music2, Play, Search, Send, Sparkles, ThumbsUp, X, Zap } from 'lucide-react'
import { PageContainer, AppShell } from './Brand'
import { getLikedIds, saveLikedIds } from '../lib/storage'
import { searchTracks } from '../lib/music'
import { addSongRequest, likeSongRequest, supabaseEnabled } from '../lib/supabase'

function Modal({ children, onClose, title }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-5 shadow-2xl sm:p-7" onMouseDown={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{title}</h2><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div>{children}</div></div>
}

function SearchResult({ track, onPreview, onRequest }) {
  const sourceLabel ='YouTube'
  return <div className="group flex gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 transition hover:border-white/20 hover:bg-white/[.06]"><button onClick={() => onPreview(track)} className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-white/10"><img src={track.thumbnail} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" /><span className="absolute inset-0 grid place-items-center bg-black/25"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink"><Play size={15} fill="currentColor" /></span></span></button><div className="min-w-0 flex-1 py-0.5"><div className="flex items-center gap-2"><p className="truncate font-semibold">{track.title}</p><span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/45">{sourceLabel}</span></div><p className="mt-1 truncate text-xs text-white/50">{track.artist}</p><p className="mt-2 text-[11px] text-white/30">{track.duration}</p></div><button onClick={() => onRequest(track)} className="self-center rounded-xl bg-neon/10 px-3 py-2 text-xs font-bold text-neon transition hover:bg-neon hover:text-ink">Pedir</button></div>
}

function RequestCard({ request, liked, onLike, onPreview }) {
  const statusLabel = request.status === 'played' ? 'Ya sonó' : request.status === 'not-found' ? 'No ubicada' : 'En cola'
  return <article className={`flex gap-3 rounded-2xl border p-3 transition ${request.status === 'played' ? 'border-emerald-400/20 bg-emerald-400/[.04]' : 'border-white/10 bg-white/[.035]'}`}><button onClick={() => onPreview({ id: request.videoId, source: request.source, spotifyId: request.spotifyId, title: request.title, artist: request.artist, thumbnail: request.thumbnail })} className="relative h-[68px] w-24 shrink-0 overflow-hidden rounded-xl bg-white/10"><img src={request.thumbnail} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Play size={20} fill="currentColor" /></span></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{request.title}</h3><p className="truncate text-xs text-white/50">{request.artist}</p></div><button onClick={() => onLike(request.id)} disabled={liked || request.status !== 'pending'} className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${liked ? 'bg-neon text-ink' : 'bg-white/10 text-white/65 hover:bg-neon/15 hover:text-neon'}`}><ThumbsUp size={13} fill={liked ? 'currentColor' : 'none'} /> {request.likes}</button></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40"><span className="flex items-center gap-1"><span className="grid h-4 w-4 place-items-center rounded-full bg-violet/40 text-[9px] text-white">{request.requester.charAt(0).toUpperCase()}</span>{request.requester}</span>{request.dedication && <span className="truncate italic text-white/50">“{request.dedication}”</span>}<span className={request.status === 'played' ? 'text-emerald-300' : request.status === 'not-found' ? 'text-amber-300' : 'text-neon/80'}>{statusLabel}</span></div></div></article>
}

function PreviewFrame({ track }) {
  if (track.source === 'spotify' || String(track.id || '').startsWith('spotify:')) {
    const spotifyId = track.spotifyId || String(track.id).replace(/^spotify:/, '')
    return <iframe title={track.title} src={`https://open.spotify.com/embed/track/${spotifyId}`} className="h-[352px] w-full" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
  }
  const youtubeId = String(track.id || '').replace(/^youtube:/, '')
  return <iframe title={track.title} src={track.videoUrl || `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`} className="aspect-video w-full" allow="autoplay; encrypted-media" allowFullScreen />
}

function QrPlaceholder() {
  const cells = Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9); const col = index % 9
    const finder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3)
    return <span key={index} className={(finder ? (row === 1 && col === 1) || (row === 1 && col === 7) || (row === 7 && col === 1) : (index * 7 + row * 3) % 5 < 2) ? 'bg-ink' : 'bg-transparent'} />
  })
  return <div className="grid h-28 w-28 grid-cols-9 gap-1 rounded-xl bg-white p-2">{cells}</div>
}

export default function AttendeeApp({ event, onUpdate, onExit }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [requestSong, setRequestSong] = useState(null)
  const [form, setForm] = useState({ requester: '', dedication: '' })
  const [notice, setNotice] = useState('')
  const [likedIds, setLikedIds] = useState(() => getLikedIds(event.id))

  const sortedRequests = useMemo(() => [...(event.requests || [])].sort((a, b) => b.likes - a.likes), [event.requests])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try { setResults(await searchTracks(query)) } catch { setNotice('No se pudo buscar ahora. Revisa tu conexión e inténtalo de nuevo.') } finally { setSearching(false) }
  }

  async function submitRequest(e) {
    e.preventDefault()
    if (!form.requester.trim() || !requestSong) return
    try {
      const request = supabaseEnabled
        ? await addSongRequest(event.id, requestSong, form)
        : { id: `request-${Date.now()}`, title: requestSong.title, artist: requestSong.artist, videoId: requestSong.source === 'spotify' ? `spotify:${requestSong.id}` : requestSong.id, source: requestSong.source || 'youtube', thumbnail: requestSong.thumbnail, requester: form.requester.trim(), dedication: form.dedication.trim(), likes: 0, status: 'pending' }
      onUpdate({ ...event, requests: [...(event.requests || []), request] })
      setRequestSong(null); setForm({ requester: '', dedication: '' }); setNotice('¡Pedido enviado! La pista ya puede votarlo.')
      setTimeout(() => setNotice(''), 3500)
    } catch {
      setNotice('No se pudo enviar el pedido. Inténtalo otra vez.')
    }
  }

  async function likeRequest(id) {
    if (likedIds.includes(id)) return
    try {
      if (supabaseEnabled) await likeSongRequest(id)
      const nextLiked = [...likedIds, id]
      const requests = event.requests.map((request) => request.id === id ? { ...request, likes: request.likes + 1 } : request)
      setLikedIds(nextLiked); saveLikedIds(event.id, nextLiked); onUpdate({ ...event, requests })
    } catch {
      setNotice('No se pudo registrar el like. Inténtalo de nuevo.')
    }
  }

  return <AppShell onHome={onExit} right={<div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-[10px] uppercase tracking-widest text-white/35">Evento</span><strong className="text-sm">{event.name}</strong></span><span className="rounded-xl border border-neon/20 bg-neon/10 px-3 py-2 text-sm font-bold tracking-widest text-neon">{event.code}</span></div>}>
    <PageContainer>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Estás dentro · {event.code}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Pide tu canción.</h1><p className="mt-3 max-w-xl text-sm text-white/50">Busca un tema, escucha una previa y súmalo a la cola de {event.djName}.</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Evento activo</div></div>
      {notice && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-neon/20 bg-neon/10 px-4 py-3 text-sm text-neon"><Check size={18} /> {notice}</div>}
      <section className="glass rounded-[2rem] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">01 · Encuentra el ritmo</p><h2 className="section-title mt-2">Buscar en YouTube</h2></div><Music2 className="text-white/20" /></div><form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="input-dark pl-11" placeholder="Canción o artista..." /></div><button className="btn-primary sm:min-w-36" disabled={searching || !query.trim()}>{searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} {searching ? 'Buscando' : 'Buscar'}</button></form>{results.length > 0 && <div className="mt-5 space-y-3">{results.map((track) => <SearchResult key={`${track.id}-${track.title}`} track={track} onPreview={setSelected} onRequest={setRequestSong} />)}</div>}{!results.length && <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/35"><Zap size={19} className="mx-auto mb-2 text-neon/70" />Escribe una canción o artista para encontrar tu próximo pedido.</div>}</section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]"><section><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">02 · La cola de la fiesta</p><h2 className="section-title mt-2">Pedidos en vivo</h2></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/50">{sortedRequests.length} pedidos</span></div><div className="space-y-3">{sortedRequests.map((request) => <RequestCard key={request.id} request={request} liked={likedIds.includes(request.id)} onLike={likeRequest} onPreview={setSelected} />)}{!sortedRequests.length && <div className="glass rounded-2xl px-5 py-10 text-center text-sm text-white/40">Todavía no hay pedidos. ¡Sé el primero!</div>}</div></section><aside><div className="overflow-hidden rounded-[2rem] border border-violet/20 bg-gradient-to-br from-violet/25 via-white/[.04] to-neon/10 p-5 sm:p-6"><div className="mb-5 flex items-center gap-2 text-violet-200"><MessageCircleHeart size={20} /><span className="font-bold">Apoya al DJ</span></div><p className="text-sm leading-6 text-white/65">{event.thankYou || 'Gracias por hacer vibrar la pista.'}</p><div className="mt-5 flex items-center gap-4 rounded-2xl bg-white p-3 text-ink"><QrPlaceholder /><div><p className="text-xs font-bold uppercase tracking-widest text-ink/50">Yape</p><p className="mt-1 text-lg font-extrabold">{event.yapeNumber || '999 888 777'}</p><p className="mt-1 text-xs text-ink/60">Escanea para dejar tu propina</p></div></div><div className="mt-5 flex items-center gap-2 text-xs text-white/50"><Clock3 size={14} /> Contratos: <a href={`tel:${event.contact}`} className="font-semibold text-neon underline-offset-2 hover:underline">{event.contact}</a></div></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-5"><p className="text-xs font-bold uppercase tracking-widest text-white/35">Tip rápido</p><p className="mt-2 text-sm leading-6 text-white/55">Dale like a los pedidos que quieres escuchar primero. El DJ verá la cola ordenada.</p></div></aside></div>
    </PageContainer>
    {requestSong && <Modal title="Pedir canción" onClose={() => setRequestSong(null)}><div className="mb-5 flex gap-3 rounded-2xl bg-white/[.05] p-3"><img src={requestSong.thumbnail} alt="" className="h-16 w-24 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate font-bold">{requestSong.title}</p><p className="mt-1 truncate text-xs text-white/50">{requestSong.artist}</p></div></div><form onSubmit={submitRequest} className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">Tu nombre <span className="text-neon">*</span></span><input required value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} className="input-dark" placeholder="¿Cómo te llamas?" /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">Dedicatoria <span className="font-normal text-white/35">(opcional)</span></span><textarea value={form.dedication} onChange={(e) => setForm({ ...form, dedication: e.target.value })} className="input-dark min-h-24 resize-none" placeholder="Para mi gente..." maxLength={100} /></label><button className="btn-primary w-full"><Send size={17} /> Enviar pedido</button></form></Modal>}
    {selected && <Modal title="Reproducción previa" onClose={() => setSelected(null)}><div className="overflow-hidden rounded-2xl bg-black"><PreviewFrame track={selected} /></div><h3 className="mt-4 font-bold">{selected.title}</h3><p className="mt-1 text-sm text-white/50">{selected.artist}</p></Modal>}
  </AppShell>
}
