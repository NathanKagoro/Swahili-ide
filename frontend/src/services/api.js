import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

// Build auth headers only when a token exists.
function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function runSwahili(code) {
  const { data } = await api.post('/run-swahili', { code })
  return data
}

export async function registerAccount(username, password) {
  const { data } = await api.post('/auth/register', { username, password })
  return data
}

export async function loginAccount(username, password) {
  const { data } = await api.post('/auth/login', { username, password })
  return data
}

export async function logoutAccount(token) {
  const { data } = await api.post('/auth/logout', null, { headers: authHeaders(token) })
  return data
}

export async function fetchProgress(token) {
  const { data } = await api.get('/progress', { headers: authHeaders(token) })
  return data
}

export async function updateProgress(token, completedLessons) {
  const { data } = await api.put(
    '/progress',
    { completed_lessons: completedLessons },
    { headers: authHeaders(token) },
  )
  return data
}

export async function transcribeAudio(file, lang = 'sw') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('lang', lang)
  const { data } = await api.post('/transcribe', formData)
  return data
}

export async function fetchVoiceTutorConfig() {
  const { data } = await api.get('/voice/tutor/config')
  return data
}

export async function speakText(text, lang = 'sw', lessonId = null) {
  const { data } = await api.post('/speak', {
    text,
    lang,
    lesson_id: lessonId,
  })
  return data
}

export async function explainCode(prompt, targetLanguage = 'en', runtimeContext = {}) {
  // Keep runtime context visible in dev tools while we iterate on prompt behavior.
  console.info('LLM context payload (/explain):', runtimeContext)
  const { data } = await api.post('/explain', {
    prompt,
    target_language: targetLanguage,
    runtime_context: runtimeContext,
  })
  return data
}

export async function generateCode(prompt, targetLanguage = 'en', runtimeContext = {}) {
  // Keep runtime context visible in dev tools while we iterate on prompt behavior.
  console.info('LLM context payload (/generate):', runtimeContext)
  const { data } = await api.post('/generate', {
    prompt,
    target_language: targetLanguage,
    runtime_context: runtimeContext,
  })
  return data
}

export async function fetchChatHistory(token, limit = 20) {
  const { data } = await api.get('/chat/history', {
    params: { limit },
    headers: authHeaders(token),
  })
  return data
}

export async function saveChatHistory(token, messages) {
  const { data } = await api.post(
    '/chat/history',
    { messages },
    { headers: authHeaders(token) },
  )
  return data
}

