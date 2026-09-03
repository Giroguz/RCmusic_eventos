import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, CheckCircle2, CircleAlert, Clock3, ExternalLink, Eye, Headphones, Link2, ListMusic, LogOut, Music2, ShieldCheck, PauseCircle, Play, Plus, RefreshCw, Search, Settings2, Sparkles, X } from 'lucide-react'
import { AppShell, PageContainer } from './Brand'
import { getEvents, makeCode, saveEvents } from '../lib/storage'
import { createDjEvent, getDjAccess, getDjEvents, setRequestStatus, signOutDj, supabaseEnabled, updateDjEventInfo } from '../lib/supabase'
import AdminPanel from './AdminPanel'
import { useLanguage } from '../lib/i18n'

function Modal({ children, onClose, title }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-5 sm:p-7" onMouseDown={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{title}</h2><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div>{children}</div></div>
}

function Stat({ icon: Icon, label, value, accent = 'white' }) {
  return <div className="glass rounded-2xl p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${accent === 'lime' ? 'bg-neon/15 text-neon' : accent === 'violet' ? 'bg-violet/20 text-violet-200' : accent === 'amber' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/10 text-white/60'}`}><Icon size={18} /></div><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></div>
}

function PreviewFrame({ track }) {
  if (track.source === 'spotify' || String(track.videoId || '').startsWith('spotify:')) {
    const spotifyId = track.spotifyId || String(track.videoId).replace(/^spotify:/, '')
    return <iframe title={track.title} src={`https://open.spotify.com/embed/track/${spotifyId}`} className="h-[352px] w-full" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
  }
  return <iframe title={track.title} src={`https://www.youtube-nocookie.com/embed/${track.videoId}?autoplay=1&rel=0`} className="aspect-video w-full" allow="autoplay; encrypted-media" allowFullScreen />
}

