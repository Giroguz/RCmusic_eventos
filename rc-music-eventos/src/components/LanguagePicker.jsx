import { Languages } from 'lucide-react'
import { LANGUAGES, useLanguage } from '../lib/i18n'

const FLAGS = { es: '🇪🇸', en: '🇬🇧', pt: '🇧🇷', fr: '🇫🇷', ja: '🇯🇵', zh: '🇨🇳', hi: '🇮🇳' }

export default function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage()
  return <label className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.05] px-2.5 py-2 text-xs text-white/65" title={t('languageLabel')}>
    <Languages size={14} className="shrink-0 text-turquoise" />
    <select aria-label={t('languageLabel')} value={language} onChange={(e) => setLanguage(e.target.value)} className="max-w-[170px] bg-transparent text-xs font-semibold text-white outline-none sm:max-w-none">
      {LANGUAGES.map((item) => <option key={item.code} value={item.code} className="bg-ink text-white">{FLAGS[item.code] || '🌐'} {item.label}</option>)}
    </select>
  </label>
}
