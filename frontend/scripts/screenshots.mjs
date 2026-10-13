// Takes screenshots of the built site at 1440, 390 and 360 px, and fails if a
// page logs an error or scrolls sideways. Output: frontend/shots/*.png
//
//   npm run build && npm run shots
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch, root, serveDist } from './lib.mjs'

const PORT = Number(process.env.PORT || 4373)
const WIDTHS = [
  [1440, 900],
  [390, 844],
  [360, 740],
]
const PAGES = [
  ['uwanja', '#/'],
  ['somo', '#/masomo/marudio-ikiwa'],
  ['mazoezi', '#/mazoezi'],
  ['kamusi', '#/kamusi'],
]

const outDir = join(root, 'shots')
mkdirSync(outDir, { recursive: true })
const { server, url } = await serveDist(PORT)
const browser = await launch()
const problems = []
try {
  for (const [width, height] of WIDTHS) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 })
    page.on('console', (msg) => msg.type() === 'error' && problems.push(`${width}px console: ${msg.text()}`))
    page.on('pageerror', (err) => problems.push(`${width}px page error: ${err}`))
    page.on('response', (res) => res.status() >= 400 && problems.push(`${width}px HTTP ${res.status()} ${res.url()}`))
    for (const [name, hash] of PAGES) {
      await page.goto(`${url}${hash}`, { waitUntil: 'networkidle0' })
      await page.evaluate(() => document.fonts.ready)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 1) problems.push(`${width}px ${name}: scrolls sideways by ${overflow}px`)
      await page.screenshot({ path: join(outDir, `${name}-${width}.png`), fullPage: true })
    }
    // The landing page after pressing Run, so the output is in a screenshot too.
    await page.goto(`${url}#/`, { waitUntil: 'networkidle0' })
    await page.click('.btn-run')
    await page.waitForSelector('.console-text', { timeout: 90_000 })
    await page.screenshot({ path: join(outDir, `uwanja-baada-ya-kuendesha-${width}.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
  server.close()
}
console.log(`screenshots written to ${outDir}`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
