import { useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Headphones, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Brand, PageContainer } from './Brand'
import { signInDj, supabaseEnabled } from '../lib/supabase'

export default function DjLogin({ onLogin, onBack }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const accessKey = import.meta.env.VITE_DJ_ACCESS_KEY || 'rcdj2026'

  async function submit(e) {
    e.preventDefault()
    try {
      if (supabaseEnabled) {
        const email = import.meta.env.VITE_SUPABASE_DJ_EMAIL
        if (!email) throw new Error('Falta VITE_SUPABASE_DJ_EMAIL')
        await signInDj(email, password)
      } else if (password !== accessKey) {
        throw new Error('Clave incorrecta')
      }
      onLogin()
    } catch {
      setError(supabaseEnabled ? 'No se pudo iniciar sesión. Comprueba tu correo y contraseña.' : 'Clave incorrecta. Revisa la clave de acceso del DJ.')
    }
  }

  return <div className="min-h-screen bg-ink bg-grid"><PageContainer className="flex min-h-screen flex-col"><div className="flex items-center justify-between"><Brand /><button onClick={onBack} className="btn-secondary px-3 py-2 text-sm"><ArrowLeft size={16} /> Volver</button></div><div className="flex flex-1 items-center justify-center py-14"><div className="w-full max-w-md"><div className="mb-8 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-violet/20 text-violet-200"><Headphones size={30} /></div><p className="eyebrow text-violet-200">Acceso privado</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Panel de DJ.</h1><p className="mt-4 text-sm leading-6 text-white/55">Controla la cola, crea eventos y mantén el ritmo sin perderte ningún pedido.</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">Clave de acceso</label><div className="relative"><LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input autoFocus required type={show ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} className="input-dark pl-11 pr-12" placeholder="Escribe tu clave" /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 hover:text-white">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button className="btn-primary mt-5 w-full">Entrar al panel <ArrowRight size={18} /></button><div className="mt-5 flex items-center gap-2 text-xs text-white/35"><ShieldCheck size={14} className="text-violet-300" /> Demo: <strong className="text-white/65">rcdj2026</strong></div></form></div></div></PageContainer></div>
}
