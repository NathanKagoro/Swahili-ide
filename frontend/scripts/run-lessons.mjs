// Runs real Pyswahili programs in headless Chrome against the built site:
// the language features the runner promises, every lesson example and model
// answer, every practice task, every dictionary example and every playground
// sample. Exits non-zero if anything fails.
//
//   npm run build && npm run test:lessons
import { launch, serveDist } from './lib.mjs'
import { lessons, practiceTests } from '../src/data/lessons.js'
import { KEYWORD_EXAMPLES } from '../src/data/keywordExamples.js'
import { SAMPLES } from '../src/data/samples.js'

const PORT = Number(process.env.PORT || 4372)

// Model answers for the practice tasks, written in Pyswahili.
const PRACTICE_ANSWERS = {
  t1: 'ikiwa i imo katiya(1, 16):\n    kama i % 15 == 0:\n        andika("FizzBuzz")\n    pia i % 3 == 0:\n        andika("Fizz")\n    pia i % 5 == 0:\n        andika("Buzz")\n    zaidi:\n        andika(i)\n',
  t2: 'nums = [1, 2, 3, 4, 5]\nandika(jumlisha(nums))\n',
  t3: 'nums = [1, 2, 3, 4, 5, 6]\nidadi = 0\nikiwa n imo nums:\n    kama n % 2 == 0:\n        idadi = idadi + 1\nandika(idadi)\n',
  t4: 'nums = [3, 1, 9, 4]\nandika(kubwa(nums))\n',
}

const cases = []
const add = (group, name, code, expect, options = {}) => cases.push({ group, name, code, expect, options })
const prints = (text) => (r) => (r.error ? `unexpected error: ${r.error}` : r.output === text ? null : `output was ${JSON.stringify(r.output)}, expected ${JSON.stringify(text)}`)
const ok = (r) => (r.error ? `unexpected error: ${r.error}` : null)
const okWithOutput = (r) => ok(r) || (r.output.trim() ? null : 'printed nothing')
const fails = (type, line, swPart) => (r) => {
  if (!r.errorInfo) return `expected ${type}, but it ran: ${JSON.stringify(r.output)}`
  if (r.errorInfo.type !== type) return `expected ${type}, got ${r.errorInfo.type}: ${r.errorInfo.en}`
  if (line != null && r.errorInfo.line !== line) return `expected line ${line}, got ${r.errorInfo.line}`
  if (swPart && !r.errorInfo.sw.includes(swPart)) return `Swahili message lacks "${swPart}": ${r.errorInfo.sw}`
  if (!r.errorInfo.en || !r.error.includes(r.errorInfo.sw) || !r.error.includes(r.errorInfo.en)) return 'error text must hold both the Swahili and the English line'
  return null
}

