import { useEffect, useState } from 'react'
import { Check, Clock3, Lock, Plus, RefreshCw, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'
import { adminCreateDj, adminGetSubscriptionQr, adminListDjs, adminRegenerateCode, adminSetDjPlan, adminSetDjState, adminSetSubscriptionQr } from '../lib/supabase'
import { useLanguage } from '../lib/i18n'
import { PLAN_OPTIONS, countdownText, planPriceText } from '../lib/plans'
import LanguagePicker from './LanguagePicker'

function LiveCountdown({ expiresAt }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!expiresAt) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  return <span className={expiresAt && new Date(expiresAt).getTime() > now ? 'text-emerald-200' : 'text-red-300'}>{expiresAt ? countdownText(expiresAt, now) : 'Sin plan'}</span>
}

function planLabel(planType, t) {
  if (planType === 'fifteen') return '15 días · S/ 16.00'
  if (planType === 'monthly') return `${t('monthly')} · S/ 30.00`
  if (planType === 'annual') return `${t('annual')} · S/ 330.00`
  return t('noPlan')
}

async function qrFileToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('invalid-image')
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
  const image = await new Promise((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source })
  const maxSide = 900; const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  const result = canvas.toDataURL('image/webp', 0.86)
  if (result.length > 1200000) throw new Error('image-too-large')
  return result
}

