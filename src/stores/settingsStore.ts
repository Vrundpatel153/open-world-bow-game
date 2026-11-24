// ─────────────────────────────────────────────────────────────────────────────
// settingsStore — Production Graphics, Resolution, Audio & Pause Settings
// Controls render scale, shadow quality, foliage density, view distance,
// audio sub-buses, and real-time pause modal state.
// Automatically persists to localStorage with zero latency.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { sound } from '@/game/audio/SoundSynthesizer'

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom'
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra'
export type FoliageDensity = 'low' | 'medium' | 'high' | 'ultra'
export type ViewDistance = 'low' | 'medium' | 'high' | 'ultra'
export type AntiAliasing = 'off' | 'fxaa' | 'msaa'

export interface GraphicsSettings {
  preset: QualityPreset
  resolutionScale: number // 0.5 (50%), 0.75 (75%), 1.0 (100%), 1.25 (125%), 1.5 (150%)
  shadowQuality: ShadowQuality
  foliageDensity: FoliageDensity
  viewDistance: ViewDistance
  antiAliasing: AntiAliasing
  viewmodelLighting: boolean
  targetFps: number // 0 = uncapped, 30, 60, 120
  fullscreen: boolean
}

export interface AudioSettings {
  masterVolume: number // 0.0 to 1.0
  ambienceVolume: number // 0.0 to 1.0 (Nature birds & wind)
  sfxVolume: number // 0.0 to 1.0 (Bow, footsteps, sword, fire)
  isMuted: boolean
}

interface SettingsState {
  // Pause & Quick Menu
  isPaused: boolean
  isQuickMenuOpen: boolean
  activeTab: 'graphics' | 'audio' | 'controls' | 'hardware'

  // Settings Bags
  graphics: GraphicsSettings
  audio: AudioSettings

  // Actions
  setPaused: (paused: boolean) => void
  setQuickMenuOpen: (open: boolean) => void
  toggleQuickMenu: () => void
  setActiveTab: (tab: 'graphics' | 'audio' | 'controls' | 'hardware') => void

  // Graphics Setters
  applyPreset: (preset: QualityPreset) => void
  setResolutionScale: (scale: number) => void
  setShadowQuality: (quality: ShadowQuality) => void
  setFoliageDensity: (density: FoliageDensity) => void
  setViewDistance: (dist: ViewDistance) => void
  setAntiAliasing: (aa: AntiAliasing) => void
  setViewmodelLighting: (enabled: boolean) => void
  setTargetFps: (fps: number) => void
  toggleFullscreen: () => void

  // Audio Setters
  setMasterVolume: (vol: number) => void
  setAmbienceVolume: (vol: number) => void
  setSfxVolume: (vol: number) => void
  setMuted: (muted: boolean) => void

  // Reset
  resetToRecommended: () => void
}

const STORAGE_KEY = 'open_world_settings_v2'

export const PRESET_CONFIGS: Record<Exclude<QualityPreset, 'custom'>, Omit<GraphicsSettings, 'preset' | 'fullscreen'>> = {
  low: {
    resolutionScale: 0.75,
    shadowQuality: 'off',
    foliageDensity: 'low',
    viewDistance: 'low',
    antiAliasing: 'off',
    viewmodelLighting: false,
    targetFps: 60,
  },
  medium: {
    resolutionScale: 1.0,
    shadowQuality: 'low',
    foliageDensity: 'medium',
    viewDistance: 'medium',
    antiAliasing: 'fxaa',
    viewmodelLighting: true,
    targetFps: 60,
  },
  high: {
    resolutionScale: 1.0,
    shadowQuality: 'high',
    foliageDensity: 'high',
    viewDistance: 'high',
    antiAliasing: 'msaa',
    viewmodelLighting: true,
    targetFps: 0,
  },
  ultra: {
    resolutionScale: 1.25,
    shadowQuality: 'ultra',
    foliageDensity: 'ultra',
    viewDistance: 'ultra',
    antiAliasing: 'msaa',
    viewmodelLighting: true,
    targetFps: 0,
  },
}

