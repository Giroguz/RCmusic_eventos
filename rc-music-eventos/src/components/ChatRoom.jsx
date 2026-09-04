import { useEffect, useState } from 'react'
import { MessageCircle, Send, Smile, Users, X } from 'lucide-react'
import { subscribeToEventPresence, supabase } from '../lib/supabase'

const emojis = ['🎵', '🔥', '💃', '🕺', '❤️', '👏', '😂', '🎉']

export default function ChatRoom({ eventId, role = 'attendee', onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [name, setName] = useState(() => role === 'dj' ? 'DJ' : '')
  const [online, setOnline] = useState(0)
  const [showEmojis, setShowEmojis] = useState(false)
  useEffect(() => subscribeToEventPresence(eventId, role, setOnline), [eventId, role])
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
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"><div className="glass flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem]"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><div className="flex items-center gap-2 font-display text-xl font-bold"><MessageCircle size={20} className="text-neon" /> Sala de chat</div><div className="mt-1 flex items-center gap-1 text-xs font-light text-emerald-200/80"><Users size={13} /> {online} en línea</div></div><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={20} /></button></div><div className="min-h-60 flex-1 space-y-2 overflow-y-auto p-4">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === 'dj' ? 'border border-violet-300/20 bg-violet-300/10' : 'bg-white/[.06]'}`}><p className="mb-1 text-[10px] font-semibold text-neon/80">{message.sender}</p><p className="break-words text-white/85">{message.text}</p></div>) : <div className="py-12 text-center text-sm text-white/35">Sé el primero en escribir algo 👋</div>}</div><div className="border-t border-white/10 p-3"><div className="mb-2 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="input-dark min-w-0 flex-1 px-3 py-2 text-xs" /><span className="flex items-center px-1 text-xs text-white/35">{role === 'dj' ? 'DJ' : 'Asistente'}</span></div><form onSubmit={send} className="flex gap-2"><div className="relative flex-1"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" className="input-dark w-full px-3 py-2.5 pr-10 text-sm" /><button type="button" onClick={() => setShowEmojis((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-neon"><Smile size={17} /></button>{showEmojis && <div className="absolute bottom-12 right-0 flex gap-1 rounded-xl border border-white/10 bg-ink p-2 shadow-xl">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => setText((value) => `${value}${emoji}`)} className="rounded p-1 text-lg hover:bg-white/10">{emoji}</button>)}</div>}</div><button className="btn-primary px-3" disabled={!text.trim()}><Send size={17} /></button></form></div></div></div>
}
