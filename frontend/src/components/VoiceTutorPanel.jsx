import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchVoiceTutorConfig } from '../services/api'

function httpToWs(url) {
  if (!url) return ''
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`
  return url
}

function toPcm16(float32Array) {
  const pcm = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return pcm
}

function pcm16ToAudioBuffer(audioCtx, bytes) {
  const input = new Int16Array(bytes)
  const channel = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    channel[i] = input[i] / 32768
  }
  const buffer = audioCtx.createBuffer(1, channel.length, 24000)
  buffer.copyToChannel(channel, 0)
  return buffer
}

export default function VoiceTutorPanel({ language = 'en', chatContext = [] }) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const [agentEvents, setAgentEvents] = useState([])
  const [config, setConfig] = useState(null)
  const [micDevices, setMicDevices] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [loadingMics, setLoadingMics] = useState(false)

  const wsRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const micSourceRef = useRef(null)
  const processorRef = useRef(null)
  const muteGainRef = useRef(null)
  const playbackCursorRef = useRef(0)
  const keepAliveRef = useRef(null)

  const isConnected = status === 'connected' || status === 'streaming'
  const isSwahiliUi = language === 'sw'

  const wsUrl = useMemo(() => {
    const baseApi = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    const wsBase = httpToWs(baseApi.replace(/\/$/, ''))
    return `${wsBase}/voice/tutor/ws`
  }, [])

  useEffect(() => {
    let mounted = true
    fetchVoiceTutorConfig()
      .then((payload) => {
        if (mounted) setConfig(payload)
      })
      .catch(() => {
        if (mounted) setError('Could not load Voice Tutor configuration from backend.')
      })
    return () => {
      mounted = false
    }
  }, [])

  const loadMicDevices = async ({ requestPermission = false } = {}) => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    setLoadingMics(true)
    let permissionStream = null

    try {
      if (requestPermission && navigator.mediaDevices?.getUserMedia) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput')
      setMicDevices(inputs)
      setSelectedMicId((prev) => {
        if (prev && inputs.some((d) => d.deviceId === prev)) return prev
        return inputs[0]?.deviceId || ''
      })
    } catch {
      setError('Could not enumerate microphones.')
    } finally {
      if (permissionStream) {
        permissionStream.getTracks().forEach((track) => track.stop())
      }
      setLoadingMics(false)
    }
  }

  useEffect(() => {
    loadMicDevices()

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) return undefined

    const handleDeviceChange = () => {
      loadMicDevices()
    }

    mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  const stopSession = async () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }))
      ws.close()
    }
    wsRef.current = null

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current.onaudioprocess = null
      processorRef.current = null
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect()
      micSourceRef.current = null
    }
    if (muteGainRef.current) {
      muteGainRef.current.disconnect()
      muteGainRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    playbackCursorRef.current = 0
    setStatus('idle')
  }

  useEffect(() => () => {
    stopSession()
  }, [])

  const appendEvent = (line) => {
    setAgentEvents((prev) => {
      const next = [...prev, line]
      return next.slice(-8)
    })
  }

  const handleAgentAudio = async (arrayBuffer) => {
    const audioCtx = audioContextRef.current
    if (!audioCtx) return
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {})
    }

    const buffer = pcm16ToAudioBuffer(audioCtx, arrayBuffer)
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(audioCtx.destination)

    const now = audioCtx.currentTime
    const startAt = Math.max(now, playbackCursorRef.current)
    source.start(startAt)
    playbackCursorRef.current = startAt + buffer.duration
  }

  const startSession = async () => {
    setError('')

    if (!config?.enabled) {
      setError('Voice Tutor is disabled on backend. Set DEEPGRAM_AGENT_ENABLED=true.')
      return
    }

    try {
      setStatus('connecting')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      loadMicDevices()

      const audioContext = new AudioContext({ sampleRate: 24000 })
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      const muteGain = audioContext.createGain()
      muteGain.gain.value = 0

      mediaStreamRef.current = stream
      audioContextRef.current = audioContext
      micSourceRef.current = source
      processorRef.current = processor
      muteGainRef.current = muteGain

      source.connect(processor)
      processor.connect(muteGain)
      muteGain.connect(audioContext.destination)

      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        const compactContext = chatContext
          .slice(-6)
          .map((item) => ({ role: item.role, text: item.text }))
        const inputSampleRate = Math.max(8000, Math.min(48000, Math.round(audioContext.sampleRate || 24000)))
        ws.send(
          JSON.stringify({
            type: 'start',
            language: language === 'sw' ? 'en' : 'en',
            input_sample_rate: inputSampleRate,
            chat_context: compactContext,
          }),
        )
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          setStatus('streaming')
          await handleAgentAudio(event.data)
          return
        }

        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'ready') {
            setStatus('connected')
            appendEvent('Voice tutor ready.')
            return
          }
          if (payload.type === 'agent_event') {
            const messageType = payload?.payload?.type || 'event'
            appendEvent(`Agent: ${messageType}`)
            return
          }
          if (payload.type === 'agent_open') {
            appendEvent('Deepgram connection opened.')
            return
          }
          if (payload.type === 'agent_closed') {
            appendEvent('Deepgram connection closed.')
            setStatus('idle')
            return
          }
          if (payload.type === 'error') {
            setError(payload.detail || 'Voice tutor failed.')
            setStatus('idle')
          }
        } catch {
          // Ignore malformed event payloads.
        }
      }

      ws.onerror = () => {
        setError('Voice tutor websocket error.')
        setStatus('idle')
      }

      ws.onclose = () => {
        setStatus('idle')
      }

      processor.onaudioprocess = (audioEvent) => {
        const socket = wsRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        const channelData = audioEvent.inputBuffer.getChannelData(0)
        const pcm16 = toPcm16(channelData)
        socket.send(pcm16.buffer)
      }

      keepAliveRef.current = setInterval(() => {
        const socket = wsRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify({ type: 'keepalive' }))
      }, 4000)
    } catch (err) {
      await stopSession()
      setStatus('idle')
      setError(err?.message || 'Could not start voice tutor session.')
    }
  }

  return (
    <section className="panel voice-panel voice-tutor-panel">
      <div className="voice-panel-header">
        <h2>{isSwahiliUi ? 'Mkufunzi wa Sauti (Deepgram)' : 'Voice Tutor (Deepgram)'}</h2>
        <span className="voice-beta-tag">BETA</span>
      </div>

      <p className="mic-hint">
        {isSwahiliUi
          ? 'Njia hii ni mazungumzo ya sauti ya moja kwa moja. Inalenga majibu ya Kiingereza na kufundisha keywords za Pyswahili.'
          : 'This mode runs a separate real-time voice conversation. It responds in English while reinforcing Pyswahili keywords.'}
      </p>

      <div className="mic-picker-row">
        <select
          className="mic-device-select"
          value={selectedMicId}
          onChange={(event) => setSelectedMicId(event.target.value)}
          disabled={loadingMics || isConnected || status === 'connecting'}
          title={isSwahiliUi ? 'Chagua kipaza sauti' : 'Choose microphone'}
          aria-label={isSwahiliUi ? 'Chagua kipaza sauti' : 'Choose microphone'}
        >
          {!micDevices.length && (
            <option value="">
              {isSwahiliUi ? 'Hakuna kipaza sauti kilichopatikana' : 'No microphone devices found'}
            </option>
          )}
          {micDevices.map((device, index) => (
            <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
              {device.label || (isSwahiliUi ? `Kipaza sauti ${index + 1}` : `Microphone ${index + 1}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="mic-refresh-btn"
          onClick={() => loadMicDevices({ requestPermission: true })}
          disabled={loadingMics || isConnected || status === 'connecting'}
          title={isSwahiliUi ? 'Sasisha orodha ya vipaza sauti' : 'Refresh microphone list'}
          aria-label={isSwahiliUi ? 'Sasisha orodha ya vipaza sauti' : 'Refresh microphone list'}
        >
          ↻
        </button>
      </div>

      <p className="mic-hint">
        {isSwahiliUi
          ? 'Pendekezo: tumia kipaza sauti cha headset/earphones chenye mic karibu na mdomo kwa matokeo bora.'
          : 'Recommended: use a headset or earphone microphone close to your mouth for best results.'}
      </p>

      <div className="voice-controls">
        <button
          onClick={startSession}
          disabled={isConnected || status === 'connecting'}
          title={isSwahiliUi ? 'Anza Voice Tutor' : 'Start Voice Tutor'}
          aria-label={isSwahiliUi ? 'Anza Voice Tutor' : 'Start Voice Tutor'}
        >
          ▶
        </button>
        <button
          onClick={stopSession}
          disabled={!isConnected && status !== 'connecting'}
          title={isSwahiliUi ? 'Simamisha Voice Tutor' : 'Stop Voice Tutor'}
          aria-label={isSwahiliUi ? 'Simamisha Voice Tutor' : 'Stop Voice Tutor'}
        >
          ■
        </button>
      </div>

      <p className="transcript-label">
        {isSwahiliUi ? 'Hali' : 'Status'}: {status}
      </p>

      <div className="transcript-preview" aria-live="polite">
        {agentEvents.length ? agentEvents.join('\n') : (isSwahiliUi ? 'Bado hakuna matukio ya voice tutor.' : 'No voice tutor events yet.')}
      </div>

      {error && <p className="voice-error">{error}</p>}
    </section>
  )
}
