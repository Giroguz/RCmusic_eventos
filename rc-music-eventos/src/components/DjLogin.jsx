import { useEffect, useState } from 'react'
import { supabase, supabaseEnabled, sendEmailVerificationLink, signInDj } from '../lib/supabase'

const ADMIN_EMAIL = 'djgianfrancoromerodechosica@gmail.com'

export default function DjLogin({ onLogin, onBack }) {
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState(ADMIN_EMAIL)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    async function finishRecovery(session) {
      try {
        const pending = JSON.parse(sessionStorage.getItem('rc_pending_recovery_v1') || 'null')
        if (!pending || session?.user?.email?.toLowerCase() !== pending.email || !session.user.email_confirmed_at) return
        const { data, error: rpcError } = await supabase.rpc('dj_recover_admin_code')
        if (rpcError) throw rpcError
        if (!active) return
        const result = Array.isArray(data) ? data[0] : data
        sessionStorage.removeItem('rc_pending_recovery_v1')
        setRecoveryCode(result.generated_code)
        setRecoveryEmail(pending.email)
        setRecoveryMessage('Código nuevo generado. Guárdalo en un lugar seguro.')
      } catch {
        if (active) setRecoveryMessage('No se pudo regenerar el código. Verifica el enlace e inténtalo otra vez.')
      }
    }
    supabase.auth.getSession().then(({ data }) => finishRecovery(data.session)).catch(() => {})
    const { data } = supabase.auth.onAuthStateChange((_, session) => finishRecovery(session))
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  async function submit(event) {
    event.preventDefault(); setError('')
    try {
      if (!supabaseEnabled) throw new Error('server')
      onLogin(await signInDj(email, code))
    } catch { setError('No se pudo iniciar sesión. Comprueba tu correo y código.') }
  }

  async function requestRecovery(event) {
    event.preventDefault(); setRecoveryMessage('')
    try {
      if (!supabaseEnabled || recoveryEmail.trim().toLowerCase() !== ADMIN_EMAIL) throw new Error('email')
      sessionStorage.setItem('rc_pending_recovery_v1', JSON.stringify({ email: ADMIN_EMAIL }))
      await sendEmailVerificationLink(ADMIN_EMAIL)
      setRecoveryMessage('Te enviamos un enlace de verificación. Ábrelo en tu correo para generar el código nuevo.')
    } catch { setRecoveryMessage('La recuperación solo está disponible para el correo administrador aprobado.') }
  }

  return <main className="party-page min-h-screen bg-ink bg-grid px-4 py-10 text-white"><div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="eyebrow text-violet-200">Acceso privado</p><h1 className="mt-3 text-4xl font-bold">Panel DJ</h1><p className="mt-4 text-sm leading-6 text-white/55">Ingresa con tu correo aprobado y tu código personal.</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">Correo aprobado</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" /><label className="mb-2 mt-4 block text-sm font-semibold text-white/75">Código personal</label><input required value={code} onChange={(e) => setCode(e.target.value)} className="input-dark" autoComplete="one-time-code" />{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button className="btn-primary mt-5 w-full">Entrar al panel</button></form><button type="button" onClick={() => { setRecoveryOpen(true); setRecoveryCode(''); setRecoveryMessage('') }} className="mt-4 w-full text-xs text-white/50 underline underline-offset-4 hover:text-turquoise">¿Olvidaste tu código? Recuperarlo por correo</button><button type="button" onClick={onBack} className="btn-secondary mt-4 w-full">Volver</button></div>{recoveryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onMouseDown={() => setRecoveryOpen(false)}><div className="glass w-full max-w-md rounded-[2rem] p-6" onMouseDown={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold">Recuperar código</h2><p className="mt-2 text-sm leading-6 text-white/55">Verifica el correo administrador y generaremos un código nuevo. El anterior dejará de funcionar.</p>{recoveryCode ? <div className="mt-5 rounded-2xl border border-turquoise/30 bg-turquoise/10 p-4 text-center"><p className="text-xs text-white/55">Nuevo código</p><p className="mt-2 font-mono text-2xl font-bold tracking-[.12em] text-turquoise">{recoveryCode}</p><p className="mt-3 text-xs text-white/55">{recoveryMessage}</p><button type="button" onClick={() => { setCode(recoveryCode); setRecoveryOpen(false) }} className="btn-primary mt-4 w-full">Usar este código</button></div> : <form onSubmit={requestRecovery} className="mt-5 space-y-3"><input required type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="input-dark" placeholder={ADMIN_EMAIL} />{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button className="btn-primary w-full">Enviar enlace de recuperación</button></form>}</div></div>}</main>
}
