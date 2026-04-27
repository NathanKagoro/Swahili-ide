export default function Console({ output, error, compact = false }) {
  return (
    <div className={`console ${compact ? 'compact' : ''}`}>
      {error ? <pre className="error">{error}</pre> : <pre>{output || 'Hakuna output bado.'}</pre>}
    </div>
  )
}
