'use client'

import { useState, useRef, useEffect } from 'react'
import { MicButton, SpeakButton } from './voice'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', name: 'English', native: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish', native: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'French', native: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'German', native: 'Deutsch' },
  { code: 'pt', flag: '🇧🇷', name: 'Portuguese', native: 'Português' },
  { code: 'ar', flag: '🇸🇦', name: 'Arabic', native: 'العربية' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese', native: '日本語' },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi', native: 'हिन्दी' },
  { code: 'it', flag: '🇮🇹', name: 'Italian', native: 'Italiano' },
  { code: 'nl', flag: '🇳🇱', name: 'Dutch', native: 'Nederlands' },
  { code: 'ru', flag: '🇷🇺', name: 'Russian', native: 'Русский' },
  { code: 'ko', flag: '🇰🇷', name: 'Korean', native: '한국어' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese', native: '中文' },
  { code: 'tr', flag: '🇹🇷', name: 'Turkish', native: 'Türkçe' },
  { code: 'pl', flag: '🇵🇱', name: 'Polish', native: 'Polski' },
  { code: 'sv', flag: '🇸🇪', name: 'Swedish', native: 'Svenska' },
]

const TOPICS = [
  { icon: '⚽', label: 'Rules & Laws', q: 'How does the offside rule work?' },
  { icon: '🎯', label: 'Tactics', q: "What's a false nine?" },
  { icon: '🏆', label: 'History', q: 'Who has won the most World Cups?' },
  { icon: '📊', label: '2022 Stats', q: 'Who was the top scorer at the 2022 World Cup?' },
  { icon: '🟨', label: 'VAR', q: 'Why was VAR introduced?' },
  { icon: '🥅', label: 'Penalties', q: 'What is a penalty shootout?' },
  { icon: '💪', label: 'Pressing', q: "What does 'pressing' mean in football?" },
  { icon: '🌍', label: 'World Cup', q: 'How many teams are in the World Cup?' },
]

function getTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function FanDecoder() {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState(LANGUAGES[0])
  const [langOpen, setLangOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const ask = async (q?: string) => {
    const query = q || question
    if (!query.trim()) return
    setQuestion('')
    setLangOpen(false)
    const userMsg: ChatMessage = { role: 'user', content: query, timestamp: getTime() }
    setHistory(h => [...h, userMsg])
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8001/fan-decoder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, language: lang.code, history: history.map(m => ({ role: m.role, content: m.content })) })
      })
      const data = await res.json()
      setHistory(h => [...h, { role: 'assistant', content: data.answer, timestamp: getTime() }])
    } catch(e) {}
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 150px)', gap: 0, background: 'var(--bg)' }}>

      {/* LEFT — broadcast sidebar */}
      <div style={{
        width: 280, flexShrink: 0,
        background: 'var(--bg2)', borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--bd)',
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
              animation: 'lpb 1.1s ease infinite',
            }}/>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#EF4444' }}>On Air</span>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em', color: 'var(--green)' }}>Fan Decoder</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>AI Football Analyst · Live</div>
        </div>

        {/* Language selector */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>Broadcast Language</div>
          <div ref={langRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setLangOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--bd2)',
                borderRadius: 6, cursor: 'pointer', color: 'var(--t1)',
                fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{lang.flag}</span>
                <span>{lang.native}</span>
              </span>
              <span style={{ color: 'var(--t3)', fontSize: 11 }}>{langOpen ? '▲' : '▼'}</span>
            </button>
            {langOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg3)', border: '1px solid var(--bd2)',
                borderRadius: 6, marginTop: 4, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {LANGUAGES.map(l => (
                  <div
                    key={l.code}
                    onClick={() => { setLang(l); setLangOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', cursor: 'pointer',
                      background: lang.code === l.code ? 'rgba(16,185,129,0.12)' : 'none',
                      borderLeft: lang.code === l.code ? '3px solid var(--green)' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg4)')}
                    onMouseLeave={e => (e.currentTarget.style.background = lang.code === l.code ? 'rgba(16,185,129,0.12)' : 'none')}
                  >
                    <span style={{ fontSize: 16 }}>{l.flag}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{l.native}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>{l.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Topic cards */}
        <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>Quick Topics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TOPICS.map(t => (
              <button
                key={t.q}
                onClick={() => ask(t.q)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', background: 'var(--bg3)',
                  border: '1px solid var(--bd)', borderRadius: 6,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.12s', fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg4)'; e.currentTarget.style.borderColor = 'var(--bd2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--bd)' }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, lineHeight: 1.3 }}>{t.q}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats ticker */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>Live Context</div>
          {[['128', 'Matches loaded'],['6,147','Players indexed'],['2018/22','World Cups']].map(([v,l])=>(
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{l}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — broadcast main screen */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Broadcast header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 44,
          background: 'linear-gradient(90deg, #0D1220 0%, #111828 100%)',
          borderBottom: '2px solid var(--green)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.12em', color: 'var(--t3)' }}>PITCH INTEL</div>
            <div style={{ width: 1, height: 16, background: 'var(--bd2)' }}/>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>Fan Decoder — AI Football Analyst</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)' }}>{lang.flag} {lang.native}</div>
            <div style={{ padding: '3px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--green)', borderRadius: 3, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--green)' }}>REAL DATA</div>
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>

          {/* Welcome graphic */}
          {history.length === 0 && !loading && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              padding: '40px 20px',
            }}>
              {/* Broadcast-style title card */}
              <div style={{
                width: '100%', maxWidth: 520,
                background: 'var(--bg2)', border: '1px solid var(--bd)',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  background: 'var(--green)', padding: '8px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.1em', color: '#000' }}>FIFA WORLD CUP ANALYST</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#000', opacity: 0.7 }}>AI POWERED</span>
                </div>
                <div style={{ padding: '20px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.06em', color: 'var(--t1)', marginBottom: 6 }}>Ask Me Anything</div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                    Rules, tactics, history, results — grounded in real World Cup 2018 & 2022 match data.
                    Available in {LANGUAGES.length} languages.
                  </div>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
                  borderTop: '1px solid var(--bd)', background: 'var(--bd)',
                }}>
                  {[['128', 'Matches'], ['6,147', 'Players'], ['2', 'World Cups'], ['16', 'Languages']].map(([v,l]) => (
                    <div key={l} style={{ background: 'var(--bg2)', padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--green)' }}>{v}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>Select a topic on the left or type your question below</div>
            </div>
          )}

          {/* Messages */}
          {history.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                /* User question — broadcast lower-third style */
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      background: 'var(--bg2)', border: '1px solid var(--bd2)',
                      borderRadius: '8px 8px 2px 8px', padding: '10px 14px',
                      borderRight: '3px solid var(--green)',
                    }}>
                      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500, lineHeight: 1.5 }}>{msg.content}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{msg.timestamp}</div>
                  </div>
                </div>
              ) : (
                /* AI response — broadcast graphic style */
                <div style={{ marginBottom: 20 }}>
                  {/* Broadcast-style response card */}
                  <div style={{
                    background: 'var(--bg2)', border: '1px solid var(--bd)',
                    borderRadius: 8, overflow: 'hidden',
                  }}>
                    {/* Top bar — like a broadcast graphic header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 14px',
                      background: 'var(--bg)',
                      borderBottom: '1px solid var(--bd)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
                        }}/>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--green)' }}>AI Analyst</span>
                        <span style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 600 }}>· {lang.flag} {lang.native}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{msg.timestamp}</span>
                    </div>
                    {/* Content */}
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.75, fontWeight: 400 }}>
                        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                      </div>
                    </div>
                    {/* Bottom bar — like broadcast data bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '8px 14px', borderTop: '1px solid var(--bd)',
                      background: 'var(--bg)',
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>Source: StatsBomb Open Data · World Cup 2018/2022</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SpeakButton text={msg.content} lang={lang.code} />
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>Powered by IBM Granite</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--bd)',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'lpb 1s ease infinite' }}/>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--green)' }}>AI Analyst · Thinking</span>
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--green)',
                      animation: `lpb 1.2s ease ${i*0.2}s infinite`,
                    }}/>
                  ))}
                  <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 4 }}>Analysing match data...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={endRef}/>
        </div>

        {/* Input bar — broadcast ticker style */}
        <div style={{
          flexShrink: 0, padding: '12px 20px',
          background: 'var(--bg2)', borderTop: '1px solid var(--bd)',
        }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '0 14px', background: 'var(--bg)',
              border: '1px solid var(--bd2)', borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              fontSize: 16, flexShrink: 0,
            }}>
              {lang.flag}
            </div>
            <input
              style={{
                flex: 1, background: 'var(--bg)', border: '1px solid var(--bd2)',
                borderRight: 'none', borderLeft: 'none',
                padding: '12px 16px', fontSize: 13, fontWeight: 500,
                color: 'var(--t1)', outline: 'none', fontFamily: 'Inter, sans-serif',
                transition: 'border-color 0.12s',
              }}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder={`Ask in ${lang.native}...`}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--green)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--bd2)')}
            />
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', background: 'var(--bg)', borderTop: '1px solid var(--bd2)', borderBottom: '1px solid var(--bd2)' }}>
              <MicButton lang={lang.code} onResult={t => setQuestion(t)} />
            </div>
            <button
              onClick={() => ask()}
              disabled={loading || !question.trim()}
              style={{
                padding: '12px 28px', background: 'var(--green)', color: '#000',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer', borderRadius: '0 6px 6px 0',
                fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
                opacity: loading || !question.trim() ? 0.5 : 1,
              }}
            >Ask</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--t3)' }}>
            Answers grounded in real StatsBomb World Cup data · {LANGUAGES.length} languages available
          </div>
        </div>
      </div>
    </div>
  )
}
