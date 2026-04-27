import { useState } from 'react'

export default function AuthPage({
  authMode,
  language,
  onSetLanguage,
  onSubmitAuth,
  authLoading,
  authError,
  authMessage,
  isLoggedIn,
  authState,
  onLogout,
  onGoHome,
  onSwitchAuthMode,
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const isSignup = authMode === 'signup'

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSubmitAuth(isSignup ? 'register' : 'login', username, password)
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-page-top">
            <button className="ghost-btn" onClick={onGoHome}>
              {language === 'sw' ? 'Rudi IDE' : 'Back to IDE'}
            </button>
            <div className="nav-lang-toggle" aria-label="Global language toggle">
              <button className={language === 'en' ? 'active' : ''} onClick={() => onSetLanguage('en')}>
                English
              </button>
              <button className={language === 'sw' ? 'active' : ''} onClick={() => onSetLanguage('sw')}>
                Kiswahili
              </button>
            </div>
          </div>

          <div>
            <h1>{language === 'sw' ? 'Akaunti ya Swahili IDE' : 'Swahili IDE Account'}</h1>
            <p>
              {language === 'sw'
                ? 'Tumia ukurasa huu kuingia au kufungua akaunti bila kuingilia mantiki ya IDE kuu.'
                : 'Use this separate page to sign in or create an account without interfering with the main IDE flow.'}
            </p>
          </div>

          <div className="auth-copy-list">
            <p>{language === 'sw' ? 'Maendeleo ya somo huhifadhiwa kwenye kifaa na pia kwenye akaunti ukiwa umeingia.' : 'Lesson progress is kept on-device and also synced to your account when signed in.'}</p>
            <p>{language === 'sw' ? 'Unaweza kuendelea kama mgeni wakati wowote.' : 'You can continue as a guest at any time.'}</p>
          </div>
        </section>

        <section className="auth-card">
          <div className="account-switches">
            <button className={!isSignup ? 'active' : ''} onClick={() => onSwitchAuthMode('login')}>
              {language === 'sw' ? 'Ingia' : 'Log In'}
            </button>
            <button className={isSignup ? 'active' : ''} onClick={() => onSwitchAuthMode('register')}>
              {language === 'sw' ? 'Fungua Akaunti' : 'Create Account'}
            </button>
          </div>

          {isLoggedIn ? (
            <div className="auth-authenticated">
              <div>
                <h2>{language === 'sw' ? 'Tayari umeingia' : 'You are already signed in'}</h2>
                <p className="account-badge">{authState?.user?.username}</p>
              </div>
              <div className="auth-actions-row">
                <button className="run-btn" onClick={onGoHome}>
                  {language === 'sw' ? 'Nenda IDE' : 'Go to IDE'}
                </button>
                <button className="ghost-btn" onClick={onLogout}>
                  {language === 'sw' ? 'Toka' : 'Log Out'}
                </button>
              </div>
            </div>
          ) : (
            <form className="auth-form-page" onSubmit={handleSubmit}>
              <div>
                <h2>{isSignup ? (language === 'sw' ? 'Fungua akaunti mpya' : 'Create a new account') : language === 'sw' ? 'Ingia kwenye akaunti yako' : 'Sign in to your account'}</h2>
                <p className="auth-alt-text">
                  {isSignup
                    ? language === 'sw'
                      ? 'Jina la mtumiaji linahifadhiwa kwa herufi ndogo na maendeleo yako yatasawazishwa ukishaingia.'
                      : 'Usernames are stored in lowercase and your progress will sync after sign-in.'
                    : language === 'sw'
                      ? 'Ukiingia, maendeleo ya kifaa hiki yataunganishwa na akaunti yako.'
                      : 'Signing in merges this device\'s lesson progress into your account.'}
                </p>
              </div>

              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={language === 'sw' ? 'Jina la mtumiaji' : 'Username'}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={language === 'sw' ? 'Nenosiri' : 'Password'}
              />

              <div className="auth-actions-row">
                <button
                  className="run-btn"
                  type="submit"
                  disabled={authLoading || username.trim().length < 3 || password.length < 6}
                >
                  {authLoading
                    ? language === 'sw'
                      ? 'Inahifadhi...'
                      : 'Saving...'
                    : isSignup
                      ? language === 'sw'
                        ? 'Tengeneza Akaunti'
                        : 'Create Account'
                      : language === 'sw'
                        ? 'Ingia'
                        : 'Log In'}
                </button>
                <button className="ghost-btn" type="button" onClick={onGoHome}>
                  {language === 'sw' ? 'Endelea kama Mgeni' : 'Continue as Guest'}
                </button>
              </div>
            </form>
          )}

          {authError ? <p className="nav-status fail-msg auth-status">{authError}</p> : null}
          {authMessage ? <p className="nav-status pass-msg auth-status">{authMessage}</p> : null}
        </section>
      </div>
    </div>
  )
}