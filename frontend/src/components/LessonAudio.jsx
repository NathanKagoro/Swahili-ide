import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from './Icons'

const clock = (s) => {
  if (!Number.isFinite(s)) return '0:00'
  const whole = Math.floor(s)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Recorded lesson narration. Nothing is fetched until Play is pressed.
export default function LessonAudio({ lang, order }) {
  const t = (sw, en) => (lang === 'sw' ? sw : en)
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = `${import.meta.env.BASE_URL}audio/somo-${String(order).padStart(2, '0')}-${lang}.mp3`

  // A different lesson or language stops and forgets the current recording.
  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setDuration(0)
    setFailed(false)
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [src])

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.addEventListener('timeupdate', () => setTime(audio.currentTime))
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
      audio.addEventListener('ended', () => setPlaying(false))
      audio.addEventListener('pause', () => setPlaying(false))
      audio.addEventListener('play', () => setPlaying(true))
      audio.addEventListener('error', () => setFailed(true))
      audioRef.current = audio
    }
    const audio = audioRef.current
    if (audio.paused) audio.play().catch(() => setFailed(true))
    else audio.pause()
  }

  return (
    <div className="narration">
      <button type="button" className="btn btn-ink" onClick={toggle} aria-pressed={playing}>
        {playing ? <PauseIcon /> : <PlayIcon />}
        <span>{playing ? t('Simamisha sauti', 'Pause audio') : t('Sikiliza somo', 'Listen to the lesson')}</span>
      </button>
      {duration > 0 && (
        <>
          <input
            type="range"
            className="seek"
            min="0"
            max={Math.floor(duration)}
            step="1"
            value={Math.floor(time)}
            onChange={(event) => {
              audioRef.current.currentTime = Number(event.target.value)
              setTime(Number(event.target.value))
            }}
            aria-label={t('Sogeza sauti', 'Seek')}
            aria-valuetext={`${clock(time)} / ${clock(duration)}`}
          />
          <span className="narration-time">
            {clock(time)} / {clock(duration)}
          </span>
        </>
      )}
      <p className="narration-note">
        {failed
          ? t('Sauti ya somo hili haikupatikana.', 'The recording for this lesson could not be loaded.')
          : t('Sauti ya kompyuta (Piper), si ya binadamu.', 'Computer voice (Piper), not a human reader.')}
      </p>
    </div>
  )
}
