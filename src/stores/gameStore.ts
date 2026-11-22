// ─────────────────────────────────────────────────────────────────────────────
// Game store — Zustand
//
// Central game state. All game systems (camera, input, scene) read from here.
// Never store Three.js objects here (not serialisable). Use refs for those.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'

export type SceneId = 'grass' | 'water' | 'godrays' | 'painterly'

export type GamePhase =
  | 'loading'   // assets loading
  | 'ready'     // first frame drawn, loading screen still visible
  | 'playing'   // user has entered the game
  | 'paused'

interface GameState {
  phase: GamePhase
  activeScene: SceneId
  grassPreset: string
  skyMode: string
  fps: number

  // Actions
  setPhase: (phase: GamePhase) => void
  setScene: (scene: SceneId) => void
  setGrassPreset: (preset: string) => void
  setSkyMode: (mode: string) => void
  setFps: (fps: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'loading',
  activeScene: 'grass',
  grassPreset: 'default',
  skyMode: 'day',
  fps: 0,

  setPhase:       (phase)       => set({ phase }),
  setScene:       (activeScene) => set({ activeScene }),
  setGrassPreset: (grassPreset) => set({ grassPreset }),
  setSkyMode:     (skyMode)     => set({ skyMode }),
  setFps:         (fps)         => set({ fps }),
}))
