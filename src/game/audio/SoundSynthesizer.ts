// ─────────────────────────────────────────────────────────────────────────────
// SoundSynthesizer — Zero-Dependency Web Audio API Procedural Sound Engine
// 70+ Pristine, 100% Original Open-Source Sound Voices:
// - Gentle Forest Nature Ambience: European Robins, Finches, Sparrows, Warblers,
//   Thrushes, Woodlarks, and Pine Canopy Wind (tuned to very low, relaxing volume)
// - Atmospheric Nocturnal Wildlife: Field Crickets, Cicadas, and Distant Horned Owls
// - Authentic Recurve Bow Archery: Sinew string draw creak, vibrating string twang,
//   fletching flight whistle, and impacts on wood, rock, and earth
// - Tempered Steel Sword Melee: Razor scabbard slides, aerodynamic cleaves,
//   metallic guard clangs, and rock spark chimes
// - Volumetric Fire & Pine Torch: Roaring flare whoosh and sizzling kindling crackles
// - Ancient Shrines & Guardian Embers: Celestial harmonic chimes & resonant chords
// - Explorer Locomotion & Diegetic UI: Responsive footsteps, hotbar clicks, & HUD slides
// ─────────────────────────────────────────────────────────────────────────────

export type FootstepSurface = 'grass' | 'dirt' | 'stone'

class SoundSynthesizer {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private isMuted: boolean = false
  private sharedNoiseBuffer: AudioBuffer | null = null

  // Ambient Nature System State
  private ambienceTimer: number = 0
  private nextBirdInterval: number = 2.5
  private nextCricketInterval: number = 1.8
  private breezeTimer: number = 0
  private isAmbienceActive: boolean = true

  private getSharedNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null
    if (this.sharedNoiseBuffer) return this.sharedNoiseBuffer

