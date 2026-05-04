import { useEffect, useMemo, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import Editor from '../components/Editor'
import Console from '../components/Console'
import VoiceInput from '../components/VoiceInput'
import VoiceTutorPanel from '../components/VoiceTutorPanel'
import {
  explainCode,
  fetchChatHistory,
  generateCode,
  runSwahili,
  saveChatHistory,
  speakText,
} from '../services/api'
import { lessons, lessonExplanations, practiceTests, swahiliDictionary } from '../data/lessons'

const starterCode = ''

// Normalize terminal output line endings and strip trailing whitespace.
function normalizeOutput(output) {
  return (output || '').replace(/\r\n/g, '\n').trim()
}

// Keep lesson titles compact in the UI by removing repeated language markers.
function formatLessonTitle(title) {
  return title.replace(/\bPython\b\s*/gi, '').replace(/\s{2,}/g, ' ').trim()
}

// Display practice IDs as clean numbers in tabs.
function formatPracticeNumber(id) {
  return id.replace(/^t/i, '')
}

// Replace symbols with spoken words so narration audio does not skip critical operators.
function verbalizeSymbolsForAudio(text, language) {
  const source = text || ''
  const replacements = language === 'sw'
    ? [
        ['>=', ' kubwa au sawa na '],
        ['<=', ' ndogo au sawa na '],
        ['==', ' sawa na sawa na '],
        ['!=', ' sio sawa na '],
        ['->', ' inaelekea kwa '],
        ['+', ' jumlisha '],
        ['-', ' toa '],
        ['*', ' zidisha '],
        ['/', ' gawa kwa '],
        [':', ' koloni '],
        ['#', ' alama ya namba '],
        ['(', ' fungua mabano '],
        [')', ' funga mabano '],
        ['[', ' fungua mabano ya mraba '],
        [']', ' funga mabano ya mraba '],
        ['{', ' fungua mabano ya curly '],
        ['}', ' funga mabano ya curly '],
      ]
    : [
        ['>=', ' greater than or equal to '],
        ['<=', ' less than or equal to '],
        ['==', ' is equal to '],
        ['!=', ' is not equal to '],
        ['->', ' maps to '],
        ['+', ' plus '],
        ['-', ' minus '],
        ['*', ' times '],
        ['/', ' divided by '],
        [':', ' colon '],
        ['#', ' hash '],
        ['(', ' open parenthesis '],
        [')', ' close parenthesis '],
        ['[', ' open bracket '],
        [']', ' close bracket '],
        ['{', ' open brace '],
        ['}', ' close brace '],
      ]

  let spoken = source
  for (const [symbol, word] of replacements) {
    spoken = spoken.split(symbol).join(word)
  }
  return spoken.replace(/\s{2,}/g, ' ').trim()
}

// Build longer narration text used by lesson TTS playback.
function buildLessonNarration({ lesson, lessonTitle, lessonSummary, lessonConcepts, language }) {
  const rawConceptLead = lessonConcepts[0] || lessonSummary
  const rawConceptFollow = lessonConcepts[1] || lessonSummary
  const spokenSummary = verbalizeSymbolsForAudio(lessonSummary, language)
  const conceptLead = verbalizeSymbolsForAudio(rawConceptLead, language)
  const conceptFollow = verbalizeSymbolsForAudio(rawConceptFollow, language)
  const spokenPrompt = verbalizeSymbolsForAudio(
    language === 'sw' ? lesson.test.promptSw : lesson.test.promptEn,
    language,
  )

  if (language === 'sw') {
    return [
      `Karibu kwenye somo la ${lesson.order}, ${lessonTitle}.`,
      `Leo tutajifunza mada hii: ${spokenSummary}`,
      `Wazo la kwanza la kushika ni hili: ${conceptLead}`,
      `Baada ya hapo, kumbuka pia kwamba ${conceptFollow}`,
      `Ukihitaji mazoezi, fungua mfano wa ${lesson.example.titleSw} na ubadilishe mistari michache kwa makusudi.`,
      `Mwisho wa somo, changamoto yako ni hii: ${spokenPrompt}`,
      'Jaribu polepole, angalia matokeo, na chukulia kila tokeo kama mrejesho wa kujifunza kwa vitendo.',
    ].join(' ')
  }

  return [
    `Welcome to lesson ${lesson.order}, ${lessonTitle}.`,
    `Today we are going to learn this topic: ${spokenSummary}`,
    `The first idea I want you to hold onto is this: ${conceptLead}`,
    `After that, keep this second point in view: ${conceptFollow}`,
    `If you want a quick practice round, open the example called ${lesson.example.titleEn} and intentionally tweak a few lines.`,
    `At the end of the lesson, your challenge is: ${spokenPrompt}`,
    'Go step by step, watch the output carefully, and treat each result as practical feedback you can learn from.',
  ].join(' ')
}

// Choose response language heuristically when a message has no explicit language tag.
function detectResponseLanguage(text, fallback = 'sw') {
  const normalized = (text || '').toLowerCase()
  if (!normalized) return fallback

  // Lightweight heuristic: common Swahili markers vs English markers.
  const swHints = /\b(na|kwa|hii|hilo|hivyo|tafadhali|samahani|msimbo|kazi|somo|swali|jibu|python|pyswahili|msaidi|mwalimu)\b/g
  const enHints = /\b(the|and|with|this|that|please|sorry|code|function|loop|class|python|pyswahili|assistant|lesson|question|answer)\b/g

  const swScore = (normalized.match(swHints) || []).length
  const enScore = (normalized.match(enHints) || []).length

  if (swScore === enScore) return fallback
  return swScore > enScore ? 'sw' : 'en'
}

// Detect prompts that are likely asking for code output.
function isCodeRequest(prompt) {
  const normalized = (prompt || '').toLowerCase()
  if (!normalized) return false
  const directCodeKeywords = /\b(code|coding|msimbo|function|program|script|loop|debug|bug|error|class|darasa|algorithm|syntax|implement|andika\s+msimbo|write\s+code)\b/
  const writeCodePhrases = /\b(andika|tengeneza|jenga|create|build|generate|write|implement)\b[\s\S]{0,40}\b(msimbo|code|program|script|function|python|pyswahili)\b/
  return directCodeKeywords.test(normalized) || writeCodePhrases.test(normalized)
}

// Detect vague "explain this" prompts so we can attach nearby code context.
function isVagueExplainRequest(prompt) {
  const normalized = (prompt || '').toLowerCase().trim()
  if (!normalized) return false
  return /\b(explain this|explain that|can you explain|fafanua hii|eleza hii|nisaidie kuelewa)\b/.test(normalized)
}

// Catch language-switch requests and route users to the explicit toggle control.
function isLanguageSwitchRequest(prompt) {
  const normalized = (prompt || '').toLowerCase().trim()
  if (!normalized) return false
  return /\b(switch language|change language|use english|use swahili|speak english|speak swahili|badilisha lugha|tumia kiingereza|tumia kiswahili|ongea kiingereza|ongea kiswahili|geuza lugha)\b/.test(normalized)
}

// Strip markdown code fences when we need pure code text.
function extractPureCode(text) {
  const raw = (text || '').trim()
  if (!raw) return ''

  const fencedMatch = raw.match(/```(?:[a-zA-Z0-9_+-]+)?\s*([\s\S]*?)```/)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  return raw
}

const PYTHON_TO_SWAHILI_KEYWORDS = swahiliDictionary.reduce((map, [swahiliWord, pythonWord]) => {
  map[pythonWord] = swahiliWord
  return map
}, {})

// Map Python keywords back to Pyswahili while preserving strings/comments.
function normalizeToPyswahiliCode(text) {
  const source = (text || '').trim()
  if (!source) return ''

  let output = ''
  let token = ''
  let i = 0
  let inSingle = false
  let inDouble = false
  let inComment = false

  const flushToken = () => {
    if (!token) return
    output += PYTHON_TO_SWAHILI_KEYWORDS[token] || token
    token = ''
  }

  while (i < source.length) {
    const char = source[i]
    const prev = i > 0 ? source[i - 1] : ''

    if (inComment) {
      output += char
      if (char === '\n') {
        inComment = false
      }
      i += 1
      continue
    }

    if (!inSingle && !inDouble && char === '#') {
      flushToken()
      inComment = true
      output += char
      i += 1
      continue
    }

    if (!inDouble && char === "'" && prev !== '\\') {
      flushToken()
      inSingle = !inSingle
      output += char
      i += 1
      continue
    }

    if (!inSingle && char === '"' && prev !== '\\') {
      flushToken()
      inDouble = !inDouble
      output += char
      i += 1
      continue
    }

    if (inSingle || inDouble) {
      output += char
      i += 1
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      token += char
      i += 1
      continue
    }

    flushToken()
    output += char
    i += 1
  }

  flushToken()
  return output
}

// Split assistant text into plain-text and fenced-code segments for richer rendering.
function parseChatTextSegments(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) return []

  const segments = []
  const fenceRegex = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = fenceRegex.exec(normalized)) !== null) {
    const [fullMatch, codeLangRaw, codeBodyRaw] = match
    const matchIndex = match.index

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        value: normalized.slice(lastIndex, matchIndex),
      })
    }

    segments.push({
      type: 'code',
      lang: (codeLangRaw || '').trim(),
      value: (codeBodyRaw || '').trimEnd(),
    })

    lastIndex = matchIndex + fullMatch.length
  }

  if (lastIndex < normalized.length) {
    segments.push({
      type: 'text',
      value: normalized.slice(lastIndex),
    })
  }

  return segments.filter((segment) => (segment.value || '').trim().length > 0)
}

