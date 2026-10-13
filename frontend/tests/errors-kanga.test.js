import { describe, expect, it } from 'vitest'
import { describeError, nearestKeyword } from '../src/lib/errors.js'
import { bandTile, clothVars, groundTile, MOTIF_NAMES, pindoTile } from '../src/lib/kanga.js'
import { PROVERBS, proverbFor } from '../src/lib/proverbs.js'
import { lessons } from '../src/data/lessons.js'

describe('describeError', () => {
  it('gives the line number in Swahili and keeps the English original', () => {
    const info = describeError({ type: 'NameError', message: "name 'x' is not defined", line: 3 })
    expect(info.sw).toMatch(/^Mstari wa 3: /)
    expect(info.sw).toContain("'x'")
    expect(info.en).toBe("NameError: name 'x' is not defined (line 3)")
    expect(info.text).toBe(`${info.sw}\n${info.en}`)
    expect(info.line).toBe(3)
  })

  it('suggests the Pyswahili word for a near miss', () => {
    expect(describeError({ type: 'NameError', message: "name 'kweli' is not defined", line: 1 }).sw).toContain("'Kweli'")
    expect(describeError({ type: 'NameError', message: "name 'andka' is not defined", line: 1 }).sw).toContain("'andika'")
    expect(nearestKeyword('jina')).toBeNull()
    expect(nearestKeyword('x')).toBeNull()
  })

  it('explains common syntax errors', () => {
    expect(describeError({ type: 'SyntaxError', message: "expected ':'", line: 1 }).sw).toContain(':')
    expect(describeError({ type: 'SyntaxError', message: "'(' was never closed", line: 2 }).sw).toContain('hayajafungwa')
    expect(describeError({ type: 'SyntaxError', message: 'unterminated string literal (detected at line 1)', line: 1 }).sw).toContain('nukuu')
    expect(describeError({ type: 'IndentationError', message: 'expected an indented block after', line: 2 }).sw).toContain('nafasi')
    expect(describeError({ type: 'SyntaxError', message: 'invalid syntax', line: 4 }).sw).toMatch(/^Mstari wa 4: Sintaksia/)
  })

  it('explains common runtime errors', () => {
    expect(describeError({ type: 'ZeroDivisionError', message: 'division by zero', line: 1 }).sw).toContain('sifuri')
    expect(describeError({ type: 'IndexError', message: 'list index out of range', line: 1 }).sw).toContain('orodha')
    expect(describeError({ type: 'KeyError', message: "'umri'", line: 1 }).sw).toContain("'umri'")
    expect(describeError({ type: 'ValueError', message: "invalid literal for int() with base 10: 'abc'", line: 1 }).sw).toContain('namba')
    expect(describeError({ type: 'SomethingOdd', message: 'boom', line: null }).sw).toBe('Kosa limetokea wakati wa kuendesha msimbo.')
  })

  it('omits the line when it is unknown', () => {
    const info = describeError({ type: 'TypeError', message: 'bad', line: null })
    expect(info.sw).not.toMatch(/Mstari/)
    expect(info.en).toBe('TypeError: bad')
  })

  it('describes runner errors in both languages', () => {
    const timeout = describeError({ type: 'Timeout', seconds: 10 })
    expect(timeout.sw).toContain('sekunde 10')
    expect(timeout.en).toContain('10 seconds')
    const limit = describeError({ type: 'OutputLimit', limit: 20000 })
    expect(limit.sw).toContain('20,000')
    expect(limit.en).toContain('20,000')
    for (const type of ['InputCancelled', 'LoadError', 'Stopped']) {
      const info = describeError({ type })
      expect(info.sw.length).toBeGreaterThan(10)
      expect(info.en.length).toBeGreaterThan(10)
    }
  })
})

describe('kanga generator', () => {
  it('makes well-formed, deterministic SVG tiles', () => {
    for (let seed = 0; seed < 24; seed += 1) {
      const tile = pindoTile(seed)
      expect(tile.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
      expect(tile.endsWith('</svg>')).toBe(true)
      expect(tile).toBe(pindoTile(seed))
      expect(tile).not.toMatch(/NaN|undefined/)
      expect(bandTile(seed)).not.toMatch(/NaN|undefined/)
    }
    expect(groundTile()).toContain('<svg')
  })

  it('gives different cloths to different lessons', () => {
    const tiles = new Set(lessons.map((lesson) => pindoTile(lesson.order)))
    expect(tiles.size).toBeGreaterThanOrEqual(MOTIF_NAMES.length * 2)
    expect(pindoTile(1)).not.toBe(pindoTile(2))
  })

  it('returns CSS variables as data URIs', () => {
    const vars = clothVars(3)
    expect(vars['--pindo']).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(vars['--ukanda']).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(vars['--pindo-ground']).toMatch(/^#[0-9a-f]{6}$/)
    expect(vars['--pindo']).not.toContain('<')
  })
})

describe('proverbs', () => {
  it('has a proverb and gloss for every lesson and page', () => {
    for (const lesson of lessons) {
      const [sw, en] = proverbFor('masomo', lesson.id)
      expect(sw, lesson.id).toBeTruthy()
      expect(en, lesson.id).toBeTruthy()
    }
    for (const view of ['uwanja', 'mazoezi', 'kamusi']) expect(proverbFor(view)).toHaveLength(2)
  })

  it('gives every lesson its own proverb', () => {
    const lines = lessons.map((lesson) => proverbFor('masomo', lesson.id)[0])
    expect(new Set(lines).size).toBe(lessons.length)
  })

  it('keeps the dictionary page and the dictionaries lesson apart', () => {
    expect(proverbFor('kamusi')).toBe(PROVERBS.kamusi)
    expect(proverbFor('masomo', 'kamusi')).toBe(PROVERBS['somo:kamusi'])
  })
})
