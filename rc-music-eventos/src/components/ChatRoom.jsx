import { useEffect, useState } from 'react'
import { MessageCircle, Send, Smile, Users, X } from 'lucide-react'
import { subscribeToEventPresence, supabase } from '../lib/supabase'
import { useLanguage } from '../lib/i18n'

import { emojis } from '../lib/emojis'

export default function ChatRoom({ eventId, role = 'attendee', onClose }) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [name, setName] = useState(() => role === 'dj' ? 'DJ' : '')
  const [online, setOnline] = useState(0)
  const [showEmojis, setShowEmojis] = useState(false)
  const [nameConfirmed, setNameConfirmed] = useState(role === 'dj')
  useEffect(() => subscribeToEventPresence(eventId, role, setOnline, 'chat'), [eventId, role])
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
    const channel = supabase.channel(`event-chat-${eventId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => setMessages((current) => [...current, payload].slice(-100)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eventId])
  async function send(e) {
    e?.preventDefault(); const clean = text.trim(); const sender = name.trim() || (role === 'dj' ? 'DJ' : 'Asistente')
    if (!clean || !supabase) return
    const channel = supabase.channel(`event-chat-${eventId}`)
    await channel.send({ type: 'broadcast', event: 'message', payload: { id: `${Date.now()}-${Math.random()}`, sender, role, text: clean } })
    setText(''); setShowEmojis(false); supabase.removeChannel(channel)
  }
  if (!nameConfirmed) return <div style={{ zIndex: 20000 }} className="chat-backdrop fixed inset-0 z-[70] grid select-none place-items-center overscroll-contain bg-black/85 p-4 backdrop-blur-sm"><div className="chat-modal w-full max-w-sm rounded-[2rem] p-6"><div className="mb-5 flex items-center gap-2 font-display text-xl font-bold"><MessageCircle size={20} className="text-neon" /> {t('chatRoom')}</div><p className="mb-4 text-sm leading-6 text-white/60">{t('chatNameHint')}</p><input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && setNameConfirmed(true)} placeholder={t('yourName')} className="input-dark w-full" /><button onClick={() => name.trim() && setNameConfirmed(true)} disabled={!name.trim()} className="btn-primary mt-4 w-full">{t('enterChat')}</button><button onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white">{t('cancel')}</button></div></div>
  return <div style={{ zIndex: 20000 }} className="chat-backdrop fixed inset-0 z-[70] flex select-none items-end justify-center overscroll-contain bg-black/85 p-3 backdrop-blur-sm sm:items-center"><div className="chat-modal flex h-[82vh] max-h-[48rem] w-full max-w-lg flex-col overflow-hidden rounded-[2rem]"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><div className="flex items-center gap-2 font-display text-xl font-bold"><MessageCircle size={20} className="text-neon" /> {t('chatRoom')}</div><div className="mt-1 flex items-center gap-1 text-xs font-light text-emerald-200/80"><Users size={13} /> {online} {t('online')}</div></div><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div><div className="chat-messages min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === 'dj' ? 'border border-violet-300/20 bg-violet-300/10' : 'bg-white/[.06]'}`}><p className="mb-1 text-[10px] font-semibold text-neon/80">{message.sender}</p><p className="break-words text-white/85">{message.text}</p></div>) : <div className="py-12 text-center text-sm text-white/35">{t('chatEmpty')} 👋</div>}</div><div className="border-t border-white/10 p-3"><form onSubmit={send} className="flex gap-2"><div className="relative flex-1"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chatPlaceholder')} className="input-dark w-full px-3 py-2.5 pr-10 text-sm" /><button type="button" onClick={() => setShowEmojis((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-neon"><Smile size={17} /></button>{showEmojis && <div className="absolute bottom-12 left-1/2 grid max-h-[min(55vh,24rem)] w-[min(92vw,320px)] -translate-x-1/2 grid-cols-6 overflow-y-auto overscroll-contain place-items-center gap-1 rounded-2xl border border-white/10 bg-ink p-2 shadow-xl">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => setText((value) => `${value}${emoji}`)} className="grid h-9 w-9 place-items-center rounded-lg p-0 text-center text-lg leading-none hover:bg-white/10">{emoji}</button>)}</div>}</div><button className="btn-primary px-3" disabled={!text.trim()}><Send size={17} /></button></form></div></div></div>
}
