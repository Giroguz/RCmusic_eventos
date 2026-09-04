import { LANGUAGES, useLanguage } from '../lib/i18n'

const FLAGS = { es: '🇪🇸', en: '🇬🇧', pt: '🇵🇹', fr: '🇫🇷', ja: '🇯🇵', zh: '🇨🇳', hi: '🇮🇳' }

export default function LanguagePicker({ compact = false }) {
  const { language, setLanguage, t } = useLanguage()
  return <label className={`inline-flex min-w-0 items-center rounded-xl border border-white/10 bg-white/[.05] text-white/65 ${compact ? 'px-1.5 py-1.5 text-[11px]' : 'px-2 py-1.5 text-xs'}`} title={t('languageLabel')}>
    <select aria-label={t('languageLabel')} value={language} onChange={(e) => setLanguage(e.target.value)} className={`min-w-0 bg-transparent font-semibold text-white outline-none ${compact ? 'max-w-[116px] text-[11px]' : 'max-w-[134px] text-xs sm:max-w-none'}`}>
      {LANGUAGES.map((item) => <option key={item.code} value={item.code} className="bg-ink text-white">{FLAGS[item.code] || '🌐'} {item.label}</option>)}
    </select>
  </label>
}
