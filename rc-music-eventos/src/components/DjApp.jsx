import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Check, CheckCircle2, CircleAlert, Clock3, Download, ExternalLink, Eye, Headphones, ImagePlus, Link2, ListMusic, LoaderCircle, MessageCircleHeart, Music2, ShieldCheck, PauseCircle, Play, Plus, RefreshCw, Search, Settings2, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import { AppShell, PageContainer } from './Brand'
import { getEvents, makeCode, saveEvents } from '../lib/storage'
import { createDjEvent, finalizeDjEvent, getDjAccess, getDjEventQr, getDjEvents, setRequestStatus, signOutDj, supabaseEnabled, updateDjEventInfo, updateDjEventQr, updateDjEventTipSettings, subscribeToEventPresence } from '../lib/supabase'
import AdminPanel from './AdminPanel'
import { useLanguage } from '../lib/i18n'
import ChatRoom from './ChatRoom'
import { downloadDriveAudio, fetchDriveAudio, searchDriveAudio, downloadYoutubeAudio } from '../lib/download'
import { countdownText } from '../lib/plans'

function EmailVerificationBadge({ access }) {
  const verified = Boolean(access?.email_verified || access?.emailVerified)
  return <span className={`hidden rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline ${verified ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/30 bg-amber-400/10 text-amber-100'}`}>{verified ? '✓ Correo verificado' : 'Correo pendiente'}</span>
}

function AccessCountdown({ access }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!access?.planExpiresAt || access.role === 'admin') return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [access?.planExpiresAt, access?.role])
  if (!access?.planExpiresAt || access.role === 'admin') return null
  const expired = new Date(access.planExpiresAt).getTime() <= now
  return <span className={`hidden rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline ${expired ? 'border-red-300/30 bg-red-400/10 text-red-200' : 'border-neon/20 bg-neon/10 text-neon'}`}>Plan: {countdownText(access.planExpiresAt, now)}</span>
}

function Modal({ children, onClose, title }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-5 sm:p-7" onMouseDown={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">{title}</h2><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div>{children}</div></div>
}

function Stat({ icon: Icon, label, value, accent = 'white' }) {
  return <div className="glass rounded-2xl p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${accent === 'lime' ? 'bg-neon/15 text-neon' : accent === 'violet' ? 'bg-violet/20 text-violet-200' : accent === 'amber' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/10 text-white/60'}`}><Icon size={18} /></div><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></div>
}

function MediaThumbnail({ src, alt = '', className = '' }) { const [failed, setFailed] = useState(!src); if (failed) return <img src="/music-placeholder.svg" alt={alt || 'Música'} className={className} />; return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} /> }
function PreviewFrame({ track }) { if (track.source === 'unknown') return <div className="grid min-h-40 place-items-center p-8 text-center text-sm text-white/55">Este pedido no tiene una vista previa disponible.</div>
  if (track.source === 'spotify' || String(track.videoId || '').startsWith('spotify:')) {
    const spotifyId = track.spotifyId || String(track.videoId).replace(/^spotify:/, '')
    return <iframe title={track.title} src={`https://open.spotify.com/embed/track/${spotifyId}`} className="h-[352px] w-full" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
  }
  return <iframe title={track.title} src={`https://www.youtube-nocookie.com/embed/${track.videoId}?autoplay=1&rel=0`} className="aspect-video w-full" allow="autoplay; encrypted-media" allowFullScreen />
}

