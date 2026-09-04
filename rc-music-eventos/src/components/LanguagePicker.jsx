import { LANGUAGES, useLanguage } from '../lib/i18n'

const FLAGS = { es: '🇪🇸', en: '🇬🇧', pt: '🇵🇹', fr: '🇫🇷', ja: '🇯🇵', zh: '🇨🇳', hi: '🇮🇳' }

export default function LanguagePicker({ compact = false }) {
  const { language, setLanguage, t } = useLanguage()
  const currentFlag = FLAGS[language] || '🌐'
  return <label className={`inline-flex min-w-0 items-center rounded-xl border border-white/10 bg-white/[.05] text-white/65 ${compact ? 'gap-1 px-1.5 py-1.5 text-[11px]' : 'gap-1 px-2 py-1.5 text-xs'}`} title={t('languageLabel')}>
    <span aria-hidden="true" className="shrink-0 text-sm leading-none">{currentFlag}</span>
    <select aria-label={t('languageLabel')} value={language} onChange={(e) => setLanguage(e.target.value)} className={`ml-0.5 min-w-0 bg-transparent font-semibold text-white outline-none ${compact ? 'max-w-[104px] text-[11px]' : 'max-w-[122px] text-xs sm:max-w-none'}`}>
      {LANGUAGES.map((item) => <option key={item.code} value={item.code} className="bg-ink text-white">{item.label}</option>)}
    </select>
  </label>
}
