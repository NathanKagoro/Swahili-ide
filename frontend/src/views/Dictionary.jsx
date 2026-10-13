import { useMemo, useState } from 'react'
import { KEYWORDS } from '../lib/keywords'
import { pindoTile, svgUrl } from '../lib/kanga'

const KIND_LABEL = {
  'neno-kuu': ['Neno kuu', 'Keyword'],
  thamani: ['Thamani', 'Value'],
  kazi: ['Kazi', 'Built-in'],
}

// The dictionary as a swatch card: one cloth sample per word.
export default function Dictionary({ lang, onTry }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('zote')
  const tiles = useMemo(() => Array.from({ length: 18 }, (_, i) => svgUrl(pindoTile(i))), [])

  const needle = query.trim().toLowerCase()
  const shown = KEYWORDS.map((word, i) => ({ ...word, tile: tiles[i % tiles.length] })).filter(
    (word) => (kind === 'zote' || word.kind === kind) && (!needle || word.sw.toLowerCase().includes(needle) || word.en.toLowerCase().includes(needle) || word.meaning.includes(needle)),
  )

  return (
    <>
      <div className="intro">
        <h1>{t('Kamusi ya Pyswahili', 'Pyswahili dictionary')}</h1>
        <p>
          {t(
            `Maneno ${KEYWORDS.length} ya Kiswahili na neno la Python linalolingana na kila moja. Kitafsiri cha tovuti hii hutumia orodha hii hii.`,
            `${KEYWORDS.length} Swahili words and the Python word each one stands for. The translator on this site uses this same list.`,
          )}
        </p>
      </div>

      <div className="swatch-tools">
        <label className="labelled">
          <span>{t('Tafuta neno', 'Find a word')}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('mfano: andika au print', 'e.g. andika or print')} autoCapitalize="off" spellCheck={false} />
        </label>
        <div className="chips" role="group" aria-label={t('Chuja kwa aina', 'Filter by kind')}>
          {[['zote', ['Zote', 'All']], ...Object.entries(KIND_LABEL)].map(([id, [sw, en]]) => (
            <button type="button" key={id} className={`chip ${kind === id ? 'is-on' : ''}`} aria-pressed={kind === id} onClick={() => setKind(id)}>
              {t(sw, en)}
            </button>
          ))}
        </div>
      </div>

      <p className="swatch-count" aria-live="polite">
        {t('Yanaonyeshwa', 'Showing')} {shown.length}/{KEYWORDS.length}
      </p>

      <ul className="swatches">
        {shown.map((word) => (
          <li key={word.sw} className="swatch">
            <span className="swatch-cloth" style={{ backgroundImage: word.tile }} aria-hidden="true" />
            <span className="swatch-sw" lang="sw">
              {word.sw}
            </span>
            <code className="swatch-en">{word.en}</code>
            <span className="swatch-meaning">
              {t(KIND_LABEL[word.kind][0], KIND_LABEL[word.kind][1])}
              {lang === 'en' ? `, “${word.meaning}”` : ''}
            </span>
            <button type="button" className="swatch-try" onClick={() => onTry(word)}>
              {t('Jaribu', 'Try it')}
              <span className="sr-only"> {word.sw}</span>
            </button>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="swatch-none">{t('Hakuna neno linalolingana. Futa utafutaji uone yote.', 'No word matches. Clear the search to see them all.')}</p>}
    </>
  )
}
