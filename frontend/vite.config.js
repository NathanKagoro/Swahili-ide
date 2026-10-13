import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { clothVars, groundTile, svgUrl } from './src/lib/kanga.js'

// The site is served from https://nathankagoro.github.io/Swahili-ide/.
// Override with VITE_BASE=/ for a deployment at a domain root.
const base = process.env.VITE_BASE || '/Swahili-ide/'

// Puts the default cloth pattern in the HTML so the border is there at first
// paint, before any script has run.
function kangaFirstPaint() {
  return {
    name: 'kanga-first-paint',
    transformIndexHtml(html) {
      const vars = { ...clothVars(0), '--ground': svgUrl(groundTile()) }
      const css = `:root{${Object.entries(vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')}}`
      return html.replace('</head>', `<style id="kanga-vars">${css}</style></head>`)
    },
  }
}

// GitHub Pages serves 404.html for unknown paths; a copy of the app keeps old
// links such as /login landing on the working page.
function spaFallback() {
  let outDir = 'dist'
  return {
    name: 'spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), kangaFirstPaint(), spaFallback()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer') || id.includes('style-mod') || id.includes('w3c-keyname') || id.includes('crelt')) return 'editor'
          return undefined
        },
      },
    },
  },
  server: { port: 4370, strictPort: true },
  preview: { port: 4371, strictPort: true },
  test: { include: ['tests/**/*.test.js'], environment: 'node' },
})
