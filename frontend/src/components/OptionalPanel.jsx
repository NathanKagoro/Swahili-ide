import { lazy, Suspense } from 'react'
import { backendConfigured } from '../services/api'
import { dictationSupported, useVoiceFor } from '../hooks/useBrowserSpeech'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

const README_BACKEND = 'https://github.com/NathanKagoro/Swahili-ide/tree/ui-ux-improvements#optional-backend'

// One collapsed panel for everything that needs a server. With no backend it
// is plain information: no warnings, no status lights.
export default function OptionalPanel({ lang, backendUp, code, onUseCode }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const swVoice = useVoiceFor('sw')

  return (
    <details className="optional">
      <summary>
        <span className="optional-title">{t('Si lazima: inahitaji backend yako mwenyewe', 'Optional: needs your own backend')}</span>
        <span className="optional-hint">{t('Msaidizi Amani, mwalimu wa sauti, sauti hadi maandishi', 'Amani assistant, voice tutor, speech to text')}</span>
      </summary>

      <div className="optional-body">
        <p>
          {t(
            'Kuandika na kuendesha msimbo, masomo, mazoezi na kamusi havihitaji seva. Vipengele vitatu vilivyo hapa chini vinahitaji seva yenye funguo za API, kwa hiyo havimo kwenye tovuti hii.',
            'Writing and running code, the lessons, the practice tasks and the dictionary need no server. The three features below need a server holding API keys, so they are not part of this site.',
          )}
        </p>
        <dl className="optional-list">
          <div>
            <dt>{t('Msaidizi Amani', 'Amani assistant')}</dt>
            <dd>{t('Gumzo na modeli ya lugha inayoeleza msimbo na kuandika mifano ya Pyswahili. Inahitaji ufunguo wa OpenRouter au Ollama.', 'A chat with a language model that explains code and writes Pyswahili examples. Needs an OpenRouter key or Ollama.')}</dd>
          </div>
          <div>
            <dt>{t('Mwalimu wa sauti', 'Voice tutor')}</dt>
            <dd>{t('Mazungumzo ya sauti ya moja kwa moja kupitia Deepgram. Hujibu kwa Kiingereza. Inahitaji ufunguo wa Deepgram.', 'A live spoken conversation through Deepgram. It answers in English. Needs a Deepgram key.')}</dd>
          </div>
          <div>
            <dt>{t('Sauti hadi maandishi ya seva', 'Server speech to text')}</dt>
            <dd>{t('Hurekodi sauti na kuinakili kwa Whisper au Deepgram kwenye seva, kisha huiweka kwenye gumzo.', 'Records audio and transcribes it with Whisper or Deepgram on the server, then puts it in the chat.')}</dd>
          </div>
        </dl>

        {!backendConfigured && (
          <p className="optional-state">
            {t('Tovuti hii imejengwa bila backend. ', 'This site is built without a backend. ')}
            <a href={README_BACKEND}>{t('Jinsi ya kuendesha backend yako', 'How to run your own backend')}</a>
          </p>
        )}
        {backendConfigured && backendUp === null && <p className="optional-state">{t('Inakagua backend…', 'Checking the backend…')}</p>}
        {backendConfigured && backendUp === false && (
          <p className="optional-state">
            {t('Backend iliyowekwa haijibu, kwa hiyo vipengele hivi vimezimwa. ', 'The configured backend is not answering, so these features are off. ')}
            <a href={README_BACKEND}>{t('Jinsi ya kuiendesha', 'How to run it')}</a>
          </p>
        )}
        {backendConfigured && backendUp === true && (
          <Suspense fallback={<p className="optional-state">{t('Inapakia…', 'Loading…')}</p>}>
            <AssistantPanel lang={lang} code={code} onUseCode={onUseCode} />
          </Suspense>
        )}

        <h3>{t('Kivinjari chako kinatoa nini bila seva', 'What your browser provides without a server')}</h3>
        <ul className="optional-native">
          <li>
            {dictationSupported
              ? t('Imla: kitufe cha Imla kwenye uwanja huandika unachosema (Kiswahili sw-TZ au sw-KE). Sauti hutumwa kwa huduma ya utambuzi ya kivinjari.', 'Dictation: the Dictate button in the playground types what you say (Swahili sw-TZ or sw-KE). Audio goes to the browser’s recognition service.')
              : t('Imla: kivinjari hiki hakina utambuzi wa sauti, kwa hiyo kitufe cha Imla hakionyeshwi.', 'Dictation: this browser has no speech recognition, so the Dictate button is not shown.')}
          </li>
          <li>
            {swVoice
              ? t(`Kusoma kwa sauti: kivinjari kina sauti ya Kiswahili (${swVoice.name}) ya kusoma maandishi ya somo.`, `Reading aloud: the browser has a Swahili voice (${swVoice.name}) for reading lesson text.`)
              : t('Kusoma kwa sauti: kivinjari hiki hakina sauti ya Kiswahili. Masomo yana sauti iliyorekodiwa badala yake.', 'Reading aloud: this browser has no Swahili voice. The lessons have recorded audio instead.')}
          </li>
        </ul>
      </div>
    </details>
  )
}
