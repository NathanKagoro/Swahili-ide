import { useRef, useState } from 'react'
import VoiceInput from './VoiceInput'
import VoiceTutorPanel from './VoiceTutorPanel'
import { explainCode, generateCode, speakText } from '../services/api'
import { SW_TO_EN } from '../lib/keywords'
import { toSwahili } from '../lib/translate'

// Loaded only when a backend is configured and answering its health check.

function wantsCode(prompt) {
  const text = prompt.toLowerCase()
  return (
    /\b(code|msimbo|function|program|script|loop|class|darasa|algorithm|implement)\b/.test(text) &&
    /\b(andika|tengeneza|jenga|create|build|generate|write|implement)\b/.test(text)
  )
}

function stripFence(text) {
  const raw = (text || '').trim()
  const fenced = raw.match(/```(?:[\w+-]+)?\s*([\s\S]*?)```/)
  return (fenced ? fenced[1] : raw).trim()
}

export default function AssistantPanel({ lang, code, onUseCode }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const audioRef = useRef(null)

  const context = (prompt, intent) => ({
    app: 'swahili-ide',
    intent,
    ui_language: lang,
    response_language_hint: lang,
    user_prompt: prompt,
    pyswahili_keyword_map: SW_TO_EN,
    editor_code_preview: (code || '').slice(0, 1200),
    recent_chat_messages: messages.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 600) })),
  })

  const send = async () => {
    const prompt = draft.trim()
    if (!prompt || busy) return
    setMessages((all) => [...all, { id: `${Date.now()}-u`, role: 'user', text: prompt }])
    setDraft('')
    setBusy(true)
    setNote('')
    try {
      let reply
      if (wantsCode(prompt)) {
        const instruction = `${prompt}\n\nWrite only runnable Pyswahili code. No explanations, no markdown, no backticks.`
        const data = await generateCode(instruction, lang, context(prompt, 'code_generation'))
        const generated = toSwahili(stripFence(data?.result))
        reply = { role: 'assistant', text: generated || t('Sikupata msimbo. Jaribu kuuliza kwa namna nyingine.', 'No code came back. Try asking another way.'), code: generated }
      } else {
        const data = await explainCode(prompt, lang, context(prompt, 'chat_help'))
        reply = { role: 'assistant', text: (data?.result || '').trim() || t('Sikupata jibu kutoka kwa modeli.', 'The model returned no answer.') }
      }
      setMessages((all) => [...all, { id: `${Date.now()}-a`, ...reply }])
    } catch (err) {
      setNote(`${t('Amani hakujibu.', 'Amani did not answer.')} ${err?.message || ''}`.trim())
    } finally {
      setBusy(false)
    }
  }

  const speak = async (message) => {
    audioRef.current?.pause()
    try {
      const { audio_base64: audio, mime_type: mime } = await speakText(message.text, lang)
      audioRef.current = new Audio(`data:${mime};base64,${audio}`)
      await audioRef.current.play()
    } catch {
      setNote(t('Seva haikuweza kusoma ujumbe kwa sauti.', 'The server could not read the message aloud.'))
    }
  }

  return (
    <div className="assistant">
      <h3>{t('Msaidizi Amani', 'Amani assistant')}</h3>
      <div className="assistant-thread" role="log" aria-live="polite">
        {!messages.length && <p className="assistant-empty">{t('Uliza swali kuhusu msimbo wako, au omba mfano wa msimbo.', 'Ask about your code, or ask for an example.')}</p>}
        {messages.map((message) => (
          <div key={message.id} className={`msg msg-${message.role}`}>
            <p className="msg-who">{message.role === 'user' ? t('Wewe', 'You') : 'Amani'}</p>
            {message.code ? <pre className="msg-code">{message.code}</pre> : <p className="msg-text">{message.text}</p>}
            {message.role === 'assistant' && (
              <div className="msg-actions">
                {message.code && (
                  <button type="button" className="btn btn-line" onClick={() => onUseCode(message.code)}>
                    {t('Weka kwenye kihariri', 'Put in the editor')}
                  </button>
                )}
                <button type="button" className="btn btn-line" onClick={() => speak(message)}>
                  {t('Soma kwa sauti', 'Read aloud')}
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="assistant-empty">{t('Amani anaandika…', 'Amani is writing…')}</p>}
      </div>
      <form
        className="assistant-form"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <label htmlFor="amani-input">{t('Ujumbe kwa Amani', 'Message to Amani')}</label>
        <textarea id="amani-input" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
        <button type="submit" className="btn btn-ink" disabled={busy || !draft.trim()}>
          {t('Tuma', 'Send')}
        </button>
      </form>
      {note && <p className="optional-state">{note}</p>}

      <VoiceInput onTranscribed={setDraft} transcript={draft} language={lang} />
      <VoiceTutorPanel language={lang} chatContext={messages} />
    </div>
  )
}
