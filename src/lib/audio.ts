let audioContext: AudioContext | null = null

export type SoundCue = 'rfq' | 'trade' | 'warning' | 'news' | 'finish'

export function playSound(cue: SoundCue, muted: boolean): void {
  if (muted || typeof window === 'undefined') return
  try {
    audioContext ??= new AudioContext()
    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const config: Record<SoundCue, { frequency: number; duration: number; gain: number }> = {
      rfq: { frequency: 720, duration: 0.08, gain: 0.025 },
      trade: { frequency: 980, duration: 0.07, gain: 0.02 },
      warning: { frequency: 300, duration: 0.12, gain: 0.03 },
      news: { frequency: 420, duration: 0.18, gain: 0.035 },
      finish: { frequency: 620, duration: 0.28, gain: 0.025 },
    }
    const selected = config[cue]
    oscillator.frequency.setValueAtTime(selected.frequency, now)
    oscillator.type = cue === 'warning' ? 'square' : 'sine'
    gain.gain.setValueAtTime(selected.gain, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + selected.duration)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + selected.duration)
  } catch {
    // Audio is non-essential and may be blocked until a user gesture.
  }
}
