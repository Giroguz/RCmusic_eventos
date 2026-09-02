import { Disc3, Radio } from 'lucide-react'

export function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neon text-ink shadow-glow">
        <Disc3 size={22} strokeWidth={2.5} />
      </div>
      <div className={compact ? 'hidden sm:block' : ''}>
        <p className="font-display text-lg font-bold leading-none tracking-tight">RC music<span className="text-neon">_eventos</span></p>
        <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.17em] text-white/40"><Radio size={10} /> live requests</p>
      </div>
    </div>
  )
}

export function AppShell({ children, onHome, right }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink bg-grid">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onHome} aria-label="Ir al inicio"><Brand compact /></button>
          {right}
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-white/30 sm:px-6 lg:px-8">RC music_eventos · haz que cada canción cuente</footer>
    </div>
  )
}

export function PageContainer({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 ${className}`}>{children}</div>
}
