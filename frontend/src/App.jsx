import { useCallback, useEffect, useState } from 'react'
import Playground from './views/Playground'
import { FIRST_EXAMPLE } from './data/samples'
import Lessons from './views/Lessons'
import Practice from './views/Practice'
import Dictionary from './views/Dictionary'
import OptionalPanel from './components/OptionalPanel'
import { lessons } from './data/lessons'
import { KEYWORD_EXAMPLES } from './data/keywordExamples'
import { backendConfigured, checkBackend, runSwahili } from './services/api'
import { loadProgress, markComplete, readPref, saveProgress, writePref } from './lib/progress'
import { proverbFor } from './lib/proverbs'
import { clothVars } from './lib/kanga'
import { toPython } from './lib/translate'

const LESSON_IDS = lessons.map((lesson) => lesson.id)
const VIEWS = [
  ['uwanja', 'Uwanja', 'Playground'],
  ['masomo', 'Masomo', 'Lessons'],
  ['mazoezi', 'Mazoezi', 'Practice'],
  ['kamusi', 'Kamusi', 'Dictionary'],
]
// Each page wears a different cloth; each lesson has its own.
const CLOTH_SEED = { uwanja: 0, mazoezi: 9, kamusi: 14 }

function readRoute() {
  const [view, id] = window.location.hash.replace(/^#\/?/, '').split('/')
  if (view === 'masomo') return { view, lessonId: LESSON_IDS.includes(id) ? id : readPref('swahili-ide-lesson', LESSON_IDS[0]) }
  if (view === 'mazoezi' || view === 'kamusi') return { view, lessonId: null }
  return { view: 'uwanja', lessonId: null }
}

// Exposed for the headless test script and for anyone curious in the console.
if (typeof window !== 'undefined') window.pyswahili = { run: runSwahili, toPython }

export default function App() {
  const [lang, setLang] = useState(() => (readPref('swahili-ide-lang', 'sw') === 'en' ? 'en' : 'sw'))
  const [route, setRoute] = useState(readRoute)
  const [progress, setProgress] = useState(() => loadProgress(LESSON_IDS))
  const [code, setCode] = useState(() => readPref('swahili-ide-draft', FIRST_EXAMPLE))
  const [backendUp, setBackendUp] = useState(null)
  const t = (sw, en) => (lang === 'sw' ? sw : en)

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'sw' ? 'Pyswahili: Python kwa Kiswahili' : 'Pyswahili: Python in Swahili'
    writePref('swahili-ide-lang', lang)
  }, [lang])

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    const timer = setTimeout(() => writePref('swahili-ide-draft', code), 400)
    return () => clearTimeout(timer)
  }, [code])

  useEffect(() => {
    if (route.lessonId) writePref('swahili-ide-lesson', route.lessonId)
    const seed = route.view === 'masomo' ? lessons.find((lesson) => lesson.id === route.lessonId)?.order || 1 : CLOTH_SEED[route.view]
    for (const [name, value] of Object.entries(clothVars(seed))) document.documentElement.style.setProperty(name, value)
  }, [route])

  useEffect(() => {
    if (!backendConfigured) return undefined
    let live = true
    checkBackend().then((ok) => live && setBackendUp(ok))
    return () => {
      live = false
    }
  }, [])

  const go = useCallback((hash) => {
    window.location.hash = hash
  }, [])
  const onComplete = useCallback((id) => setProgress((current) => markComplete(current, id)), [])

  const [proverb, gloss] = proverbFor(route.view, route.lessonId)

  return (
    <div className="cloth">
      <a className="skip" href="#main">
        {t('Ruka hadi kwenye maudhui', 'Skip to content')}
      </a>
      <div className="field">
        <header className="selvedge">
          <a className="back" href="https://nathankagoro.com">
            ← nathankagoro.com
          </a>
          <p className="brand">
            <a href="#/">Pyswahili</a>
          </p>
          <nav className="nav" aria-label={t('Kurasa', 'Pages')}>
            {VIEWS.map(([id, sw, en]) => (
              <a key={id} href={id === 'uwanja' ? '#/' : `#/${id}`} className={route.view === id ? 'is-on' : ''} aria-current={route.view === id ? 'page' : undefined}>
                {t(sw, en)}
              </a>
            ))}
          </nav>
          <div className="lang" role="group" aria-label={t('Lugha', 'Language')}>
            <button type="button" className={lang === 'sw' ? 'is-on' : ''} aria-pressed={lang === 'sw'} onClick={() => setLang('sw')} lang="sw">
              Kiswahili
            </button>
            <button type="button" className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">
              English
            </button>
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          {route.view === 'uwanja' && <Playground lang={lang} code={code} onChange={setCode} />}
          {route.view === 'masomo' && <Lessons lang={lang} lessonId={route.lessonId} onOpenLesson={(id) => go(`#/masomo/${id}`)} progress={progress} onComplete={onComplete} />}
          {route.view === 'mazoezi' && <Practice lang={lang} />}
          {route.view === 'kamusi' && (
            <Dictionary
              lang={lang}
              onTry={(word) => {
                setCode(KEYWORD_EXAMPLES[word.sw] || `${word.sw}\n`)
                go('#/')
              }}
            />
          )}
        </main>

        <aside className="jina" aria-label={t('Jina la kanga: methali', 'The kanga’s proverb line')}>
          <p className="jina-label">{t('Jina la kanga hii', 'This kanga’s proverb')}</p>
          <p className="jina-text" lang="sw">
            {proverb}
          </p>
          <p className="jina-gloss" lang="en">
            {gloss}
          </p>
        </aside>

        {route.view === 'uwanja' && (
          <OptionalPanel
            lang={lang}
            backendUp={backendUp}
            code={code}
            onUseCode={(text) => {
              setCode(text)
              window.scrollTo(0, 0)
            }}
          />
        )}

        <footer className="foot">
          <p>
            {t(
              'Msimbo huendeshwa ndani ya kivinjari chako kwa Pyodide; hakuna kinachotumwa kwa seva. Hakuna akaunti: maendeleo ya masomo huhifadhiwa kwenye kifaa hiki tu.',
              'Code runs inside your browser with Pyodide; nothing is sent to a server. There are no accounts: lesson progress is kept on this device only.',
            )}
          </p>
          <p>
            {t('Jedwali la maneno limetoka kwa ', 'The keyword table comes from ')}
            <a href="https://github.com/Kalebu/pyswahili">pyswahili</a>
            {t(' ya Jordan Kalebu (leseni ya MIT). ', ' by Jordan Kalebu (MIT licence). ')}
            <a href="https://github.com/NathanKagoro/Swahili-ide">{t('Chanzo cha tovuti hii', 'Source for this site')}</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
