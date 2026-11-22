// ─────────────────────────────────────────────────────────────────────────────
// Input store — keyboard/mouse/touch state for open world character & camera
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'

interface InputState {
  keys: Set<string>
  pointerLocked: boolean
  isMouseDown: boolean
  isSprinting: boolean
  isJumping: boolean

  // Virtual joystick vector (-1 to 1) for mobile
  joystickVector: { x: number; y: number }

  // Mouse & Touch delta for third-person camera rotation
  cameraDelta: { dx: number; dy: number }
  cameraZoomDelta: number

  pressKey: (key: string) => void
  releaseKey: (key: string) => void
  setLocked: (locked: boolean) => void
  setMouseDown: (down: boolean) => void
  setSprinting: (sprint: boolean) => void
  setJumping: (jump: boolean) => void
  setJoystickVector: (x: number, y: number) => void
  addCameraDelta: (dx: number, dy: number) => void
  consumeCameraDelta: () => { dx: number; dy: number }
  addZoomDelta: (delta: number) => void
  consumeZoomDelta: () => number
  isDown: (key: string) => boolean
}

export const useInputStore = create<InputState>((set, get) => ({
  keys: new Set(),
  pointerLocked: false,
  isMouseDown: false,
  isSprinting: false,
  isJumping: false,
  joystickVector: { x: 0, y: 0 },
  cameraDelta: { dx: 0, dy: 0 },
  cameraZoomDelta: 0,

  pressKey: (key) =>
    set((s) => {
      s.keys.add(key)
      return { keys: new Set(s.keys) }
    }),
  releaseKey: (key) =>
    set((s) => {
      s.keys.delete(key)
      return { keys: new Set(s.keys) }
    }),
  setLocked: (locked) => set({ pointerLocked: locked }),
  setMouseDown: (isMouseDown) => set({ isMouseDown }),
  setSprinting: (isSprinting) => set({ isSprinting }),
  setJumping: (isJumping) => set({ isJumping }),
  setJoystickVector: (x, y) => set({ joystickVector: { x, y } }),

  addCameraDelta: (dx, dy) =>
    set((s) => ({
      cameraDelta: { dx: s.cameraDelta.dx + dx, dy: s.cameraDelta.dy + dy },
    })),
  consumeCameraDelta: () => {
    const cur = get().cameraDelta
    if (cur.dx === 0 && cur.dy === 0) return cur
    set({ cameraDelta: { dx: 0, dy: 0 } })
    return cur
  },

  addZoomDelta: (delta) =>
    set((s) => ({ cameraZoomDelta: s.cameraZoomDelta + delta })),
  consumeZoomDelta: () => {
    const d = get().cameraZoomDelta
    if (d === 0) return 0
    set({ cameraZoomDelta: 0 })
    return d
  },

  isDown: (key) => get().keys.has(key),
}))
