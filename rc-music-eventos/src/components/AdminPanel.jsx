import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Clock3, Crown, FileCheck2, Gauge, Lock, Plus, RefreshCw, Search, ShieldCheck, UserCheck, UserX, UsersRound, WalletCards, X, XCircle } from 'lucide-react'
import { adminCreateDj, adminExtendDjPlan, adminGetSubscriptionPlanPrices, adminGetSubscriptionQr, adminGetSubscriptionYapeNumber, adminListDjs, adminListSubscriptionProofs, adminRegenerateCode, adminReviewSubscriptionProof, adminSetDjPlan, adminSetDjState, adminSetSubscriptionPlanPrices, adminSetSubscriptionQr, adminSetSubscriptionYapeNumber } from '../lib/supabase'
import { useLanguage } from '../lib/i18n'
import { PLAN_OPTIONS, countdownText, mergePlanOptions, planPriceText } from '../lib/plans'
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

function planLabel(planType, t, plans = PLAN_OPTIONS) {
  const plan = plans.find((item) => item.id === planType)
  if (plan) return `${plan.label} · S/ ${Number(plan.pricePen).toFixed(2)}`
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
  const [proofs, setProofs] = useState([])
  const [form, setForm] = useState({ email: '', displayName: '', planType: 'fifteen' })
  const [subscriptionQr, setSubscriptionQr] = useState('')
  const [yapeNumber, setYapeNumber] = useState('')
  const [yapeNumberDraft, setYapeNumberDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [proofBusy, setProofBusy] = useState(false)
  const [planOptions, setPlanOptions] = useState(PLAN_OPTIONS)
  const [priceDraft, setPriceDraft] = useState(() => Object.fromEntries(PLAN_OPTIONS.map((plan) => [plan.id, { days: plan.days, pricePen: plan.pricePen }])))
  const [pricesBusy, setPricesBusy] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [extendDays, setExtendDays] = useState({})

  async function load() {
    try { setDjs(await adminListDjs(session.token)); setError('') } catch { setError(t('adminLoadError')) }
    try { setProofs(await adminListSubscriptionProofs(session.token)) } catch {}

    try { setSubscriptionQr(await adminGetSubscriptionQr(session.token)) } catch {}
    try { const number = await adminGetSubscriptionYapeNumber(session.token); setYapeNumber(number); setYapeNumberDraft(number) } catch {}
    try {
      const prices = mergePlanOptions(await adminGetSubscriptionPlanPrices(session.token))
      setPlanOptions(prices)
      setPriceDraft(Object.fromEntries(prices.map((plan) => [plan.id, { days: plan.days, pricePen: plan.pricePen }])))
    } catch {}
  }

  async function savePlanPrices() {
    setPricesBusy(true); setError('')
    try {
      const saved = mergePlanOptions(await adminSetSubscriptionPlanPrices(Object.entries(priceDraft).map(([planType, values]) => ({ planType, ...values })), session.token))
      setPlanOptions(saved)
      setPriceDraft(Object.fromEntries(saved.map((plan) => [plan.id, { days: plan.days, pricePen: plan.pricePen }])))
      setNotice('Precios y duración de planes actualizados.')
    } catch { setError('No se pudo guardar la configuración de planes.') } finally { setPricesBusy(false) }
  }
  async function saveYapeNumber() {
    setQrBusy(true); setError('')
    try { const number = yapeNumberDraft.trim(); await adminSetSubscriptionYapeNumber(number, session.token); setYapeNumber(number); setYapeNumberDraft(number); setNotice('Número de Yape actualizado.') } catch { setError('No se pudo guardar el número de Yape.') } finally { setQrBusy(false) }
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
  async function reviewProof(id, status) {
    setProofBusy(true); setError('')
    try { await adminReviewSubscriptionProof(id, status, status === 'approved' ? 'Pago verificado por el desarrollador.' : 'Comprobante rechazado por el desarrollador.', session.token); setNotice(status === 'approved' ? 'Pago aprobado y plan activado.' : 'Comprobante rechazado.'); await load() } catch { setError('No se pudo actualizar el comprobante.') } finally { setProofBusy(false) }
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

  async function extendPlan(dj) {
    const days = Number(extendDays[dj.id] || 0)
    if (!days) return
    await action(() => adminExtendDjPlan(dj.id, days, session.token))
    setExtendDays((current) => ({ ...current, [dj.id]: '' }))
  }

  const pendingProofs = proofs.filter((proof) => proof.status === 'pending').length
  const activeDjs = djs.filter((dj) => dj.role !== 'admin' && dj.isActive).length
  const pendingDjs = djs.filter((dj) => dj.role !== 'admin' && !dj.approved).length
  const visibleDjs = djs.filter((dj) => dj.role !== 'admin' && `${dj.displayName} ${dj.email}`.toLowerCase().includes(userSearch.trim().toLowerCase()))

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"><div className="mx-auto my-6 max-w-6xl rounded-[2rem] border border-white/10 bg-ink p-5 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100"><Crown size={24} /></div><div><p className="eyebrow text-violet-200">Desarrollador</p><h2 className="mt-2 font-display text-3xl font-bold">Centro de gestión</h2><p className="mt-2 text-sm text-white/50">Usuarios, planes, solicitudes, precios y acceso al catálogo privado.</p></div></div><div className="flex items-center gap-2"><LanguagePicker compact /><button onClick={() => action(() => adminRegenerateCode(session.dj_id, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs"><RefreshCw size={14} /> {t('regenerate')}</button><button onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10" aria-label={t('close')}><X size={20} /></button></div></div>
    {notice && <div className="mb-4 flex items-center gap-2 rounded-xl border border-neon/20 bg-neon/10 px-3 py-2 text-sm text-neon"><Check size={16} /> {notice}</div>}
    {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
    <div className="mb-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><UsersRound size={18} className="text-violet-200" /><p className="mt-3 text-2xl font-bold">{djs.filter((dj) => dj.role !== 'admin').length}</p><p className="mt-1 text-xs text-white/45">Usuarios DJ</p></div><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.06] p-4"><Gauge size={18} className="text-emerald-200" /><p className="mt-3 text-2xl font-bold text-emerald-100">{activeDjs}</p><p className="mt-1 text-xs text-white/45">Planes activos</p></div><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4"><UserCheck size={18} className="text-amber-100" /><p className="mt-3 text-2xl font-bold text-amber-100">{pendingDjs}</p><p className="mt-1 text-xs text-white/45">Por autorizar</p></div><div className="rounded-2xl border border-turquoise/15 bg-turquoise/[.06] p-4"><WalletCards size={18} className="text-turquoise" /><p className="mt-3 text-2xl font-bold text-turquoise">{pendingProofs}</p><p className="mt-1 text-xs text-white/45">Solicitudes pendientes</p></div></div>
    <div className="mb-5 grid gap-3 rounded-2xl border border-violet/20 bg-violet/10 p-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-widest text-white/45">Planes disponibles</p>{planOptions.map((plan) => <p key={plan.id} className="mt-2 font-bold text-violet-100">{plan.label} · S/ {Number(plan.pricePen).toFixed(2)} · {plan.days} días</p>)}</div><div className="sm:col-span-2 flex items-center text-sm leading-6 text-white/65"><ShieldCheck size={18} className="mr-2 shrink-0 text-neon" />El acceso al catálogo privado se habilita únicamente cuando el correo está autorizado y su plan todavía está vigente.</div></div>
    <section className="mb-7 grid gap-4 rounded-2xl border border-neon/20 bg-neon/10 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-bold text-neon">QR de Yape para suscripciones</p><p className="mt-1 text-xs leading-5 text-white/55">Sube manualmente una foto del QR. Se mostrará a los DJs cuando elijan pagar por Yape.</p><div className="mt-3 flex flex-wrap items-center gap-2"><input value={yapeNumberDraft} onChange={(e) => setYapeNumberDraft(e.target.value)} inputMode="numeric" placeholder="Número de Yape" className="w-44 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-neon/50" /><button type="button" onClick={saveYapeNumber} disabled={qrBusy} className="rounded-xl bg-neon px-3 py-2.5 text-xs font-bold text-ink hover:brightness-110">Guardar número</button></div><label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl border border-neon/30 bg-black/20 px-4 py-2.5 text-xs font-bold text-neon hover:bg-neon/10"><Plus size={15} className="mr-2" />{qrBusy ? 'Guardando…' : 'Subir foto del QR'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={qrBusy} onChange={(e) => { saveSubscriptionQr(e.target.files?.[0]); e.target.value = '' }} className="sr-only" /></label>{subscriptionQr && <button type="button" onClick={removeSubscriptionQr} disabled={qrBusy} className="ml-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-200 hover:bg-red-400/10">Quitar QR</button>}</div>{subscriptionQr && <img src={subscriptionQr} alt="QR de Yape para suscripciones" className="h-32 w-32 rounded-xl bg-white p-2 object-contain" />}</section>
    <section className="mb-7 rounded-2xl border border-violet-300/20 bg-violet-300/[.06] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-bold text-violet-100"><WalletCards size={17} /> Precios y duración</p><p className="mt-1 text-xs leading-5 text-white/55">Configura cuánto cuesta cada plan y cuántos días agrega al acceso.</p></div><button type="button" onClick={savePlanPrices} disabled={pricesBusy} className="btn-primary px-3 py-2 text-xs">{pricesBusy ? 'Guardando…' : 'Guardar planes'}</button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{planOptions.map((plan) => <div key={plan.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="font-bold text-white">{plan.label}</p><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-white/45">Días<input type="number" min="1" max="3650" value={priceDraft[plan.id]?.days || ''} onChange={(e) => setPriceDraft((current) => ({ ...current, [plan.id]: { ...current[plan.id], days: e.target.value } }))} className="input-dark mt-1 px-3 py-2 text-sm" /></label><label className="text-[11px] text-white/45">Precio S/<input type="number" min="0" step="0.01" value={priceDraft[plan.id]?.pricePen || ''} onChange={(e) => setPriceDraft((current) => ({ ...current, [plan.id]: { ...current[plan.id], pricePen: e.target.value } }))} className="input-dark mt-1 px-3 py-2 text-sm" /></label></div></div>)}</div></section>
    <section className="mb-7 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-bold text-amber-100"><FileCheck2 size={17} /> Comprobantes de pago</p><p className="mt-1 text-xs leading-5 text-white/55">Revisa el comprobante antes de activar el plan del DJ.</p></div><span className="rounded-full bg-amber-200/15 px-2.5 py-1 text-xs font-bold text-amber-100">{proofs.filter((proof) => proof.status === 'pending').length} pendientes</span></div><div className="mt-4 space-y-3">{proofs.filter((proof) => proof.status === 'pending').map((proof) => <article key={proof.id} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center"><img src={proof.proof_image} alt="Comprobante de pago" className="h-28 w-full rounded-xl bg-white object-contain p-1 sm:w-28" /><div className="min-w-0"><p className="font-bold text-white">{proof.display_name || 'DJ'}</p><p className="break-all text-xs text-white/50">{proof.email}</p><p className="mt-2 text-sm text-amber-100">Plan solicitado: <strong>{planLabel(proof.plan_type, t, planOptions)}</strong></p><p className="mt-1 text-[11px] text-white/40">Enviado: {new Date(proof.submitted_at).toLocaleString()}</p></div><div className="flex flex-wrap gap-2 sm:flex-col"><button type="button" onClick={() => reviewProof(proof.id, 'approved')} disabled={proofBusy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-ink hover:bg-emerald-200"><CheckCircle2 size={15} /> Aprobar y activar</button><button type="button" onClick={() => reviewProof(proof.id, 'rejected')} disabled={proofBusy} className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-300/25 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-400/20"><XCircle size={15} /> Rechazar</button></div></article>)}{!proofs.some((proof) => proof.status === 'pending') && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/40">No hay comprobantes pendientes.</p>}</div></section>
    <form onSubmit={create} className="mb-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 md:grid-cols-[1.2fr_1fr_220px_auto]"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" placeholder="dj@correo.com" aria-label={t('email')} /><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input-dark" placeholder={t('displayName')} aria-label={t('displayName')} /><select value={form.planType} onChange={(e) => setForm({ ...form, planType: e.target.value })} className="input-dark" aria-label="Plan">{planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.label} · S/ {Number(plan.pricePen).toFixed(2)}</option>)}<option value="none">{t('noPlan')}</option></select><button disabled={busy} className="btn-primary"><Plus size={17} /> {t('createDj')}</button></form>
    <div className="mb-3 flex items-center gap-2"><Search size={16} className="text-white/35" /><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="input-dark py-2.5 text-sm" placeholder="Buscar usuario por nombre o correo" /></div><div className="space-y-3">{visibleDjs.map((dj) => <div key={dj.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{dj.displayName}</p><span className="break-all text-xs text-white/45">{dj.email}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${dj.isActive ? 'bg-emerald-400/15 text-emerald-200' : dj.approved ? 'bg-amber-300/15 text-amber-200' : 'bg-white/10 text-white/45'}`}>{dj.isActive ? t('active') : dj.approved ? 'Autorizado · vencido' : 'Pendiente'}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${dj.emailVerified || dj.email_verified ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/15 text-amber-100'}`}>{dj.emailVerified || dj.email_verified ? '✓ Correo verificado' : 'Correo pendiente'}</span></div><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45"><span>Plan: <strong className="text-white/70">{planLabel(dj.planType, t, planOptions)}</strong></span><span className="inline-flex items-center gap-1"><Clock3 size={13} /> <LiveCountdown expiresAt={dj.planExpiresAt} /></span></p><p className="mt-1 text-[11px] text-white/35">{dj.approved ? 'Acceso autorizado' : 'Acceso no autorizado'} · {dj.daysRemaining || 0} {t('daysRemaining')}</p></div>
      <div className="space-y-2"><select value={dj.planType || 'none'} onChange={(e) => action(() => adminSetDjPlan(dj.id, e.target.value, session.token))} disabled={busy} className="input-dark py-2 text-xs" aria-label="Editar tiempo del plan"><option value="none">{t('noPlan')}</option>{planOptions.map((plan) => <option key={plan.id} value={plan.id}>{planLabel(plan.id, t, planOptions)}</option>)}</select><div className="flex gap-2"><input type="number" min="1" max="3650" value={extendDays[dj.id] || ''} onChange={(e) => setExtendDays((current) => ({ ...current, [dj.id]: e.target.value }))} className="input-dark min-w-0 px-3 py-2 text-xs" placeholder="Días extra" /><button type="button" onClick={() => extendPlan(dj)} disabled={busy || !extendDays[dj.id]} className="btn-secondary shrink-0 px-3 py-2 text-xs">+ tiempo</button></div></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => action(() => adminSetDjState(dj.id, dj.blocked ? { approved: true, blocked: false } : dj.approved ? { approved: false, blocked: true } : { approved: true, blocked: false }, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs">{dj.blocked ? <UserCheck size={14} /> : dj.approved ? <UserX size={14} /> : <UserCheck size={14} />}{dj.blocked ? t('unblock') : dj.approved ? t('block') : 'Autorizar'}</button><button onClick={() => action(() => adminRegenerateCode(dj.id, session.token))} disabled={busy} className="btn-secondary px-3 py-2 text-xs" title={t('regenerate')}><RefreshCw size={14} /> <span className="hidden sm:inline">{t('regenerate')}</span></button></div>
    </div>)}{!djs.filter((dj) => dj.role !== 'admin').length && <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40"><ShieldCheck size={22} className="mx-auto mb-2 text-violet-200" />{t('noDjs')}</div>}</div>
    <p className="mt-6 flex items-center gap-2 text-xs text-white/35"><Lock size={13} /> El catálogo de Drive se entrega dentro de la aplicación y no se publica ningún enlace directo.</p>
  </div></div>
}
