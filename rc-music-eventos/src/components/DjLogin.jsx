import { useState } from 'react'
import { supabase, supabaseEnabled, signInDj } from '../lib/supabase'

const ADMIN_EMAIL = 'djgianfrancoromerodechosica@gmail.com'

export default function DjLogin({ onLogin, onBack }) {
 const [email, setEmail] = useState(ADMIN_EMAIL)
 const [code, setCode] = useState('')
 const [error, setError] = useState('')
 const [recoveryOpen, setRecoveryOpen] = useState(false)
 const [recoveryEmail, setRecoveryEmail] = useState(ADMIN_EMAIL)
 const [recoveryMessage, setRecoveryMessage] = useState('')

 async function submit(event) {
  event.preventDefault(); setError('')
  try { if (!supabaseEnabled) throw new Error('server'); onLogin(await signInDj(email, code)) }
  catch { setError('No se pudo iniciar sesión. Comprueba tu correo y código.') }
 }

 async function requestRecovery(event) {
  event.preventDefault(); setRecoveryMessage('')
  try {
   const normalizedEmail = recoveryEmail.trim().toLowerCase()
   if (!supabaseEnabled || !normalizedEmail || !normalizedEmail.includes('@')) throw new Error('email')
   sessionStorage.setItem('rc_pending_recovery_v1', JSON.stringify({ email: normalizedEmail }))
   const { error: sendError } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/recovery.html` } })
   if (sendError) throw sendError
   setRecoveryMessage('Te enviamos un enlace de verificación al correo indicado. Ábrelo para crear tu nueva clave.')
  } catch { setRecoveryMessage('No se pudo enviar el enlace. Verifica que el correo pertenezca a un usuario DJ autorizado.') }
 }

 return <main className="party-page min-h-screen bg-ink bg-grid px-4 py-10 text-white"><div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="eyebrow text-violet-200">Acceso privado</p><h1 className="mt-3 text-4xl font-bold">Panel DJ</h1><p className="mt-4 text-sm leading-6 text-white/55">Ingresa con tu correo aprobado y tu código personal.</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">Correo aprobado</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" /><label className="mb-2 mt-4 block text-sm font-semibold text-white/75">Código personal</label><input required value={code} onChange={(e) => setCode(e.target.value)} className="input-dark" autoComplete="one-time-code" />{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button className="btn-primary mt-5 w-full">Entrar al panel</button></form><button type="button" onClick={() => { setRecoveryOpen(true); setRecoveryMessage('') }} className="mt-4 w-full text-xs text-white/50 underline underline-offset-4 hover:text-turquoise">¿Olvidaste tu código? Recuperarlo por correo</button><button type="button" onClick={onBack} className="btn-secondary mt-4 w-full">Volver</button></div>{recoveryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onMouseDown={() => setRecoveryOpen(false)}><div className="glass w-full max-w-md rounded-[2rem] p-6" onMouseDown={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold">Crear nueva clave</h2><p className="mt-2 text-sm leading-6 text-white/55">Escribe el correo del usuario DJ y te enviaremos un enlace de verificación.</p><form onSubmit={requestRecovery} className="mt-5 space-y-3"><input required type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="input-dark" placeholder="dj@correo.com" />{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button className="btn-primary w-full">Enviar enlace de verificación</button></form></div></div>}</main>
}
