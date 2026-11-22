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

  // ── Arrow Nock / Reload: Soft wood slide & nock click onto string ───────────
  public playArrowNock() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.04)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  // ── Bow Equip: Leather rustle & subtle string twang ─────────────────────────
  public playBowEquip() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // 1. Leather rustle noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, now)
    filter.Q.setValueAtTime(1.5, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)

    // 2. Light wooden handle slide
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(120, now + 0.02)
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.1)

    oscGain.gain.setValueAtTime(0.001, now)
    oscGain.gain.linearRampToValueAtTime(0.08, now + 0.04)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

    osc.connect(oscGain)
    oscGain.connect(this.masterGain)
    osc.start(now + 0.02)
    osc.stop(now + 0.14)
  }

  // ── Bow Unequip: Soft leather stow slide ────────────────────────────────────
  public playBowUnequip() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.1)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(450, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
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

  // ── Arrow Impact on Environment (Tree Wood or Stone Rock) ───────────────────
  public playArrowThud(isWood: boolean = true) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    if (isWood) {
      // Solid deep wooden "thock" chunk
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, now)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.12)
    } else {
      // Crisp stone ricochet clank & fracture
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(1350, now)
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2200, now)
      filter.Q.setValueAtTime(3.5, now)

      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.08)
    }
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

  // ── Torch Audio: Fire Ignition Burst ──────────────────────────────────────
  public playTorchIgnite() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // Warm resonant flame flare whoosh
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(60, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.12)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.35)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(450, now)
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.35)

    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.35)

    // Sizzling kindling ember crackles
    const crackleCount = 4
    for (let i = 0; i < crackleCount; i++) {
      const delay = 0.05 + Math.random() * 0.2
      const popOsc = this.ctx.createOscillator()
      const popGain = this.ctx.createGain()
      popOsc.type = 'square'
      popOsc.frequency.setValueAtTime(800 + Math.random() * 1200, now + delay)
      popGain.gain.setValueAtTime(0.06, now + delay)
      popGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.02)
      popOsc.connect(popGain)
      popGain.connect(this.masterGain)
      popOsc.start(now + delay)
      popOsc.stop(now + delay + 0.02)
    }
  }

  // ── Torch Audio: Extinguish Sizzle ─────────────────────────────────────────
  public playTorchExtinguish() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.18)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
  }

  // ── Torch Audio: Thrust / Wave Flare Whoosh ────────────────────────────────
  public playTorchWave() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09)
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.28)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(550, now)

    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.32, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.28)
  }

  // ── Wooden Sword: Unsheathe / Ready ─────────────────────────────────────────
  public playSwordEquip() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // Friction whisper from scabbard
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.14)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI)
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(750, now)
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.14)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
  }

  // ── Wooden Sword: 3-Click Combo Swings (Left, Right, Big Slash) ────────────
  public playSwordSwing(comboStep: number = 1) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // Air cutting whoosh noise buffer
    const duration = comboStep === 3 ? 0.26 : 0.18
    const bufferSize = Math.floor(this.ctx.sampleRate * duration)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI)
      data[i] = (Math.random() * 2 - 1) * env
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.setValueAtTime(2.5, now)

    if (comboStep === 1) {
      // Quick diagonal left-to-right whoosh
      filter.frequency.setValueAtTime(380, now)
      filter.frequency.exponentialRampToValueAtTime(850, now + 0.08)
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.18)
    } else if (comboStep === 2) {
      // Agile returning right-to-left whoosh
      filter.frequency.setValueAtTime(480, now)
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.08)
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.18)
    } else {
      // Heavy downward cleave / finisher
      filter.frequency.setValueAtTime(280, now)
      filter.frequency.exponentialRampToValueAtTime(950, now + 0.11)
      filter.frequency.exponentialRampToValueAtTime(240, now + 0.26)

      // Resonant sub-frequency punch for big slash
      const subOsc = this.ctx.createOscillator()
      const subGain = this.ctx.createGain()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(95, now)
      subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.22)
      subGain.gain.setValueAtTime(0.25, now)
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      subOsc.connect(subGain)
      subGain.connect(this.masterGain)
      subOsc.start(now)
      subOsc.stop(now + 0.22)
    }

    const gain = this.ctx.createGain()
    const vol = comboStep === 3 ? 0.34 : 0.25
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
  }

  // ── Wooden Sword: Charged Heavy Attack Release ─────────────────────────────
  public playSwordChargeRelease() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // Heavy sonic whirlwind power whoosh
    const duration = 0.35
    const bufferSize = Math.floor(this.ctx.sampleRate * duration)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI)
      data[i] = (Math.random() * 2 - 1) * env
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.setValueAtTime(3.2, now)
    filter.frequency.setValueAtTime(260, now)
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.14)
    filter.frequency.exponentialRampToValueAtTime(280, now + duration)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.42, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)

    // Deep chest-thump bass punch
    const subOsc = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(120, now)
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.28)
    subGain.gain.setValueAtTime(0.38, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    subOsc.connect(subGain)
    subGain.connect(this.masterGain)
    subOsc.start(now)
    subOsc.stop(now + 0.28)
  }

  // ── Rock Strike: Hard Wood on Granite Clack & Impact Crack ──────────────────
  public playRockStrike(power: number = 1.0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // 1. Hard wooden clack (high impact transient)
    const woodOsc = this.ctx.createOscillator()
    const woodGain = this.ctx.createGain()
    woodOsc.type = 'square'
    woodOsc.frequency.setValueAtTime(420 * power, now)
    woodOsc.frequency.exponentialRampToValueAtTime(110, now + 0.05)
    woodGain.gain.setValueAtTime(0.45 * Math.min(1.2, power), now)
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    woodOsc.connect(woodGain)
    woodGain.connect(this.masterGain)
    woodOsc.start(now)
    woodOsc.stop(now + 0.05)

    // 2. Granite stone clang / friction scrape
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1800, now)
    filter.Q.setValueAtTime(5, now)

    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0.35 * power, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
  }

  // ── Sword Parry / Guard Clang ──────────────────────────────────────────────
  public playSwordParry() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(580, now)
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.15)
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.15)
  }
}

export const sound = new SoundSynthesizer()
