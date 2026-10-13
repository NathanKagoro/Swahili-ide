// Shared helpers for the headless scripts: a static server for dist/ under the
// GitHub Pages base path, and a Chrome launcher.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const BASE = '/Swahili-ide/'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

export function serveDist(port) {
  const dist = join(root, 'dist')
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ is missing. Run "npm run build" first.')
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end('outside base')
      return
    }
    let file = join(dist, path.slice(BASE.length) || 'index.html')
    if (!file.startsWith(dist)) {
      res.writeHead(403).end()
      return
    }
    let status = 200
    if (!existsSync(file) || statSync(file).isDirectory()) {
      file = join(dist, '404.html')
      status = 404
    }
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${port}${BASE}` })))
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const found = candidates.find((path) => existsSync(path))
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH.')
  return found
}

export function launch() {
  return puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
}
