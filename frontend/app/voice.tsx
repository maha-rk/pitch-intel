'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Voice layer for Pitch Intel — speech-to-text input (MicButton) and
 * text-to-speech "audio commentary" output (SpeakButton), both via the
 * browser-native Web Speech API. No backend, no API cost.
 */

// Map our short language codes to BCP-47 tags for recognition + synthesis.
const BCP47: Record<string, string> = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR',
  ar: 'ar-SA', ja: 'ja-JP', hi: 'hi-IN', it: 'it-IT', nl: 'nl-NL',
  ru: 'ru-RU', ko: 'ko-KR', zh: 'zh-CN', tr: 'tr-TR', pl: 'pl-PL', sv: 'sv-SE',
}
const tag = (code?: string) => BCP47[code || 'en'] || code || 'en-US'

function stripMarkup(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Speech-to-text mic button. Calls onResult with the transcript. */
export function MicButton({ onResult, lang, title }: { onResult: (t: string) => void; lang?: string; title?: string }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recRef = useRef<any>(null)

  useEffect(() => {
    const SR = (typeof window !== 'undefined') &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) { setSupported(false); return }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || ''
      if (t) onResult(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    return () => { try { rec.abort() } catch {} }
  }, [onResult])

  useEffect(() => { if (recRef.current) recRef.current.lang = tag(lang) }, [lang])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    if (listening) { rec.stop(); setListening(false) }
    else { try { rec.start(); setListening(true) } catch {} }
  }, [listening])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      title={title || (listening ? 'Stop listening' : 'Speak your question')}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, flexShrink: 0, cursor: 'pointer',
        background: listening ? '#7B2020' : 'var(--bg3)',
        border: `1px solid ${listening ? '#EF4444' : 'var(--bd2)'}`,
        borderRadius: 6, color: listening ? '#FCA5A5' : 'var(--t2)',
        animation: listening ? 'lpb 1.1s ease infinite' : 'none',
        transition: 'all 0.12s',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
      </svg>
    </button>
  )
}

/** Text-to-speech button. Reads `text` aloud; click again to stop. */
export function SpeakButton({ text, lang, label }: { text: string; lang?: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) setSupported(false)
    return () => { try { window.speechSynthesis?.cancel() } catch {} }
  }, [])

  const toggle = useCallback(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speaking) { synth.cancel(); setSpeaking(false); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(stripMarkup(text))
    u.lang = tag(lang)
    u.rate = 1.0
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }, [speaking, text, lang])

  if (!supported || !text) return null

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? 'Stop' : 'Listen to this'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', cursor: 'pointer',
        background: speaking ? 'var(--g-chip)' : 'var(--bg3)',
        border: `1px solid ${speaking ? 'var(--green)' : 'var(--bd2)'}`,
        borderRadius: 5, color: speaking ? 'var(--green)' : 'var(--t2)',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {speaking
          ? <><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></>
          : <><polygon points="5 3 19 12 5 21 5 3"/></>}
      </svg>
      {label || (speaking ? 'Stop' : 'Listen')}
    </button>
  )
}
