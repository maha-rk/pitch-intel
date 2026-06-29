'use client'

export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'sv', label: 'Svenska',    flag: '🇸🇪' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'bn', label: 'বাংলা',       flag: '🇧🇩' },
  { code: 'sw', label: 'Kiswahili',  flag: '🇰🇪' },
  { code: 'th', label: 'ภาษาไทย',    flag: '🇹🇭' },
]

const KEY = 'pitch-intel-lang'

export function getLang(): string {
  if (typeof window === 'undefined') return 'en'
  return localStorage.getItem(KEY) || 'en'
}

export function setLang(code: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, code)
  window.dispatchEvent(new Event('lang-change'))
}
