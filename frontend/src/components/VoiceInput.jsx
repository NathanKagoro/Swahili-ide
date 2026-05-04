import { useVoice } from '../hooks/useVoice'

export default function VoiceInput({ onTranscribed, transcript, language = 'sw' }) {
  const {
    error,
    inputDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    captureInfo,
    recording,
    startRecording,
    stopRecordingAndTranscribe,
    transcribing,
  } = useVoice(onTranscribed, language)

  const isSwahili = language === 'sw'

  return (
    <section className="panel voice-panel">
      <div className="voice-panel-header">
        <h2>{isSwahili ? 'Sauti hadi Maandishi (Beta)' : 'Speech to Text (Beta)'}</h2>
        <span className="voice-beta-tag">BETA</span>
      </div>

      {isSwahili ? (
        <div className="stt-warning stt-warning--critical">
          <span className="stt-warning-icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Utambuzi wa sauti ya Kiswahili bado ni dhaifu sana.</strong>
            <p>
              Mfumo huu hautambui Kiswahili vizuri — matokeo mara nyingi yana makosa au hayalingani na ulichosema.
              Inashauriwa kutumia <strong>Kiingereza</strong> kwa sasa hadi mfumo uboreshwe.
            </p>
          </div>
        </div>
      ) : (
        <div className="stt-warning stt-warning--info">
          <span className="stt-warning-icon" aria-hidden="true">ℹ️</span>
          <p>
            Speak your message aloud. The transcript appears in the chat composer so you can edit it before sending.
            Swahili speech recognition is not yet reliable — use English for best results.
          </p>
        </div>
      )}

      <div className="voice-controls">
        <button
          onClick={startRecording}
          disabled={recording || transcribing}
          aria-label={isSwahili ? 'Anza kurekodi sauti' : 'Start recording'}
          title={isSwahili ? 'Anza kurekodi sauti' : 'Start recording'}
        >
          ▶
        </button>
        <button
          onClick={stopRecordingAndTranscribe}
          disabled={!recording || transcribing}
          aria-label={
            transcribing
              ? (isSwahili ? 'Inatafsiri sauti' : 'Transcribing…')
              : (isSwahili ? 'Simamisha na tafsiri sauti' : 'Stop and transcribe')
          }
          title={
            transcribing
              ? (isSwahili ? 'Inatafsiri sauti' : 'Transcribing…')
              : (isSwahili ? 'Simamisha na tafsiri sauti' : 'Stop and transcribe')
          }
        >
          {transcribing ? '⏳' : '■'}
        </button>
      </div>

      <label className="transcript-label" htmlFor="mic-device-select">
        {isSwahili ? 'Kifaa cha kipaza sauti' : 'Microphone device'}
      </label>
      <p className="mic-hint">
        {isSwahili
          ? 'Pendekezo: tumia kipaza sauti cha headset/earphones chenye mic karibu na mdomo kwa matokeo bora.'
          : 'Recommended: use a headset or earphone microphone close to your mouth for better transcription.'}
      </p>
      <select
        id="mic-device-select"
        className="mic-device-select"
        value={selectedDeviceId}
        onChange={(event) => setSelectedDeviceId(event.target.value)}
        disabled={recording || transcribing || !inputDevices.length}
      >
        {!inputDevices.length && <option value="">{isSwahili ? 'Hakuna vifaa vya sauti' : 'No input devices found'}</option>}
        {inputDevices.map((device, index) => (
          <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
            {device.label || (isSwahili ? `Kipaza sauti ${index + 1}` : `Microphone ${index + 1}`)}
          </option>
        ))}
      </select>

      {captureInfo && (
        <p className="transcript-label">
          {isSwahili ? 'Muda' : 'Last capture'}: {captureInfo.durationSeconds.toFixed(1)}s,{' '}
          {captureInfo.sizeBytes} bytes, {captureInfo.mimeType}
        </p>
      )}

      <label className="transcript-label" htmlFor="transcript-box">
        {isSwahili ? 'Maneno yaliyotambuliwa' : 'Latest transcript'}
      </label>
      <div id="transcript-box" className="transcript-preview" aria-live="polite">
        {transcript || (isSwahili ? 'Bado hakuna maneno yaliyotambuliwa.' : 'No transcript captured yet.')}
      </div>

      {error && <p className="voice-error">{error}</p>}
    </section>
  )
}
