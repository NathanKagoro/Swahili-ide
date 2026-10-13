import { useEffect, useState } from 'react'
import Workbench from '../components/Workbench'
import LessonAudio from '../components/LessonAudio'
import { ArrowIcon, CheckIcon, SpeakerIcon, StopIcon } from '../components/Icons'
import { lessons, lessonExplanations } from '../data/lessons'
import { runSwahili } from '../services/api'
import { countComplete } from '../lib/progress'
import { useReadAloud, useVoiceFor } from '../hooks/useBrowserSpeech'

const clean = (text) => (text || '').replace(/\r\n/g, '\n').trim()

export default function Lessons({ lang, lessonId, onOpenLesson, progress, onComplete }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const lesson = lessons.find((item) => item.id === lessonId) || lessons[0]
  const index = lessons.indexOf(lesson)
  const title = t(lesson.titleSw, lesson.titleEn)
  const concepts = lessonExplanations[lesson.id][lang === 'sw' ? 'sw' : 'en']

  const [tab, setTab] = useState('mfano')
  const [asPython, setAsPython] = useState(false)
  const exampleSource = asPython ? lesson.example.codeEn : lesson.example.codeSw
  const [exampleCode, setExampleCode] = useState(exampleSource)
  const [drafts, setDrafts] = useState({})
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    setExampleCode(exampleSource)
  }, [exampleSource])
  useEffect(() => {
    setTab('mfano')
    setListOpen(false)
  }, [lesson.id])

  const voice = useVoiceFor(lang)
  const reader = useReadAloud(voice)
  useEffect(() => reader.stop, [lesson.id, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = countComplete(
    progress,
    lessons.map((item) => item.id),
  )

  // The answer is right when it prints what the model answer prints.
  const judge = async (result) => {
    if (result.errorInfo) return { pass: false, message: t('Msimbo wako una kosa. Rekebisha kisha ujaribu tena.', 'Your code has an error. Fix it and try again.') }
    const expected = []
    for (const solution of [lesson.test.solutionSw, lesson.test.solutionEn]) {
      // eslint-disable-next-line no-await-in-loop
      const model = await runSwahili(solution)
      if (!model.errorInfo) expected.push(clean(model.output))
    }
    if (expected.includes(clean(result.output))) {
      onComplete(lesson.id)
      return { pass: true, message: t('Umefaulu. Somo limewekwa alama.', 'Correct. The lesson is marked as done.') }
    }
    return {
      pass: false,
      message: t('Matokeo hayalingani na yanayotarajiwa. Soma swali tena kisha ujaribu.', 'The output does not match what is expected. Read the task again and retry.'),
    }
  }

  return (
    <div className="lesson-layout">
      <nav className={`lesson-nav ${listOpen ? 'is-open' : ''}`} aria-label={t('Orodha ya masomo', 'Lesson list')}>
        <button type="button" className="lesson-nav-toggle" onClick={() => setListOpen((open) => !open)} aria-expanded={listOpen}>
          <span>
            {t('Masomo yote', 'All lessons')} ({done}/{lessons.length})
          </span>
          <span className="caret" aria-hidden="true" />
        </button>
        <p className="lesson-nav-count">
          {t('Umemaliza', 'Completed')} {done}/{lessons.length}
        </p>
        <ol className="lesson-list">
          {lessons.map((item) => (
            <li key={item.id}>
              <button type="button" className={`lesson-link ${item.id === lesson.id ? 'is-on' : ''}`} aria-current={item.id === lesson.id ? 'true' : undefined} onClick={() => onOpenLesson(item.id)}>
                <span className="lesson-no">{item.order}</span>
                <span className="lesson-title">{t(item.titleSw, item.titleEn)}</span>
                {progress[item.id] && (
                  <span className="lesson-done">
                    <CheckIcon />
                    <span className="sr-only">{t('limekamilika', 'completed')}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="lesson-main">
        <article className="paper">
          <p className="paper-kicker">
            {t('Somo la', 'Lesson')} {lesson.order} {t('kati ya', 'of')} {lessons.length}
          </p>
          <h1>{title}</h1>
          <p className="paper-lead">{t(lesson.summarySw, lesson.summaryEn)}</p>
          <div className="paper-body">
            {concepts.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="paper-tools">
            <LessonAudio lang={lang} order={lesson.order} />
            {voice && (
              <button type="button" className="btn btn-line" onClick={() => (reader.speaking ? reader.stop() : reader.read([title, ...concepts].join('. ')))}>
                {reader.speaking ? <StopIcon /> : <SpeakerIcon />}
                <span>{reader.speaking ? t('Acha kusoma', 'Stop reading') : t('Soma maandishi kwa sauti ya kivinjari', 'Read the text with the browser voice')}</span>
              </button>
            )}
          </div>
        </article>

        <div className="tabs" role="tablist" aria-label={t('Sehemu za somo', 'Lesson parts')}>
          <button type="button" role="tab" id="tab-mfano" aria-selected={tab === 'mfano'} aria-controls="lesson-panel" className={`tab ${tab === 'mfano' ? 'is-on' : ''}`} onClick={() => setTab('mfano')}>
            {t('Mfano', 'Example')}
          </button>
          <button type="button" role="tab" id="tab-jaribio" aria-selected={tab === 'jaribio'} aria-controls="lesson-panel" className={`tab ${tab === 'jaribio' ? 'is-on' : ''}`} onClick={() => setTab('jaribio')}>
            {t('Jaribio la somo', 'Lesson test')}
            {progress[lesson.id] && <CheckIcon />}
          </button>
        </div>

        <div id="lesson-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'mfano' ? (
            <>
              <p className="task">
                <strong>{t(lesson.example.titleSw, lesson.example.titleEn)}.</strong> {t('Endesha, kisha badilisha mistari uone kinachotokea.', 'Run it, then change the lines and see what happens.')}
              </p>
              <Workbench
                lang={lang}
                code={exampleCode}
                onChange={setExampleCode}
                name={`somo-${lesson.order}-mfano.py`}
                editorLabel={t('Kihariri cha mfano. Bonyeza Esc kisha Tab kutoka.', 'Example editor. Press Esc then Tab to leave.')}
                onReset={() => setExampleCode(exampleSource)}
                extra={
                  <button type="button" className="btn btn-quiet" onClick={() => setAsPython((value) => !value)} aria-pressed={asPython}>
                    <span>{asPython ? t('Onyesha Pyswahili', 'Show Pyswahili') : t('Onyesha Python', 'Show Python')}</span>
                  </button>
                }
              />
            </>
          ) : (
            <>
              <p className="task">
                <strong>{t('Swali.', 'Task.')}</strong> {t(lesson.test.promptSw, lesson.test.promptEn)}
              </p>
              <Workbench
                lang={lang}
                code={drafts[lesson.id] || ''}
                onChange={(text) => setDrafts((all) => ({ ...all, [lesson.id]: text }))}
                name={`somo-${lesson.order}-jaribio.py`}
                editorLabel={t('Kihariri cha jibu. Bonyeza Esc kisha Tab kutoka.', 'Answer editor. Press Esc then Tab to leave.')}
                placeholder={t('Andika jibu lako hapa', 'Write your answer here')}
                emptyHint={t('Andika jibu, kisha bonyeza Kagua jibu.', 'Write your answer, then press Check answer.')}
                check={{ label: t('Kagua jibu', 'Check answer'), judge }}
              />
            </>
          )}
        </div>

        <div className="pager">
          <button type="button" className="btn btn-line" disabled={index === 0} onClick={() => onOpenLesson(lessons[index - 1].id)}>
            <ArrowIcon back />
            <span>{t('Somo lililopita', 'Previous lesson')}</span>
          </button>
          <button type="button" className="btn btn-line" disabled={index === lessons.length - 1} onClick={() => onOpenLesson(lessons[index + 1].id)}>
            <span>{t('Somo linalofuata', 'Next lesson')}</span>
            <ArrowIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
