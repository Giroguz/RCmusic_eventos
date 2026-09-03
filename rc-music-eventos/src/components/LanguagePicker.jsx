import { Languages } from 'lucide-react'
import { LANGUAGES, useLanguage } from '../lib/i18n'

export default function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage()
  const changeLanguage = (event) => setLanguage(event.currentTarget.value)
  return <label className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.05] px-2.5 py-2 text-xs text-white/65" title={t('languageLabel')}>
    <Languages size={14} className="shrink-0 text-turquoise" />
    <select aria-label={t('languageLabel')} value={language} onChange={changeLanguage} onInput={changeLanguage} className="max-w-[150px] bg-transparent text-xs font-semibold text-white outline-none sm:max-w-none">
      {LANGUAGES.map((item) => <option key={item.code} value={item.code} className="bg-ink text-white">{item.label}</option>)}
    </select>
  </label>
}
