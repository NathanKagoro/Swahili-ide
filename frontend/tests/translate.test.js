import { describe, expect, it } from 'vitest'
import { KEYWORDS, SW_TO_EN, EN_TO_SW } from '../src/lib/keywords.js'
import { tokenize, toPython, toSwahili } from '../src/lib/translate.js'
import { KEYWORD_EXAMPLES } from '../src/data/keywordExamples.js'
import { lessons, swahiliDictionary } from '../src/data/lessons.js'

describe('keyword table', () => {
  it('has 47 unique Swahili words mapping to unique Python words', () => {
    expect(KEYWORDS).toHaveLength(47)
    expect(new Set(KEYWORDS.map((k) => k.sw)).size).toBe(47)
    expect(new Set(KEYWORDS.map((k) => k.en)).size).toBe(47)
  })

  it('matches the upstream pyswahili table for the core words', () => {
    expect(SW_TO_EN).toMatchObject({ andika: 'print', ingiza: 'input', kama: 'if', pia: 'elif', zaidi: 'else', ikiwa: 'for', imo: 'in', katiya: 'range', wakati: 'while', njia: 'def', rudisha: 'return', jaribu: 'try', ila: 'except', Kweli: 'True', SiKweli: 'False', tupu: 'None' })
  })

  it('is the list the lessons and dictionary page use', () => {
    expect(swahiliDictionary).toEqual(KEYWORDS.map((k) => [k.sw, k.en]))
  })

  it('has a runnable example for every word, and each example uses its word', () => {
    for (const { sw } of KEYWORDS) {
      expect(KEYWORD_EXAMPLES[sw], sw).toBeTypeOf('string')
      expect(tokenize(KEYWORD_EXAMPLES[sw]).some((token) => token.type === 'name' && token.text === sw), sw).toBe(true)
    }
    expect(Object.keys(KEYWORD_EXAMPLES)).toHaveLength(KEYWORDS.length)
  })
})

describe('tokenize', () => {
  it('reproduces the source exactly', () => {
    const samples = ['', 'andika("a")', 'x = 1 # maoni\n', "f'{x}' + r\"\\d\"", '"""mistari\nmiwili""" na x', '"haijafungwa\nandika(1)', 'π = 3.14\n\tkama π > 3:\r\n']
    for (const source of samples) {
      expect(
        tokenize(source)
          .map((token) => token.text)
          .join(''),
      ).toBe(source)
    }
  })

  it('classifies names, strings, comments and numbers', () => {
    const types = tokenize('andika("kama", 12) # kama').map((token) => token.type)
    expect(types).toEqual(['name', 'other', 'string', 'other', 'number', 'other', 'comment'])
  })
})

describe('toPython', () => {
  it('translates a simple print', () => {
    expect(toPython('andika("Habari, Dunia!")')).toBe('print("Habari, Dunia!")')
  })

  it('translates every keyword', () => {
    for (const { sw, en } of KEYWORDS) expect(toPython(sw)).toBe(en)
  })

  it('translates control flow and keeps indentation', () => {
    const sw = 'ikiwa i imo katiya(3):\n    kama i == 1:\n        endelea\n    pia i == 2:\n        vunja\n    zaidi:\n        andika(i)\n'
    const py = 'for i in range(3):\n    if i == 1:\n        continue\n    elif i == 2:\n        break\n    else:\n        print(i)\n'
    expect(toPython(sw)).toBe(py)
  })

  it('leaves strings alone, whatever the quotes or prefix', () => {
    expect(toPython('andika("kama na au")')).toBe('print("kama na au")')
    expect(toPython("andika('andika')")).toBe("print('andika')")
    expect(toPython('x = f"{kama}"')).toBe('x = f"{kama}"')
    expect(toPython('x = """kama\nzaidi"""\nandika(x)')).toBe('x = """kama\nzaidi"""\nprint(x)')
    expect(toPython('andika("sema \\"kama\\" tena")')).toBe('print("sema \\"kama\\" tena")')
  })

  it('leaves comments alone', () => {
    expect(toPython('# andika hapa\nandika(1) # kama')).toBe('# andika hapa\nprint(1) # kama')
  })

  it('only swaps whole words and respects case', () => {
    expect(toPython('kamati = 1')).toBe('kamati = 1')
    expect(toPython('andika_mara = 2')).toBe('andika_mara = 2')
    expect(toPython('kweli = 1')).toBe('kweli = 1')
    expect(toPython('Kweli na SiKweli')).toBe('True and False')
  })

  it('keeps the number of lines so error line numbers match', () => {
    const source = 'x = 1\r\n\r\nkama x:\r\n    andika(x)\r\n# mwisho'
    expect(toPython(source).split('\n')).toHaveLength(5)
    expect(toPython(source)).not.toContain('\r')
  })

  it('leaves plain Python unchanged', () => {
    const py = 'def f(a):\n    return [x for x in range(a) if x % 2]\nprint(f(5))'
    expect(toPython(py)).toBe(py)
  })

  it('does not treat object prototype names as keywords', () => {
    expect(toPython('constructor = 1\ntoString = 2')).toBe('constructor = 1\ntoString = 2')
  })

  it('handles empty and missing input', () => {
    expect(toPython('')).toBe('')
    expect(toPython(null)).toBe('')
    expect(toPython(undefined)).toBe('')
  })

  it('translates every lesson example and solution to the English version of the same shape', () => {
    for (const lesson of lessons) {
      for (const [sw, en] of [
        [lesson.example.codeSw, lesson.example.codeEn],
        [lesson.test.solutionSw, lesson.test.solutionEn],
      ]) {
        const python = toPython(sw)
        expect(python.split('\n'), lesson.id).toHaveLength(en.split('\n').length)
        const leftover = tokenize(python).filter((token) => token.type === 'name' && Object.hasOwn(SW_TO_EN, token.text))
        expect(leftover, lesson.id).toEqual([])
      }
    }
  })
})

describe('toSwahili', () => {
  it('is the inverse of toPython for keywords', () => {
    for (const { sw, en } of KEYWORDS) expect(toSwahili(en)).toBe(sw)
    expect(EN_TO_SW.print).toBe('andika')
  })

  it('round-trips a program', () => {
    const sw = 'njia salamu(jina):\n    rudisha "Habari " + jina\n\nandika(salamu("Asha"))'
    expect(toSwahili(toPython(sw))).toBe(sw)
  })
})
