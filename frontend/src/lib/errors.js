// Turn a Python error into a learner-facing message: Swahili first, with the
// English original kept alongside so it can be searched for.
import { KEYWORDS } from './keywords.js'

function withinOneEdit(a, b) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length > b.length) i += 1
    else if (a.length < b.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

// Suggest a Pyswahili word when an unknown name is nearly one (kweli -> Kweli).
export function nearestKeyword(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  const sameLetters = KEYWORDS.find((k) => k.sw.toLowerCase() === lower && k.sw !== name)
  if (sameLetters) return sameLetters.sw
  if (name.length < 5) return null // short names such as jina are ordinary variables
  const near = KEYWORDS.find((k) => k.sw.length >= 5 && k.sw !== name && withinOneEdit(k.sw.toLowerCase(), lower))
  return near ? near.sw : null
}

const SYNTAX_RULES = [
  [/expected ':'/, 'Alama ya : inakosekana mwishoni mwa mstari.'],
  [/'([([{])' was never closed/, (m) => `Mabano ${m[1]} hayajafungwa.`],
  [/unmatched '([)\]}])'/, (m) => `Mabano ${m[1]} hayana mwenzake wa kufungua.`],
  [/unterminated (triple-quoted )?string literal|EOL while scanning string/, 'Maandishi hayajafungwa kwa alama ya nukuu.'],
  [/expected an indented block/, 'Mstari unaofuata : lazima uanze kwa nafasi nne.'],
  [/unexpected indent/, 'Mstari huu umeanza kwa nafasi zisizotarajiwa.'],
  [/unindent does not match/, 'Nafasi za mwanzo wa mstari hazilingani na mistari iliyotangulia.'],
  [/inconsistent use of tabs/, 'Usichanganye tab na nafasi mwanzoni mwa mistari.'],
  [/Perhaps you forgot a comma/, 'Sintaksia si sahihi. Huenda umesahau koma.'],
  [/cannot assign to|Maybe you meant '=='/, 'Huwezi kuweka thamani hapa. Kulinganisha hutumia == na kuweka thamani hutumia =.'],
  [/'return' outside function/, 'rudisha inaruhusiwa ndani ya njia tu.'],
  [/'break' outside loop/, 'vunja inaruhusiwa ndani ya marudio tu.'],
  [/'continue' not properly in loop/, 'endelea inaruhusiwa ndani ya marudio tu.'],
  [/unexpected EOF|incomplete input/, 'Msimbo umeishia katikati. Kuna kitu hakijakamilika.'],
]

function describeSyntax(message) {
  for (const [pattern, text] of SYNTAX_RULES) {
    const m = pattern.exec(message)
    if (m) return typeof text === 'function' ? text(m) : text
  }
  return 'Sintaksia si sahihi. Kagua alama na mpangilio wa mstari huu.'
}

function describeRuntime(type, message) {
  switch (type) {
    case 'NameError':
    case 'UnboundLocalError': {
      const m = /name '([^']+)'/.exec(message) || /variable '([^']+)'/.exec(message)
      const name = m ? m[1] : ''
      const hint = nearestKeyword(name)
      const base = name
        ? `Jina '${name}' halijulikani. Halijapewa thamani, au limeandikwa vibaya.`
        : 'Jina halijulikani. Halijapewa thamani, au limeandikwa vibaya.'
      return hint ? `${base} Je, ulimaanisha '${hint}'?` : base
    }
    case 'TypeError':
      if (/can only concatenate|unsupported operand/.test(message)) {
        return 'Aina mbili tofauti za data haziwezi kuunganishwa hivi. Badilisha moja kwanza, kwa mfano neno(5) au int("5").'
      }
      if (/positional argument|takes \d+/.test(message)) return 'Idadi ya thamani ulizoipa njia hii si sahihi.'
      if (/not callable/.test(message)) return 'Hiki si njia, kwa hiyo hakiwezi kuitwa kwa mabano ().'
      if (/not subscriptable/.test(message)) return 'Kitu hiki hakina vipengele vya kuchukua kwa [ ].'
      if (/not iterable/.test(message)) return 'Kitu hiki hakiwezi kupitiwa kwa marudio.'
      return 'Aina ya data haifai kwa kitendo hiki.'
    case 'ZeroDivisionError':
      return 'Huwezi kugawanya kwa sifuri.'
    case 'IndexError':
      return 'Nafasi hiyo haipo. Namba ya nafasi iko nje ya urefu wa orodha.'
    case 'KeyError':
      return `Ufunguo ${message} haupo kwenye kamusi.`
    case 'ValueError':
      if (/invalid literal for int|could not convert string to float/.test(message)) {
        return 'Maandishi haya hayawezi kubadilishwa kuwa namba.'
      }
      return 'Thamani hii haifai kwa kitendo hiki.'
    case 'AttributeError':
      return 'Kitu hiki hakina sifa au njia yenye jina hilo.'
    case 'ModuleNotFoundError':
    case 'ImportError':
      return 'Moduli hiyo haipatikani katika Python ya kivinjari.'
    case 'RecursionError':
      return 'Njia inajiita tena na tena bila kusimama.'
    case 'AssertionError':
      return 'Sharti la assert halikutimia.'
    case 'MemoryError':
      return 'Kumbukumbu imejaa.'
    case 'EOFError':
      return 'ingiza() haikupata jibu.'
    default:
      return 'Kosa limetokea wakati wa kuendesha msimbo.'
  }
}

const group = (n) => Number(n).toLocaleString('en-GB')

// Errors raised by the runner itself rather than by Python.
const RUNNER_ERRORS = {
  Timeout: (info) => ({
    sw: `Muda umeisha baada ya sekunde ${info.seconds}. Huenda kuna marudio yasiyoisha.`,
    en: `Stopped after ${info.seconds} seconds. There may be a loop that never ends.`,
  }),
  OutputLimit: (info) => ({
    sw: `Matokeo yamekatwa: yamezidi herufi ${group(info.limit)}.`,
    en: `Output cut off: more than ${group(info.limit)} characters.`,
  }),
  InputCancelled: () => ({
    sw: 'Umesitisha programu ilipokuwa inasubiri jibu la ingiza().',
    en: 'You stopped the program while it was waiting for input.',
  }),
  LoadError: () => ({
    sw: 'Imeshindikana kupakua Python. Kagua mtandao wako kisha ubonyeze Endesha tena.',
    en: 'Could not download Python. Check your connection and press Run again.',
  }),
  Stopped: () => ({
    sw: 'Umesimamisha programu.',
    en: 'You stopped the program.',
  }),
}

// raw: { type, message, line? } plus runner-specific fields.
// Returns { type, line, sw, en, text } where text is the two-line plain form.
export function describeError(raw) {
  const type = raw?.type || 'Error'
  const line = Number.isInteger(raw?.line) && raw.line > 0 ? raw.line : null
  let sw
  let en
  if (RUNNER_ERRORS[type]) {
    ;({ sw, en } = RUNNER_ERRORS[type](raw))
  } else {
    const message = String(raw?.message ?? '')
    const isSyntax = type === 'SyntaxError' || type === 'IndentationError' || type === 'TabError'
    const body = isSyntax ? describeSyntax(message) : describeRuntime(type, message)
    sw = line ? `Mstari wa ${line}: ${body}` : body
    en = `${type}: ${message}${line ? ` (line ${line})` : ''}`
  }
  return { type, line, sw, en, text: `${sw}\n${en}` }
}
