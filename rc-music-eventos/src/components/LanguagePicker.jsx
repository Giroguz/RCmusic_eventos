import { Languages } from 'lucide-react'
import { LANGUAGES, useLanguage } from '../lib/i18n'

export default function LanguagePicker({ compact = false }) {
  const { language, setLanguage } = useLanguage()
  return <label className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.05] px-2.5 py-2 text-xs text-white/65" title="Language / Idioma">
    <Languages size={14} className="text-neon" />
    <select aria-label="Idioma" value={language} onChange={(e) => setLanguage(e.target.value)} className="max-w-[105px] bg-transparent text-xs font-semibold text-white outline-none">
      {LANGUAGES.map((item) => <option key={item.code} value={item.code} className="bg-ink text-white">{compact ? item.code.toUpperCase() : item.label}</option>)}
    </select>
  </label>
}