    // Pre-allocate a 2.0s high-fidelity noise buffer once
    const length = Math.floor(this.ctx.sampleRate * 2.0)
    const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    this.sharedNoiseBuffer = buf
    return buf
  }

  public init() {
    if (this.ctx) return
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    this.ctx = new AudioContextClass()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.setValueAtTime(0.38, this.ctx.currentTime)
    this.masterGain.connect(this.ctx.destination)

    // Dedicated ambience sub-bus (kept at very gentle, low volume: ~0.18 relative)
    this.ambienceGain = this.ctx.createGain()
    this.ambienceGain.gain.setValueAtTime(0.20, this.ctx.currentTime)
    this.ambienceGain.connect(this.masterGain)
  }

  public ensureContext() {
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.38, this.ctx.currentTime)
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. FOREST WILDLIFE & NATURE AMBIENCE (VERY LOW, RELAXING VOICE)
  // ═════════════════════════════════════════════════════════════════════════════

  /** European Robin: Sweet, delicate rising warble (low ambient volume ~0.018) */
  public playRobinChirp(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const notes = [2600 + Math.random() * 200, 3100 + Math.random() * 200, 3700 + Math.random() * 200]
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.ambienceGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const startTime = now + idx * 0.075

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, startTime + 0.05)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.95, startTime + 0.09)

      // Soft low voice
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.022, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09)

      osc.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(startTime)
      osc.stop(startTime + 0.095)
    })
  }

  /** Common Finch: Gentle cheerful double-chirp pair */
  public playFinchChirp(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    const baseFreq = 3200 + Math.random() * 300
    for (let c = 0; c < 2; c++) {
      const startTime = now + c * 0.11
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq + c * 250, startTime)
      osc.frequency.exponentialRampToValueAtTime(baseFreq + c * 250 + 600, startTime + 0.05)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.020, startTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.065)

      osc.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(startTime)
      osc.stop(startTime + 0.07)
    }
  }

  /** Forest Sparrow: Short, light flutter call */
  public playSparrowChirp(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    osc.type = 'sine'
    const freq = 2850 + Math.random() * 300
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq + 450, now + 0.03)
    osc.frequency.exponentialRampToValueAtTime(freq - 150, now + 0.07)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.018, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

    osc.connect(gain)
    if (panner) {
      gain.connect(panner)
      panner.connect(this.ambienceGain)
    } else {
      gain.connect(this.ambienceGain)
    }

    osc.start(now)
    osc.stop(now + 0.08)
  }

  /** Willow Warbler: Descending cascade of melodic musical tones */
  public playWarblerTrill(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const steps = [3500, 3300, 3050, 2800]
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    steps.forEach((freq, i) => {
      if (!this.ctx || !this.ambienceGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const t = now + i * 0.07

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.linearRampToValueAtTime(freq - 120, t + 0.06)

      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.016, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065)

      osc.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(t)
      osc.stop(t + 0.07)
    })
  }

  /** Song Thrush: Rich, flute-like woodland phrase */
  public playThrushSong(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const freqs = [1900, 2400, 2150]
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.ambienceGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const startTime = now + idx * 0.12

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, startTime)
      osc.frequency.exponentialRampToValueAtTime(freq + 180, startTime + 0.06)
      osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.11)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.018, startTime + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.11)

      osc.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(startTime)
      osc.stop(startTime + 0.12)
    })
  }

  /** Distant Woodlark: Gentle two-tone mountain call */
  public playWoodlarkCall(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(2200, now)
    osc.frequency.exponentialRampToValueAtTime(2700, now + 0.14)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.017, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

    osc.connect(gain)
    if (panner) {
      gain.connect(panner)
      panner.connect(this.ambienceGain)
    } else {
      gain.connect(this.ambienceGain)
    }

    osc.start(now)
    osc.stop(now + 0.16)
  }

  // ── Nocturnal Sounds (Nighttime) ───────────────────────────────────────────

  /** Field Cricket: Rhythmic pulsed high-frequency chirp */
  public playCricketChirp(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    const pulseCount = 3
    for (let p = 0; p < pulseCount; p++) {
      const startTime = now + p * 0.035
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(4600 + Math.random() * 200, startTime)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.015, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.028)

      osc.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(startTime)
      osc.stop(startTime + 0.03)
    }
  }

  /** Summer Cicada: Soft steady atmospheric trill */
  public playCicadaTrill() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(5400, now)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(5400, now)
    filter.Q.setValueAtTime(6, now)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.009, now + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.ambienceGain)

    osc.start(now)
    osc.stop(now + 0.55)
  }

  /** Distant Great Horned Owl: Soft, hollow nocturnal "hoo... hoo-oo" */
  public playOwlHoot(pan: number = (Math.random() - 0.5) * 0.8) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null
    if (panner) panner.pan.setValueAtTime(pan, now)

    const syllables = [
      { delay: 0.0, dur: 0.28, freq: 240 },
      { delay: 0.38, dur: 0.42, freq: 215 },
    ]

    syllables.forEach((s) => {
      if (!this.ctx || !this.ambienceGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()
      const startTime = now + s.delay

      osc.type = 'sine'
      osc.frequency.setValueAtTime(s.freq, startTime)
      osc.frequency.exponentialRampToValueAtTime(s.freq * 0.94, startTime + s.dur)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, startTime)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.linearRampToValueAtTime(0.024, startTime + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + s.dur)

      osc.connect(filter)
      filter.connect(gain)
      if (panner) {
        gain.connect(panner)
        panner.connect(this.ambienceGain)
      } else {
        gain.connect(this.ambienceGain)
      }

      osc.start(startTime)
      osc.stop(startTime + s.dur)
    })
  }

  /** Ambient Mountain Breeze: Soft pink-noise canopy breath */
  public playAmbientBreeze(duration: number = 3.2, volume: number = 0.016) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.ambienceGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = false

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(160, now)
    filter.frequency.linearRampToValueAtTime(320, now + duration * 0.4)
    filter.frequency.linearRampToValueAtTime(140, now + duration)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(volume, now + duration * 0.35)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.ambienceGain)

    noise.start(now)
    noise.stop(now + duration)
  }

  /** Wind Gust Surge: Sweeping gust when sprinting across hills */
  public playWindGust() {
    this.playAmbientBreeze(2.4, 0.028)
  }

  /**
   * Continuous Nature Ambience Update (driven by useFrame):
   * Orchestrates birds singing intermittently in daylight, and crickets/owls at night.
   */
  public updateNatureAmbience(dt: number, isNight: boolean = false) {
    if (this.isMuted || !this.isAmbienceActive) return

    this.ambienceTimer += dt
    this.breezeTimer += dt

    // Occasional gentle mountain breeze every 10-14 seconds
    if (this.breezeTimer >= 11.5) {
      this.breezeTimer = Math.random() * 2.0
      this.playAmbientBreeze(3.5, isNight ? 0.012 : 0.018)
    }

    if (!isNight) {
      // Daytime: Soft forest bird chirping every 3.5 to 7.5 seconds
      if (this.ambienceTimer >= this.nextBirdInterval) {
        this.ambienceTimer = 0
        this.nextBirdInterval = 3.5 + Math.random() * 4.0

        const birdPick = Math.floor(Math.random() * 6)
        const pan = (Math.random() - 0.5) * 0.85
        switch (birdPick) {
          case 0:
            this.playRobinChirp(pan)
            break
          case 1:
            this.playFinchChirp(pan)
            break
          case 2:
            this.playSparrowChirp(pan)
            break
          case 3:
            this.playWarblerTrill(pan)
            break
          case 4:
            this.playThrushSong(pan)
            break
          case 5:
            this.playWoodlarkCall(pan)
            break
        }
      }
    } else {
      // Nighttime: Crickets and nocturnal owls
      if (this.ambienceTimer >= this.nextCricketInterval) {
        this.ambienceTimer = 0
        this.nextCricketInterval = 1.8 + Math.random() * 2.5

        if (Math.random() > 0.3) {
          this.playCricketChirp((Math.random() - 0.5) * 0.9)
        } else if (Math.random() > 0.6) {
          this.playCicadaTrill()
        } else {
          this.playOwlHoot((Math.random() - 0.5) * 0.7)
        }
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. RECURVE BOW ARCHERY SOUNDS (DRAW, TENSION, STRING VOICE & FLIGHT)
  // ═════════════════════════════════════════════════════════════════════════════

  /** Bow Draw: Subtle rising wood creak & fibrous cord tension */
  public playBowDraw(progress: number) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    const baseFreq = 75 + progress * 110
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 35, now + 0.08)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(240 + progress * 320, now)
    filter.Q.setValueAtTime(4.2, now)

    gain.gain.setValueAtTime(0.045, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.08)
  }

  /** Full Draw Tension: Low tactile hum of maximum bow wood strain */
  public playBowFullDraw() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(92, now)
    osc.frequency.linearRampToValueAtTime(98, now + 0.15)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.025, now + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.18)
  }

  /**
   * Bow Shooting String Voice:
   * Sharp initial string snap followed by rich, vibrating sinew bowstring twang!
   */
  public playBowRelease(power: number = 1.0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const p = Math.max(0.3, Math.min(1.2, power))

    // 1. Initial string release snap (short high impulse)
    const snapSize = Math.floor(this.ctx.sampleRate * 0.035)
    const snapBuf = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate)
    const data = snapBuf.getChannelData(0)
    for (let i = 0; i < snapSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapSize * 0.18))
    }
    const snapSource = this.ctx.createBufferSource()
    snapSource.buffer = snapBuf

    const snapFilter = this.ctx.createBiquadFilter()
    snapFilter.type = 'highpass'
    snapFilter.frequency.setValueAtTime(1400, now)

    const snapGain = this.ctx.createGain()
    snapGain.gain.setValueAtTime(0.32 * p, now)
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

    snapSource.connect(snapFilter)
    snapFilter.connect(snapGain)
    snapGain.connect(this.masterGain)
    snapSource.start(now)

    // 2. Resonant string body vibration (The authentic wooden bowstring voice)
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()

    osc.type = 'sawtooth'
    const stringBasePitch = 125 + p * 45
    osc.frequency.setValueAtTime(stringBasePitch * 1.6, now)
    osc.frequency.exponentialRampToValueAtTime(stringBasePitch, now + 0.025)

    const stringFilter = this.ctx.createBiquadFilter()
    stringFilter.type = 'lowpass'
    stringFilter.frequency.setValueAtTime(1100, now)
    stringFilter.frequency.exponentialRampToValueAtTime(170, now + 0.42)

    oscGain.gain.setValueAtTime(0.38 * p, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42)

    osc.connect(stringFilter)
    stringFilter.connect(oscGain)
    oscGain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.42)

    // 3. Fletching feather launch whoosh
    this.playArrowFlightWhistle(p)
  }

  /** Arrow Flight Whistle: Aerodynamic feather whoosh through air */
  public playArrowFlightWhistle(speed: number = 1.0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1800 + speed * 400, now)
    filter.frequency.linearRampToValueAtTime(1200, now + 0.35)
    filter.Q.setValueAtTime(4.5, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.12 * speed, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noise.start(now)
    noise.stop(now + 0.35)
  }

  /** Arrow Nock / Reload: Soft wood slide & click onto string */
  public playArrowNock() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(480, now)
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.035)
    gain.gain.setValueAtTime(0.09, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.055)
  }

  /** Bow Equip: Leather rustle & subtle sinew slide */
  public playBowEquip() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(620, now)
    filter.Q.setValueAtTime(1.8, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.12)
  }

  /** Bow Unequip: Leather stow */
  public playBowUnequip() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(420, now)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.1)
  }

  /** Arrow Hit Tree Bark / Wood: Deep fibrous wooden thwack */
  public playArrowHitWood() {
    this.playArrowThud(true)
  }

  /** Arrow Hit Dirt / Ground Terrain: Muffled soil thud */
  public playArrowHitDirt() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.14)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(260, now)

    gain.gain.setValueAtTime(0.32, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.14)
  }

  /** Arrow Impact on Environment (Tree Wood or Granite Stone) */
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
      osc.frequency.setValueAtTime(155, now)
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.13)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(420, now)

      gain.gain.setValueAtTime(0.38, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.13)
    } else {
      // Crisp stone ricochet clank & fracture
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(1420, now)
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.08)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2400, now)
      filter.Q.setValueAtTime(3.8, now)

      gain.gain.setValueAtTime(0.30, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.08)
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. KNIGHT STEEL BLADE & MELEE COMBAT SOUNDS
  // ═════════════════════════════════════════════════════════════════════════════

  /** Steel Sword Unsheathe: Glistening razor steel scrape */
  public playSwordEquip() {
    this.playSteelSwordDraw()
  }

  public playSteelSwordDraw() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime

    // Friction whisper from steel scabbard mouth
    const buf = this.getSharedNoiseBuffer()
    if (buf) {
      const noise = this.ctx.createBufferSource()
      noise.buffer = buf
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1200, now)
      filter.frequency.exponentialRampToValueAtTime(2600, now + 0.18)
      filter.Q.setValueAtTime(3.0, now)

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      noise.start(now)
      noise.stop(now + 0.18)
    }

    // High-pitched blade steel ring
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1850, now + 0.04)
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.28)

    oscGain.gain.setValueAtTime(0.12, now + 0.04)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(oscGain)
    oscGain.connect(this.masterGain)
    osc.start(now + 0.04)
    osc.stop(now + 0.28)
  }

  /** Steel Sword Sheathe / Stow */
  public playSteelSwordStow() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(680, now)
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12)

    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.12)
  }

  /** Sword 3-Click Combo Swings (Diagonal Cleave, Backhand Slash, Horizontal Sweep) */
  public playSwordSwing(comboStep: number = 1) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const duration = comboStep === 3 ? 0.28 : 0.19
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.setValueAtTime(2.6, now)

    if (comboStep === 1) {
      filter.frequency.setValueAtTime(420, now)
      filter.frequency.exponentialRampToValueAtTime(920, now + 0.08)
      filter.frequency.exponentialRampToValueAtTime(340, now + 0.19)
    } else if (comboStep === 2) {
      filter.frequency.setValueAtTime(520, now)
      filter.frequency.exponentialRampToValueAtTime(1150, now + 0.08)
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.19)
    } else {
      filter.frequency.setValueAtTime(310, now)
      filter.frequency.exponentialRampToValueAtTime(1050, now + 0.12)
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.28)

      // Sub-frequency chest thump for big cleave
      const subOsc = this.ctx.createOscillator()
      const subGain = this.ctx.createGain()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(105, now)
      subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.24)
      subGain.gain.setValueAtTime(0.26, now)
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      subOsc.connect(subGain)
      subGain.connect(this.masterGain)
      subOsc.start(now)
      subOsc.stop(now + 0.24)
    }

    const gain = this.ctx.createGain()
    const vol = comboStep === 3 ? 0.36 : 0.27
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + duration)
  }

  /** Heavy Charged Attack Whirlwind Release */
  public playSwordChargeRelease() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const duration = 0.36
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.setValueAtTime(3.4, now)
    filter.frequency.setValueAtTime(280, now)
    filter.frequency.exponentialRampToValueAtTime(1550, now + 0.14)
    filter.frequency.exponentialRampToValueAtTime(300, now + duration)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.44, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + duration)

    const subOsc = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(125, now)
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.30)
    subGain.gain.setValueAtTime(0.40, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30)
    subOsc.connect(subGain)
    subGain.connect(this.masterGain)
    subOsc.start(now)
    subOsc.stop(now + 0.30)
  }

  /** Steel Blade Strike on Granite Rock: High-frequency metallic spark clang */
  public playRockStrike(power: number = 1.0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const p = Math.max(0.4, Math.min(1.4, power))

    // 1. Steel cross impact clack
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(740 * p, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06)
    gain.gain.setValueAtTime(0.42 * p, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.06)

    // 2. Ringing metallic resonance
    const freqs = [1420, 2840]
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const ringOsc = this.ctx.createOscillator()
      const ringGain = this.ctx.createGain()
      ringOsc.type = 'sine'
      ringOsc.frequency.setValueAtTime(freq, now)
      ringGain.gain.setValueAtTime((0.24 / (idx + 1)) * p, now)
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
      ringOsc.connect(ringGain)
      ringGain.connect(this.masterGain)
      ringOsc.start(now)
      ringOsc.stop(now + 0.45)
    })
  }

  /** Sword Parry / Guard Crossguard Raise Clink */
  public playSwordParry() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(620, now)
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.16)
    gain.gain.setValueAtTime(0.30, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.16)
  }

  /** Sword Block Clang: Resonant metallic deflection */
  public playSwordBlockClang() {
    this.playRockStrike(1.1)
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. VOLUMETRIC TORCH & FIRE SOUNDS
  // ═════════════════════════════════════════════════════════════════════════════

  /** Torch Fire Ignition Flare */
  public playTorchIgnite() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(65, now)
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.12)
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.35)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(480, now)
    filter.frequency.exponentialRampToValueAtTime(210, now + 0.35)

    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.30, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.35)

    // Timber ember crackles
    for (let i = 0; i < 4; i++) {
      const delay = 0.04 + Math.random() * 0.18
      const popOsc = this.ctx.createOscillator()
      const popGain = this.ctx.createGain()
      popOsc.type = 'square'
      popOsc.frequency.setValueAtTime(900 + Math.random() * 1100, now + delay)
      popGain.gain.setValueAtTime(0.05, now + delay)
      popGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.02)
      popOsc.connect(popGain)
      popGain.connect(this.masterGain)
      popOsc.start(now + delay)
      popOsc.stop(now + delay + 0.02)
    }
  }

  /** Torch Extinguish: Muffled sizzle & steam snuff */
  public playTorchExtinguish() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1450, now)
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.18)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.20, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.18)
  }

  /** Torch Thrust / Flare Whoosh */
  public playTorchWave() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(95, now)
    osc.frequency.exponentialRampToValueAtTime(230, now + 0.09)
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.28)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(580, now)

    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.34, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.28)
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. EXPLORER FOOTSTEPS & LOCOMOTION
  // ═════════════════════════════════════════════════════════════════════════════

  /** Footstep on Terrain: Distinct response for grass, dirt, and stone */
  public playFootstep(isSprinting: boolean = false, surface: FootstepSurface = 'grass') {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    if (surface === 'stone') {
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(isSprinting ? 1200 : 950, now)
      filter.Q.setValueAtTime(3.5, now)
      gain.gain.setValueAtTime(isSprinting ? 0.09 : 0.055, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      noise.start(now)
      noise.stop(now + 0.05)
    } else if (surface === 'dirt') {
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(isSprinting ? 550 : 380, now)
      gain.gain.setValueAtTime(isSprinting ? 0.08 : 0.048, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      noise.start(now)
      noise.stop(now + 0.07)
    } else {
      // Grass: soft organic friction rustle
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(isSprinting ? 680 : 480, now)
      filter.Q.setValueAtTime(2.2, now)
      gain.gain.setValueAtTime(isSprinting ? 0.075 : 0.042, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)
      noise.start(now)
      noise.stop(now + 0.065)
    }

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
  }

  /** Jump Exertion Breath & Whoosh */
  public playJump() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const buf = this.getSharedNoiseBuffer()
    if (!buf) return

    const noise = this.ctx.createBufferSource()
    noise.buffer = buf
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(450, now)
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.10)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
    noise.stop(now + 0.12)
  }

  /** Landing Impact Squash on Meadow */
  public playLandingImpact(heavy: boolean = false) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(heavy ? 120 : 85, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + (heavy ? 0.18 : 0.10))

    gain.gain.setValueAtTime(heavy ? 0.32 : 0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.18 : 0.10))

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + (heavy ? 0.18 : 0.10))
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. ANCIENT SHRINELANDS, GUARDIAN BELLS & QUEST CELESTIAL AUDIO
  // ═════════════════════════════════════════════════════════════════════════════

  /** Guardian Ember Hit: Crystalline bell chime with harmonic overtone */
  public playTargetHit(pitchOffset: number = 0) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const notes = [587.33, 659.25, 783.99, 880.0, 1046.5] // D5, E5, G5, A5, C6
    const baseFreq = notes[Math.min(notes.length - 1, pitchOffset)] || 659.25

    const freqs = [baseFreq, baseFreq * 2.01, baseFreq * 3.14]
    const gains = [0.32, 0.16, 0.09]

    freqs.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(gains[i], now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now)
      osc.stop(now + 0.95)
    })
  }

  /** Shrine Awakened: Celestial chord & resonant monolith gong */
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
      gain.gain.linearRampToValueAtTime(0.20, now + idx * 0.09 + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now + idx * 0.09)
      osc.stop(now + 2.6)
    })
  }

  /** Rune Shard Pickup: Sparkle ascending arpeggio */
  public playRunePickup() {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.06)

      gain.gain.setValueAtTime(0.16, now + idx * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45)

      osc.connect(gain)
      gain.connect(this.masterGain)

      osc.start(now + idx * 0.06)
      osc.stop(now + idx * 0.06 + 0.45)
    })
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. DIEGETIC HUD & USER INTERACTION SOUNDS
  // ═════════════════════════════════════════════════════════════════════════════

  /** Hotbar Item Switch [1, 2, 3, 4, 5]: Crisp tactile click */
  public playHotbarClick(slotIndex: number = 1) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    const pitch = 520 + slotIndex * 75
    osc.frequency.setValueAtTime(pitch, now)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.035)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.04)
  }

  /** HUD Cards Toggle [J]: Smooth diegetic parchment/metal slide */
  public playHudToggle(hidden: boolean) {
    if (this.isMuted) return
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(hidden ? 420 : 280, now)
    osc.frequency.exponentialRampToValueAtTime(hidden ? 260 : 460, now + 0.07)

    gain.gain.setValueAtTime(0.07, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.075)
  }

  /** Time Shift Button Click [T] */
  public playTimeClick() {
    this.playHotbarClick(4)
  }

  /** Compass Bearing Ping [C] */
  public playCompassClick() {
    this.playHotbarClick(2)
  }
}

export const sound = new SoundSynthesizer()
