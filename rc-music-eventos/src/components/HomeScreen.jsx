import { ArrowRight, Headphones, Heart, Mic2, PartyPopper, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Brand, PageContainer } from './Brand'

function RoleCard({ icon: Icon, title, copy, action, accent, onClick, features }) {
  return (
    <button onClick={onClick} className={`group glass relative overflow-hidden rounded-[2rem] p-6 text-left transition hover:-translate-y-1 hover:border-white/25 sm:p-8 ${accent === 'violet' ? 'hover:shadow-violet' : 'hover:shadow-glow'}`}>
      <div className={`absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl ${accent === 'violet' ? 'bg-violet/30' : 'bg-neon/20'}`} />
      <div className="relative">
        <div className={`mb-7 grid h-14 w-14 place-items-center rounded-2xl ${accent === 'violet' ? 'bg-violet/20 text-violet-200' : 'bg-neon/15 text-neon'}`}><Icon size={28} /></div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-white/45">{title === 'Entrar como Asistente' ? 'Público' : 'Organización'}</p>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">{copy}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {features.map((feature) => <span key={feature} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/65">{feature}</span>)}
        </div>
        <div className="mt-8 flex items-center gap-2 font-semibold text-white group-hover:text-neon">{action}<ArrowRight size={18} className="transition group-hover:translate-x-1" /></div>
      </div>
    </button>
  )
}

export default function HomeScreen({ onAttendee, onDj }) {
  return (
    <div className="min-h-screen bg-ink bg-grid">
      <PageContainer className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between"><Brand /><span className="hidden rounded-full border border-neon/20 bg-neon/10 px-3 py-1.5 text-xs font-semibold text-neon sm:block">Tu música, tu momento</span></div>
        <div className="flex flex-1 flex-col justify-center py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-semibold text-white/60"><Sparkles size={14} className="text-neon" /> La pista también decide</div>
            <h1 className="font-display text-5xl font-bold leading-[.98] tracking-[-.06em] sm:text-7xl">La fiesta suena<br /><span className="text-neon">a tu manera.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg">Pide canciones, vota por tus favoritas y conecta con el DJ en tiempo real. Sin interrumpir la fiesta.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <RoleCard icon={Users} title="Entrar como Asistente" copy="Únete con el código del evento y haz que tu canción llegue a la cabina." action="Pedir una canción" accent="lime" features={['Buscar en YouTube', 'Votar pedidos', 'Dedicar canciones']} onClick={onAttendee} />
            <RoleCard icon={Headphones} title="Panel de DJ" copy="Administra tu evento, ordena la cola y mantén la pista encendida." action="Abrir panel de control" accent="violet" features={['Cola en vivo', 'Control de reproducción', 'Crear eventos']} onClick={onDj} />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/40"><span className="flex items-center gap-2"><Heart size={14} className="text-neon" /> Likes que ordenan la cola</span><span className="flex items-center gap-2"><Mic2 size={14} className="text-violet-300" /> Dedicatorias para el momento</span><span className="flex items-center gap-2"><PartyPopper size={14} className="text-amber-300" /> Hecho para fiestas</span></div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-white/35"><ShieldCheck size={14} /> Demo local lista para personalizar con tu marca</div>
      </PageContainer>
    </div>
  )
}
