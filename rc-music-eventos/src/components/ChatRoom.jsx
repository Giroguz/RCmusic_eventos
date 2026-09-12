import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Smile, Users, X } from 'lucide-react'
import { subscribeToEventPresence, supabase } from '../lib/supabase'
import { useLanguage } from '../lib/i18n'

import { emojis } from '../lib/emojis'

const CHAT_HISTORY_PREFIX = 'rc_music_chat_history_v1_'
const CHAT_NAME_PREFIX = 'rc_music_chat_name_v1_'
const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000
function loadChatHistory(eventId) {
  const now = Date.now()
  try {
    const stored = JSON.parse(localStorage.getItem(`${CHAT_HISTORY_PREFIX}${eventId}`) || 'null')
    const messages = Array.isArray(stored) ? stored : Array.isArray(stored?.messages) ? stored.messages : []
    const activeMessages = messages.filter((message) => {
      const sentAt = new Date(message.createdAt || 0).getTime()
      return Number.isFinite(sentAt) && sentAt > now - CHAT_RETENTION_MS
    })
    localStorage.setItem(`${CHAT_HISTORY_PREFIX}${eventId}`, JSON.stringify({ messages: activeMessages, lastCleanupAt: now }))
    return { messages: activeMessages, lastCleanupAt: now }
  } catch { return { messages: [], lastCleanupAt: now } }
}
function saveChatHistory(eventId, messages, lastCleanupAt = Date.now()) {
  try { localStorage.setItem(`${CHAT_HISTORY_PREFIX}${eventId}`, JSON.stringify({ messages, lastCleanupAt })) } catch {}
}
function formatChatTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function loadChatName(eventId) {
  try { return localStorage.getItem(`${CHAT_NAME_PREFIX}${eventId}`) || '' } catch { return '' }
}
function saveChatName(eventId, name) {
  try { localStorage.setItem(`${CHAT_NAME_PREFIX}${eventId}`, name) } catch {}
}
function clearChatData(eventId) {
  try {
    localStorage.removeItem(`${CHAT_HISTORY_PREFIX}${eventId}`)
    localStorage.removeItem(`${CHAT_NAME_PREFIX}${eventId}`)
  } catch {}
}

