import { useEffect, useId, useRef, useState } from 'react'
import CodeEditor from './CodeEditor'
import { CheckIcon, MicIcon, PlayIcon, ResetIcon, StopIcon } from './Icons'
import { runSwahili } from '../services/api'
import { onRunnerState, PYODIDE_DOWNLOAD_MB, TIMEOUT_MS } from '../runner/runner'
import { KIND_OF } from '../lib/keywords'
import { useDictation } from '../hooks/useBrowserSpeech'

// Keys offered above the phone keyboard: the symbols that are slow to reach
// on a touch keyboard, then the most used Pyswahili words.
const SYMBOL_KEYS = [
  ['    ', 'tab'],
  [':', ':'],
  ['(', '('],
  [')', ')'],
  ['"', '"'],
  ['=', '='],
  ['[', '['],
  [']', ']'],
]
const WORD_KEYS = ['andika', 'kama', 'zaidi', 'ikiwa', 'imo', 'katiya', 'wakati', 'njia', 'rudisha', 'ingiza']

// The mji: the centre panel of the cloth. Editor on one side, output on the other.
export default function Workbench({ lang, code, onChange, name, editorLabel, placeholder, onReset, resetLabel, check, extra, dictation = false, emptyHint }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const inputId = useId()
  const editorRef = useRef(null)
  const consoleRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const answerRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [runner, setRunner] = useState('none')
  const [output, setOutput] = useState('')
  const [errorInfo, setErrorInfo] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [ran, setRan] = useState(false)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('')

  useEffect(() => onRunnerState(setRunner), [])
  useEffect(() => () => abortRef.current?.abort(), [])

  // A different exercise in the same panel starts with a clean console.
  useEffect(() => {
    const running = abortRef.current
    abortRef.current = null
    running?.abort()
    answerRef.current = null
    setAsking(false)
    setBusy(false)
    setOutput('')
    setErrorInfo(null)
    setVerdict(null)
    setRan(false)
  }, [name])

  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output, errorInfo, asking, verdict])

  useEffect(() => {
    if (asking) inputRef.current?.focus()
  }, [asking])

  const dictate = useDictation(lang, (text) => editorRef.current?.insert(text))

  const settleInput = (value) => {
    const resolve = answerRef.current
    answerRef.current = null
    setAsking(false)
    setAnswer('')
    resolve?.(value)
  }

  const run = async (withCheck) => {
    if (busy) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setRan(true)
    setOutput('')
    setErrorInfo(null)
    setVerdict(null)
    const result = await runSwahili(code, {
      signal: controller.signal,
      onOutput: (text) => setOutput(text),
      requestInput: () =>
        new Promise((resolve) => {
          answerRef.current = resolve
          setAsking(true)
        }),
    })
    if (abortRef.current !== controller) return // the panel moved on to another exercise
    setOutput(result.output)
    setErrorInfo(result.errorInfo)
    if (withCheck && check) {
      try {
        setVerdict(await check.judge(result))
      } catch {
        setVerdict({ pass: false, message: t('Imeshindikana kukagua jibu. Jaribu tena.', 'Could not check the answer. Try again.') })
      }
    }
    setBusy(false)
    abortRef.current = null
  }

  const stop = () => {
    if (answerRef.current) settleInput(null)
    abortRef.current?.abort()
  }

  const loading = busy && runner !== 'ready' && !asking
  const seconds = Math.round(TIMEOUT_MS / 1000)

  return (
    <section className="mji" aria-label={t('Kihariri na matokeo', 'Editor and output')}>
      <div className="mji-bar">
        <p className="mji-name">
          <span className="mji-dots" aria-hidden="true" />
          {name}
        </p>
        <div className="mji-actions">
          {dictation && dictate.supported && (
            <button
              type="button"
              className={`btn btn-quiet ${dictate.listening ? 'is-on' : ''}`}
              onClick={dictate.listening ? dictate.stop : dictate.start}
              aria-pressed={dictate.listening}
              title={t('Sema, maneno yaandikwe kwenye kihariri', 'Speak and the words are typed into the editor')}
            >
              <MicIcon />
              <span>{dictate.listening ? t('Ninasikiliza', 'Listening') : t('Imla', 'Dictate')}</span>
            </button>
          )}
          {extra}
          {onReset && (
            <button type="button" className="btn btn-quiet" onClick={onReset} disabled={busy}>
              <ResetIcon />
              <span>{resetLabel || t('Anza upya', 'Reset')}</span>
            </button>
          )}
          {check && (
            <button type="button" className="btn btn-check" onClick={() => run(true)} disabled={busy}>
              <CheckIcon />
              <span>{check.label}</span>
            </button>
          )}
          {busy ? (
            <button type="button" className="btn btn-run is-stop" onClick={stop}>
              <StopIcon />
              <span>{t('Simamisha', 'Stop')}</span>
            </button>
          ) : (
            <button type="button" className="btn btn-run" onClick={() => run(false)} title="Ctrl + Enter">
              <PlayIcon />
              <span>{t('Endesha', 'Run')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mji-body">
        <div className="mji-code">
          <CodeEditor ref={editorRef} value={code} onChange={onChange} onRun={() => run(false)} label={editorLabel} placeholder={placeholder} />
          <div className="keys" role="group" aria-label={t('Vitufe vya haraka', 'Quick keys')}>
            {SYMBOL_KEYS.map(([text, label]) => (
              <button
                type="button"
                key={label}
                className="key"
                onClick={() => editorRef.current?.insert(text)}
                aria-label={label === 'tab' ? t('Nafasi nne', 'Indent four spaces') : `${t('Andika alama', 'Type')} ${label}`}
              >
                {label}
              </button>
            ))}
            {WORD_KEYS.map((word) => (
              <button type="button" key={word} className="key key-word" onClick={() => editorRef.current?.insert(KIND_OF[word] === 'kazi' ? `${word}(` : `${word} `)}>
                {word}
              </button>
            ))}
          </div>
        </div>

        <div className="mji-out">
          <p className="out-head">{t('Matokeo', 'Output')}</p>
          <div className="console" ref={consoleRef} role="log" aria-live="polite" aria-label={t('Matokeo ya programu', 'Program output')} tabIndex={0}>
            {loading && (
              <div className="console-load">
                <p>{t('Inapakua Python kwa mara ya kwanza…', 'Downloading Python for the first time…')}</p>
                <div className="load-bar" aria-hidden="true" />
                <p className="console-note">
                  {t(
                    `Pyodide, takriban MB ${PYODIDE_DOWNLOAD_MB}. Baada ya hapa huhifadhiwa na kivinjari.`,
                    `Pyodide, about ${PYODIDE_DOWNLOAD_MB} MB. After this the browser keeps a copy.`,
                  )}
                </p>
              </div>
            )}
            {!ran && !busy && (
              <p className="console-hint">
                <span className="prompt" aria-hidden="true">
                  &gt;&gt;&gt;{' '}
                </span>
                {emptyHint || t('Bonyeza Endesha. Matokeo yataonekana hapa.', 'Press Run. The output appears here.')}
              </p>
            )}
            {output && <pre className="console-text">{output}</pre>}
            {asking && (
              <form
                className="console-input"
                onSubmit={(event) => {
                  event.preventDefault()
                  settleInput(answer)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') settleInput(null)
                }}
              >
                <label htmlFor={inputId}>{t('ingiza() inasubiri jibu lako', 'ingiza() is waiting for your answer')}</label>
                <div className="console-input-row">
                  <input id={inputId} ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                  <button type="submit" className="btn btn-run">
                    {t('Tuma', 'Send')}
                  </button>
                </div>
              </form>
            )}
            {ran && !busy && !output && !errorInfo && <p className="console-note">{t('Programu imeisha bila kuandika chochote.', 'The program finished without printing anything.')}</p>}
            {errorInfo && (
              <div className="console-error">
                <p className="err-sw" lang="sw">
                  {errorInfo.sw}
                </p>
                <p className="err-en" lang="en">
                  {errorInfo.en}
                </p>
              </div>
            )}
            {verdict && (
              <p className={`verdict ${verdict.pass ? 'is-pass' : 'is-retry'}`}>
                {verdict.pass && <CheckIcon />}
                <span>{verdict.message}</span>
              </p>
            )}
          </div>
          {dictation && dictate.listening && (
            <p className="out-foot">{t('Sauti yako inatumwa kwa huduma ya utambuzi wa sauti ya kivinjari chako.', 'Your voice is sent to your browser’s speech recognition service.')}</p>
          )}
          {dictation && dictate.problem && (
            <p className="out-foot">
              {dictate.problem === 'denied'
                ? t('Kipaza sauti hakijaruhusiwa. Ruhusu kwenye mipangilio ya kivinjari.', 'The microphone is not allowed. Allow it in the browser settings.')
                : dictate.problem === 'language'
                  ? t('Kivinjari hiki hakitambui Kiswahili kwa sauti.', 'This browser cannot recognise spoken Swahili.')
                  : t('Utambuzi wa sauti haukufanya kazi. Jaribu tena.', 'Speech recognition did not work. Try again.')}
            </p>
          )}
          <p className="out-foot out-limit">
            {t(`Hukimbia ndani ya kivinjari chako. Kikomo: sekunde ${seconds}.`, `Runs inside your browser. Limit: ${seconds} seconds.`)}
          </p>
        </div>
      </div>
    </section>
  )
}