function loadPersistedSettings(): { graphics: GraphicsSettings; audio: AudioSettings } {
  const defaultGraphics: GraphicsSettings = {
    preset: 'high',
    ...PRESET_CONFIGS.high,
    fullscreen: false,
  }

  const defaultAudio: AudioSettings = {
    masterVolume: 0.85,
    ambienceVolume: 0.65,
    sfxVolume: 0.90,
    isMuted: false,
  }

  if (typeof window === 'undefined') {
    return { graphics: defaultGraphics, audio: defaultAudio }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        graphics: { ...defaultGraphics, ...(parsed.graphics || {}) },
        audio: { ...defaultAudio, ...(parsed.audio || {}) },
      }
    }
  } catch (_) {}

  return { graphics: defaultGraphics, audio: defaultAudio }
}

function persistSettings(graphics: GraphicsSettings, audio: AudioSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ graphics, audio }))
  } catch (_) {}
}

const initial = loadPersistedSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isPaused: false,
  isQuickMenuOpen: false,
  activeTab: 'graphics',

  graphics: initial.graphics,
  audio: initial.audio,

  setPaused: (isPaused) => set({ isPaused }),

  setQuickMenuOpen: (isQuickMenuOpen) => {
    set({ isQuickMenuOpen, isPaused: isQuickMenuOpen })
  },

  toggleQuickMenu: () => {
    const next = !get().isQuickMenuOpen
    set({ isQuickMenuOpen: next, isPaused: next })
  },

  setActiveTab: (activeTab) => set({ activeTab }),

  applyPreset: (preset) => {
    if (preset === 'custom') {
      const g = { ...get().graphics, preset }
      set({ graphics: g })
      persistSettings(g, get().audio)
      return
    }

    const cfg = PRESET_CONFIGS[preset]
    const g: GraphicsSettings = {
      ...get().graphics,
      preset,
      ...cfg,
    }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setResolutionScale: (scale) => {
    const g = { ...get().graphics, resolutionScale: scale, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setShadowQuality: (quality) => {
    const g = { ...get().graphics, shadowQuality: quality, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setFoliageDensity: (density) => {
    const g = { ...get().graphics, foliageDensity: density, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setViewDistance: (dist) => {
    const g = { ...get().graphics, viewDistance: dist, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setAntiAliasing: (aa) => {
    const g = { ...get().graphics, antiAliasing: aa, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setViewmodelLighting: (enabled) => {
    const g = { ...get().graphics, viewmodelLighting: enabled, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  setTargetFps: (fps) => {
    const g = { ...get().graphics, targetFps: fps, preset: 'custom' as QualityPreset }
    set({ graphics: g })
    persistSettings(g, get().audio)
  },

  toggleFullscreen: () => {
    if (typeof document === 'undefined') return
    const isFull = !!document.fullscreenElement
    if (!isFull) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      const g = { ...get().graphics, fullscreen: true }
      set({ graphics: g })
    } else {
      document.exitFullscreen?.().catch(() => {})
      const g = { ...get().graphics, fullscreen: false }
      set({ graphics: g })
    }
  },

  setMasterVolume: (vol) => {
    const a = { ...get().audio, masterVolume: Math.max(0, Math.min(1, vol)) }
    set({ audio: a })
    sound.setMasterVolume(a.masterVolume)
    persistSettings(get().graphics, a)
  },

  setAmbienceVolume: (vol) => {
    const a = { ...get().audio, ambienceVolume: Math.max(0, Math.min(1, vol)) }
    set({ audio: a })
    sound.setAmbienceVolume(a.ambienceVolume)
    persistSettings(get().graphics, a)
  },

  setSfxVolume: (vol) => {
    const a = { ...get().audio, sfxVolume: Math.max(0, Math.min(1, vol)) }
    set({ audio: a })
    sound.setSfxVolume(a.sfxVolume)
    persistSettings(get().graphics, a)
  },

  setMuted: (isMuted) => {
    const a = { ...get().audio, isMuted }
    set({ audio: a })
    persistSettings(get().graphics, a)
  },

  resetToRecommended: () => {
    get().applyPreset('high')
    const a: AudioSettings = {
      masterVolume: 0.85,
      ambienceVolume: 0.65,
      sfxVolume: 0.90,
      isMuted: false,
    }
    set({ audio: a })
    persistSettings(get().graphics, a)
  },
}))

if (typeof window !== 'undefined') {
  ;(window as any).__settingsStore = useSettingsStore
}
