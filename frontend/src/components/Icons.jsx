// Small inline SVG icons. All are decorative: the button text or aria-label names the action.
const base = { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': true, focusable: false }

export const PlayIcon = () => (
  <svg {...base}>
    <path d="M5 3.2v13.6L16.5 10z" fill="currentColor" />
  </svg>
)

export const StopIcon = () => (
  <svg {...base}>
    <rect x="4.5" y="4.5" width="11" height="11" fill="currentColor" />
  </svg>
)

export const PauseIcon = () => (
  <svg {...base}>
    <path d="M5 3.5h3.5v13H5zM11.5 3.5H15v13h-3.5z" fill="currentColor" />
  </svg>
)

export const MicIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="7.2" y="2.5" width="5.6" height="9.5" rx="2.8" fill="currentColor" stroke="none" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.8M7 17.8h6" />
  </svg>
)

export const SpeakerIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 7.8h3l4-3.3v11L6 12.2H3z" fill="currentColor" stroke="none" />
    <path d="M13 7.2a4 4 0 0 1 0 5.6M15.3 4.9a7.2 7.2 0 0 1 0 10.2" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
    <path d="M4 10.5l4 4 8-9" />
  </svg>
)

export const ResetIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.2 10a5.8 5.8 0 1 0 1.9-4.3" />
    <path d="M3.6 3.4v3.2h3.2" />
  </svg>
)

export const ArrowIcon = ({ back = false }) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" style={back ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" />
  </svg>
)
