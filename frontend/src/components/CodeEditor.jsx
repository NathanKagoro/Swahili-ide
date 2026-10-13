import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'

// Code editor. A plain textarea is shown at once and is fully usable; the
// CodeMirror chunk (highlighting, indentation, completion) replaces it when it
// has loaded. Both keep `value` and `onChange` in step.
const CodeEditor = forwardRef(function CodeEditor({ value, onChange, onRun, label, placeholder }, ref) {
  const hostRef = useRef(null)
  const areaRef = useRef(null)
  const handleRef = useRef(null)
  const latest = useRef({ value, onChange, onRun })
  latest.current = { value, onChange, onRun }
  const [enhanced, setEnhanced] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('../lib/cm.js').then(({ createEditor }) => {
      if (cancelled || !hostRef.current) return
      const area = areaRef.current
      const hadFocus = area && document.activeElement === area
      handleRef.current = createEditor(hostRef.current, {
        doc: latest.current.value,
        label,
        placeholder,
        onChange: (text) => latest.current.onChange?.(text),
        onRun: () => latest.current.onRun?.(),
      })
      setEnhanced(true)
      if (hadFocus) handleRef.current.focus()
    })
    return () => {
      cancelled = true
      handleRef.current?.destroy()
      handleRef.current = null
    }
    // The editor is created once; label and placeholder do not change for a mounted editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    handleRef.current?.setDoc(value)
  }, [value, enhanced])

  useImperativeHandle(ref, () => ({
    insert(text) {
      if (handleRef.current) {
        handleRef.current.insert(text)
        return
      }
      const area = areaRef.current
      if (!area) return
      const start = area.selectionStart ?? area.value.length
      const end = area.selectionEnd ?? start
      const next = area.value.slice(0, start) + text + area.value.slice(end)
      latest.current.onChange?.(next)
      requestAnimationFrame(() => {
        area.focus()
        area.setSelectionRange(start + text.length, start + text.length)
      })
    },
    focus() {
      if (handleRef.current) handleRef.current.focus()
      else areaRef.current?.focus()
    },
  }))

  return (
    <div className="editor" ref={hostRef}>
      {!enhanced && (
        <textarea
          ref={areaRef}
          className="editor-plain"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              onRun?.()
            }
          }}
          aria-label={label}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      )}
    </div>
  )
})

export default CodeEditor
