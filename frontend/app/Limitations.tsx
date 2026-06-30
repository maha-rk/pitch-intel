'use client'

/**
 * Honest-limitations panel. Every AI verdict pairs its conclusion with an
 * explicit statement of what the data and method cannot tell you. Surfacing
 * blind spots is a trust feature, not a disclaimer.
 */
export default function Limitations({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <div
      style={{
        marginTop: 16,
        background: 'var(--bg2)',
        border: '1px solid var(--bd2)',
        borderLeft: '3px solid var(--gold)',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden style={{ fontSize: 10 }}>⚠</span> What this can&apos;t tell you
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((t, i) => (
          <li
            key={i}
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: 'var(--t2)',
              display: 'flex',
              gap: 7,
            }}
          >
            <span style={{ color: 'var(--gold)', flexShrink: 0 }}>—</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
