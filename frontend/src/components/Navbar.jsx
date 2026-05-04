export default function Navbar({
  mode,
  language,
  onSetLanguage,
  onSwitchBasic,
  onSwitchLearn,
  onSwitchTests,
  isLoggedIn,
  authState,
  onLogout,
  authError,
  authMessage,
  onOpenLogin,
  onOpenSignup,
}) {
  return (
    <header className="navbar">
      <div className="navbar-zone navbar-left">
        <button className="ghost-btn" onClick={mode === 'learn' ? onSwitchBasic : onSwitchLearn}>
          {mode === 'learn'
            ? (language === 'sw' ? 'Nenda IDE' : 'Go to IDE')
            : (language === 'sw' ? 'Masomo' : 'Lessons')}
        </button>
        <button className="ghost-btn" onClick={onSwitchTests}>
          {language === 'sw' ? 'Majaribio' : 'Tests'}
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

      <div className="navbar-title-wrap">
        <h1>Swahili IDE</h1>
      </div>

      <div className="navbar-zone navbar-right">
        <div className="nav-account-shell">
          {isLoggedIn ? (
            <div className="nav-account-logged-in">
              <span className="account-badge">{authState?.user?.username}</span>
              <button className="ghost-btn" onClick={onLogout}>
                {language === 'sw' ? 'Toka' : 'Log Out'}
              </button>
            </div>
          ) : (
            <div className="nav-account-guest">
              <div className="account-switches nav-account-switches">
                <button onClick={onOpenLogin}>
                  {language === 'sw' ? 'Ingia' : 'Log In'}
                </button>
                <button onClick={onOpenSignup}>
                  {language === 'sw' ? 'Fungua Akaunti' : 'Create Account'}
                </button>
              </div>
            </div>
          )}

          {authError ? <p className="nav-status fail-msg">{authError}</p> : null}
          {authMessage ? <p className="nav-status pass-msg">{authMessage}</p> : null}
        </div>

        <a href="https://nathankagoro.com" target="_blank" rel="noopener noreferrer" className="nav-portfolio-pill" title="Portfolio">
          {language === 'sw' ? 'Kazi' : 'Portfolio'}
        </a>
      </div>
    </header>
  )
}
