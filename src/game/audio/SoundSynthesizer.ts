// ─────────────────────────────────────────────────────────────────────────────
// SoundSynthesizer — Zero-Dependency Web Audio API Procedural Sound Engine
// Realistic archery sounds, wood creaks, resonant bell chimes, footstep rustling,
// and celestial fanfare generated mathematically in real-time.
// ─────────────────────────────────────────────────────────────────────────────

class SoundSynthesizer {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isMuted: boolean = false

  private init() {
    if (this.ctx) return
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    this.ctx = new AudioContextClass()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime)
    this.masterGain.connect(this.ctx.destination)
  }

  private ensureContext() {
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this.ctx.currentTime)
    }
  }

  // ── Bow Draw: subtle rising wood creak & tension ────────────────────────────
  public playBowDraw(progress: number) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    // Short pitch-bent filtered noise pulse mimicking wood fiber strain
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    const baseFreq = 80 + progress * 90
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 30, this.ctx.currentTime + 0.08)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(220 + progress * 300, this.ctx.currentTime)
    filter.Q.setValueAtTime(4, this.ctx.currentTime)

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start()
    osc.stop(this.ctx.currentTime + 0.08)
  }

  // ── Bow Release: sharp snap & vibrating bowstring twang ─────────────────────
  public playBowRelease(power: number = 1.0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // 1. String release snap (short high noise impulse)
    const bufferSize = this.ctx.sampleRate * 0.04
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.setValueAtTime(1200, now)

    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0.25 * power, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)

    // 2. Resonant string vibration (twang)
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()

    osc.type = 'sawtooth'
    const stringPitch = 140 + power * 40
    osc.frequency.setValueAtTime(stringPitch * 1.5, now)
    osc.frequency.exponentialRampToValueAtTime(stringPitch, now + 0.03)

    const stringFilter = this.ctx.createBiquadFilter()
    stringFilter.type = 'lowpass'
    stringFilter.frequency.setValueAtTime(900, now)
    stringFilter.frequency.exponentialRampToValueAtTime(180, now + 0.35)

    oscGain.gain.setValueAtTime(0.3 * power, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(stringFilter)
    stringFilter.connect(oscGain)
    oscGain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.35)
  }

  // ── Arrow Hit: wooden impact thud ──────────────────────────────────────────
  public playArrowHitWood() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12)

    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.12)
  }

  // ── Target Hit: crystalline bell chime with harmonic overtone ───────────────
  public playTargetHit(pitchOffset: number = 0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const notes = [587.33, 659.25, 783.99, 880.0, 1046.5] // D5, E5, G5, A5, C6
    const baseFreq = notes[Math.min(notes.length - 1, pitchOffset)] || 659.25

    // Fundamental & overtone
    const freqs = [baseFreq, baseFreq * 2.01, baseFreq * 3.14]
    const gains = [0.3, 0.15, 0.08]

    freqs.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(gains[i], now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.9)
    })
  }

  // ── Shrine Awakened: Celestial chord & resonant gong ────────────────────────
  public playShrineAwakened() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25] // C Major 9 chord

    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.09)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.09 + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now + idx * 0.09)
      osc.stop(now + 2.5)
    })
  }

  // ── Rune Shard Pickup: Sparkle ascending arpeggio ───────────────────────────
  public playRunePickup() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51] // C5, E5, G5, C6, E6

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.06)

      gain.gain.setValueAtTime(0.15, now + idx * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now + idx * 0.06)
      osc.stop(now + idx * 0.06 + 0.45)
    })
  }

  // ── Footstep: Soft grass rustle ─────────────────────────────────────────────
  public playFootstep(isSprinting: boolean = false) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }

    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(isSprinting ? 650 : 450, now)
    filter.Q.setValueAtTime(2, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(isSprinting ? 0.07 : 0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noise.start(now)
  }
}

export const sound = new SoundSynthesizer()
