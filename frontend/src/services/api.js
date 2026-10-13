// Code always runs in the browser (see ../runner/runner.js).
//
// Everything else in this file talks to the optional FastAPI backend in
// /backend. The public site is built without VITE_API_URL, so none of it is
// called there. Set VITE_API_URL at build time (for example
// http://127.0.0.1:8000/api) to switch the backend features on.
export { runSwahili } from '../runner/runner.js'

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
export const backendConfigured = Boolean(API_URL)

async function request(path, { method = 'GET', body, form, timeoutMs = 60_000 } = {}) {
  if (!backendConfigured) throw new Error('No backend configured')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body ? JSON.stringify(body) : undefined),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

// The backend exposes /health at its root, one level above /api.
// Resolves to true or false. It never throws and never logs.
export async function checkBackend() {
  if (!backendConfigured) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${API_URL.replace(/\/api$/, '')}/health`, { signal: controller.signal })
    if (!response.ok) return false
    const data = await response.json().catch(() => null)
    return data?.status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function transcribeAudio(file, lang = 'sw') {
  const form = new FormData()
  form.append('file', file)
  form.append('lang', lang)
  return request('/transcribe', { method: 'POST', form })
}

export function fetchVoiceTutorConfig() {
  return request('/voice/tutor/config')
}

export function speakText(text, lang = 'sw', lessonId = null) {
  return request('/speak', { method: 'POST', body: { text, lang, lesson_id: lessonId } })
}

export function explainCode(prompt, targetLanguage = 'en', runtimeContext = {}) {
  return request('/explain', {
    method: 'POST',
    body: { prompt, target_language: targetLanguage, runtime_context: runtimeContext },
  })
}

export function generateCode(prompt, targetLanguage = 'en', runtimeContext = {}) {
  return request('/generate', {
    method: 'POST',
    body: { prompt, target_language: targetLanguage, runtime_context: runtimeContext },
  })
}
