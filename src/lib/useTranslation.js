import useStore from '../store/useStore'
import { en, ml } from './translations'

const locales = { en, ml }

export default function useTranslation() {
  const lang = useStore(s => s.language) || 'en'
  const t = (key) => locales[lang]?.[key] ?? locales.en?.[key] ?? key
  return { t, lang }
}
