import { useCallback, useEffect, useRef, useState } from 'react'

// Speech features the browser provides by itself, with no backend.
// Both are feature-detected and both say so plainly when they are missing.

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const dictationSupported = Boolean(Recognition)
export const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Dictation with the Web Speech API. In Chrome the audio is sent to the
// browser vendor's speech service; the page says so next to the button.
export function useDictation(language, onText) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState('') // '', 'denied', 'language', 'failed'
  const recRef = useRef(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return
    setProblem('')
    const locales = language === 'sw' ? ['sw-TZ', 'sw-KE'] : ['en-GB']
    const attempt = (index) => {
      const rec = new Recognition()
      rec.lang = locales[index]
      rec.interimResults = false
      rec.continuous = false
      rec.onresult = (event) => {
        const text = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(' ')
          .trim()
        if (text) onTextRef.current?.(text)
      }
      rec.onerror = (event) => {
        if (event.error === 'language-not-supported' && index + 1 < locales.length) {
          recRef.current = null
          attempt(index + 1)
          return
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setProblem('denied')
        else if (event.error === 'language-not-supported') setProblem('language')
        else if (event.error !== 'no-speech' && event.error !== 'aborted') setProblem('failed')
      }
      rec.onend = () => {
        if (recRef.current === rec) {
          recRef.current = null
          setListening(false)
        }
      }
      recRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        recRef.current = null
        setListening(false)
        setProblem('failed')
      }
    }
    attempt(0)
  }, [language])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported: dictationSupported, listening, problem, start, stop }
}

// Finds a system voice for the language. Voices load asynchronously in most browsers.
export function useVoiceFor(language) {
  const [voice, setVoice] = useState(null)
  useEffect(() => {
    if (!synthesisSupported) return undefined
    const pick = () => {
      const voices = window.speechSynthesis.getVoices()
      const prefix = language === 'sw' ? 'sw' : 'en'
      setVoice(voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) || null)
    }
    pick()
    window.speechSynthesis.addEventListener?.('voiceschanged', pick)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', pick)
  }, [language])
  return voice
}

export function useReadAloud(voice) {
  const [speaking, setSpeaking] = useState(false)
  const stop = useCallback(() => {
    if (synthesisSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])
  const read = useCallback(
    (text) => {
      if (!synthesisSupported || !voice) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = 0.95
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [voice],
  )
  useEffect(() => stop, [stop])
  return { speaking, read, stop }
}
