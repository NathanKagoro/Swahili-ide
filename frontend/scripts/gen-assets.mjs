// Generates the favicon, touch icon and the 1200x630 preview image from the
// same kanga generator the site uses. Run with: node scripts/gen-assets.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { DYE, pindoTile, bandTile } from '../src/lib/kanga.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = (name) => resolve(here, '../public', name)
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')

// Favicon: a tiny kanga. Border, dark centre, a turmeric prompt.
const favicon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" fill="${DYE.madder}"/>` +
  `<g fill="${DYE.turmeric}">${[8, 24, 40, 56].map((x) => `<circle cx="${x}" cy="6" r="3"/><circle cx="${x}" cy="58" r="3"/>`).join('')}` +
  `${[22, 42].map((y) => `<circle cx="6" cy="${y}" r="3"/><circle cx="58" cy="${y}" r="3"/>`).join('')}</g>` +
  `<rect x="12" y="12" width="40" height="40" fill="${DYE.ink}" stroke="${DYE.cotton}" stroke-width="3"/>` +
  `<path d="M21 23l10 9-10 9" fill="none" stroke="${DYE.turmeric}" stroke-width="5" stroke-linecap="square"/>` +
  `<rect x="34" y="38" width="11" height="5" fill="${DYE.cotton}"/></svg>`
writeFileSync(out('favicon.svg'), favicon)
await sharp(Buffer.from(favicon), { density: 300 }).resize(180, 180).png().toFile(out('icon-180.png'))

// Preview image. Text is drawn as paths-free SVG text using fonts sharp can
// find on the build machine, so it is generated once and committed.
const W = 1200
const H = 630
const P = 70 // pindo width
const og =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<defs><pattern id="p" width="96" height="96" patternUnits="userSpaceOnUse">${inner(pindoTile(0))}</pattern>` +
  `<pattern id="b" width="32" height="20" patternUnits="userSpaceOnUse">${inner(bandTile(0))}</pattern></defs>` +
  `<rect width="${W}" height="${H}" fill="url(#p)"/>` +
  `<rect x="${P - 14}" y="${P - 14}" width="${W - 2 * P + 28}" height="${H - 2 * P + 28}" fill="${DYE.ink}"/>` +
  `<rect x="${P - 8}" y="${P - 8}" width="${W - 2 * P + 16}" height="${H - 2 * P + 16}" fill="${DYE.cotton}"/>` +
  `<rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" fill="${DYE.indigo}"/>` +
  `<rect x="${P}" y="${P}" width="${W - 2 * P}" height="20" fill="url(#b)"/>` +
  `<text x="120" y="182" font-family="Rockwell Extra Bold, Rockwell, Georgia, serif" font-weight="800" font-size="64" fill="${DYE.cotton}">Andika Python kwa Kiswahili</text>` +
  // the mji
  `<rect x="111" y="213" width="978" height="178" fill="${DYE.madder}"/><rect x="114" y="216" width="972" height="172" fill="${DYE.ink}"/>` +
  `<rect x="117" y="219" width="966" height="166" fill="${DYE.turmeric}"/><rect x="120" y="222" width="960" height="160" fill="${DYE.ink}"/>` +
  `<rect x="144" y="242" width="14" height="14" fill="${DYE.madder}"/><rect x="164" y="242" width="14" height="14" fill="${DYE.turmeric}"/><rect x="184" y="242" width="14" height="14" fill="${DYE.cotton}"/>` +
  `<text x="144" y="318" font-family="Consolas, Courier New, monospace" font-weight="700" font-size="46"><tspan fill="#b3b9ff">andika</tspan><tspan fill="#cfc8b4">(</tspan><tspan fill="#ff9d8e">"Habari, Dunia!"</tspan><tspan fill="#cfc8b4">)</tspan></text>` +
  `<text x="144" y="362" font-family="Consolas, Courier New, monospace" font-size="30" fill="${DYE.cotton}"><tspan fill="${DYE.turmeric}">&gt;&gt;&gt; </tspan>Habari, Dunia!</text>` +
  // the jina
  `<rect x="111" y="420" width="978" height="108" fill="${DYE.madder}"/><rect x="114" y="423" width="972" height="102" fill="${DYE.cotton}"/>` +
  `<rect x="117" y="426" width="966" height="96" fill="${DYE.ink}"/><rect x="120" y="429" width="960" height="90" fill="${DYE.cotton}"/>` +
  `<text x="600" y="490" text-anchor="middle" font-family="Rockwell Extra Bold, Rockwell, Georgia, serif" font-weight="800" font-size="40" letter-spacing="2" fill="${DYE.indigo}">HABA NA HABA HUJAZA KIBABA</text>` +
  `</svg>`
await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true, colours: 64 }).toFile(out('og.png'))
console.log('wrote favicon.svg, icon-180.png, og.png')
