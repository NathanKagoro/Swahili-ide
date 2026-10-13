// Kanga pattern generator. Pure functions that return small SVG tiles, used
// for the cloth border (pindo), the edging band and the dictionary swatches.
// It runs in the browser, at build time (first paint) and in Node (preview image).

export const DYE = {
  indigo: '#1c1f52',
  ink: '#0d0f2b',
  turmeric: '#f0ae1b',
  madder: '#b4281e',
  cotton: '#f5eedc',
}

// ground, main motif colour, second colour, fine line colour
const COLOURWAYS = [
  [DYE.madder, DYE.turmeric, DYE.cotton, DYE.indigo],
  [DYE.turmeric, DYE.indigo, DYE.madder, DYE.cotton],
  [DYE.cotton, DYE.madder, DYE.indigo, DYE.turmeric],
]

const T = 96 // tile size
const n = (v) => Math.round(v * 100) / 100

function petals(count, rx, ry, dist, fill) {
  let out = ''
  for (let i = 0; i < count; i += 1) {
    out += `<ellipse rx="${rx}" ry="${ry}" cy="${-dist}" fill="${fill}" transform="rotate(${n((360 / count) * i)})"/>`
  }
  return out
}

function ringOfDots(count, r, dist, fill) {
  let out = ''
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count
    out += `<circle cx="${n(Math.cos(a) * dist)}" cy="${n(Math.sin(a) * dist)}" r="${r}" fill="${fill}"/>`
  }
  return out
}

// Each motif draws around (0,0) within roughly a 44 px box.
const MOTIFS = {
  // jua: sun rosette
  jua: ([, a, b, line]) =>
    `${petals(8, 4.5, 9, 12, a)}<circle r="7.5" fill="${b}"/><circle r="3" fill="${line}"/>${ringOfDots(8, 1.6, 20.5, b)}`,
  // almasi: nested diamonds
  almasi: ([g, a, b, line]) =>
    `<path d="M0-21 21 0 0 21-21 0Z" fill="${a}"/><path d="M0-14 14 0 0 14-14 0Z" fill="${g}"/><path d="M0-8 8 0 0 8-8 0Z" fill="${b}"/><circle r="2.2" fill="${line}"/>`,
  // korosho: the cashew (paisley) shape common on kanga
  korosho: ([g, a, b, line]) =>
    `<path d="M-2-21C13-21 19-6 12 6 6 17-9 19-14 9-18 1-12-7-5-5 0-3 0 4-4 4-7 4-8 1-7-1" fill="${a}"/><path d="M0-14C8-14 12-5 8 2 5 8-3 10-7 6" fill="none" stroke="${g}" stroke-width="2.4" stroke-linecap="round"/><circle cx="3" cy="-4" r="3" fill="${b}"/><circle cx="-16" cy="-15" r="2" fill="${line}"/>`,
  // majani: leaf sprig
  majani: ([, a, b, line]) =>
    `<path d="M0 21V-20" stroke="${line}" stroke-width="2" stroke-linecap="round"/>` +
    [-12, -1, 10]
      .map(
        (y, i) =>
          `<ellipse rx="9" ry="4" cx="-9" cy="${y}" fill="${i % 2 ? b : a}" transform="rotate(28 -9 ${y})"/><ellipse rx="9" ry="4" cx="9" cy="${y}" fill="${i % 2 ? b : a}" transform="rotate(-28 9 ${y})"/>`,
      )
      .join('') +
    `<circle cy="-22" r="3" fill="${b}"/>`,
  // nyota: eight-pointed star
  nyota: ([g, a, b, line]) =>
    `<path d="M-15-15H15V15H-15Z" fill="${a}"/><path d="M0-21 21 0 0 21-21 0Z" fill="${a}"/><circle r="9" fill="${g}"/><circle r="5" fill="${b}"/><circle r="1.8" fill="${line}"/>`,
  // mawimbi: shell fans
  mawimbi: ([g, a, b, line]) =>
    `<path d="M-21 10A21 21 0 0 1 21 10Z" fill="${a}"/><path d="M-14 10A14 14 0 0 1 14 10Z" fill="${g}"/><path d="M-8 10A8 8 0 0 1 8 10Z" fill="${b}"/><path d="M-21 15H21" stroke="${line}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>`,
}

export const MOTIF_NAMES = Object.keys(MOTIFS)

function filler([, a, b, line], kind) {
  if (kind === 0) return `<circle r="3.4" fill="${b}"/>${ringOfDots(4, 1.5, 8, line)}`
  if (kind === 1) return `<path d="M0-7 7 0 0 7-7 0Z" fill="${b}"/><circle r="2" fill="${a}"/>`
  return `<path d="M-7 0H7M0-7V7" stroke="${b}" stroke-width="2.6" stroke-linecap="round"/><circle r="2" fill="${line}"/>`
}

function design(seed) {
  const s = Math.abs(Math.floor(seed)) || 0
  return { motif: MOTIF_NAMES[s % MOTIF_NAMES.length], colours: COLOURWAYS[(s + Math.floor(s / MOTIF_NAMES.length)) % COLOURWAYS.length], seed: s }
}

// A square repeat: the motif on a half-drop, small fillers in the gaps.
export function pindoTile(seed = 0) {
  const { motif, colours, seed: s } = design(seed)
  const draw = MOTIFS[motif](colours)
  const fill = filler(colours, s % 3)
  const q = T / 4
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">` +
    `<rect width="${T}" height="${T}" fill="${colours[0]}"/>` +
    `<g transform="translate(${q} ${q})">${draw}</g>` +
    `<g transform="translate(${3 * q} ${3 * q}) rotate(${motif === 'korosho' || motif === 'majani' ? 180 : 0})">${draw}</g>` +
    `<g transform="translate(${3 * q} ${q})">${fill}</g><g transform="translate(${q} ${3 * q})">${fill}</g>` +
    `</svg>`
  )
}

// The narrow sawtooth band that edges the cloth inside the pindo.
export function bandTile(seed = 0) {
  const { colours } = design(seed)
  const [g, a, b, line] = colours
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="20" viewBox="0 0 32 20">` +
    `<rect width="32" height="20" fill="${line}"/><path d="M0 20 8 4 16 20Z" fill="${a === line ? b : a}"/><path d="M16 20 24 4 32 20Z" fill="${g === line ? b : g}"/>` +
    `<circle cx="16" cy="5" r="2" fill="${b}"/><circle cx="0" cy="5" r="2" fill="${b}"/><circle cx="32" cy="5" r="2" fill="${b}"/></svg>`
  )
}

// A quiet repeat for the ground between the border and the centre panel.
export function groundTile() {
  const c = '#2b2f72'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">` +
    `<g fill="${c}"><circle cx="11" cy="11" r="1.6"/><circle cx="33" cy="33" r="1.6"/><path d="M33 7.5 36.5 11 33 14.5 29.5 11Z"/><path d="M11 29.5 14.5 33 11 36.5 7.5 33Z"/></g></svg>`
  )
}

export function svgUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}")`
}

export function groundColour(seed = 0) {
  return design(seed).colours[0]
}

// CSS custom properties for a whole cloth.
export function clothVars(seed = 0) {
  return {
    '--pindo': svgUrl(pindoTile(seed)),
    '--ukanda': svgUrl(bandTile(seed)),
    '--pindo-ground': groundColour(seed),
  }
}