function DjRequestRow({ request, onStatus, onPreview, t }) {
  const played = request.status === 'played'; const notFound = request.status === 'not-found'
  return <div className={`flex flex-col gap-4 border-b border-white/10 px-4 py-4 last:border-0 sm:flex-row sm:items-center ${played ? 'opacity-55' : ''}`}><button onClick={() => onPreview(request)} className="group relative h-16 w-full shrink-0 overflow-hidden rounded-xl bg-white/10 sm:w-24"><img src={request.thumbnail} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100"><Play size={18} fill="currentColor" /></span></button><div className="min-w-0 flex-1"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate font-bold">{request.title}</p><p className="truncate text-xs text-white/50">{request.artist}</p></div><span className="flex items-center gap-1 rounded-lg bg-neon/10 px-2 py-1 text-xs font-extrabold text-neon">{request.likes} <span className="font-normal text-neon/60">likes</span></span></div><div className="mt-2 space-y-1 text-xs text-white/45"><p><span className="font-semibold text-white/65">{t('requestedBy')}:</span> {request.requester || '—'}</p><p><span className="font-semibold text-white/65">{t('dedicatedTo')}:</span> {request.dedication || '—'}</p><p><span className="font-semibold text-white/65">{t('statusLabel')}:</span> <span className={played ? 'text-emerald-300' : notFound ? 'text-amber-200' : 'text-neon'}>{played ? t('alreadyPlayed') : notFound ? t('notLocated') : t('inQueue')}</span></p></div></div><div className="flex shrink-0 gap-2"><button onClick={() => onStatus(request.id, played ? 'pending' : 'played')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:flex-none ${played ? 'bg-white/10 text-white/65 hover:bg-white/15' : 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'}`} title={played ? t('statusQueued') : t('statusPlayed')}>{played ? <RefreshCw size={15} /> : <CheckCircle2 size={15} />}<span className="sm:hidden">{played ? t('inQueue') : t('played')}</span></button><button onClick={() => onStatus(request.id, notFound ? 'pending' : 'not-found')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:flex-none ${notFound ? 'bg-white/10 text-white/65 hover:bg-white/15' : 'bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'}`} title={notFound ? t('statusQueued') : t('statusNotFound')}>{notFound ? <RefreshCw size={15} /> : <CircleAlert size={15} />}<span className="sm:hidden">{notFound ? t('inQueue') : t('notLocated')}</span></button></div></div>
}

export default function DjApp({ onExit, session }) {
  const { t } = useLanguage()
  const [events, setEvents] = useState(() => supabaseEnabled ? [] : getEvents())
  const [activeId, setActiveId] = useState(undefined)
  const [access, setAccess] = useState(session)
  const [loading, setLoading] = useState(true)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preview, setPreview] = useState(null)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', contact: '', yapeNumber: '', thankYou: '' })
  const [profileForm, setProfileForm] = useState({ djName: '', yapeNumber: '', contact: '' })
  const activeEvent = events.find((event) => event.id === activeId) || events[0]

  useEffect(() => {
    const sync = async () => {
      try {
        if (supabaseEnabled) {
          const currentAccess = await getDjAccess(session?.token)
          if (!currentAccess) { onExit(); return }
          setAccess({ ...session, ...currentAccess })
          const remoteEvents = await getDjEvents(session?.token)
          setEvents(remoteEvents)
          setActiveId((current) => remoteEvents.some((event) => event.id === current) ? current : remoteEvents[0]?.id)
        } else { setEvents(getEvents()); setActiveId((current) => current || getEvents()[0]?.id) }
      } catch { if (supabaseEnabled) onExit() } finally { setLoading(false) }
    }
    sync()
    if (!supabaseEnabled) { window.addEventListener('storage', sync); window.addEventListener('rc-events-updated', sync) }
    const interval = setInterval(sync, 25000)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('rc-events-updated', sync); clearInterval(interval) }
  }, [session?.token])

  const requests = useMemo(() => [...(activeEvent?.requests || [])].filter((request) => filter === 'all' || request.status === filter).sort((a, b) => b.likes - a.likes), [activeEvent, filter])
  useEffect(() => {
    if (activeEvent) setProfileForm({ djName: activeEvent.djName || '', yapeNumber: activeEvent.yapeNumber || '', contact: activeEvent.contact || '' })
  }, [activeEvent?.id, activeEvent?.djName, activeEvent?.yapeNumber, activeEvent?.contact])

  async function saveProfile(e) {
    e.preventDefault()
    if (!activeEvent) return
    const updated = { ...activeEvent, djName: profileForm.djName.trim() || 'DJ', yapeNumber: profileForm.yapeNumber.trim(), contact: profileForm.contact.trim() }
    try {
      const saved = supabaseEnabled ? await updateDjEventInfo(activeEvent.id, updated, session?.token) : updated
      setEvents((current) => current.map((event) => event.id === activeEvent.id ? { ...event, djName: saved.djName, yapeNumber: saved.yapeNumber, contact: saved.contact } : event))
      if (!supabaseEnabled) saveEvents(events.map((event) => event.id === activeEvent.id ? updated : event))
      setShowSettings(false); setNotice(t('profileSaved')); setTimeout(() => setNotice(''), 4000)
    } catch { setNotice(t('profileSaveFailed')) }
  }

  const pending = activeEvent?.requests?.filter((request) => request.status === 'pending').length || 0
  const played = activeEvent?.requests?.filter((request) => request.status === 'played').length || 0
  const notFound = activeEvent?.requests?.filter((request) => request.status === 'not-found').length || 0

  async function updateEvent(nextEvent) {
    const previous = activeEvent
    const next = events.map((event) => event.id === nextEvent.id ? nextEvent : event)
    if (supabaseEnabled && previous) {
      const changed = nextEvent.requests.find((request) => previous.requests.find((oldRequest) => oldRequest.id === request.id && oldRequest.status !== request.status))
      if (changed) await setRequestStatus(changed.id, changed.status, session?.token)
    } else {
      saveEvents(next)
    }
    setEvents(next)
  }

  function markStatus(id, status) {
    if (!activeEvent) return
    updateEvent({ ...activeEvent, requests: activeEvent.requests.map((request) => request.id === id ? { ...request, status } : request) })
  }

  async function createEvent(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const input = { code: makeCode(events.map((item) => item.code)), name: form.name.trim(), djName: 'DJ Gianfranco', contact: form.contact.trim() || 'No configurado', yapeNumber: form.yapeNumber.trim() || '999 888 777', thankYou: form.thankYou.trim() || 'Gracias por apoyar la música y hacer vibrar la pista.' }
    try {
      const event = supabaseEnabled ? await createDjEvent(input, session?.token) : { id: `event-${Date.now()}`, ...input, createdAt: new Date().toISOString(), requests: [] }
      const next = [...events, event]
      setEvents(next); if (!supabaseEnabled) saveEvents(next); setActiveId(event.id); setShowCreate(false); setForm({ name: '', contact: '', yapeNumber: '', thankYou: '' }); setNotice(`${t('eventCreated')} ${event.code}`); setTimeout(() => setNotice(''), 5000)
    } catch {
      setNotice(t('createFailed'))
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink text-sm text-white/50">{t('accessChecking')}</div>
  if (!activeEvent) return <AppShell onHome={onExit} right={<div className="flex items-center gap-2">{access?.role === 'admin' && <button onClick={() => setShowAdmin(true)} className="btn-secondary px-3 py-2 text-sm"><ShieldCheck size={16} /> {t('admin')}</button>}<button onClick={onExit} className="btn-secondary px-3 py-2 text-sm"><LogOut size={16} /> {t('logout')}</button></div>}><PageContainer><div className="mx-auto max-w-lg glass rounded-2xl p-6"><Headphones size={28} className="mx-auto mb-3 text-violet-200" /><p className="mb-5 text-center text-white/60">{t('noEvents')}</p><form onSubmit={createEvent} className="space-y-3"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder={t('eventName')} /><button className="btn-primary w-full"><Plus size={17} /> {t('create')}</button></form></div>{showAdmin && access?.role === 'admin' && <AdminPanel session={access} onClose={() => setShowAdmin(false)} />}</PageContainer></AppShell>
  return <AppShell onHome={onExit} right={<div className="flex items-center gap-2">{access?.role === 'admin' && <button onClick={() => setShowAdmin(true)} className="btn-secondary px-3 py-2 text-sm"><ShieldCheck size={16} /> <span className="hidden sm:inline">{t('admin')}</span></button>}<button onClick={onExit} className="btn-secondary px-3 py-2 text-sm"><LogOut size={16} /> <span className="hidden sm:inline">{t('logout')}</span></button></div>}><PageContainer><div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="eyebrow text-violet-200">{t('panelTitle')}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('panelHeading')}</h1><p className="mt-3 text-sm text-white/50">{t('panelDescription')}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setShowSettings(true)} className="btn-secondary"><Settings2 size={18} /> {t('configureProfile')}</button><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> {t('newEvent')}</button></div></div>{notice && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-neon/20 bg-neon/10 px-4 py-3 text-sm text-neon"><Check size={18} /> {notice}</div>}<section className="mb-7 flex flex-col gap-4 rounded-[2rem] border border-violet/20 bg-violet/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet/30 text-violet-100"><Headphones size={23} /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-200/70">{t('activeEvent')}</p><div className="mt-1 flex items-center gap-2"><h2 className="truncate font-display text-xl font-bold">{activeEvent.name}</h2><span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold tracking-widest text-neon">{activeEvent.code}</span></div></div></div><div className="flex items-center gap-2"><select value={activeEvent.id} onChange={(e) => setActiveId(e.target.value)} className="rounded-xl border border-white/10 bg-ink/50 px-3 py-2 text-sm text-white outline-none"><option value={activeEvent.id}>{activeEvent.name}</option>{events.filter((event) => event.id !== activeEvent.id).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><button onClick={() => navigator.clipboard?.writeText(activeEvent.code)} className="rounded-xl border border-white/10 bg-white/[.06] p-2.5 text-white/60 hover:text-white" title={t('copyCode')}><Link2 size={17} /></button></div></section><div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat icon={ListMusic} label={t('totalRequests')} value={activeEvent.requests?.length || 0} /><Stat icon={Clock3} label={t('queued')} value={pending} accent="lime" /><Stat icon={CheckCircle2} label={t('played')} value={played} accent="violet" /><Stat icon={CircleAlert} label={t('notFound')} value={notFound} accent="amber" /></div><section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035]"><div className="flex flex-col justify-between gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:p-5"><div><div className="flex items-center gap-2"><BarChart3 size={19} className="text-neon" /><h2 className="font-display text-xl font-bold">{t('requestQueue')}</h2><span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" /></div><p className="mt-1 text-xs text-white/40">{t('queueLive')}</p></div><div className="flex gap-2 overflow-x-auto no-scrollbar"><button onClick={() => setFilter('all')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'all' ? 'bg-white text-ink' : 'bg-white/10 text-white/55'}`}>{t('all')}</button><button onClick={() => setFilter('pending')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'pending' ? 'bg-neon text-ink' : 'bg-white/10 text-white/55'}`}>{t('queued')}</button><button onClick={() => setFilter('played')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'played' ? 'bg-emerald-300 text-ink' : 'bg-white/10 text-white/55'}`}>{t('played')}</button><button onClick={() => setFilter('not-found')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'not-found' ? 'bg-amber-300 text-ink' : 'bg-white/10 text-white/55'}`}>{t('notFound')}</button></div></div>{requests.length ? requests.map((request) => <DjRequestRow key={request.id} request={request} onStatus={markStatus} onPreview={setPreview} t={t} />) : <div className="px-5 py-14 text-center text-sm text-white/35"><Music2 size={25} className="mx-auto mb-3 text-white/20" />{t('noSongs')}</div>}</section><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="glass rounded-2xl p-5 md:col-span-2"><div className="flex items-center gap-2 text-sm font-bold"><Settings2 size={17} className="text-violet-200" /> {t('shareAccess')}</div><p className="mt-2 text-sm text-white/50">{t('shareHint')}</p><div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 p-4"><span className="font-display text-3xl font-bold tracking-[.18em] text-neon">{activeEvent.code}</span><button onClick={() => navigator.clipboard?.writeText(activeEvent.code)} className="btn-secondary px-3 py-2 text-xs">{t('copyCode')}</button></div></div><div className="rounded-2xl border border-neon/20 bg-neon/10 p-5"><Sparkles size={19} className="text-neon" /><p className="mt-3 font-bold text-neon">{t('boothTip')}</p><p className="mt-2 text-sm leading-6 text-white/60">{t('boothTipText')}</p></div></div></PageContainer>{showSettings && <Modal title={t('configureProfile')} onClose={() => setShowSettings(false)}><form onSubmit={saveProfile} className="space-y-4"><p className="text-sm leading-6 text-white/55">{t('profileHint')}</p><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('stageName')}</span><input value={profileForm.djName} onChange={(e) => setProfileForm({ ...profileForm, djName: e.target.value })} className="input-dark" placeholder={t('stageNamePlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('yapeNameNumber')}</span><input value={profileForm.yapeNumber} onChange={(e) => setProfileForm({ ...profileForm, yapeNumber: e.target.value })} className="input-dark" placeholder={t('yapeProfilePlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('bookingContact')}</span><input value={profileForm.contact} onChange={(e) => setProfileForm({ ...profileForm, contact: e.target.value })} className="input-dark" placeholder={t('bookingContactPlaceholder')} /></label><button className="btn-primary w-full"><Check size={17} /> {t('saveProfile')}</button></form></Modal>}{showCreate && <Modal title={t('createEvent')} onClose={() => setShowCreate(false)}><form onSubmit={createEvent} className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('eventName')} <span className="text-neon">*</span></span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder={t('newEventName')} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('contact')}</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input-dark" placeholder={t('contactPlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('yape')}</span><input value={form.yapeNumber} onChange={(e) => setForm({ ...form, yapeNumber: e.target.value })} className="input-dark" placeholder={t('yapePlaceholder')} /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('guestMessage')}</span><textarea value={form.thankYou} onChange={(e) => setForm({ ...form, thankYou: e.target.value })} className="input-dark min-h-24 resize-none" placeholder={t('thanksPlaceholder')} maxLength={150} /></label><button className="btn-primary w-full"><Plus size={18} /> {t('create')}</button></form></Modal>}{preview && <Modal title={t('preview')} onClose={() => setPreview(null)}><div className="overflow-hidden rounded-2xl bg-black"><PreviewFrame track={preview} /></div><h3 className="mt-4 font-bold">{preview.title}</h3><p className="mt-1 text-sm text-white/50">{preview.artist}</p></Modal>}{showAdmin && access?.role === 'admin' && <AdminPanel session={access} onClose={() => setShowAdmin(false)} />}</AppShell>
}
