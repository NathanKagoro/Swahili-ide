import { useEffect, useRef, useState } from 'react'
import { transcribeAudio } from '../services/api'
import { blobFromAudioChunks } from '../services/voice'

// Pick file extension based on recorder MIME type for backend compatibility.
function extensionFromMimeType(mimeType = '') {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

// Manage microphone capture lifecycle and send captured audio to backend STT.
export function useVoice(onTranscribed, language = 'sw') {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [inputDevices, setInputDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [captureInfo, setCaptureInfo] = useState(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const chunksRef = useRef([])
  const recordingStartedAtRef = useRef(0)

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return

    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter((device) => device.kind === 'audioinput')
        setInputDevices(audioInputs)

        if (!selectedDeviceId && audioInputs.length) {
          setSelectedDeviceId(audioInputs[0].deviceId)
        }
      } catch {
        // Ignore device enumeration failures and continue with browser default input.
      }
    }

    refreshDevices()
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices)
    }
  }, [selectedDeviceId])

  // Start recording with sensible speech-oriented constraints and MIME fallback.
  const startRecording = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kivinjari hiki hakiungi mkono kipaza sauti (getUserMedia).')
        return
      }
      if (typeof MediaRecorder === 'undefined') {
        setError('Kivinjari hiki hakiungi mkono kurekodi sauti (MediaRecorder).')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      const selectedType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = selectedType ? new MediaRecorder(stream, { mimeType: selectedType }) : new MediaRecorder(stream)

      mediaStreamRef.current = stream
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.start(250)
      recordingStartedAtRef.current = Date.now()
      setCaptureInfo(null)
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      const permissionDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      if (permissionDenied) {
        setError('Imeshindikana kufungua kipaza sauti. Ruhusu ruhusa ya microphone.')
      } else {
        setError('Imeshindikana kuanza kurekodi sauti. Jaribu tena.')
      }
    }
  }

  // Finalize recording, validate capture quality, and call transcription endpoint.
  const stopRecordingAndTranscribe = async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    await new Promise((resolve) => {
      recorder.onstop = resolve
      if (typeof recorder.requestData === 'function' && recorder.state !== 'inactive') {
        recorder.requestData()
      }
      recorder.stop()
    })

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())

    setRecording(false)
    setTranscribing(true)
    setError('')

    try {
      if (!chunksRef.current.length) {
        setError('Hakuna sauti iliyorekodiwa. Bonyeza Start Mic na ongea kabla ya kusimamisha.')
        return
      }

      const audioBlob = await blobFromAudioChunks(chunksRef.current)
      const mimeType = audioBlob.type || 'audio/webm'
      const extension = extensionFromMimeType(mimeType)
      const durationSeconds = Math.max(0.1, (Date.now() - recordingStartedAtRef.current) / 1000)
      const sizeBytes = audioBlob.size
      setCaptureInfo({ durationSeconds, mimeType, sizeBytes })

      if (durationSeconds >= 2 && sizeBytes < 6000) {
        setError('Sauti iliyorekodiwa ni ndogo sana. Chagua mic sahihi na ongea kwa sekunde 4-8.')
        return
      }

      const audioFile = new File([audioBlob], `voice.${extension}`, { type: mimeType })
      const result = await transcribeAudio(audioFile, language)
      const text = (result?.text || '').trim()
      if (!text) {
        setError('Hakuna maneno yaliyotambuliwa. Ongea karibu na kipaza sauti na ujaribu tena.')
        return
      }

      onTranscribed(text)
    } catch {
      setError('Imeshindikana kutafsiri sauti. Hakikisha backend inaendesha.')
    } finally {
      setTranscribing(false)
      mediaRecorderRef.current = null
      mediaStreamRef.current = null
      chunksRef.current = []
    }
  }

  return {
    error,
    inputDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    captureInfo,
    recording,
    startRecording,
    stopRecordingAndTranscribe,
    transcribing,
  }
}
