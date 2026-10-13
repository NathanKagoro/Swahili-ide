// CodeMirror 6 set-up with Pyswahili highlighting. This module is loaded on
// demand (dynamic import) so the first paint does not wait for it.
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit, bracketMatching } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'
import { KEYWORDS, KIND_OF, PY_KEYWORDS, PY_BUILTINS } from './keywords.js'

const DEDENT_AFTER = new Set(['rudisha', 'vunja', 'endelea', 'return', 'break', 'continue', 'pass', 'raise'])
const WORD = /^[\p{L}_][\p{L}\p{N}_]*/u

function readTriple(stream, state) {
  while (!stream.eol()) {
    if (stream.match(state.triple)) {
      state.triple = null
      return
    }
    stream.next()
  }
}

const pyswahili = StreamLanguage.define({
  name: 'pyswahili',
  startState: () => ({ triple: null, lineIndent: 0, last: '', first: '' }),
  token(stream, state) {
    if (stream.sol()) {
      state.lineIndent = stream.indentation()
      state.first = ''
      if (!state.triple) state.last = ''
    }
    if (state.triple) {
      readTriple(stream, state)
      return 'string'
    }
    if (stream.eatSpace()) return null
    if (stream.peek() === '#') {
      stream.skipToEnd()
      return 'comment'
    }
    const triple = stream.match(/^[rRuUbBfF]{0,2}("""|''')/)
    if (triple) {
      state.triple = triple[1]
      state.last = 's'
      readTriple(stream, state)
      return 'string'
    }
    const quote = stream.match(/^[rRuUbBfF]{0,2}(["'])/)
    if (quote) {
      while (!stream.eol()) {
        const ch = stream.next()
        if (ch === '\\') stream.next()
        else if (ch === quote[1]) break
      }
      state.last = 's'
      return 'string'
    }
    if (stream.match(/^\d[\w.]*/)) {
      state.last = '0'
      return 'number'
    }
    if (stream.match(WORD)) {
      const word = stream.current()
      if (!state.first) state.first = word
      state.last = 'w'
      const kind = KIND_OF[word]
      if (kind === 'thamani' || word === 'True' || word === 'False' || word === 'None') return 'atom'
      if (kind === 'neno-kuu' || PY_KEYWORDS.has(word)) return 'keyword'
      if (kind === 'kazi' || PY_BUILTINS.has(word)) return 'variableName.standard'
      return 'variableName'
    }
    state.last = stream.next()
    return 'operator'
  },
  indent(state, textAfter, context) {
    if (state.triple) return null
    let col = state.lineIndent
    if (state.last === ':') col += context.unit
    else if (DEDENT_AFTER.has(state.first)) col -= context.unit
    if (/^\s*(zaidi|pia|ila|else|elif|except|finally)\b/.test(textAfter) && state.last !== ':') col -= context.unit
    return Math.max(0, col)
  },
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
  },
})

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-keyword)', fontWeight: '700' },
  { tag: tags.atom, color: 'var(--code-atom)', fontWeight: '700' },
  { tag: tags.standard(tags.variableName), color: 'var(--code-builtin)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: tags.operator, color: 'var(--code-punct)' },
])

const theme = EditorView.theme(
  {
    '&': { color: 'var(--code-text)', backgroundColor: 'transparent', height: '100%' },
    '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.6', overflow: 'auto' },
    '.cm-content': { caretColor: 'var(--turmeric)', padding: '12px 0' },
    '.cm-line': { padding: '0 14px 0 8px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--code-gutter)', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 12px', minWidth: '2.2em' },
    '.cm-activeLine': { backgroundColor: 'rgba(240, 174, 27, 0.07)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--turmeric)', borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(240, 174, 27, 0.28)',
    },
    '.cm-matchingBracket': { backgroundColor: 'rgba(245, 238, 220, 0.2)', outline: '1px solid var(--code-gutter)' },
    '.cm-placeholder': { color: 'var(--code-comment)' },
    '.cm-tooltip': { backgroundColor: 'var(--cotton)', color: 'var(--indigo)', border: '2px solid var(--turmeric)', borderRadius: '0' },
    '.cm-tooltip-autocomplete ul li': { padding: '6px 10px', fontFamily: 'var(--font-code)' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--indigo)', color: 'var(--cotton)' },
    '.cm-completionDetail': { fontStyle: 'normal', opacity: '0.8', marginLeft: '1em' },
  },
  { dark: true },
)

const options = KEYWORDS.map((k) => ({
  label: k.sw,
  detail: k.en,
  type: k.kind === 'kazi' ? 'function' : k.kind === 'thamani' ? 'constant' : 'keyword',
}))

function completeKeywords(context) {
  const word = context.matchBefore(/[\p{L}_][\p{L}\p{N}_]*/u)
  if (!word || (word.text.length < 2 && !context.explicit)) return null
  return { from: word.from, options, validFor: /^[\p{L}\p{N}_]*$/u }
}

// Mount an editor in `parent`. Returns a small handle used by the React wrapper.
export function createEditor(parent, { doc = '', onChange, onRun, label = '', placeholder = '' } = {}) {
  const runKey = {
    key: 'Mod-Enter',
    run: () => {
      onRun?.()
      return true
    },
  }
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        pyswahili,
        syntaxHighlighting(highlight),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [completeKeywords], icons: false }),
        keymap.of([runKey, ...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        placeholder ? cmPlaceholder(placeholder) : [],
        theme,
        EditorView.contentAttributes.of({
          'aria-label': label,
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString())
        }),
      ],
    }),
  })
  // Line heights are measured when the editor mounts; measure again once the
  // code font has arrived or the gutter numbers sit at the wrong height.
  document.fonts?.ready.then(() => view.requestMeasure())
  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc(text) {
      if (text === view.state.doc.toString()) return
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    },
    insert(text) {
      view.dispatch(view.state.replaceSelection(text), { scrollIntoView: true, userEvent: 'input' })
      view.focus()
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