// --- language features ---
add('features', 'print', 'andika("Habari, Dunia!")', prints('Habari, Dunia!\n'))
add('features', 'variables', 'jina = "Amina"\numri = 12\nandika(jina, umri + 1)', prints('Amina 13\n'))
add('features', 'if / elif / else', 'x = 7\nkama x > 10:\n    andika("kubwa")\npia x > 5:\n    andika("wastani")\nzaidi:\n    andika("ndogo")', prints('wastani\n'))
add('features', 'for loop', 'ikiwa i imo katiya(3):\n    andika(i)', prints('0\n1\n2\n'))
add('features', 'while loop with break and continue', 'i = 0\nwakati Kweli:\n    i = i + 1\n    kama i == 2:\n        endelea\n    kama i > 4:\n        vunja\n    andika(i)', prints('1\n3\n4\n'))
add('features', 'functions', 'njia mraba(x):\n    rudisha x * x\n\nandika(mraba(6))', prints('36\n'))
add('features', 'lists and methods', 'matunda = ["embe", "ndizi"]\nmatunda.append("nanasi")\nandika(urefu(matunda), matunda[2])\nandika(panga(matunda))', prints("3 nanasi\n['embe', 'nanasi', 'ndizi']\n"))
add('features', 'dicts', 'mtu = {"jina": "Asha", "umri": 12}\nmtu["mji"] = "Dar"\nikiwa k imo mtu:\n    andika(k, mtu[k])', prints('jina Asha\numri 12\nmji Dar\n'))
add('features', 'try / except', 'jaribu:\n    andika(1 / 0)\nila:\n    andika("kosa")\nandika("mwisho")', prints('kosa\nmwisho\n'))
add('features', 'try / except with a named error', 'jaribu:\n    int("abc")\nila ValueError:\n    andika("si namba")', prints('si namba\n'))
add('features', 'classes', 'darasa Mnyama:\n    njia __init__(self, jina):\n        self.jina = jina\n\nandika(Mnyama("paka").jina)', prints('paka\n'))
add('features', 'standard library import', 'kutoka math import sqrt\nandika(sqrt(81))', prints('9.0\n'))
add('features', 'plain Python still runs', 'for i in range(2):\n    print(i)', prints('0\n1\n'))
add('features', 'keywords inside strings and comments are untouched', '# andika kama\nandika("kama na au")', prints('kama na au\n'))
add('features', 'syntax error with line number', 'andika("moja")\nkama 5 > 2\n    andika("mbili")', fails('SyntaxError', 2, 'Mstari wa 2'))
add('features', 'unclosed bracket', 'andika("a"', fails('SyntaxError', 1, 'hayajafungwa'))
add('features', 'indentation error', 'kama Kweli:\nandika(1)', fails('IndentationError', 2, 'Mstari wa 2'))
add('features', 'name error with line number', 'x = 1\nandika(x)\nandika(y)', (r) => fails('NameError', 3, "'y'")(r) || (r.output === '1\n' ? null : 'output before the error was lost'))
add('features', 'error inside a function reports the failing line', 'njia gawa(a, b):\n    rudisha a / b\n\nandika(gawa(1, 0))', fails('ZeroDivisionError', 2, 'sifuri'))
add('features', 'infinite loop hits the timeout', 'wakati Kweli:\n    x = 1', fails('Timeout', null, 'Muda umeisha'), { timeoutMs: 3000 })
add('features', 'runner recovers after a timeout', 'andika("bado nipo")', prints('bado nipo\n'))
add('features', 'endless printing hits the output limit', 'wakati Kweli:\n    andika("x" * 100)', (r) => fails('OutputLimit', null, 'yamekatwa')(r) || (r.output.length === 20000 ? null : `kept ${r.output.length} characters, expected 20000`))
add('features', 'ingiza() takes an answer', 'jina = ingiza("Jina? ")\nandika("Karibu", jina)', prints('Jina? Asha\nKaribu Asha\n'), { inputs: ['Asha'] })
add('features', 'ingiza() twice, with number conversion', 'a = int(ingiza("a: "))\nb = int(ingiza("b: "))\nandika(a + b)', prints('a: 2\nb: 40\n42\n'), { inputs: ['2', '40'] })
add('features', 'ingiza() inside jaribu / ila', 'jaribu:\n    n = int(ingiza("Namba: "))\n    andika(n * 2)\nila:\n    andika("si namba")', prints('Namba: 21\n42\n'), { inputs: ['21'] })
add('features', 'ingiza() cancelled', 'ingiza("Jina? ")', fails('InputCancelled', null, 'Umesitisha'), { inputs: [] })
add('features', 'ingiza() with nothing to answer it', 'ingiza("Jina? ")', fails('EOFError', null, 'ingiza()'), { noInput: true })
add('features', 'random is stable across an input replay', 'import random\nx = random.random()\ningiza("? ")\nandika(x == x)', prints('? a\nTrue\n'), { inputs: ['a'] })

// --- lessons ---
for (const lesson of lessons) {
  add('lessons', `${lesson.order} ${lesson.id}: example (Pyswahili)`, lesson.example.codeSw, okWithOutput)
  add('lessons', `${lesson.order} ${lesson.id}: example (Python)`, lesson.example.codeEn, okWithOutput)
  add('lessons', `${lesson.order} ${lesson.id}: model answer (Pyswahili)`, lesson.test.solutionSw, okWithOutput)
  add('lessons', `${lesson.order} ${lesson.id}: model answer (Python)`, lesson.test.solutionEn, okWithOutput)
}

// --- practice tasks ---
for (const task of practiceTests) {
  add('practice', `${task.id}: starter (Pyswahili) runs`, task.starterSw, ok)
  add('practice', `${task.id}: starter (Python) runs`, task.starterEn, ok)
  add('practice', `${task.id}: model answer gives the expected output`, PRACTICE_ANSWERS[task.id], prints(task.expectedOutput))
}

// --- dictionary and playground ---
for (const [word, code] of Object.entries(KEYWORD_EXAMPLES)) add('dictionary', word, code, okWithOutput, { inputs: ['Asha'] })
for (const sample of SAMPLES) add('playground', sample.id, sample.code, okWithOutput, { inputs: ['Asha'] })

const { server, url } = await serveDist(PORT)
const browser = await launch()
const failures = []
try {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForFunction('window.pyswahili && typeof window.pyswahili.run === "function"')

  const started = Date.now()
  let group = ''
  for (const test of cases) {
    if (test.group !== group) {
      group = test.group
      console.log(`\n${group}`)
    }
    const result = await page.evaluate(
      (code, options) => {
        const answers = options.inputs ? [...options.inputs] : null
        return window.pyswahili.run(code, {
          timeoutMs: options.timeoutMs,
          requestInput: options.noInput ? undefined : async () => (answers && answers.length ? answers.shift() : null),
        })
      },
      test.code,
      test.options,
    )
    const problem = test.expect(result)
    console.log(`  ${problem ? 'FAIL' : 'ok  '} ${test.name}`)
    if (problem) {
      console.log(`       ${problem}`)
      failures.push(`${test.group} / ${test.name}: ${problem}`)
    }
  }
  if (pageErrors.length) failures.push(`page errors: ${pageErrors.join('; ')}`)
  console.log(`\n${cases.length - failures.length}/${cases.length} programs behaved as expected in ${((Date.now() - started) / 1000).toFixed(1)} s`)
} finally {
  await browser.close()
  server.close()
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.map((f) => `- ${f}`).join('\n')}`)
  process.exit(1)
}