function DjRequestRow({ request, onStatus, onPreview, onProof, onDriveSearch, onDriveCancel, searchingDrive, readOnly, t }) {
  const played = request.status === 'played'; const notFound = request.status === 'not-found'; const awaiting = request.status === 'awaiting-payment'; const rejected = request.status === 'payment-rejected'
  const statusText = awaiting ? t('paymentPending') : rejected ? t('paymentRejected') : played ? t('alreadyPlayed') : notFound ? t('notLocated') : t('inQueue')
  const statusTone = played ? 'text-[#b8ff3d]' : notFound || rejected ? 'text-red-400' : awaiting ? 'text-violet-200' : 'text-amber-300'
  return <div className={`flex flex-col gap-4 border-b border-white/10 px-4 py-4 last:border-0 sm:flex-row sm:items-center ${played || rejected ? 'opacity-55' : ''}`}><button onClick={() => onPreview(request)} className="group relative h-16 w-full shrink-0 overflow-hidden rounded-xl bg-white/10 sm:w-24"><MediaThumbnail src={request.thumbnail} alt={request.title} className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100"><Play size={18} fill="currentColor" /></span></button><div className="min-w-0 flex-1"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className={`truncate font-bold ${played || notFound || rejected ? 'line-through decoration-white/60' : ''}`}>{request.title}</p><p className="truncate text-xs text-white/50">{request.artist}</p></div><span className="flex items-center gap-1 rounded-lg bg-neon/10 px-2 py-1 text-xs font-extrabold text-neon">{request.likes} <span className="font-normal text-neon/60">likes</span></span></div><div className="mt-2 space-y-1 text-xs text-white/45"><p><span className="font-semibold text-white/65">{t('requestedBy')}:</span> {request.requester || '—'}</p><p><span className="font-semibold text-white/65">{t('dedicatedTo')}:</span> {request.dedication || '—'}</p><p className={`${statusTone} font-bold`}><span>{t('statusLabel')}:</span> {statusText}</p>{request.paymentProof && <button onClick={() => onProof(request.paymentProof)} className="font-semibold text-turquoise underline-offset-2 hover:underline">{t('viewPaymentProof')}</button>}</div></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{searchingDrive ? <button onClick={onDriveCancel} className="flex min-w-[132px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-400/20 sm:flex-none" title={t('cancel')}><LoaderCircle size={15} className="animate-spin" /> <span>{t('searching')}</span></button> : <button onClick={() => onDriveSearch(request)} className="flex min-w-[132px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-turquoise/10 px-3 py-2.5 text-xs font-bold text-turquoise transition hover:bg-turquoise/20 sm:flex-none" title={t('searchDrive')}><Search size={15} /> <span>{t('searchDrive')}</span></button>}{!readOnly && (awaiting ? <><button onClick={() => onStatus(request.id, 'pending')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-400/15 px-3 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/25 sm:flex-none" title={t('approvePayment')}><CheckCircle2 size={15} /><span>{t('approvePayment')}</span></button><button onClick={() => onStatus(request.id, 'payment-rejected')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400/10 px-3 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20 sm:flex-none" title={t('rejectPayment')}><CircleAlert size={15} /><span>{t('rejectPayment')}</span></button></> : !rejected && <><button onClick={() => onStatus(request.id, played ? 'pending' : 'played')} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-bold transition sm:flex-none ${played ? 'bg-white/10 text-white/65 hover:bg-white/15' : 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25'}`} title={played ? t('statusQueued') : t('statusPlayed')}>{played ? <RefreshCw size={15} /> : <CheckCircle2 size={15} />}<span className="whitespace-nowrap">{played ? t('inQueue') : t('played')}</span></button><button onClick={() => onStatus(request.id, notFound ? 'pending' : 'not-found')} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-bold transition sm:flex-none ${notFound ? 'bg-white/10 text-white/65 hover:bg-white/15' : 'bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'}`} title={notFound ? t('statusQueued') : t('statusNotFound')}>{notFound ? <RefreshCw size={15} /> : <CircleAlert size={15} />}<span className="whitespace-nowrap">{notFound ? t('inQueue') : t('notLocated')}</span></button></>)} </div></div>
}
async function fileToQrDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('invalid-image')
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
  const image = await new Promise((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source })
  const maxSide = 900; const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')
  return png.length <= 1150000 ? png : canvas.toDataURL('image/webp', 0.86)
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
  const [showFinalize, setShowFinalize] = useState(false)
  const [preview, setPreview] = useState(null)
  const [paymentProof, setPaymentProof] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortMode, setSortMode] = useState('likes')
  const [form, setForm] = useState({ name: '', contact: '', yapeNumber: '', thankYou: '' })
  const [profileForm, setProfileForm] = useState({ djName: '', yapeNumber: '', contact: '', qrImage: '', tipsRequired: false })
  const [onlineCount, setOnlineCount] = useState(0); const [chatOpen, setChatOpen] = useState(false); const [presenceNotice, setPresenceNotice] = useState(''); const previousOnlineCount = useRef(null); const presenceNoticeTimer = useRef(null)
  const [qrLoading, setQrLoading] = useState(false)
  const activeEvent = events.find((event) => event.id === activeId) || events[0]

  useEffect(() => {
    const sync = async () => {
      try {
        if (supabaseEnabled) {
          const currentAccess = await getDjAccess(session?.token)
          if (!currentAccess) { onExit(); return }
          setAccess({ ...session, ...currentAccess })
          const remoteEvents = await getDjEvents(session?.token)
          const eventsWithQr = await Promise.all(remoteEvents.map(async (event) => { try { return { ...event, qrImage: await getDjEventQr(event.id, session?.token) } } catch { return event } }))
          setEvents(eventsWithQr)
          setActiveId((current) => eventsWithQr.some((event) => event.id === current) ? current : eventsWithQr[0]?.id)
        } else { setEvents(getEvents()); setActiveId((current) => current || getEvents()[0]?.id) }
      } catch { if (supabaseEnabled) onExit() } finally { setLoading(false) }
    }
    sync()
    if (!supabaseEnabled) { window.addEventListener('storage', sync); window.addEventListener('rc-events-updated', sync) }
    const interval = setInterval(sync, 25000)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('rc-events-updated', sync); clearInterval(interval) }
  }, [session?.token])

  const requests = useMemo(() => [...(activeEvent?.requests || [])].filter((request) => filter === 'all' || request.status === filter).sort((a, b) => sortMode === 'recent' ? String(b.createdAt || '').localeCompare(String(a.createdAt || '')) : (b.likes - a.likes) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))), [activeEvent, filter, sortMode])
  useEffect(() => {
    previousOnlineCount.current = null
    setPresenceNotice('')
    if (!activeEvent?.id) return undefined
    const unsubscribe = subscribeToEventPresence(activeEvent.id, 'dj', (count) => {
      const previous = previousOnlineCount.current
      setOnlineCount(count)
      if (previous !== null && count > previous) {
        setPresenceNotice(`${t('participantJoined')} · ${count}`)
        if (presenceNoticeTimer.current) clearTimeout(presenceNoticeTimer.current)
        presenceNoticeTimer.current = setTimeout(() => setPresenceNotice(''), 4500)
      }
      previousOnlineCount.current = count
    })
    return () => {
      unsubscribe?.()
      if (presenceNoticeTimer.current) clearTimeout(presenceNoticeTimer.current)
      presenceNoticeTimer.current = null
    }
  }, [activeEvent?.id, t])
  useEffect(() => {
    if (activeEvent) setProfileForm({ djName: activeEvent.djName || '', yapeNumber: activeEvent.yapeNumber || '', contact: activeEvent.contact || '', qrImage: activeEvent.qrImage || '', tipsRequired: Boolean(activeEvent.tipsRequired) })
  }, [activeEvent?.id, activeEvent?.djName, activeEvent?.yapeNumber, activeEvent?.contact, activeEvent?.qrImage])

  async function handleQrUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setQrLoading(true)
    try { const qrImage = await fileToQrDataUrl(file); setProfileForm((current) => ({ ...current, qrImage })) } catch { setNotice(t('qrImageInvalid')); setTimeout(() => setNotice(''), 3500) } finally { setQrLoading(false); e.target.value = '' }
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!activeEvent) return
    const updated = { ...activeEvent, djName: profileForm.djName.trim() || 'DJ', yapeNumber: profileForm.yapeNumber.trim(), contact: profileForm.contact.trim(), qrImage: profileForm.qrImage || '', tipsRequired: Boolean(profileForm.tipsRequired) }
    try {
      const saved = supabaseEnabled ? await updateDjEventInfo(activeEvent.id, updated, session?.token) : updated
      if (supabaseEnabled && profileForm.qrImage !== (activeEvent.qrImage || '')) await updateDjEventQr(activeEvent.id, profileForm.qrImage, session?.token)
      if (supabaseEnabled && Boolean(profileForm.tipsRequired) !== Boolean(activeEvent.tipsRequired)) await updateDjEventTipSettings(activeEvent.id, profileForm.tipsRequired, session?.token)
      setEvents((current) => current.map((event) => event.id === activeEvent.id ? { ...event, djName: saved.djName, yapeNumber: saved.yapeNumber, contact: saved.contact, qrImage: updated.qrImage, tipsRequired: updated.tipsRequired } : event))
      if (!supabaseEnabled) saveEvents(events.map((event) => event.id === activeEvent.id ? updated : event))
      setShowSettings(false); setNotice(t('profileSaved')); setTimeout(() => setNotice(''), 4000)
    } catch { setNotice(t('profileSaveFailed')) }
  }

  const [driveSearchId, setDriveSearchId] = useState('')
  const [driveSearchController, setDriveSearchController] = useState(null)
  const [downloadingFileId, setDownloadingFileId] = useState('')
  const [noticeLoading, setNoticeLoading] = useState(false)
  const [downloadOptions, setDownloadOptions] = useState(null)
  const [drivePreview, setDrivePreview] = useState({ id: '', url: '', loading: false })

  async function searchDriveForRequest(request) {
    if (!request || driveSearchId || downloadingFileId) return
    const controller = new AbortController()
    setDriveSearchController(controller)
    setDriveSearchId(request.id)
    setNotice(t('searching'))
    try {
      const matches = await searchDriveAudio(`${request.title} ${request.artist}`, controller.signal)
      setDownloadOptions({ request, matches })
      if (!matches.length) setNotice(t('notLocated'))
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(t('downloadFailed'))
    } finally {
      setDriveSearchController(null)
      setDriveSearchId('')
      setTimeout(() => setNotice(''), 4500)
    }
  }

  function cancelDriveSearch() {
    driveSearchController?.abort()
    setDriveSearchController(null)
    setDriveSearchId('')
    setNotice('')
  }

  async function previewDriveFile(file) {
    if (!file?.id || drivePreview.loading) return
    if (drivePreview.url) URL.revokeObjectURL(drivePreview.url)
    setDrivePreview({ id: file.id, url: '', loading: true })
    try {
      const blob = await fetchDriveAudio(file.id)
      setDrivePreview({ id: file.id, url: URL.createObjectURL(blob), loading: false })
    } catch { setDrivePreview({ id: '', url: '', loading: false }); setNotice(t('downloadFailed')) }
  }

  async function downloadSelectedDriveFile(file) {
    if (!file?.id || downloadingFileId) return
    setDownloadingFileId(file.id)
    setNoticeLoading(true)
    setNotice(t('downloadPreparing'))
    try {
      await downloadDriveAudio(file.id, file.name)
      setNoticeLoading(false)
      setNotice(t('downloadCompleted'))
    } catch {
      setNoticeLoading(false)
      setNotice(t('downloadFailed'))
    } finally {
      setDownloadingFileId('')
      setTimeout(() => setNotice(''), 4500)
    }
  }

  async function finishActiveEvent() {
    if (!activeEvent || activeEvent.finalized) return
    try {
      const finalizedAt = supabaseEnabled ? await finalizeDjEvent(activeEvent.id, session?.token) : new Date().toISOString()
      const updated = { ...activeEvent, finalized: true, finalizedAt, qrImage: '', requests: (activeEvent.requests || []).map((request) => ({ ...request, paymentProof: '' })) }
      const next = events.map((event) => event.id === activeEvent.id ? updated : event)
      setEvents(next)
      if (!supabaseEnabled) saveEvents(next)
      setShowFinalize(false)
      setNotice(t('eventFinalized'))
      setTimeout(() => setNotice(''), 5000)
    } catch { setNotice(t('eventFinalizeFailed')) }
  }

  const pending = activeEvent?.requests?.filter((request) => request.status === 'pending').length || 0
  const played = activeEvent?.requests?.filter((request) => request.status === 'played').length || 0
  const notFound = activeEvent?.requests?.filter((request) => request.status === 'not-found').length || 0
  const awaitingPayment = activeEvent?.requests?.filter((request) => request.status === 'awaiting-payment').length || 0

  async function updateEvent(nextEvent) {
    const previous = activeEvent
    const next = events.map((event) => event.id === nextEvent.id ? nextEvent : event)
    // Actualiza la cola de inmediato para que cualquier estado responda al clic.
    setEvents(next)
    try {
      if (supabaseEnabled && previous) {
        const changed = nextEvent.requests.find((request) => previous.requests.find((oldRequest) => oldRequest.id === request.id && oldRequest.status !== request.status))
        if (changed) await setRequestStatus(changed.id, changed.status, access?.token)
      } else {
        saveEvents(next)
      }
    } catch {
      setNotice(t('updateDjError'))
      setTimeout(() => setNotice(''), 4000)
    }
  }

  function markStatus(id, status) {
    if (!activeEvent || activeEvent.finalized) return
    updateEvent({ ...activeEvent, requests: activeEvent.requests.map((request) => request.id === id ? { ...request, status } : request) })
  }

  function downloadSongRecord() {
    if (!activeEvent) return
    const lineBreak = '\r\n'
    const recordedRequests = (activeEvent.requests || []).slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    const songLines = recordedRequests.map((request, index) => `${index + 1}.-Canción: ${request.title}`)
    const separator = '-'.repeat(Math.max(1, ...songLines.map((line) => line.length)))
    const entries = recordedRequests.map((request, index) => [
      songLines[index],
      `Artista: ${request.artist}`,
    ].join(lineBreak))
    const content = [
      `Registro de canciones tocadas — ${activeEvent.name}`,
      `Código del evento: ${activeEvent.code}`,
      separator,
      '',
      entries.join(`${lineBreak}${lineBreak}`),
      '',
      separator,
    ].join(lineBreak)
    const blob = new Blob([`\ufeff${content}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `registro-canciones-${activeEvent.code}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function createEvent(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const input = { code: makeCode(events.map((item) => item.code)), name: form.name.trim(), djName: t('defaultDjName'), contact: form.contact.trim() || t('defaultContact'), yapeNumber: form.yapeNumber.trim() || t('defaultYape'), thankYou: form.thankYou.trim() || t('defaultThanks') }
    try {
      const event = supabaseEnabled ? await createDjEvent(input, session?.token) : { id: `event-${Date.now()}`, ...input, createdAt: new Date().toISOString(), requests: [] }
      const next = [...events, event]
      setEvents(next); if (!supabaseEnabled) saveEvents(next); setActiveId(event.id); setShowCreate(false); setForm({ name: '', contact: '', yapeNumber: '', thankYou: '' }); setNotice(`${t('eventCreated')} ${event.code}`); setTimeout(() => setNotice(''), 5000)
    } catch {
      setNotice(t('createFailed'))
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-ink text-sm text-white/50">{t('accessChecking')}</div>
  if (!activeEvent) return <AppShell onHome={onExit} right={<div className="flex items-center gap-2"><EmailVerificationBadge access={access} /><AccessCountdown access={access} />{access?.role === 'admin' && <button onClick={() => setShowAdmin(true)} className="btn-secondary px-3 py-2 text-sm"><ShieldCheck size={16} /> Desarrollador</button>}</div>}><PageContainer><div className="mx-auto max-w-lg glass rounded-2xl p-6"><Headphones size={28} className="mx-auto mb-3 text-violet-200" /><p className="mb-5 text-center text-white/60">{t('noEvents')}</p><form onSubmit={createEvent} className="space-y-3"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder={t('eventName')} /><button className="btn-primary w-full"><Plus size={17} /> {t('create')}</button></form></div>{showAdmin && access?.role === 'admin' && <AdminPanel session={access} onClose={() => setShowAdmin(false)} />}</PageContainer></AppShell>
  return <AppShell onHome={onExit} right={<div className="flex items-center gap-2"><EmailVerificationBadge access={access} /><AccessCountdown access={access} />{access?.role === 'admin' && <button onClick={() => setShowAdmin(true)} className="btn-secondary px-3 py-2 text-sm"><ShieldCheck size={16} /> <span className="hidden sm:inline">Desarrollador</span></button>}</div>}><PageContainer><div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="eyebrow text-violet-200">{t('panelTitle')}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('panelHeading')}</h1><p className="mt-3 text-sm text-white/50">{t('panelDescription')}</p></div><div className="flex flex-wrap gap-2">{!activeEvent.finalized && <button onClick={() => setShowSettings(true)} className="btn-secondary"><Settings2 size={18} /> {t('configureProfile')}</button>}{!activeEvent.finalized && <button onClick={() => setShowFinalize(true)} className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-300/20"><CircleAlert size={18} /> <span>{t('finalizeEvent')}</span></button>}{activeEvent.finalized && <span className="flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-200"><CheckCircle2 size={18} /> {t('eventFinalizedLabel')}</span>}<button onClick={downloadSongRecord} disabled={!activeEvent?.requests?.length} className="btn-secondary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"><Download size={18} /> {t('downloadSongRecord')}</button><button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> {t('newEvent')}</button></div></div>{presenceNotice && <div className="fixed left-1/2 top-5 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-emerald-300/30 bg-[#071c1a]/95 px-4 py-3 text-xs font-bold text-emerald-200 shadow-2xl shadow-emerald-400/10 sm:text-sm"><UserRound size={17} /> {presenceNotice}</div>}{notice && <div className="fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-2xl border border-neon/30 bg-ink/95 px-3 py-3 text-xs font-bold text-neon shadow-2xl shadow-neon/10 sm:px-5 sm:text-sm">{noticeLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />} {notice}</div>}<button onClick={() => setChatOpen(true)} className="mb-4 inline-flex items-center justify-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-2 text-xs font-semibold text-neon transition hover:bg-neon/20"><MessageCircleHeart size={17} /> {t('chatRoom')}</button><section className="mb-7 flex flex-col gap-4 rounded-[2rem] border border-violet/20 bg-violet/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet/30 text-violet-100"><Headphones size={23} /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-200/70">{t('activeEvent')}</p><div className="mt-1 flex items-center gap-2"><h2 className="truncate font-display text-xl font-bold">{activeEvent.name}</h2><span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold tracking-widest text-neon">{activeEvent.code}</span><span className="flex items-center gap-1.5 text-[11px] font-light text-emerald-200/75"><span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,.35)]"><UserRound size={13} strokeWidth={2.5} /></span>{onlineCount} en línea</span></div></div></div><div className="flex items-center gap-2"><select value={activeEvent.id} onChange={(e) => setActiveId(e.target.value)} className="rounded-xl border border-white/10 bg-ink/50 px-3 py-2 text-sm text-white outline-none"><option value={activeEvent.id}>{activeEvent.name}</option>{events.filter((event) => event.id !== activeEvent.id).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><button onClick={() => navigator.clipboard?.writeText(activeEvent.code)} className="rounded-xl border border-white/10 bg-white/[.06] p-2.5 text-white/60 hover:text-white" title={t('copyCode')}><Link2 size={17} /></button></div></section><div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat icon={ListMusic} label={t('totalRequests')} value={activeEvent.requests?.length || 0} /><Stat icon={Clock3} label={t('queued')} value={pending} accent="lime" /><Stat icon={CheckCircle2} label={t('played')} value={played} accent="violet" /><Stat icon={CircleAlert} label={t('notFound')} value={notFound} accent="amber" /></div><section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.035]"><div className="flex flex-col justify-between gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:p-5"><div><div className="flex items-center gap-2"><BarChart3 size={19} className="text-neon" /><h2 className="font-display text-xl font-bold">{t('requestQueue')}</h2><span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" /></div><p className="mt-1 text-xs text-white/40">{t('queueLive')}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{t('sortRequests')}:</span><button onClick={() => setSortMode('recent')} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${sortMode === 'recent' ? 'bg-violet-200 text-ink' : 'bg-white/10 text-white/55'}`}>{t('sortRecent')}</button><button onClick={() => setSortMode('likes')} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${sortMode === 'likes' ? 'bg-neon text-ink' : 'bg-white/10 text-white/55'}`}>{t('sortLikes')}</button></div></div><div className="flex gap-2 overflow-x-auto no-scrollbar"><button onClick={() => setFilter('all')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'all' ? 'bg-white text-ink' : 'bg-white/10 text-white/55'}`}>{t('all')}</button><button onClick={() => setFilter('pending')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'pending' ? 'bg-neon text-ink' : 'bg-white/10 text-white/55'}`}>{t('queued')}</button><button onClick={() => setFilter('played')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'played' ? 'bg-emerald-300 text-ink' : 'bg-white/10 text-white/55'}`}>{t('played')}</button><button onClick={() => setFilter('not-found')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'not-found' ? 'bg-amber-300 text-ink' : 'bg-white/10 text-white/55'}`}>{t('notFound')}</button><button onClick={() => setFilter('awaiting-payment')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === 'awaiting-payment' ? 'bg-violet-200 text-ink' : 'bg-white/10 text-white/55'}`}>{t('paymentPending')} {awaitingPayment ? `(${awaitingPayment})` : ''}</button></div></div>{requests.length ? requests.map((request) => <DjRequestRow key={request.id} request={request} onStatus={markStatus} onPreview={setPreview} onProof={setPaymentProof} onDriveSearch={searchDriveForRequest} onDriveCancel={cancelDriveSearch} searchingDrive={driveSearchId === request.id} readOnly={activeEvent.finalized} t={t} />) : <div className="px-5 py-14 text-center text-sm text-white/35"><Music2 size={25} className="mx-auto mb-3 text-white/20" />{t('noSongs')}</div>}</section><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="glass rounded-2xl p-5 md:col-span-2"><div className="flex items-center gap-2 text-sm font-bold"><Settings2 size={17} className="text-violet-200" /> {t('shareAccess')}</div><p className="mt-2 text-sm text-white/50">{t('shareHint')}</p><div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 p-4"><span className="font-display text-3xl font-bold tracking-[.18em] text-neon">{activeEvent.code}</span><button onClick={() => navigator.clipboard?.writeText(activeEvent.code)} className="btn-secondary px-3 py-2 text-xs">{t('copyCode')}</button></div></div><div className="rounded-2xl border border-neon/20 bg-neon/10 p-5"><Sparkles size={19} className="text-neon" /><p className="mt-3 font-bold text-neon">{t('boothTip')}</p><p className="mt-2 text-sm leading-6 text-white/60">{t('boothTipText')}</p></div></div></PageContainer>{chatOpen && <ChatRoom eventId={activeEvent.id} role="dj" onClose={() => setChatOpen(false)} />}{showFinalize && <Modal title={t('finalizeEvent')} onClose={() => setShowFinalize(false)}><div className="space-y-4"><div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{t('finalizeEventWarning')}</div><p className="text-sm leading-6 text-white/60">{t('finalizeEventDetails')}</p><div className="flex gap-3"><button type="button" onClick={() => setShowFinalize(false)} className="btn-secondary flex-1">{t('cancel')}</button><button type="button" onClick={finishActiveEvent} className="flex-1 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-ink hover:bg-amber-200">{t('confirmFinalize')}</button></div></div></Modal>}{showSettings && <Modal title={t('configureProfile')} onClose={() => setShowSettings(false)}><form onSubmit={saveProfile} className="space-y-4"><p className="text-sm leading-6 text-white/55">{t('profileHint')}</p><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('stageName')}</span><input value={profileForm.djName} onChange={(e) => setProfileForm({ ...profileForm, djName: e.target.value })} className="input-dark" placeholder={t('stageNamePlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('yapeNameNumber')}</span><input value={profileForm.yapeNumber} onChange={(e) => setProfileForm({ ...profileForm, yapeNumber: e.target.value })} className="input-dark" placeholder={t('yapeProfilePlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('bookingContact')}</span><input value={profileForm.contact} onChange={(e) => setProfileForm({ ...profileForm, contact: e.target.value })} className="input-dark" placeholder={t('bookingContactPlaceholder')} /></label><div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center gap-2"><ImagePlus size={18} className="text-neon" /><span className="text-sm font-semibold text-white/75">{t('qrImageLabel')}</span></div><p className="mt-1 text-xs leading-5 text-white/45">{t('qrImageHint')}</p><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrUpload} className="input-dark mt-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-neon file:px-3 file:py-2 file:font-bold file:text-ink" />{qrLoading && <p className="mt-2 text-xs text-white/50">{t('qrImageLoading')}</p>}{profileForm.qrImage && <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3"><img src={profileForm.qrImage} alt={t('qrImageLabel')} className="h-20 w-20 rounded-lg object-contain" /><button type="button" onClick={() => setProfileForm({ ...profileForm, qrImage: '' })} className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-2 text-xs font-bold text-red-200"><Trash2 size={14} /> {t('removeQrImage')}</button></div>}</div><label className="flex items-start gap-3 rounded-2xl border border-violet/25 bg-violet/10 p-4"><input type="checkbox" checked={profileForm.tipsRequired} onChange={(e) => setProfileForm({ ...profileForm, tipsRequired: e.target.checked })} className="mt-1 h-4 w-4 accent-[#b8ff3d]" /><span><span className="block text-sm font-bold text-white/85">{t('requireTipForRequests')}</span><span className="mt-1 block text-xs leading-5 text-white/50">{t('requireTipHint')}</span></span></label><button disabled={qrLoading} className="btn-primary w-full"><Check size={17} /> {t('saveProfile')}</button></form></Modal>}{showCreate && <Modal title={t('createEvent')} onClose={() => setShowCreate(false)}><form onSubmit={createEvent} className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('eventName')} <span className="text-neon">*</span></span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder={t('newEventName')} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('contact')}</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input-dark" placeholder={t('contactPlaceholder')} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('yape')}</span><input value={form.yapeNumber} onChange={(e) => setForm({ ...form, yapeNumber: e.target.value })} className="input-dark" placeholder={t('yapePlaceholder')} /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold text-white/75">{t('guestMessage')}</span><textarea value={form.thankYou} onChange={(e) => setForm({ ...form, thankYou: e.target.value })} className="input-dark min-h-24 resize-none" placeholder={t('thanksPlaceholder')} maxLength={150} /></label><button className="btn-primary w-full"><Plus size={18} /> {t('create')}</button></form></Modal>}{preview && <Modal title={t('preview')} onClose={() => setPreview(null)}><div className="overflow-hidden rounded-2xl bg-black"><PreviewFrame track={preview} /></div><h3 className="mt-4 font-bold">{preview.title}</h3><p className="mt-1 text-sm text-white/50">{preview.artist}</p></Modal>}{paymentProof && <Modal title={t('paymentProof')} onClose={() => setPaymentProof('')}><div className="rounded-2xl bg-white p-3"><img src={paymentProof} alt={t('paymentProof')} className="mx-auto max-h-[65vh] w-full object-contain" /></div></Modal>}{downloadOptions && <Modal title={t('downloadOptionsTitle')} onClose={() => { if (drivePreview.url) URL.revokeObjectURL(drivePreview.url); setDrivePreview({ id: '', url: '', loading: false }); setDownloadOptions(null) }}><p className="mb-5 text-sm leading-6 text-white/55">{t('downloadOptionsHint')}</p><div className="space-y-3">{downloadOptions.matches.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">{t('driveNoMatches')}</p>}{downloadOptions.matches.map((file) => <article key={file.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="font-semibold text-white">{file.name}</p><p className="mt-1 text-xs text-white/45">{file.mimeType || 'Audio'}{file.size ? ` · ${Math.round(Number(file.size) / 1024 / 1024 * 10) / 10} MB` : ''}</p>{drivePreview.id === file.id && drivePreview.url && <audio className="mt-3 w-full" controls autoPlay src={drivePreview.url} />}{drivePreview.id === file.id && drivePreview.loading && <p className="mt-3 text-xs text-white/45">{t('loadingPreview')}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={() => previewDriveFile(file)} className="btn-secondary flex-1 whitespace-nowrap px-2 py-2 text-[11px] sm:px-3 sm:text-xs" disabled={drivePreview.loading}>{drivePreview.id === file.id && drivePreview.loading ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />} {drivePreview.id === file.id && drivePreview.loading ? t('loadingPreview') : t('playPreview')}</button><button type="button" onClick={() => downloadSelectedDriveFile(file)} className="btn-primary flex-1 whitespace-nowrap px-2 py-2 text-[11px] sm:px-3 sm:text-xs" disabled={Boolean(downloadingFileId)}>{downloadingFileId === file.id ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />} {downloadingFileId === file.id ? t('downloadPleaseWait') : t('downloadAudio')}</button></div></article>)}</div></Modal>}{showAdmin && access?.role === 'admin' && <AdminPanel session={access} onClose={() => setShowAdmin(false)} />}</AppShell>
}