export default function AdminPanel({ session, onClose }) {
  const { t } = useLanguage()
  const [djs, setDjs] = useState([])
  const [form, setForm] = useState({ email: '', displayName: '', planType: 'fifteen' })
  const [subscriptionQr, setSubscriptionQr] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)

  async function load() {
    try { setDjs(await adminListDjs(session.token)); setError('') } catch { setError(t('adminLoadError')) }
    try { setSubscriptionQr(await adminGetSubscriptionQr(session.token)) } catch {}
  }
  async function saveSubscriptionQr(file) {
    if (!file) return
    setQrBusy(true); setError('')
    try { const image = await qrFileToDataUrl(file); await adminSetSubscriptionQr(image, session.token); setSubscriptionQr(image); setNotice('QR de Yape para suscripciones actualizado.') } catch { setError('No se pudo guardar el QR. Usa una imagen válida y nítida.') } finally { setQrBusy(false) }
  }
  async function removeSubscriptionQr() {
    setQrBusy(true); setError('')
    try { await adminSetSubscriptionQr('', session.token); setSubscriptionQr(''); setNotice('QR de Yape eliminado.') } catch { setError('No se pudo eliminar el QR.') } finally { setQrBusy(false) }
  }
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const result = await adminCreateDj(form, session.token)
      setNotice(`${t('generatedCode')}: ${result.generatedCode} · ${result.email}`)
      setForm({ email: '', displayName: '', planType: 'fifteen' })
      await load()
    } catch { setError(t('createDjError')) } finally { setBusy(false) }
  }

  async function action(fn) {
    setBusy(true); setError('')
    try {
      const result = await fn()
      if (result?.generatedCode) setNotice(`${t('generatedCode')}: ${result.generatedCode}`)
      await load()
    } catch { setError(t('updateDjError')) } finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"><div className="mx-auto my-6 max-w-6xl rounded-[2rem] border border-white/10 bg-ink p-5 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><div><p className="eyebrow text-violet-200">{t('admin')}</p><h2 className="mt-2 font-display text-3xl font-bold">Control de suscripciones</h2><p className="mt-2 text-sm text-white/50">Autoriza correos, asigna planes y controla el tiempo restante.</p></div><div className="flex items-center gap-2"><LanguagePicker compact /><button onClick={() => action(() => adminRegenerateCode(session.dj_id, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs"><RefreshCw size={14} /> {t('regenerate')}</button><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10" aria-label={t('close')}><X size={20} /></button></div></div>
    {notice && <div className="mb-4 flex items-center gap-2 rounded-xl border border-neon/20 bg-neon/10 px-3 py-2 text-sm text-neon"><Check size={16} /> {notice}</div>}
    {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
    <div className="mb-5 grid gap-3 rounded-2xl border border-violet/20 bg-violet/10 p-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-widest text-white/45">Planes disponibles</p><p className="mt-2 font-bold text-violet-100">15 días · S/ 16.00</p><p className="font-bold text-violet-100">Mensual · S/ 30.00</p><p className="font-bold text-violet-100">Anual · S/ 330.00</p></div><div className="sm:col-span-2 flex items-center text-sm leading-6 text-white/65"><ShieldCheck size={18} className="mr-2 shrink-0 text-neon" />El acceso al catálogo privado se habilita únicamente cuando el correo está autorizado y su plan todavía está vigente.</div></div>
    <section className="mb-7 grid gap-4 rounded-2xl border border-neon/20 bg-neon/10 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-bold text-neon">QR de Yape para suscripciones</p><p className="mt-1 text-xs leading-5 text-white/55">Sube manualmente una foto del QR. Se mostrará a los DJs cuando elijan pagar por Yape.</p><label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl border border-neon/30 bg-black/20 px-4 py-2.5 text-xs font-bold text-neon hover:bg-neon/10"><Plus size={15} className="mr-2" />{qrBusy ? 'Guardando…' : 'Subir foto del QR'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={qrBusy} onChange={(e) => { saveSubscriptionQr(e.target.files?.[0]); e.target.value = '' }} className="sr-only" /></label>{subscriptionQr && <button type="button" onClick={removeSubscriptionQr} disabled={qrBusy} className="ml-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-200 hover:bg-red-400/10">Quitar QR</button>}</div>{subscriptionQr && <img src={subscriptionQr} alt="QR de Yape para suscripciones" className="h-32 w-32 rounded-xl bg-white p-2 object-contain" />}</section>
    <form onSubmit={create} className="mb-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 md:grid-cols-[1.2fr_1fr_220px_auto]"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" placeholder="dj@correo.com" aria-label={t('email')} /><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input-dark" placeholder={t('displayName')} aria-label={t('displayName')} /><select value={form.planType} onChange={(e) => setForm({ ...form, planType: e.target.value })} className="input-dark" aria-label="Plan"><option value="fifteen">15 días · S/ 16.00</option><option value="monthly">{t('monthly')} · S/ 30.00</option><option value="annual">{t('annual')} · S/ 330.00</option><option value="none">{t('noPlan')}</option></select><button disabled={busy} className="btn-primary"><Plus size={17} /> {t('createDj')}</button></form>
    <div className="space-y-3">{djs.filter((dj) => dj.role !== 'admin').map((dj) => <div key={dj.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{dj.displayName}</p><span className="break-all text-xs text-white/45">{dj.email}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${dj.isActive ? 'bg-emerald-400/15 text-emerald-200' : dj.approved ? 'bg-amber-300/15 text-amber-200' : 'bg-white/10 text-white/45'}`}>{dj.isActive ? t('active') : dj.approved ? 'Autorizado · vencido' : 'Pendiente'}</span></div><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45"><span>Plan: <strong className="text-white/70">{planLabel(dj.planType, t)}</strong></span><span className="inline-flex items-center gap-1"><Clock3 size={13} /> <LiveCountdown expiresAt={dj.planExpiresAt} /></span></p><p className="mt-1 text-[11px] text-white/35">{dj.approved ? 'Acceso autorizado' : 'Acceso no autorizado'} · {dj.daysRemaining || 0} {t('daysRemaining')}</p></div>
      <select value={dj.planType || 'none'} onChange={(e) => action(() => adminSetDjPlan(dj.id, e.target.value, session.token))} disabled={busy} className="input-dark py-2 text-xs" aria-label="Editar tiempo del plan"><option value="none">{t('noPlan')}</option>{PLAN_OPTIONS.map((plan) => <option key={plan.id} value={plan.id}>{planLabel(plan.id, t)}</option>)}</select>
      <div className="flex flex-wrap gap-2"><button onClick={() => action(() => adminSetDjState(dj.id, dj.blocked ? { approved: true, blocked: false } : dj.approved ? { approved: false, blocked: true } : { approved: true, blocked: false }, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs">{dj.blocked ? <UserCheck size={14} /> : dj.approved ? <UserX size={14} /> : <UserCheck size={14} />}{dj.blocked ? t('unblock') : dj.approved ? t('block') : 'Autorizar'}</button><button onClick={() => action(() => adminRegenerateCode(dj.id, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs" title={t('regenerate')}><RefreshCw size={14} /> <span className="hidden sm:inline">{t('regenerate')}</span></button></div>
    </div>)}{!djs.filter((dj) => dj.role !== 'admin').length && <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40"><ShieldCheck size={22} className="mx-auto mb-2 text-violet-200" />{t('noDjs')}</div>}</div>
    <p className="mt-6 flex items-center gap-2 text-xs text-white/35"><Lock size={13} /> El catálogo de Drive se entrega dentro de la aplicación y no se publica ningún enlace directo.</p>
  </div></div>
}