// Render parsed assistant text so markdown-style fenced code appears as code blocks.
function renderChatMessageText(text) {
  const segments = parseChatTextSegments(text)
  if (!segments.length) {
    return <p className="chat-text">{text}</p>
  }

  return segments.map((segment, index) => {
    if (segment.type === 'code') {
      return (
        <div className="chat-code-group" key={`code-${index}`}>
          {segment.lang ? <span className="chat-code-lang">{segment.lang}</span> : null}
          <pre className="chat-code">
            <code>{segment.value}</code>
          </pre>
        </div>
      )
    }

    return (
      <p className="chat-text" key={`text-${index}`}>
        {segment.value.trim()}
      </p>
    )
  })
}

// Small lesson runner used inside the Learn panel for guided examples.
function LessonExample({ lesson, lessonLanguage, overrideLanguage, onLanguageChange, onRun }) {
  const activeLanguage = overrideLanguage || lessonLanguage
  const exampleCode = activeLanguage === 'sw' ? lesson.example.codeSw : lesson.example.codeEn
  const exampleTitle = activeLanguage === 'sw' ? lesson.example.titleSw : lesson.example.titleEn
  const [code, setCode] = useState(exampleCode)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCode(exampleCode)
    setOutput('')
    setError('')
  }, [exampleCode])

  const setPreset = () => {
    setCode(exampleCode)
    setOutput('')
    setError('')
  }

  const runExample = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await onRun(code)
      setOutput(data.output || '')
      setError(data.error || '')
    } catch (err) {
      setError(err?.message || (lessonLanguage === 'sw' ? 'Kosa limetokea wakati wa kuendesha msimbo.' : 'An error occurred while running code.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mini-ide-card">
      <div className="mini-ide-header">
        <h3>{exampleTitle}</h3>
        <div className="mini-ide-controls">
          <select value={overrideLanguage || 'follow'} onChange={(e) => onLanguageChange(e.target.value)}>
            <option value="follow">{lessonLanguage === 'sw' ? 'Fuata Lugha ya Somo' : 'Follow Lesson Language'}</option>
            <option value="sw">Kiswahili</option>
            <option value="en">English</option>
          </select>
          <button className="ghost-btn" onClick={setPreset}>
            {lessonLanguage === 'sw' ? 'Pakia Mfano' : 'Load Example'}
          </button>
          <button className="run-btn" onClick={runExample} disabled={loading}>
            {loading ? 'Inaendesha...' : lessonLanguage === 'sw' ? 'Endesha' : 'Run'}
          </button>
        </div>
      </div>
      <Editor code={code} onChange={setCode} height="190px" fontSize={12} />
      <Console output={output} error={error} compact language={lessonLanguage} />
    </div>
  )
}

export default function IDE({
  language,
  onSetLanguage,
  authState,
  isLoggedIn,
  authError,
  authMessage,
  onLogout,
  onOpenLogin,
  onOpenSignup,
  completedLessons,
  onSetCompletedLessons,
}) {
  const toUiMessages = (messages = []) => messages.map((item, index) => ({
    id: `${item.created_at || Date.now()}-${item.role}-${index}`,
    role: item.role,
    text: item.text,
    code: item.code || '',
    lang: item.lang || detectResponseLanguage(item.text, language),
  }))

  const [mode, setMode] = useState('learn')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeLessonId, setActiveLessonId] = useState(lessons[0].id)
  const [exampleLanguageByLesson, setExampleLanguageByLesson] = useState({})

  const [lessonTestCode, setLessonTestCode] = useState('')
  const [lessonTestStatus, setLessonTestStatus] = useState('idle')
  const [lessonTestLoading, setLessonTestLoading] = useState(false)
  const [lessonTestFeedback, setLessonTestFeedback] = useState('')
  const [lessonAudioLoading, setLessonAudioLoading] = useState(false)
  const [lessonAudioError, setLessonAudioError] = useState('')
  const [lessonAudioSrc, setLessonAudioSrc] = useState('')

  const [basicCode, setBasicCode] = useState(starterCode)
  const [basicOutput, setBasicOutput] = useState('')
  const [basicError, setBasicError] = useState('')
  const [basicLoading, setBasicLoading] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [chatPanelOpen, setChatPanelOpen] = useState(true)
  const [showVoiceTools, setShowVoiceTools] = useState(true)
  const [assistantMessages, setAssistantMessages] = useState([])
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState('')
  const [speakingLoadingId, setSpeakingLoadingId] = useState('')
  const [showLanguageBadges, setShowLanguageBadges] = useState(true)
  const assistantAudioRef = useRef(null)

  const [activePracticeId, setActivePracticeId] = useState(practiceTests[0].id)
  const [practiceCode, setPracticeCode] = useState(practiceTests[0].starterSw)
  const [practiceResult, setPracticeResult] = useState('')
  const [practiceError, setPracticeError] = useState('')
  const [practiceLoading, setPracticeLoading] = useState(false)

  const activeLesson = useMemo(
    () => lessons.find((item) => item.id === activeLessonId) || lessons[0],
    [activeLessonId],
  )
  const activePractice = useMemo(
    () => practiceTests.find((item) => item.id === activePracticeId) || practiceTests[0],
    [activePracticeId],
  )
  const runCode = async (code) => runSwahili(code)

  const saveCompletion = (lessonId, value) => {
    onSetCompletedLessons((current) => ({ ...current, [lessonId]: value }))
  }

  // Execute the free-form editor code in the backend sandbox.
  const onRunBasic = async () => {
    setBasicLoading(true)
    setBasicError('')
    try {
      const data = await runCode(basicCode)
      setBasicOutput(data.output || '')
      setBasicError(data.error || '')
    } catch (err) {
      setBasicError(err?.message || (language === 'sw' ? 'Kosa limetokea wakati wa kuendesha msimbo.' : 'An error occurred while running code.'))
    } finally {
      setBasicLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadRecentChatHistory() {
      if (!authState?.token) {
        return
      }
      setAssistantHistoryLoading(true)
      try {
        const data = await fetchChatHistory(authState.token, 20)
        if (!cancelled) {
          setAssistantMessages(toUiMessages(data.messages || []))
        }
      } catch {
        if (!cancelled) {
          setAssistantError(
            language === 'sw'
              ? 'Imeshindikana kupakia historia ya mazungumzo ya akaunti yako.'
              : 'Could not load your saved chat history.',
          )
        }
      } finally {
        if (!cancelled) {
          setAssistantHistoryLoading(false)
        }
      }
    }

    loadRecentChatHistory()

    return () => {
      cancelled = true
    }
  }, [authState?.token, language])

  const clearVoiceDraft = () => {
    setVoiceTranscript('')
  }

  const stopMessageSpeech = () => {
    if (assistantAudioRef.current) {
      try {
        assistantAudioRef.current.pause()
      } catch {
        // Ignore audio stop errors.
      }
      assistantAudioRef.current = null
    }
    setSpeakingMessageId('')
  }

  // Speak a single chat message on demand and stop previous playback if active.
  const speakChatMessage = async (message) => {
    const messageText = (message?.text || '').trim()
    if (!messageText) return

    if (speakingMessageId === message.id) {
      stopMessageSpeech()
      return
    }

    stopMessageSpeech()
    setSpeakingLoadingId(message.id)

    try {
      const ttsLanguage = message.lang || detectResponseLanguage(messageText, language)
      const { audio_base64, mime_type } = await speakText(messageText, ttsLanguage)
      const audio = new Audio(`data:${mime_type};base64,${audio_base64}`)
      assistantAudioRef.current = audio
      setSpeakingMessageId(message.id)

      audio.onended = () => {
        if (assistantAudioRef.current === audio) {
          assistantAudioRef.current = null
          setSpeakingMessageId('')
        }
      }

      await audio.play()
    } catch {
      setAssistantError(
        language === 'sw'
          ? 'Imeshindikana kusoma ujumbe kwa sauti.'
          : 'Could not read this message aloud.',
      )
      setSpeakingMessageId('')
    } finally {
      setSpeakingLoadingId('')
    }
  }

  useEffect(() => {
    return () => {
      if (assistantAudioRef.current) {
        try {
          assistantAudioRef.current.pause()
        } catch {
          // Ignore audio cleanup errors.
        }
      }
    }
  }, [])

  // Build structured runtime context so backend prompts stay aligned with current session state.
  const buildAssistantRuntimeContext = (prompt, intent = 'explain', responseLanguageHint = language) => {
    const pyswahiliKeywordMap = Object.fromEntries(swahiliDictionary)
    const recentMessages = assistantMessages.slice(-6).map((message) => ({
      role: message.role,
      text: (message.text || '').slice(0, 600),
      hasCode: Boolean((message.code || '').trim()),
      lang: message.lang || detectResponseLanguage(message.text, language),
    }))

    return {
      app: 'swahili-voice-ide',
      intent,
      ui_language: language,
      response_language_hint: responseLanguageHint,
      mode,
      active_lesson_id: activeLessonId,
      active_practice_id: activePracticeId,
      is_logged_in: Boolean(authState?.token),
      user_prompt: prompt,
      coding_context: {
        scope: 'Python and Pyswahili coding assistant',
        allowed_programming_languages: ['python', 'pyswahili'],
        ui_languages: ['sw', 'en'],
        assistant_capabilities: {
          can_add_code_to_editor: true,
          code_insert_target: 'basic_ide_editor',
          code_insert_trigger_intent: 'code_generation',
        },
        execution_pipeline: [
          'Pyswahili source is converted to Python via PySwahili.convert_to_english',
          'Converted Python runs in a restricted sandbox',
          'Sandbox blocks imports, attribute access, and unsafe builtins',
        ],
      },
      pyswahili_keyword_map: pyswahiliKeywordMap,
      editor_code_preview: (basicCode || '').slice(0, 1200),
      voice_transcript_preview: (voiceTranscript || '').slice(0, 600),
      recent_chat_messages: recentMessages,
      timestamp: new Date().toISOString(),
    }
  }

  // Send user prompt to assistant and branch between code-generation and explanation flows.
  const askAssistantFromVoice = async () => {
    const prompt = voiceTranscript.trim()
    if (!prompt || assistantBusy) return
    const responseLanguage = language

    const userMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: prompt,
      lang: responseLanguage,
    }

    setAssistantMessages((current) => [...current, userMessage])
    setAssistantBusy(true)
    setAssistantError('')
    stopMessageSpeech()
    setVoiceTranscript('')

    if (isLanguageSwitchRequest(prompt)) {
      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text:
          language === 'sw'
            ? 'Kwa kubadili lugha, tafadhali tumia kitufe cha lugha kilicho juu (Kiswahili/English). Nitajibu kulingana na lugha uliyochagua hapo.'
            : 'To change language, please use the language toggle button at the top (Kiswahili/English). I will reply in whichever language is selected there.',
        code: '',
        lang: language,
      }

      setAssistantMessages((current) => [...current, assistantMessage])
      setAssistantBusy(false)
      return
    }

    try {
      const wantsCode = isCodeRequest(prompt)
      let assistantMessage

      if (wantsCode) {
        const runtimeContext = buildAssistantRuntimeContext(prompt, 'code_generation', responseLanguage)
        const codePrompt = [
          prompt,
          '',
          'Write only runnable Pyswahili code.',
          'Do not include explanations, markdown, headings, or backticks.',
          'Output must be pure code only.',
        ].join('\n')

        const codeResult = await generateCode(codePrompt, responseLanguage, runtimeContext)
        const codeText = extractPureCode(codeResult?.result || '')
        const pyswahiliCode = normalizeToPyswahiliCode(codeText)
        const fallbackCode = responseLanguage === 'sw' ? '# Samahani, sikupata msimbo sahihi.' : '# Sorry, I could not generate valid code.'
        const pureCode = pyswahiliCode || fallbackCode

        assistantMessage = {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: pureCode,
          code: pureCode,
        }

        // Write generated code directly into the Basic IDE editor.
        setBasicCode(pureCode)
      } else {
        const runtimeContext = buildAssistantRuntimeContext(prompt, 'chat_help', responseLanguage)
        const latestMessageWithCode = [...assistantMessages].reverse().find((message) => (message.code || '').trim())
        const fallbackEditorCode = (basicCode || '').trim()
        const codeContextToExplain = ((latestMessageWithCode?.code || '') || fallbackEditorCode).trim()

        let explainPrompt = prompt
        if (isVagueExplainRequest(prompt) && codeContextToExplain) {
          explainPrompt = [
            prompt,
            '',
            language === 'sw'
              ? 'Fafanua msimbo huu wa sasa kwa hatua:'
              : 'Explain this current code step by step:',
            codeContextToExplain.slice(0, 2200),
          ].join('\n')
        }

        const helpResult = await explainCode(explainPrompt, responseLanguage, runtimeContext)

        const helpText = (helpResult?.result || '').trim()

        assistantMessage = {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: helpText || (responseLanguage === 'sw' ? 'Samahani, sikupata maelezo kutoka kwa modeli.' : 'Sorry, I could not get an explanation from the model.'),
          code: '',
        }
      }

      assistantMessage.lang = detectResponseLanguage(assistantMessage.text, responseLanguage)

      setAssistantMessages((current) => [...current, assistantMessage])

      if (authState?.token) {
        try {
          const payload = [
            { role: userMessage.role, text: userMessage.text, code: null },
            { role: assistantMessage.role, text: assistantMessage.text, code: assistantMessage.code || null },
          ]
          const saved = await saveChatHistory(authState.token, payload)
          setAssistantMessages(toUiMessages(saved.messages || []))
        } catch {
          // Continue even if history sync fails.
        }
      }

    } catch (err) {
      setAssistantError(
        err?.response?.data?.detail ||
          err?.message ||
          (language === 'sw'
            ? 'Imeshindikana kuwasiliana na msaidizi Amani. Hakikisha backend na huduma ya modeli vinafanya kazi.'
            : 'Could not reach Amani assistant. Make sure backend and the model service are running.'),
      )
    } finally {
      setAssistantBusy(false)
    }
  }

  // Compare learner output with reference behavior to mark lesson completion.
  const checkLessonTest = async () => {
    setLessonTestLoading(true)
    setLessonTestStatus('idle')
    setLessonTestFeedback('')

    try {
      const userRun = await runCode(lessonTestCode)

      if (userRun.error) {
        setLessonTestStatus('fail')
        setLessonTestFeedback(language === 'sw' ? 'Msimbo wako una kosa. Rekebisha kisha ujaribu tena.' : 'Your code has an error. Fix it and try again.')
        return
      }

      const expectedRuns = await Promise.all([
        runCode(activeLesson.test.solutionSw),
        runCode(activeLesson.test.solutionEn),
      ])

      const expectedOutputs = expectedRuns
        .filter((run) => !run.error)
        .map((run) => normalizeOutput(run.output))

      const userOutput = normalizeOutput(userRun.output)

      if (expectedOutputs.includes(userOutput)) {
        setLessonTestStatus('pass')
        setLessonTestFeedback('')
        saveCompletion(activeLesson.id, true)
        return
      }

      setLessonTestStatus('fail')
      setLessonTestFeedback(
        language === 'sw'
          ? 'Output haitalingana na inayotarajiwa. Angalia mantiki ya msimbo wako na ujaribu tena.'
          : 'Output does not match expected output. Check your logic and try again.',
      )
    } catch (err) {
      setLessonTestStatus('fail')
      setLessonTestFeedback(
        language === 'sw'
          ? 'Kosa limetokea wakati wa kukagua jibu.'
          : 'An error occurred while checking your answer.',
      )
    } finally {
      setLessonTestLoading(false)
    }
  }

  const loadPracticeStarter = (lang) => {
    const next = lang === 'sw' ? activePractice.starterSw : activePractice.starterEn
    setPracticeCode(next)
    setPracticeResult('')
    setPracticeError('')
  }

  // Run practice-task code and evaluate pass/fail using canonical expected output.
  const runPractice = async () => {
    setPracticeLoading(true)
    setPracticeError('')
    setPracticeResult('')

    try {
      const data = await runCode(practiceCode)
      if (data.error) {
        setPracticeError(data.error)
      } else {
        const passed = normalizeOutput(data.output) === normalizeOutput(activePractice.expectedOutput)
        setPracticeResult(
          passed
            ? language === 'sw'
              ? 'Umefaulu.'
              : 'Passed.'
            : language === 'sw'
              ? `Output tofauti. Inatarajiwa:\n${activePractice.expectedOutput}`
              : `Output mismatch. Expected:\n${activePractice.expectedOutput}`,
        )
      }
    } catch (err) {
      setPracticeError(err?.message || (language === 'sw' ? 'Kosa limetokea wakati wa kuendesha jaribio.' : 'An error occurred while running the test.'))
    } finally {
      setPracticeLoading(false)
    }
  }

  const openLesson = (lessonId) => {
    setActiveLessonId(lessonId)
    setMode('learn')
    setLessonTestCode('')
    setLessonTestStatus('idle')
    setLessonTestFeedback('')
    setLessonAudioError('')
    setLessonAudioSrc('')
  }

  const lessonSummary = language === 'sw' ? activeLesson.summarySw : activeLesson.summaryEn
  const lessonTitle = formatLessonTitle(language === 'sw' ? activeLesson.titleSw : activeLesson.titleEn)
  const lessonConcepts = language === 'sw' ? lessonExplanations[activeLesson.id].sw : lessonExplanations[activeLesson.id].en
  const lessonNarration = useMemo(
    () => buildLessonNarration({ lesson: activeLesson, lessonTitle, lessonSummary, lessonConcepts, language }),
    [activeLesson, lessonConcepts, lessonSummary, lessonTitle, language],
  )

  // Generate and play narrated lesson audio via backend TTS.
  const playLessonNarration = async () => {
    setLessonAudioLoading(true)
    setLessonAudioError('')

    try {
      const { audio_base64, mime_type } = await speakText(lessonNarration, language, activeLesson.id)
      setLessonAudioSrc(`data:${mime_type};base64,${audio_base64}`)
    } catch (err) {
      setLessonAudioError(
        err?.response?.data?.detail || err?.message || (language === 'sw' ? 'Imeshindikana kutengeneza sauti ya somo.' : 'Could not generate lesson audio.'),
      )
    } finally {
      setLessonAudioLoading(false)
    }
  }

  return (
    <div className="learn-page">
      <Navbar
        mode={mode}
        language={language}
        onSetLanguage={onSetLanguage}
        onSwitchBasic={() => setMode(mode === 'basic' ? 'learn' : 'basic')}
        onSwitchLearn={() => setMode('learn')}
        onSwitchTests={() => setMode('tests')}
        isLoggedIn={isLoggedIn}
        authState={authState}
        onLogout={onLogout}
        authError={authError}
        authMessage={authMessage}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
      />

      <div className="workspace-shell">
        {mode !== 'basic' && (
          <aside className={`lesson-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            {sidebarOpen ? (
              <>
                <div className="sidebar-top">
                  <div className="sidebar-top-row">
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>
                      <span className="sidebar-toggle-icon">{'<'}</span>
                      <span className="sidebar-toggle-label visible">{language === 'sw' ? 'Funga Orodha ya Masomo' : 'Collapse lessons'}</span>
                    </button>
                  </div>
                </div>

                <div className="lesson-list">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      className={`sidebar-item ${activeLessonId === lesson.id && mode === 'learn' ? 'active' : ''}`}
                      onClick={() => openLesson(lesson.id)}
                    >
                      <span className="order">#{lesson.order}</span>
                      <span className="title">{formatLessonTitle(language === 'sw' ? lesson.titleSw : lesson.titleEn)}</span>
                      <span className={`status ${completedLessons[lesson.id] ? 'done' : 'pending'}`}>
                        {completedLessons[lesson.id] ? '✓' : '○'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="sidebar-collapsed-rail">
                <button
                  className="sidebar-reopen"
                  onClick={() => setSidebarOpen(true)}
                  aria-label={language === 'sw' ? 'Fungua orodha ya masomo' : 'Open lesson list'}
                >
                  {'>'}
                </button>
              </div>
            )}
          </aside>
        )}

        <main className="content-area">
          {mode === 'learn' && (
            <section className="panel lesson-panel">
              <div className="lesson-headline">
                <div>
                  <h2>
                    {language === 'sw' ? 'Somo' : 'Lesson'} {activeLesson.order}: {lessonTitle}
                  </h2>
                  <p>{lessonSummary}</p>
                </div>
                <div className="lesson-audio-tools">
                  <button
                    className="lesson-audio-btn"
                    onClick={playLessonNarration}
                    disabled={lessonAudioLoading}
                    aria-label={language === 'sw' ? 'Sikiliza maelezo ya somo' : 'Listen to lesson narration'}
                    title={language === 'sw' ? 'Sikiliza maelezo ya somo' : 'Listen to lesson narration'}
                  >
                    {lessonAudioLoading ? '...' : '🔊'}
                  </button>
                  <span className="lesson-audio-caption">
                    {lessonAudioLoading
                      ? language === 'sw'
                        ? 'Inatengeneza sauti ya maelezo...'
                        : 'Generating narrated lesson audio...'
                      : language === 'sw'
                        ? 'Sikiliza toleo la kufundisha'
                        : 'Listen to the coaching version'}
                  </span>
                </div>
              </div>

              {lessonAudioError ? <p className="fail-msg lesson-audio-status">{lessonAudioError}</p> : null}
              {lessonAudioSrc ? <audio controls src={lessonAudioSrc} className="lesson-audio-player" /> : null}

              <section className="concept-card">
                <h3>{language === 'sw' ? 'Maelezo ya Dhana' : 'Concept Walkthrough'}</h3>
                <div className="concept-list">
                  {lessonConcepts.map((concept) => (
                    <p key={concept}>{concept}</p>
                  ))}
                </div>
              </section>

              <LessonExample
                key={activeLesson.id}
                lesson={activeLesson}
                lessonLanguage={language}
                overrideLanguage={exampleLanguageByLesson[activeLesson.id] || null}
                onLanguageChange={(value) => {
                  setExampleLanguageByLesson((prev) => ({
                    ...prev,
                    [activeLesson.id]: value === 'follow' ? null : value,
                  }))
                }}
                onRun={runCode}
              />

              <div className="lesson-test-card">
                <h3>{language === 'sw' ? 'Mtihani wa Mwisho wa Somo' : 'End-of-Lesson Test'}</h3>
                <p>{language === 'sw' ? activeLesson.test.promptSw : activeLesson.test.promptEn}</p>
                <Editor code={lessonTestCode} onChange={setLessonTestCode} height="180px" fontSize={13} />
                <div className="test-actions">
                  <button className="run-btn" onClick={checkLessonTest} disabled={lessonTestLoading}>
                    {lessonTestLoading ? (language === 'sw' ? 'Inakagua...' : 'Checking...') : language === 'sw' ? 'Kagua Jibu' : 'Check Answer'}
                  </button>
                </div>
                {lessonTestStatus === 'pass' && (
                  <p className="pass-msg">{language === 'sw' ? 'Umefaulu. Somo limewekwa tiki.' : 'Passed. Lesson marked complete.'}</p>
                )}
                {lessonTestStatus === 'fail' && (
                  <p className="fail-msg">
                    {lessonTestFeedback || (language === 'sw' ? 'Bado si sahihi. Jaribu tena.' : 'Not correct yet. Try again.')}
                  </p>
                )}
              </div>
            </section>
          )}

          {mode === 'tests' && (
            <section className="panel tests-panel">
              <h2>{language === 'sw' ? 'Majaribio ya Mazoezi' : 'Practice Tests'}</h2>
              <p>{language === 'sw' ? 'Kamilisha kazi hizi kuongeza kasi na kujiamini.' : 'Complete these tasks to build speed and confidence.'}</p>

              <div className="test-selector">
                {practiceTests.map((testItem) => (
                  <button
                    key={testItem.id}
                    className={activePracticeId === testItem.id ? 'active' : ''}
                    onClick={() => {
                      setActivePracticeId(testItem.id)
                      setPracticeCode(language === 'sw' ? testItem.starterSw : testItem.starterEn)
                      setPracticeResult('')
                      setPracticeError('')
                    }}
                  >
                    {language === 'sw' ? 'Kazi' : 'Task'} {formatPracticeNumber(testItem.id)}
                  </button>
                ))}
              </div>

              <p>{language === 'sw' ? activePractice.promptSw : activePractice.promptEn}</p>

              <div className="test-actions">
                <button className="ghost-btn" onClick={() => loadPracticeStarter('sw')}>
                  {language === 'sw' ? 'Pakia Kiolezo cha Kiswahili' : 'Load Swahili Template'}
                </button>
                <button className="ghost-btn" onClick={() => loadPracticeStarter('en')}>
                  {language === 'sw' ? 'Pakia Kiolezo cha Kiingereza' : 'Load English Template'}
                </button>
                <button className="run-btn" onClick={runPractice} disabled={practiceLoading}>
                  {practiceLoading ? (language === 'sw' ? 'Inaendesha...' : 'Running...') : language === 'sw' ? 'Endesha Jaribio' : 'Run Test'}
                </button>
              </div>

              <Editor code={practiceCode} onChange={setPracticeCode} height="230px" />

              <div className="practice-result">
                {practiceError ? <pre className="error">{practiceError}</pre> : <pre>{practiceResult || (language === 'sw' ? 'Hakuna matokeo bado.' : 'No result yet.')}</pre>}
              </div>
            </section>
          )}

          {mode === 'basic' && (
            <section className="panel basic-panel">
              <h2>{language === 'sw' ? 'IDE ya Msingi' : 'Basic IDE'}</h2>
              <p>{language === 'sw' ? 'Eneo huru la kuandika bila mwongozo wa somo.' : 'Free typing space with no lesson guidance.'}</p>

              <div className={`basic-grid ${chatPanelOpen ? 'chat-open' : 'chat-collapsed'}`}>
                <div className="basic-code-column">
                  <div className="test-actions">
                    <button className="run-btn" onClick={onRunBasic} disabled={basicLoading}>
                      {basicLoading ? 'Inaendesha...' : language === 'sw' ? 'Endesha Msimbo wa Kiswahili' : 'Run Swahili Code'}
                    </button>
                  </div>

                  <Editor code={basicCode} onChange={setBasicCode} height="320px" fontSize={13} />
                  <Console output={basicOutput} error={basicError} language={language} />

                  <section className="dictionary-card">
                    <h3>{language === 'sw' ? 'Kamusi ya Pyswahili (Kiswahili hadi Kiingereza)' : 'Pyswahili Key (Swahili to English)'}</h3>
                    <div className="dictionary-grid">
                      {swahiliDictionary.map(([sw, en]) => (
                        <div key={sw} className="dictionary-row">
                          <span className="dictionary-sw">{sw}</span>
                          <span className="dictionary-en">{en}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="basic-assistant-column">
                  <div className={`assistant-shell ${chatPanelOpen ? 'open' : 'closed'}`}>
                    {chatPanelOpen ? (
                      <section className="assistant-chat-card">
                        <div className="sidebar-top">
                          <div className="sidebar-top-row">
                            <button className="sidebar-toggle" onClick={() => setChatPanelOpen(false)}>
                              <span className="sidebar-toggle-icon">{'<'}</span>
                              <span className="sidebar-toggle-label visible">
                                {language === 'sw' ? 'Funga Msaidizi wa Chat' : 'Collapse Chat Assistant'}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="assistant-chat-header">
                          <h3>{language === 'sw' ? 'Msaidizi Amani' : 'Amani Assistant'}</h3>
                          <span className="assistant-chat-status">{assistantBusy ? (language === 'sw' ? 'Inaandika...' : 'Typing...') : 'Online'}</span>
                        </div>
                        <p className="assistant-chat-subtitle">
                          {language === 'sw'
                            ? 'Msaidizi wa chat: andika ujumbe, kisha tumia sauti ukihitaji. Historia ya hivi karibuni huhifadhiwa ukiwa umesajili akaunti.'
                            : 'Chat assistant: type your message below. Recent history is saved when signed in.'}
                        </p>

                        <div className="assistant-display-controls">
                          <button
                            className={`ghost-btn ${showLanguageBadges ? 'active' : ''}`}
                            onClick={() => setShowLanguageBadges((current) => !current)}
                            aria-pressed={showLanguageBadges}
                          >
                            {showLanguageBadges
                              ? (language === 'sw' ? 'Ficha badge za lugha' : 'Hide language badges')
                              : (language === 'sw' ? 'Onyesha badge za lugha' : 'Show language badges')}
                          </button>
                          <button
                            className={`icon-circle-btn ${showVoiceTools ? 'active' : ''}`}
                            onClick={() => setShowVoiceTools((current) => !current)}
                            aria-pressed={showVoiceTools}
                            aria-label={
                              showVoiceTools
                                ? (language === 'sw' ? 'Ficha zana za sauti' : 'Hide voice tools')
                                : (language === 'sw' ? 'Onyesha zana za sauti' : 'Show voice tools')
                            }
                            title={
                              showVoiceTools
                                ? (language === 'sw' ? 'Ficha zana za sauti' : 'Hide voice tools')
                                : (language === 'sw' ? 'Onyesha zana za sauti' : 'Show voice tools')
                            }
                          >
                            {showVoiceTools ? '🎙️' : '🔈'}
                          </button>
                        </div>

                        {showVoiceTools ? (
                          <>
                            <VoiceTutorPanel
                              language={language}
                              chatContext={assistantMessages}
                            />
                            <VoiceInput
                              onTranscribed={setVoiceTranscript}
                              transcript={voiceTranscript}
                              language={language}
                            />
                          </>
                        ) : null}

                        <div className="assistant-thread" aria-live="polite">
                          {assistantHistoryLoading ? (
                            <p className="assistant-thread-empty">{language === 'sw' ? 'Inapakia historia...' : 'Loading chat history...'}</p>
                          ) : !assistantMessages.length ? (
                            <p className="assistant-thread-empty">
                              {language === 'sw'
                                ? 'Hakuna ujumbe bado. Andika au rekodi ombi, kisha tuma kwa msaidizi.'
                                : 'No messages yet. Type or record your request, then send it to the assistant.'}
                            </p>
                          ) : (
                            <>
                              {assistantMessages.map((message) => (
                                <article key={message.id} className={`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                                  <div className="chat-meta">
                                    <p className="chat-role">{message.role === 'user' ? (language === 'sw' ? 'Wewe' : 'You') : 'Amani'}</p>
                                    <div className="chat-meta-right">
                                      {showLanguageBadges && message.lang ? (
                                        <span className={`chat-lang-badge ${message.lang === 'sw' ? 'sw' : 'en'}`}>
                                          {message.lang === 'sw' ? 'Kiswahili' : 'English'}
                                        </span>
                                      ) : null}
                                      <button
                                        className={`chat-voice-btn ${speakingMessageId === message.id ? 'active' : ''}`}
                                        onClick={() => speakChatMessage(message)}
                                        disabled={speakingLoadingId === message.id || !message.text?.trim()}
                                        aria-label={
                                          speakingMessageId === message.id
                                            ? (language === 'sw' ? 'Simamisha sauti' : 'Stop audio')
                                            : (language === 'sw' ? 'Soma ujumbe kwa sauti' : 'Read message aloud')
                                        }
                                        title={
                                          speakingMessageId === message.id
                                            ? (language === 'sw' ? 'Simamisha sauti' : 'Stop audio')
                                            : (language === 'sw' ? 'Soma ujumbe kwa sauti' : 'Read message aloud')
                                        }
                                      >
                                        {speakingLoadingId === message.id ? '⏳' : speakingMessageId === message.id ? '⏹️' : '🔊'}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="chat-rich-content">{renderChatMessageText(message.text)}</div>
                                  {message.code && message.code.trim() !== (message.text || '').trim() ? (
                                    <pre className="chat-code">{message.code}</pre>
                                  ) : null}
                                </article>
                              ))}
                              {assistantBusy ? (
                                <article className="chat-message assistant chat-typing" aria-live="polite">
                                  <div className="chat-meta">
                                    <p className="chat-role">Amani</p>
                                  </div>
                                  <div className="typing-dots" aria-label={language === 'sw' ? 'Amani anaandika' : 'Amani is typing'}>
                                    <span />
                                    <span />
                                    <span />
                                  </div>
                                </article>
                              ) : null}
                            </>
                          )}
                        </div>

                        <div className="chat-composer">
                          <textarea
                            id="assistant-input"
                            className="chat-input"
                            value={voiceTranscript}
                            onChange={(event) => setVoiceTranscript(event.target.value)}
                            placeholder={
                              language === 'sw'
                                ? 'Andika ujumbe wako kwa Amani... (ukitumia sauti, matini itawekwa hapa)'
                                : 'Type your message to Amani... (voice transcript will appear here if used)'
                            }
                          />

                          <div className="chat-composer-actions">
                            <button
                              className="icon-circle-btn"
                              onClick={clearVoiceDraft}
                              disabled={assistantBusy || !voiceTranscript.trim()}
                              aria-label={language === 'sw' ? 'Futa ujumbe' : 'Clear message'}
                              title={language === 'sw' ? 'Futa ujumbe' : 'Clear message'}
                            >
                              🧹
                            </button>
                            <button
                              className="run-btn icon-send-btn"
                              onClick={askAssistantFromVoice}
                              disabled={assistantBusy || !voiceTranscript.trim()}
                              aria-label={assistantBusy ? (language === 'sw' ? 'Inatuma' : 'Sending') : (language === 'sw' ? 'Tuma ujumbe' : 'Send message')}
                              title={assistantBusy ? (language === 'sw' ? 'Inatuma' : 'Sending') : (language === 'sw' ? 'Tuma ujumbe' : 'Send message')}
                            >
                              {assistantBusy ? '⏳' : '➤'}
                            </button>
                          </div>
                        </div>

                        {assistantError ? <p className="voice-error">{assistantError}</p> : null}
                      </section>
                    ) : (
                      <div className="sidebar-collapsed-rail assistant-collapsed-rail">
                        <button
                          className="sidebar-reopen"
                          onClick={() => setChatPanelOpen(true)}
                          aria-label={language === 'sw' ? 'Fungua msaidizi wa chat' : 'Open chat assistant'}
                        >
                          {'>'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
