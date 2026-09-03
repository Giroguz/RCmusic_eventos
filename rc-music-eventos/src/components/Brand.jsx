import { Radio } from 'lucide-react'
import { useLanguage } from '../lib/i18n'

export function Brand({ compact = false }) {
  const { t } = useLanguage()
  return (
    <div className="flex items-center gap-3">
      <div className="neon-orb h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-black/30 shadow-glow">
        <img src="/rc-music-logo.jpg" alt="R&C music" className="h-full w-full object-cover" />
      </div>
      <div className={compact ? 'hidden sm:block' : ''}>
        <p className="font-display text-lg font-bold leading-none tracking-tight">RC music<span className="text-neon">_eventos</span></p>
        <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.17em] text-white/40"><Radio size={10} /> {t('liveRequestsLabel')}</p>
      </div>
    </div>
  )
}

export function AppShell({ children, onHome, right }) {
  const { t } = useLanguage()
  return (
    <div className="app-shell min-h-screen overflow-x-hidden bg-ink bg-grid">
      <header className="sticky top-0 z-30 border-b border-neon/10 bg-[#08050d]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onHome} aria-label={t('home')}><Brand compact /></button>
          <div className="flex items-center gap-2"><LanguagePicker compact />{right}</div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-white/30 sm:px-6 lg:px-8">RC music_eventos · {t('footerTagline')}</footer>
    </div>
  )
}

export function PageContainer({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 ${className}`}>{children}</div>
}
