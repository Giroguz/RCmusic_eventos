import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Headphones, KeyRound, LoaderCircle, Mail, ShieldCheck, Upload } from 'lucide-react'
import { Brand, PageContainer } from './Brand'
import LanguagePicker from './LanguagePicker'
import { getStoredDjSession, getSubscriptionQr, getSubscriptionYapeNumber, sendEmailVerificationLink, signInDj, startDjTrial, submitSubscriptionProof, supabase, supabaseEnabled } from '../lib/supabase'
// Yape subscription number is loaded from the admin-controlled settings.
import { useLanguage } from '../lib/i18n'
import { PLAN_OPTIONS, planPriceText } from '../lib/plans'

const REGION_CURRENCIES = { PE: 'PEN', US: 'USD', CA: 'CAD', MX: 'MXN', CO: 'COP', CL: 'CLP', BR: 'BRL', AR: 'ARS', ES: 'EUR', GB: 'GBP' }

async function proofFileToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('invalid-image')
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
  const image = await new Promise((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source })
  const maxSide = 1000; const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  const result = canvas.toDataURL('image/webp', 0.84)
  if (result.length > 1500000) throw new Error('image-too-large')
  return result
}

function PlanCards({ token, email, code }) {
  const sessionToken = token || getStoredDjSession()?.token
  const [currency, setCurrency] = useState('PEN')
  const [rate, setRate] = useState(1)
  const [subscriptionQr, setSubscriptionQr] = useState('')
  const [yapeNumber, setYapeNumber] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [proofImage, setProofImage] = useState('')
  const [proofName, setProofName] = useState('')
  const [proofBusy, setProofBusy] = useState(false)
  const [proofMessage, setProofMessage] = useState('')
  useEffect(() => {
    const region = String(navigator.language || '').split('-')[1]?.toUpperCase()
    const target = REGION_CURRENCIES[region] || 'PEN'
    if (target === 'PEN') return undefined
    let active = true
    fetch('https://open.er-api.com/v6/latest/PEN').then((response) => response.json()).then((data) => {
      const nextRate = Number(data?.rates?.[target])
      if (active && Number.isFinite(nextRate) && nextRate > 0) { setCurrency(target); setRate(nextRate) }
    }).catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => { Promise.all([getSubscriptionQr(), getSubscriptionYapeNumber()]).then(([qr, number]) => { setSubscriptionQr(qr); setYapeNumber(number) }).catch(() => {}) }, [])
  async function selectProof(file) {
    if (!file) return
    setProofBusy(true); setProofMessage('')
    try { setProofImage(await proofFileToDataUrl(file)); setProofName(file.name) } catch { setProofMessage('No se pudo leer la imagen. Usa una foto clara y menor de 1.5 MB.') } finally { setProofBusy(false) }
  }
  async function sendProof() {
  if (!selectedPlan || !proofImage) {
    setProofMessage('Selecciona un plan y sube la foto del comprobante.')
    return
  }

  setProofBusy(true)
  setProofMessage('')

  try {
    let currentToken = sessionToken

    if (!currentToken && email && code && supabase) {
      const { data, error } = await supabase.rpc(
        'submit_subscription_proof_by_code',
        {
          p_email: email.trim().toLowerCase(),
          p_code: code,
          p_plan_type: selectedPlan,
          p_proof_image: proofImage,
        }
      )

      if (error) throw error

      setProofMessage(
        'Comprobante enviado. El desarrollador revisará el pago y activará tu plan.'
      )
      setProofImage('')
      return
    }

    if (!currentToken) {
      setProofMessage(
        'Vuelve a ingresar con tu código para enviar el comprobante.'
      )
      return
    }

    await submitSubscriptionProof(
      selectedPlan,
      proofImage,
      currentToken
    )

    setProofMessage(
      'Comprobante enviado. El desarrollador revisará el pago y activará tu plan.'
    )
    setProofImage('')
  } catch {
    setProofMessage(
      'No se pudo enviar el comprobante. Inténtalo nuevamente.'
    )
  } finally {
    setProofBusy(false)
  }
}

  return <div className="mt-4"><p className="mb-2 text-[11px] text-white/45">Precios base en Perú · conversión orientativa según la región del navegador</p>{subscriptionQr && <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-3 text-left text-ink"><img src={subscriptionQr} alt="QR de Yape para suscripciones" className="h-24 w-24 rounded-lg object-contain" /><div><strong className="block text-sm">Paga con Yape</strong>{yapeNumber && <span className="mt-1 block text-xs font-bold text-ink/75">Número: {yapeNumber}</span>}<span className="mt-1 block text-xs text-ink/60">Escanea el QR o usa el número y luego sube aquí tu comprobante.</span></div></div>}<div className="grid gap-2 sm:grid-cols-3">{PLAN_OPTIONS.map((plan) => <button type="button" key={plan.id} onClick={() => { setSelectedPlan(plan.id); setProofMessage('') }} className={`rounded-xl border p-3 text-center transition ${selectedPlan === plan.id ? 'border-turquoise bg-turquoise/20' : 'border-turquoise/25 bg-turquoise/10 hover:border-turquoise/60'}`}><strong className="block text-sm text-turquoise">{plan.label}</strong><span className="mt-1 block text-xs text-white/70">{planPriceText(plan, currency, rate)}</span></button>)}</div><div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-bold text-white/75">{selectedPlan ? `Plan elegido: ${PLAN_OPTIONS.find((plan) => plan.id === selectedPlan)?.label}` : '1. Elige el plan que pagaste'}</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-turquoise/30 bg-turquoise/10 px-3 py-2.5 text-xs font-bold text-turquoise hover:bg-turquoise/15"><Upload size={15} />{proofBusy ? 'Procesando…' : '2. Subir comprobante'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={proofBusy} onChange={(e) => { selectProof(e.target.files?.[0]); e.target.value = '' }} className="sr-only" /></label>{proofName && <span className="ml-2 text-xs text-white/50">{proofName}</span>}{proofImage && <img src={proofImage} alt="Vista previa del comprobante" className="mt-3 max-h-40 w-full rounded-lg bg-white object-contain p-1" />}<button type="button" onClick={sendProof} disabled={proofBusy || !proofImage || !selectedPlan} className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40">{proofBusy ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}3. Enviar comprobante</button>{proofMessage && <p className="mt-2 text-xs leading-5 text-turquoise">{proofMessage}</p>}</div></div>
}

export default function DjLogin({ onLogin, onBack }) {
  const { t, language } = useLanguage(); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [planExpired, setPlanExpired] = useState(false); const [expiredSession, setExpiredSession] = useState(null); const [showTrial, setShowTrial] = useState(false); const [trialName, setTrialName] = useState(''); const [trialEmail, setTrialEmail] = useState(''); const [trialCode, setTrialCode] = useState(''); const [trialError, setTrialError] = useState('')
  async function requestTrial(e) {
    e.preventDefault(); setTrialError('')
    try { if (!supabaseEnabled) throw new Error('SUPABASE_REQUIRED'); sessionStorage.setItem('rc_pending_trial_v1', JSON.stringify({ email: trialEmail.trim().toLowerCase(), displayName: trialName.trim() })); await sendEmailVerificationLink(trialEmail); setTrialError('Te enviamos un enlace de verificación. Ábrelo en tu correo y vuelve a esta página para generar tu demo.') }
    catch (err) { setTrialError(err?.message === 'SUPABASE_REQUIRED' ? t('supabaseRequired') : t('trialUnavailable')) }
  }

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    const finishVerifiedTrial = async (session) => {
      try {
        const pending = JSON.parse(sessionStorage.getItem('rc_pending_trial_v1') || 'null')
        if (!pending || !session?.user?.email || session.user.email.toLowerCase() !== pending.email || !session.user.email_confirmed_at) return
        const result = await startDjTrial(pending.email, pending.displayName)
        if (!active) return
        sessionStorage.removeItem('rc_pending_trial_v1'); setTrialCode(result.generated_code); setEmail(pending.email); setCode(result.generated_code); setTrialError('Correo verificado. Tu demo está lista.')
      } catch {}
    }
    supabase.auth.getSession().then(({ data }) => finishVerifiedTrial(data.session)).catch(() => {})
    const { data } = supabase.auth.onAuthStateChange((_, session) => { finishVerifiedTrial(session) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  async function submit(e) {
    e.preventDefault(); setError(''); setPlanExpired(false); setExpiredSession(null)
    try { if (!supabaseEnabled) throw new Error('SUPABASE_REQUIRED'); onLogin(await signInDj(email, code)) }
    catch (err) { const message = String(err?.message || '').toLowerCase(); const expired = message.includes('plan expired') || message.includes('plan venc'); const access = expired ? err?.access || null : null; if (access) { try { sessionStorage.setItem('rc_music_dj_session_v1', JSON.stringify(access)) } catch {} } setPlanExpired(expired); setExpiredSession(access); setError(err?.message === 'SUPABASE_REQUIRED' ? t('supabaseRequired') : expired ? t('planExpired') : t('loginError')) }
  }
  return <div className="party-page min-h-screen bg-ink bg-grid"><PageContainer className="flex min-h-screen flex-col"><div className="flex items-center justify-between"><Brand /><div className="flex items-center gap-2"><LanguagePicker /><button onClick={onBack} className="btn-secondary shrink-0 p-2.5" aria-label={t('back')} title={t('back')}><ArrowLeft size={18} /></button></div></div><div className="flex flex-1 items-center justify-center py-14"><div className="w-full max-w-md"><div className="mb-8 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-violet/20 text-violet-200"><Headphones size={30} /></div><p className="eyebrow text-violet-200">{t('djAccess')}</p><h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('djHeading')}</h1><p className="mt-4 text-sm leading-6 text-white/55">{t('djDescription')}</p></div><form onSubmit={submit} className="glass rounded-[2rem] p-5 sm:p-7"><label className="mb-2 block text-sm font-semibold text-white/75">{t('email')}</label><div className="relative"><Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input autoFocus required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); setPlanExpired(false) }} className="input-dark pl-11" placeholder={t('emailPlaceholder')} autoComplete="username" /></div><label className="mb-2 mt-4 block text-sm font-semibold text-white/75">{t('accessCode')}</label><div className="relative"><KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input required type={show ? 'text' : 'password'} value={code} onChange={(e) => { setCode(e.target.value); setError(''); setPlanExpired(false) }} className="input-dark pl-11 pr-12" placeholder="Código personal" autoComplete="one-time-code" /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 hover:text-white" aria-label={show ? 'Ocultar código' : 'Mostrar código'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200"><p>{error}</p>{planExpired && <><p className="mt-3 font-semibold text-white/80">Elige el plan que deseas contratar:</p><PlanCards token={expiredSession?.token} email={email} code={code} /></>}</div>}<button className="btn-primary mt-5 w-full">{t('enter')} <ArrowRight size={18} /></button><div className="mt-5 flex items-center gap-2 text-xs text-white/35"><ShieldCheck size={14} className="text-violet-300" /> {t('codeHint')}</div></form><button type="button" onClick={() => { setShowTrial(true); setTrialError(''); setTrialCode('') }} className="mt-4 w-full rounded-xl border border-turquoise/30 bg-turquoise/10 px-4 py-3 text-sm font-bold text-turquoise hover:bg-turquoise/15">{language === 'en' ? 'Try free demo · 1 day' : 'Probar demo gratis · 1 día'}</button></div></div>{showTrial && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={() => setShowTrial(false)}><div className="glass w-full max-w-md rounded-[2rem] p-6" onMouseDown={(e) => e.stopPropagation()}><h2 className="font-display text-2xl font-bold">{t('demoTitle')}</h2><p className="mt-2 text-sm leading-6 text-white/55">{language === 'en' ? 'Generate a trial code valid for 1 day. After that it expires until your account is approved or you choose a plan.' : 'Genera un código de prueba válido durante 1 día. Después quedará obsoleto hasta que se autorice tu cuenta o contrates un plan.'}</p>{trialCode ? <div className="mt-5 rounded-2xl border border-turquoise/30 bg-turquoise/10 p-4 text-center"><p className="text-xs text-white/55">{t('demoCodeLabel')}</p><p className="mt-2 font-mono text-3xl font-bold tracking-[.18em] text-turquoise">{trialCode}</p><p className="mt-3 text-xs text-white/55">{language === 'en' ? 'Valid for 1 day and shown only once.' : 'Válido por 1 día y se muestra una sola vez.'}</p><button type="button" onClick={() => setShowTrial(false)} className="btn-primary mt-4 w-full">{t('useDemoCode')}</button></div> : <form onSubmit={requestTrial} className="mt-5 space-y-3"><input required value={trialName} onChange={(e) => setTrialName(e.target.value)} className="input-dark" placeholder={t('demoNamePlaceholder')} /><input required type="email" value={trialEmail} onChange={(e) => setTrialEmail(e.target.value)} className="input-dark" placeholder={t('emailPlaceholder')} />{trialError && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{trialError}</p>}<button className="btn-primary w-full">{t('generateDemoCode')}</button></form>}</div></div>}</PageContainer></div>
}
