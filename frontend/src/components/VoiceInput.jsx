import { useVoice } from '../hooks/useVoice'

// Server speech-to-text (Whisper or Deepgram on the optional backend).
export default function VoiceInput({ onTranscribed, language = 'sw' }) {
  const { error, inputDevices, selectedDeviceId, setSelectedDeviceId, recording, startRecording, stopRecordingAndTranscribe, transcribing } = useVoice(onTranscribed, language)
  const t = (sw, en) => (language === 'sw' ? sw : en)

  return (
    <section className="voice-box">
      <h3>{t('Sauti hadi maandishi ya seva', 'Server speech to text')}</h3>
      <p>
        {t(
          'Rekodi ujumbe wako; maandishi yatawekwa kwenye kisanduku cha ujumbe ili uyahariri kabla ya kutuma. Utambuzi wa Kiswahili bado una makosa mengi, Kiingereza hutambuliwa vizuri zaidi.',
          'Record your message; the transcript is placed in the message box so you can edit it before sending. Swahili recognition still makes many mistakes; English is recognised better.',
        )}
      </p>
      <label className="labelled">
        <span>{t('Kipaza sauti', 'Microphone')}</span>
        <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} disabled={recording || transcribing || !inputDevices.length}>
          {!inputDevices.length && <option value="">{t('Hakuna kipaza sauti', 'No microphone found')}</option>}
          {inputDevices.map((device, index) => (
            <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
              {device.label || `${t('Kipaza sauti', 'Microphone')} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <div className="voice-actions">
        <button type="button" className="btn btn-line" onClick={startRecording} disabled={recording || transcribing}>
          {t('Anza kurekodi', 'Start recording')}
        </button>
        <button type="button" className="btn btn-line" onClick={stopRecordingAndTranscribe} disabled={!recording || transcribing}>
          {transcribing ? t('Inanakili…', 'Transcribing…') : t('Simamisha na unakili', 'Stop and transcribe')}
        </button>
      </div>
      {error && <p className="optional-state">{error}</p>}
    </section>
  )
}
