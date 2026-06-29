'use client'

import { useEffect, useState, useRef } from 'react'

export function useTypewriter(text: string | null | undefined, charsPerFrame = 8): string {
  const [displayed, setDisplayed] = useState('')
  const rafRef = useRef<number | null>(null)
  const prevText = useRef<string | null>(null)

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      prevText.current = null
      return
    }

    // Reset on new text
    if (text !== prevText.current) {
      prevText.current = text
      setDisplayed('')
      let i = 0

      const step = () => {
        i = Math.min(i + charsPerFrame, text.length)
        setDisplayed(text.slice(0, i))
        if (i < text.length) {
          rafRef.current = requestAnimationFrame(step)
        }
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(step)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [text, charsPerFrame])

  return displayed
}
