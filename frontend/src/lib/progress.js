// Lesson progress lives in this browser only (localStorage). There are no
// accounts and nothing is sent anywhere.
export const PROGRESS_KEY = 'swahili-ide-completed-lessons'

function storageOrNull(storage) {
  if (storage) return storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // storage blocked (private mode, sandboxed frame)
  }
}

// Returns { lessonId: true } for completed lessons. Never throws: corrupt or
// foreign data reads as "nothing completed".
export function loadProgress(validIds, storage) {
  const store = storageOrNull(storage)
  if (!store) return {}
  let parsed
  try {
    parsed = JSON.parse(store.getItem(PROGRESS_KEY) || '{}')
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const allowed = validIds ? new Set(validIds) : null
  const clean = {}
  for (const [id, done] of Object.entries(parsed)) {
    if (done === true && (!allowed || allowed.has(id))) clean[id] = true
  }
  return clean
}

export function saveProgress(progress, storage) {
  const store = storageOrNull(storage)
  if (!store) return false
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false // quota exceeded or storage blocked
  }
}

export function markComplete(progress, lessonId) {
  if (progress[lessonId]) return progress
  return { ...progress, [lessonId]: true }
}

export function clearProgress(storage) {
  const store = storageOrNull(storage)
  try {
    store?.removeItem(PROGRESS_KEY)
  } catch {
    /* nothing to clear */
  }
  return {}
}

export function countComplete(progress, validIds) {
  return validIds.filter((id) => progress[id]).length
}

// Small helpers for other per-browser conveniences (language, draft code).
export function readPref(key, fallback, storage) {
  const store = storageOrNull(storage)
  try {
    const v = store?.getItem(key)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function writePref(key, value, storage) {
  const store = storageOrNull(storage)
  try {
    store?.setItem(key, value)
  } catch {
    /* convenience only */
  }
}
