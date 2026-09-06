import { useState } from 'react'
import { supabase, supabaseEnabled, signInDj } from '../lib/supabase'

const ADMIN_EMAIL = 'djgianfrancoromerodechosica@gmail.com'

export default function DjLogin({ onLogin, onBack }) {
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState('request')
  const [recoveryEmail, setRecoveryEmail] = useState(ADMIN_EMAIL)
  const [verificationCode, setVerificationCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [showNewCode, setShowNewCode] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  async function submit(event) {
    event.preventDefault(); setError('')
    try { if (!supabaseEnabled) throw new Error('server'); onLogin(await signInDj(email, code)) }
    catch { setError('No se pudo iniciar sesión. Comprueba tu correo y código.') }
  }

  async function requestRecovery(event) {
    event.preventDefault(); setRecoveryMessage(''); setRecoveryBusy(true)
    try {
      if (!supabaseEnabled || !recoveryEmail.trim()) throw new Error('email')
      const { error: sendError } = await supabase.auth.signInWithOtp({ email: recoveryEmail.trim().toLowerCase(), options: { shouldCreateUser: false } })
      if (sendError) throw sendError
      setRecoveryStep('verify')
      setRecoveryMessage('Revisa tu bandeja. Escribe aquí el código de verificación que recibiste.')
    } catch { setRecoveryMessage('Si el correo pertenece a un DJ aprobado, recibirás un código de verificación.') }
    finally { setRecoveryBusy(false) }
  }

  async function changeCode(event) {
    event.preventDefault(); setRecoveryMessage(''); setRecoveryBusy(true)
    try {
      const normalizedEmail = recoveryEmail.trim().toLowerCase()
      const value = newCode.trim()
      if (value.length < 8 || value.length > 64) throw new Error('length')
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: verificationCode.trim(), type: 'email' })
      if (verifyError) throw verifyError
      const { error: updateError } = await supabase.rpc('dj_set_code', { p_new_code: value })
      if (updateError) throw updateError
      await supabase.auth.signOut().catch(() => {})
      setRecoveryStep('done')
      setRecoveryMessage('Clave actualizada. Ya puedes cerrar esta ventana e ingresar con la nueva clave.')
      setNewCode(''); setVerificationCode('')
    } catch { setRecoveryMessage('El código no es válido o no se pudo actualizar la clave. Solicita otro código e inténtalo nuevamente.') }
    finally { setRecoveryBusy(false) }
  }

  function openRecovery() { setRecoveryOpen(true); setRecoveryStep('request'); setRecoveryMessage(''); setVerificationCode(''); setNewCode('') }

  return <main className="party-page min-h-screen bg-ink bg-grid px-4 py-10 text-white"><div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="eyebrow text-violet-200">Acceso privado</p><h1 className="mt-3 text-4xl font-bold">Panel DJ</h1><p className="mt-4 text-sm leading-6 text-white/55">Ingresa con tu correo aprobado y tu código personal.</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">Correo aprobado</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" /><label className="mb-2 mt-4 block text-sm font-semibold text-white/75">Código personal</label><input required value={code} onChange={(e) => setCode(e.target.value)} className="input-dark" autoComplete="one-time-code" />{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button className="btn-primary mt-5 w-full">Entrar al panel</button></form><button type="button" onClick={openRecovery} className="mt-4 w-full text-xs text-white/50 underline underline-offset-4 hover:text-turquoise">¿Olvidaste tu código? Recuperarlo por correo</button><button type="button" onClick={onBack} className="btn-secondary mt-4 w-full">Volver</button></div>{recoveryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onMouseDown={() => setRecoveryOpen(false)}><div className="glass w-full max-w-md rounded-[2rem] p-6" onMouseDown={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold">Recuperar acceso</h2>{recoveryStep === 'request' && <><p className="mt-2 text-sm leading-6 text-white/55">Te enviaremos un código de verificación al correo de tu cuenta.</p><form onSubmit={requestRecovery} className="mt-5 space-y-3"><input required type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="input-dark" placeholder={ADMIN_EMAIL} />{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button disabled={recoveryBusy} className="btn-primary w-full">{recoveryBusy ? 'Enviando…' : 'Enviar código de verificación'}</button></form></>}{recoveryStep === 'verify' && <><p className="mt-2 text-sm leading-6 text-white/55">Introduce el código recibido y define tu nueva clave dentro del panel.</p><form onSubmit={changeCode} className="mt-5 space-y-3"><input required inputMode="numeric" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="input-dark" placeholder="Código de verificación" /><div className="relative"><input required minLength={8} maxLength={64} type={showNewCode ? 'text' : 'password'} value={newCode} onChange={(e) => setNewCode(e.target.value)} className="input-dark pr-20" placeholder="Nueva clave (8–64 caracteres)" /><button type="button" onClick={() => setShowNewCode((value) => !value)} className="absolute right-2 top-2 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70">{showNewCode ? 'Ocultar' : 'Mostrar'}</button></div>{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button disabled={recoveryBusy} className="btn-primary w-full">{recoveryBusy ? 'Guardando…' : 'Guardar nueva clave'}</button></form></>}{recoveryStep === 'done' && <p className="mt-4 rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}</div></div>}</main>
}
