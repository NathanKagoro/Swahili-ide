import { useEffect, useState } from 'react'
import IDE from './pages/IDE'
import AuthPage from './pages/AuthPage'
import { fetchProgress, loginAccount, logoutAccount, registerAccount, updateProgress } from './services/api'

const progressStorageKey = 'swahili-ide-completed-lessons'
const authStorageKey = 'swahili-ide-auth'

function mergeCompletedLessons(localMap, remoteMap) {
  const merged = { ...(remoteMap || {}) }
  Object.entries(localMap || {}).forEach(([lessonId, value]) => {
    if (value) {
      merged[lessonId] = true
    }
  })
  return merged
}

function resolveRoute(pathname) {
  if (pathname === '/login') {
    return 'login'
  }
  if (pathname === '/signup') {
    return 'signup'
  }
  return 'ide'
}

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname))
  const [language, setLanguage] = useState('sw')
  const [completedLessons, setCompletedLessons] = useState(() => {
    const raw = localStorage.getItem(progressStorageKey)
    return raw ? JSON.parse(raw) : {}
  })
  const [authState, setAuthState] = useState(() => {
    const raw = localStorage.getItem(authStorageKey)
    return raw ? JSON.parse(raw) : null
  })
  const [progressReady, setProgressReady] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const isLoggedIn = Boolean(authState?.token)

  useEffect(() => {
    const onPopState = () => setRoute(resolveRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSavedProgress() {
      if (!authState?.token) {
        setProgressReady(true)
        return
      }

      try {
        const data = await fetchProgress(authState.token)
        if (cancelled) {
          return
        }

        const localRaw = localStorage.getItem(progressStorageKey)
        const localMap = localRaw ? JSON.parse(localRaw) : {}
        const merged = mergeCompletedLessons(localMap, data.completed_lessons)
        setCompletedLessons(merged)
        localStorage.setItem(progressStorageKey, JSON.stringify(merged))

        if (JSON.stringify(merged) !== JSON.stringify(data.completed_lessons)) {
          await updateProgress(authState.token, merged)
        }

        setAuthMessage(language === 'sw' ? 'Maendeleo yako yamehifadhiwa kwenye akaunti.' : 'Your progress is now saved to your account.')
      } catch {
        if (!cancelled) {
          setAuthState(null)
          localStorage.removeItem(authStorageKey)
          setAuthError(language === 'sw' ? 'Kikao cha akaunti kimeisha. Unaendelea kama mgeni.' : 'Your session expired. Continuing as guest.')
        }
      } finally {
        if (!cancelled) {
          setProgressReady(true)
        }
      }
    }

    loadSavedProgress()

    return () => {
      cancelled = true
    }
  }, [authState?.token, language])

  useEffect(() => {
    localStorage.setItem(progressStorageKey, JSON.stringify(completedLessons))
    if (!progressReady || !authState?.token) {
      return
    }

    updateProgress(authState.token, completedLessons).catch(() => {
      setAuthError(language === 'sw' ? 'Imeshindikana kusawazisha maendeleo kwa sasa.' : 'Could not sync progress right now.')
    })
  }, [authState?.token, completedLessons, progressReady, language])

  const persistAuth = (nextAuthState) => {
    setAuthState(nextAuthState)
    if (nextAuthState) {
      localStorage.setItem(authStorageKey, JSON.stringify(nextAuthState))
    } else {
      localStorage.removeItem(authStorageKey)
    }
  }

  const goTo = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setRoute(resolveRoute(path))
    window.scrollTo(0, 0)
  }

  const handleAuthSubmit = async (nextView, username, password) => {
    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const data = nextView === 'register'
        ? await registerAccount(username, password)
        : await loginAccount(username, password)

      const merged = mergeCompletedLessons(completedLessons, data.completed_lessons)
      persistAuth({ token: data.token, user: data.user })
      setCompletedLessons(merged)
      localStorage.setItem(progressStorageKey, JSON.stringify(merged))

      if (JSON.stringify(merged) !== JSON.stringify(data.completed_lessons)) {
        await updateProgress(data.token, merged)
      }

      setAuthMessage(
        language === 'sw'
          ? 'Umeingia. Maendeleo yako sasa yatahifadhiwa kwenye akaunti.'
          : 'You are signed in. Your progress will now be saved to your account.',
      )
      setProgressReady(true)
      goTo('/')
    } catch (err) {
      setAuthError(err?.response?.data?.detail || err?.message || (language === 'sw' ? 'Imeshindikana kuingia kwenye akaunti.' : 'Could not sign in.'))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    const token = authState?.token
    persistAuth(null)
    setAuthMessage(language === 'sw' ? 'Unaendelea kama mgeni. Maendeleo ya ndani bado yapo kwenye kifaa hiki.' : 'You are now continuing as a guest. Local progress remains on this device.')

    if (token) {
      try {
        await logoutAccount(token)
      } catch {
        // Ignore logout failures after local session is cleared.
      }
    }
  }

  if (route === 'login' || route === 'signup') {
    return (
      <AuthPage
        authMode={route}
        language={language}
        onSetLanguage={setLanguage}
        onSubmitAuth={handleAuthSubmit}
        authLoading={authLoading}
        authError={authError}
        authMessage={authMessage}
        isLoggedIn={isLoggedIn}
        authState={authState}
        onLogout={handleLogout}
        onGoHome={() => goTo('/')}
        onSwitchAuthMode={(mode) => goTo(mode === 'register' ? '/signup' : '/login')}
      />
    )
  }

  return (
    <IDE
      language={language}
      onSetLanguage={setLanguage}
      authState={authState}
      isLoggedIn={isLoggedIn}
      authError={authError}
      authMessage={authMessage}
      onLogout={handleLogout}
      onOpenLogin={() => goTo('/login')}
      onOpenSignup={() => goTo('/signup')}
      completedLessons={completedLessons}
      onSetCompletedLessons={setCompletedLessons}
    />
  )
}