export default function ChatRoom({ eventId, role = 'attendee', onClose }) {
  const { t } = useLanguage()
  const [initialHistory] = useState(() => loadChatHistory(eventId))
  const [messages, setMessages] = useState(initialHistory.messages)
  const lastCleanupAt = useRef(initialHistory.lastCleanupAt)
  const [text, setText] = useState('')
  const [name, setName] = useState(() => role === 'dj' ? 'DJ' : loadChatName(eventId))
  const [online, setOnline] = useState(0)
  const [showEmojis, setShowEmojis] = useState(false)
  const [nameConfirmed, setNameConfirmed] = useState(() => role === 'dj' || Boolean(loadChatName(eventId)))
  const [eventFinalized, setEventFinalized] = useState(false)
  const [joinNotice, setJoinNotice] = useState('')
  const chatChannelRef = useRef(null)
  const chatChannelReadyRef = useRef(false)
  const joinAnnouncedRef = useRef('')
  const clientIdRef = useRef(`${role}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`)
  const joinNoticeTimerRef = useRef(null)
  const nameRef = useRef(name)
  const nameConfirmedRef = useRef(nameConfirmed)
  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { nameConfirmedRef.current = nameConfirmed }, [nameConfirmed])
  useEffect(() => subscribeToEventPresence(eventId, role, setOnline, 'chat', false), [eventId, role])
  function announceJoin(joinedName) {
    const clean = joinedName.trim()
    const channel = chatChannelRef.current
    if (!clean || !chatChannelReadyRef.current || joinAnnouncedRef.current === clean || !channel) return
    joinAnnouncedRef.current = clean
    channel.send({ type: 'broadcast', event: 'participant_joined', payload: { name: clean, role, clientId: clientIdRef.current } }).catch(() => {})
  }
  function showJoinNotice(joinedName) {
    const clean = joinedName.trim()
    if (!clean || clean === nameRef.current.trim()) return
    setJoinNotice(t('participantJoinedNotice').replace('{name}', clean))
    if (joinNoticeTimerRef.current) clearTimeout(joinNoticeTimerRef.current)
    joinNoticeTimerRef.current = setTimeout(() => setJoinNotice(''), 4500)
  }
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      const cleanupAt = Date.now()
      lastCleanupAt.current = cleanupAt
      setMessages((current) => {
        const next = current.filter((message) => {
          const sentAt = new Date(message.createdAt || 0).getTime()
          return Number.isFinite(sentAt) && sentAt > cleanupAt - CHAT_RETENTION_MS
        })
        saveChatHistory(eventId, next, cleanupAt)
        return next
      })
    }, 60000)
    return () => clearInterval(cleanupTimer)
  }, [eventId])
  useEffect(() => {
    saveChatHistory(eventId, messages, lastCleanupAt.current)
  }, [eventId, messages])
  useEffect(() => {
    if (!supabase || !eventId) return undefined
    let active = true
    const clearIfFinalized = async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
      if (!active || error || !data || !(data.finalized_at || data.finalized)) return
      clearChatData(eventId)
      setMessages([])
      setEventFinalized(true)
      setName(role === 'dj' ? 'DJ' : '')
      setNameConfirmed(true)
      onClose?.()
    }
    clearIfFinalized()
    const statusTimer = setInterval(clearIfFinalized, 15000)
    return () => { active = false; clearInterval(statusTimer) }
  }, [eventId, role])
  useEffect(() => {
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousOverscroll = body.style.overscrollBehavior
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    return () => {
      body.style.overflow = previousOverflow
      body.style.overscrollBehavior = previousOverscroll
    }
  }, [])
  useEffect(() => {
    if (!supabase || !eventId) return undefined
    const channel = supabase.channel(`event-chat-${eventId}`, { config: { broadcast: { self: false } } })
    chatChannelRef.current = channel
    const handleSubscription = (status) => {
      chatChannelReadyRef.current = status === 'SUBSCRIBED'
      if (status === 'SUBSCRIBED' && nameConfirmedRef.current) announceJoin(nameRef.current)
    }
    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => { if (payload?.createdAt) setMessages((current) => [...current, payload]) })
      .on('broadcast', { event: 'participant_joined' }, ({ payload }) => showJoinNotice(String(payload?.name || '')))
      .on('broadcast', { event: 'event_finalized' }, () => {
        clearChatData(eventId)
        setMessages([])
        setEventFinalized(true)
        setName(role === 'dj' ? 'DJ' : '')
        setNameConfirmed(true)
        onClose?.()
      })
      .subscribe(handleSubscription)
    return () => {
      chatChannelReadyRef.current = false
      chatChannelRef.current = null
      if (joinNoticeTimerRef.current) clearTimeout(joinNoticeTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [eventId])
  function confirmName() {
    const clean = name.trim()
    if (!clean) return
    saveChatName(eventId, clean)
    setName(clean)
    nameRef.current = clean
    setNameConfirmed(true)
    nameConfirmedRef.current = true
    announceJoin(clean)
  }
  async function send(e) {
    e?.preventDefault(); if (eventFinalized) return; const clean = text.trim(); const sender = name.trim() || (role === 'dj' ? 'DJ' : 'Asistente')
    if (!clean || !supabase || !chatChannelReadyRef.current || !chatChannelRef.current) return
    const payload = { id: `${Date.now()}-${Math.random()}`, sender, role, text: clean, createdAt: new Date().toISOString() }
    setMessages((current) => [...current, payload])
    chatChannelRef.current.send({ type: 'broadcast', event: 'message', payload }).catch(() => {})
    setText(''); setShowEmojis(false)
  }
  if (!nameConfirmed) return <div style={{ zIndex: 20000 }} className="chat-backdrop fixed inset-0 z-[70] grid select-none place-items-center overscroll-contain bg-black/85 p-4 backdrop-blur-sm"><div className="chat-modal w-full max-w-sm rounded-[2rem] p-6"><div className="mb-5 flex items-center gap-2 font-display text-xl font-bold"><MessageCircle size={20} className="text-neon" /> {t('chatRoom')}</div><p className="mb-4 text-sm leading-6 text-white/60">{t('chatNameHint')}</p><input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmName()} placeholder={t('yourName')} className="input-dark w-full" /><button onClick={confirmName} disabled={!name.trim()} className="btn-primary mt-4 w-full">{t('enterChat')}</button><button onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white">{t('cancel')}</button></div></div>
  return <div style={{ zIndex: 20000 }} className="chat-backdrop fixed inset-0 z-[70] flex select-none items-end justify-center overscroll-contain bg-black/85 p-3 backdrop-blur-sm sm:items-center"><div className="chat-modal flex h-[82vh] max-h-[48rem] w-full max-w-lg flex-col overflow-hidden rounded-[2rem]"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><div className="flex items-center gap-2 font-display text-xl font-bold"><MessageCircle size={20} className="text-neon" /> {t('chatRoom')}</div><div className="mt-1 flex items-center gap-1 text-xs font-light text-emerald-200/80"><Users size={13} /> {online} · {t('attendeesConnected')}</div></div><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div>{joinNotice && <div role="status" aria-live="polite" className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-turquoise/25 bg-turquoise/10 px-3 py-2 text-xs font-semibold text-turquoise"><Users size={15} /> {joinNotice}</div>}<div className="chat-messages min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === 'dj' ? 'border border-violet-300/20 bg-violet-300/10' : 'bg-white/[.06]'}`}><p className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold text-neon/80"><span>{message.sender}</span><time className="font-normal text-white/35" dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time></p><p className="break-words text-white/85">{message.text}</p></div>) : <div className="py-12 text-center text-sm text-white/35">{t('chatEmpty')} 👋</div>}</div>{eventFinalized ? <div className="border-t border-white/10 p-4 text-center text-sm text-amber-100/70">{t('eventFinished')}</div> : <div className="border-t border-white/10 p-3"><form onSubmit={send} className="flex gap-2"><div className="relative flex-1"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chatPlaceholder')} className="input-dark w-full px-3 py-2.5 pr-12 text-sm" /><button type="button" aria-label="Emojis" onClick={() => setShowEmojis((value) => !value)} className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-neon"><Smile size={21} strokeWidth={2.2} /></button>{showEmojis && <div className="absolute bottom-12 left-1/2 grid max-h-[min(55vh,24rem)] w-[min(92vw,320px)] -translate-x-1/2 grid-cols-6 overflow-y-auto overscroll-contain place-items-center gap-1 rounded-2xl border border-white/10 bg-ink p-2 shadow-xl">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => setText((value) => `${value}${emoji}`)} className="grid h-10 w-10 place-items-center rounded-lg p-0 text-center text-xl leading-none hover:bg-white/10">{emoji}</button>)}</div>}</div><button className="btn-primary px-3" disabled={!text.trim()}><Send size={17} /></button></form></div>} </div></div>
}
