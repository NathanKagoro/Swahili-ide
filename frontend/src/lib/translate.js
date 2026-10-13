// Pyswahili <-> Python keyword translation.
//
// This is a JavaScript reimplementation of pyswahili's
// PySwahili.convert_to_english (MIT, Jordan Kalebu): walk the source token by
// token and swap any NAME token found in the keyword table. Strings and
// comments are left alone, and every character that is not a keyword is
// copied through unchanged, so line numbers in Python errors match the
// learner's own lines.
import { SW_TO_EN, EN_TO_SW } from './keywords.js'

const NAME_START = /[\p{L}_]/u
const NAME_PART = /[\p{L}\p{N}_]/u
const STRING_PREFIX = /^(?:[rRuUbBfF]|[bB][rR]|[rR][bB]|[fF][rR]|[rR][fF])$/

// Split source into tokens: { type: 'name' | 'string' | 'comment' | 'number' | 'other', text }.
// Joining every token's text gives back the source exactly.
export function tokenize(source) {
  const src = String(source ?? '')
  const tokens = []
  let i = 0
  let other = ''
  const flush = () => {
    if (other) tokens.push({ type: 'other', text: other })
    other = ''
  }
  const readString = (quoteAt) => {
    const q = src[quoteAt]
    const triple = src.startsWith(q + q + q, quoteAt)
    let j = quoteAt + (triple ? 3 : 1)
    while (j < src.length) {
      const c = src[j]
      if (c === '\\') {
        j += 2
        continue
      }
      if (triple) {
        if (src.startsWith(q + q + q, j)) return j + 3
      } else {
        if (c === q) return j + 1
        if (c === '\n') return j // unterminated: stop at the end of the line
      }
      j += 1
    }
    return Math.min(j, src.length)
  }

  while (i < src.length) {
    const c = src[i]
    if (c === '#') {
      flush()
      let j = src.indexOf('\n', i)
      if (j === -1) j = src.length
      tokens.push({ type: 'comment', text: src.slice(i, j) })
      i = j
    } else if (c === '"' || c === "'") {
      flush()
      const end = readString(i)
      tokens.push({ type: 'string', text: src.slice(i, end) })
      i = end
    } else if (NAME_START.test(c)) {
      let j = i + 1
      while (j < src.length && NAME_PART.test(src[j])) j += 1
      const word = src.slice(i, j)
      const next = src[j]
      flush()
      if ((next === '"' || next === "'") && STRING_PREFIX.test(word)) {
        const end = readString(j)
        tokens.push({ type: 'string', text: src.slice(i, end) })
        i = end
      } else {
        tokens.push({ type: 'name', text: word })
        i = j
      }
    } else if (/[0-9]/.test(c)) {
      flush()
      let j = i + 1
      while (j < src.length && /[0-9a-zA-Z_.]/.test(src[j])) j += 1
      tokens.push({ type: 'number', text: src.slice(i, j) })
      i = j
    } else {
      other += c
      i += 1
    }
  }
  flush()
  return tokens
}

function swap(source, table) {
  return tokenize(source)
    .map((t) => (t.type === 'name' && Object.hasOwn(table, t.text) ? table[t.text] : t.text))
    .join('')
}

// Pyswahili source -> Python source. Line count and line order are preserved.
export function toPython(source) {
  return swap(String(source ?? '').replace(/\r\n?/g, '\n'), SW_TO_EN)
}

// Python source -> Pyswahili source (used when an assistant returns plain Python).
export function toSwahili(source) {
  return swap(String(source ?? '').replace(/\r\n?/g, '\n'), EN_TO_SW)
}
