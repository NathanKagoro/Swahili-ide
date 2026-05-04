export default function Console({ output, error, compact = false, language = 'sw' }) {
  return (
    <div className={`console ${compact ? 'compact' : ''}`}>
      {error ? <pre className="error">{error}</pre> : <pre>{output || (language === 'sw' ? 'Hakuna output bado.' : 'No output yet.')}</pre>}
    </div>
  )
}
