export const PLAN_OPTIONS = [
  { id: 'fifteen', days: 15, pricePen: 16, label: '15 días' },
  { id: 'monthly', days: 30, pricePen: 30, label: 'Mensual' },
  { id: 'annual', days: 365, pricePen: 330, label: 'Anual' },
]

export function getPlanOption(planType) {
  return PLAN_OPTIONS.find((plan) => plan.id === planType) || null
}

export function formatCountdown(expiresAt, now = Date.now()) {
  const remaining = Math.max(0, new Date(expiresAt || 0).getTime() - now)
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, expired: remaining <= 0 }
}

export function countdownText(expiresAt, now = Date.now()) {
  const value = formatCountdown(expiresAt, now)
  return value.expired ? 'Vencido' : `${value.days}d ${String(value.hours).padStart(2, '0')}h ${String(value.minutes).padStart(2, '0')}m ${String(value.seconds).padStart(2, '0')}s`
}

export function planPriceText(plan, currency = 'PEN', rate = 1) {
  const amount = plan.pricePen * rate
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'PEN' ? 2 : 0 }).format(amount)
}
