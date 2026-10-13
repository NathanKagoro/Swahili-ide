import Workbench from '../components/Workbench'
import { FIRST_EXAMPLE, SAMPLES } from '../data/samples'

export default function Playground({ lang, code, onChange }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  return (
    <>
      <div className="intro">
        <h1>{t('Andika Python kwa Kiswahili', 'Write Python in Swahili')}</h1>
        <p>
          {t(
            'Kanga ina pindo, mji na jina. Hapa mji ni msimbo wako: andika kwa maneno ya Kiswahili, bonyeza Endesha, uone matokeo papo hapo.',
            'A kanga has a border (pindo), a centre (mji) and a proverb line (jina). Here the centre is your code: write it with Swahili words, press Run, and see the result at once.',
          )}
        </p>
      </div>

      <div className="samples" role="group" aria-label={t('Mifano ya kuanzia', 'Starter examples')}>
        <span className="samples-label">{t('Mifano', 'Examples')}</span>
        {SAMPLES.map((sample) => (
          <button type="button" key={sample.id} className={`chip ${code === sample.code ? 'is-on' : ''}`} aria-pressed={code === sample.code} onClick={() => onChange(sample.code)}>
            {t(sample.sw, sample.en)}
          </button>
        ))}
      </div>

      <Workbench
        lang={lang}
        code={code}
        onChange={onChange}
        name="uwanja.py"
        editorLabel={t('Kihariri cha msimbo. Bonyeza Esc kisha Tab kutoka.', 'Code editor. Press Esc then Tab to leave.')}
        placeholder={t('Andika msimbo hapa', 'Write code here')}
        onReset={() => onChange(FIRST_EXAMPLE)}
        dictation
      />
    </>
  )
}
