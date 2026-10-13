import { beforeEach, describe, expect, it } from 'vitest'
import { PROGRESS_KEY, clearProgress, countComplete, loadProgress, markComplete, readPref, saveProgress, writePref } from '../src/lib/progress.js'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  }
}

const brokenStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('quota')
  },
  removeItem() {
    throw new Error('blocked')
  },
}

const IDS = ['utangulizi', 'sintaksia', 'vigezo']

describe('progress storage', () => {
  let store
  beforeEach(() => {
    store = memoryStorage()
  })

  it('starts empty', () => {
    expect(loadProgress(IDS, store)).toEqual({})
  })

  it('saves and loads completed lessons', () => {
    const progress = markComplete(markComplete({}, 'utangulizi'), 'vigezo')
    expect(saveProgress(progress, store)).toBe(true)
    expect(loadProgress(IDS, store)).toEqual({ utangulizi: true, vigezo: true })
  })

  it('uses the same key as the original app, so old progress carries over', () => {
    expect(PROGRESS_KEY).toBe('swahili-ide-completed-lessons')
    store.setItem(PROGRESS_KEY, JSON.stringify({ sintaksia: true }))
    expect(loadProgress(IDS, store)).toEqual({ sintaksia: true })
  })

  it('markComplete does not mutate and is idempotent', () => {
    const before = { utangulizi: true }
    const after = markComplete(before, 'vigezo')
    expect(before).toEqual({ utangulizi: true })
    expect(after).toEqual({ utangulizi: true, vigezo: true })
    expect(markComplete(after, 'vigezo')).toBe(after)
  })

  it('drops unknown lesson ids and values that are not true', () => {
    store.setItem(PROGRESS_KEY, JSON.stringify({ utangulizi: true, ghost: true, sintaksia: false, vigezo: 'yes' }))
    expect(loadProgress(IDS, store)).toEqual({ utangulizi: true })
  })

  it('treats corrupt or wrong-shaped data as no progress', () => {
    for (const bad of ['{not json', '[1,2]', '"text"', 'null', '42']) {
      store.setItem(PROGRESS_KEY, bad)
      expect(loadProgress(IDS, store), bad).toEqual({})
    }
  })

  it('never throws when storage is blocked', () => {
    expect(loadProgress(IDS, brokenStorage)).toEqual({})
    expect(saveProgress({ utangulizi: true }, brokenStorage)).toBe(false)
    expect(clearProgress(brokenStorage)).toEqual({})
    expect(readPref('x', 'fallback', brokenStorage)).toBe('fallback')
    expect(() => writePref('x', '1', brokenStorage)).not.toThrow()
  })

  it('clears progress', () => {
    saveProgress({ utangulizi: true }, store)
    expect(clearProgress(store)).toEqual({})
    expect(loadProgress(IDS, store)).toEqual({})
  })

  it('counts completed lessons against the lesson list', () => {
    expect(countComplete({ utangulizi: true, ghost: true }, IDS)).toBe(1)
    expect(countComplete({}, IDS)).toBe(0)
  })

  it('reads and writes simple preferences', () => {
    expect(readPref('lang', 'sw', store)).toBe('sw')
    writePref('lang', 'en', store)
    expect(readPref('lang', 'sw', store)).toBe('en')
  })
})
