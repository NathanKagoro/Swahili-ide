import { useState } from 'react'
import Workbench from '../components/Workbench'
import { practiceTests } from '../data/lessons'

const clean = (text) => (text || '').replace(/\r\n/g, '\n').trim()

export default function Practice({ lang }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const [activeId, setActiveId] = useState(practiceTests[0].id)
  const [drafts, setDrafts] = useState({})
  const task = practiceTests.find((item) => item.id === activeId) || practiceTests[0]
  const starter = lang === 'sw' ? task.starterSw : task.starterEn
  const code = drafts[task.id] ?? starter
  const [heading, ...rest] = t(task.promptSw, task.promptEn).split(': ')

  const judge = async (result) => {
    if (result.errorInfo) return { pass: false, message: t('Msimbo wako una kosa. Rekebisha kisha ujaribu tena.', 'Your code has an error. Fix it and try again.') }
    if (clean(result.output) === clean(task.expectedOutput)) return { pass: true, message: t('Umefaulu.', 'Correct.') }
    return {
      pass: false,
      message: `${t('Bado. Matokeo yanayotarajiwa ni:', 'Not yet. The expected output is:')}\n${clean(task.expectedOutput)}`,
    }
  }

  return (
    <>
      <div className="intro">
        <h1>{t('Mazoezi', 'Practice')}</h1>
        <p>{t('Kazi nne zisizo na mwongozo. Andika, endesha, kisha kagua jibu.', 'Four tasks with no walkthrough. Write, run, then check your answer.')}</p>
      </div>

      <div className="tabs" role="tablist" aria-label={t('Kazi za mazoezi', 'Practice tasks')}>
        {practiceTests.map((item, i) => (
          <button type="button" role="tab" key={item.id} id={`kazi-${item.id}`} aria-selected={item.id === task.id} aria-controls="practice-panel" className={`tab ${item.id === task.id ? 'is-on' : ''}`} onClick={() => setActiveId(item.id)}>
            {t('Kazi', 'Task')} {i + 1}
          </button>
        ))}
      </div>

      <div id="practice-panel" role="tabpanel" aria-labelledby={`kazi-${task.id}`}>
        <p className="task">
          <strong>{heading}.</strong> {rest.join(': ')}
        </p>
        <Workbench
          lang={lang}
          code={code}
          onChange={(text) => setDrafts((all) => ({ ...all, [task.id]: text }))}
          name={`kazi-${practiceTests.indexOf(task) + 1}.py`}
          editorLabel={t('Kihariri cha kazi. Bonyeza Esc kisha Tab kutoka.', 'Task editor. Press Esc then Tab to leave.')}
          onReset={() => setDrafts((all) => ({ ...all, [task.id]: starter }))}
          check={{ label: t('Kagua jibu', 'Check answer'), judge }}
        />
      </div>
    </>
  )
}
