import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase, supabaseEnabled, signInDj } from '../lib/supabase'

const ADMIN_EMAIL = 'djgianfrancoromerodechosica@gmail.com'
const PLANS = [{ label: '15 días', price: 'S/ 16' }, { label: 'Mensual · 30 días', price: 'S/ 30' }, { label: 'Anual · 365 días', price: 'S/ 330' }]

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
 const [planExpired, setPlanExpired] = useState(false)
 const [showPlans, setShowPlans] = useState(false)
 const [demoOpen, setDemoOpen] = useState(false)
 const [demoName, setDemoName] = useState('')
 const [demoEmail, setDemoEmail] = useState('')
 const [demoCode, setDemoCode] = useState('')
 const [demoMessage, setDemoMessage] = useState('')
 const [demoBusy, setDemoBusy] = useState(false)

 async function submit(event) {
 event.preventDefault(); setError(''); setPlanExpired(false); setShowPlans(false)
 try { if (!supabaseEnabled) throw new Error('server'); onLogin(await signInDj(email, code)) }
 catch (err) { if (/plan expired/i.test(err?.message || '')) { setPlanExpired(true); setError('Tu período de prueba terminó. Adquiere un plan para continuar.'); return } setError('No se pudo iniciar sesión. Comprueba tu correo y código.') }
 }

 async function startDemo(event) {
 event.preventDefault(); setDemoMessage(''); setDemoBusy(true)
 try { if (!supabaseEnabled) throw new Error('server'); const { data, error: rpcError } = await supabase.rpc('dj_start_trial_two_days', { p_email: demoEmail.trim().toLowerCase(), p_display_name: demoName.trim() }); if (rpcError) throw rpcError; const result = Array.isArray(data) ? data[0] : data; setDemoCode(result.generated_code); setEmail(result.email); setCode(result.generated_code); setDemoMessage('Demo activada por 2 días. Guarda este código.') }
 catch { setDemoMessage('No se pudo generar la demo. El correo quizá ya está registrado.') }
 finally { setDemoBusy(false) }
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
 let stage = 'otp'
 try {
 const normalizedEmail = recoveryEmail.trim().toLowerCase()
 const value = newCode.trim()
 if (value.length < 8 || value.length > 64) throw new Error('length')
 const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: verificationCode.trim(), type: 'email' })
 if (verifyError) throw verifyError
 stage = 'save'
 const { error: updateError } = await supabase.rpc('dj_set_recovery_code', { p_email: normalizedEmail, p_new_code: value })
 if (updateError) throw updateError
 await supabase.auth.signOut().catch(() => {})
 setRecoveryStep('done')
 setRecoveryMessage('Clave actualizada. Ya puedes cerrar esta ventana e ingresar con la nueva clave.')
 setNewCode(''); setVerificationCode('')
 } catch {
 setRecoveryMessage(stage === 'otp' ? 'El código de verificación no fue aceptado. Solicita un código nuevo e inténtalo una sola vez.' : 'El código fue aceptado, pero la nueva clave no pudo guardarse. No solicites otro OTP todavía.')
 }
 finally { setRecoveryBusy(false) }
 }

 async function openRecovery() { setRecoveryOpen(true); setRecoveryStep('verify'); setRecoveryMessage(''); setVerificationCode(''); setNewCode(''); setRecoveryBusy(true); try { const targetEmail = email.trim().toLowerCase(); if (!supabaseEnabled || !targetEmail) throw new Error('email'); const { error: sendError } = await supabase.auth.signInWithOtp({ email: targetEmail, options: { shouldCreateUser: false } }); if (sendError) throw sendError; setRecoveryMessage('Te enviamos un código de verificación a tu correo. Escríbelo aquí para continuar.') } catch { setRecoveryStep('request'); setRecoveryMessage('Si el correo pertenece a un DJ aprobado, recibirás un código de verificación.') } finally { setRecoveryBusy(false) } }

 return <main className="party-page min-h-screen bg-ink bg-grid px-4 py-10 text-white"><div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="eyebrow text-violet-200">Acceso privado</p><h1 className="mt-3 text-4xl font-bold">Panel DJ</h1><p className="mt-4 text-sm leading-6 text-white/55">Ingresa con tu correo aprobado y tu código personal.</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">Correo aprobado</label><input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} className="input-dark" /><label className="mb-2 mt-4 block text-sm font-semibold text-white/75">Código personal</label><input required value={code} onChange={(e) => { setCode(e.target.value); setError('') }} className="input-dark" autoComplete="one-time-code" />{error && <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100"><p>{error}</p>{planExpired && <><button type="button" onClick={() => setShowPlans((value) => !value)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-turquoise px-4 py-2.5 text-xs font-bold text-ink">Adquirir un plan <ArrowRight size={15} /></button>{showPlans && <div className="mt-3 grid gap-2 sm:grid-cols-3">{PLANS.map((plan) => <div key={plan.label} className="rounded-xl border border-turquoise/25 bg-turquoise/10 p-3 text-center"><strong className="block text-sm text-turquoise">{plan.label}</strong><span className="mt-1 block text-xs text-white/70">{plan.price}</span></div>)}</div>}</>}</div>}<button className="btn-primary mt-5 w-full">Entrar al panel</button></form><button type="button" onClick={() => { setDemoOpen((value) => !value); setDemoMessage('') }} className="mt-4 w-full rounded-xl border border-turquoise/30 bg-turquoise/10 px-4 py-3 text-sm font-bold text-turquoise hover:bg-turquoise/15">Probar demo gratis · 2 días</button>{demoOpen && <div className="mt-3 rounded-2xl border border-turquoise/25 bg-black/20 p-4"><h2 className="text-xl font-bold">Demo gratuita para DJ</h2><p className="mt-1 text-xs leading-5 text-white/55">Disfruta el panel durante 2 días. Luego podrás adquirir uno de los planes disponibles.</p>{demoCode ? <div className="mt-4 rounded-xl bg-turquoise/10 p-3 text-center"><p className="text-xs text-white/55">Tu código demo</p><p className="mt-1 font-mono text-2xl font-bold tracking-widest text-turquoise">{demoCode}</p><p className="mt-2 text-xs text-white/60">{demoMessage}</p></div> : <form onSubmit={startDemo} className="mt-4 space-y-3"><input required value={demoName} onChange={(e) => setDemoName(e.target.value)} className="input-dark" placeholder="Nombre artístico" /><input required type="email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} className="input-dark" placeholder="Correo electrónico" />{demoMessage && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-200">{demoMessage}</p>}<button disabled={demoBusy} className="btn-primary w-full">{demoBusy ? 'Generando…' : 'Generar demo de 2 días'}</button></form>}</div>}<button type="button" onClick={openRecovery} className="mt-4 w-full text-xs text-white/50 underline underline-offset-4 hover:text-turquoise">¿Olvidaste tu código? Recuperarlo por correo</button><button type="button" onClick={onBack} className="btn-secondary mt-4 w-full">Volver</button></div>{recoveryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onMouseDown={() => setRecoveryOpen(false)}><div className="glass w-full max-w-md rounded-[2rem] p-6" onMouseDown={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold">Recuperar acceso</h2>{recoveryStep === 'request' && <><p className="mt-2 text-sm leading-6 text-white/55">Te enviaremos un código de verificación al correo de tu cuenta.</p><form onSubmit={requestRecovery} className="mt-5 space-y-3"><input required type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="input-dark" placeholder={ADMIN_EMAIL} />{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button disabled={recoveryBusy} className="btn-primary w-full">{recoveryBusy ? 'Enviando…' : 'Enviar código de verificación'}</button></form></>}{recoveryStep === 'verify' && <><p className="mt-2 text-sm leading-6 text-white/55">Introduce el código recibido y define tu nueva clave dentro del panel.</p><form onSubmit={changeCode} className="mt-5 space-y-3"><input required inputMode="numeric" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="input-dark" placeholder="Código de verificación" /><div className="relative"><input required minLength={8} maxLength={64} type={showNewCode ? 'text' : 'password'} value={newCode} onChange={(e) => setNewCode(e.target.value)} className="input-dark pr-20" placeholder="Nueva clave (8–64 caracteres)" /><button type="button" onClick={() => setShowNewCode((value) => !value)} className="absolute right-2 top-2 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70">{showNewCode ? 'Ocultar' : 'Mostrar'}</button></div>{recoveryMessage && <p className="rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}<button disabled={recoveryBusy} className="btn-primary w-full">{recoveryBusy ? 'Guardando…' : 'Guardar nueva clave'}</button></form></>}{recoveryStep === 'done' && <p className="mt-4 rounded-xl border border-turquoise/20 bg-turquoise/10 px-3 py-2 text-sm text-turquoise">{recoveryMessage}</p>}</div></div>}</main>
}
