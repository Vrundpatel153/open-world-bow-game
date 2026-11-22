// ─────────────────────────────────────────────────────────────────────────────
// FpsSystem — measures real FPS inside the render loop, writes to gameStore.
// Runs inside R3F <Canvas> via useFrame.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/stores/gameStore'

export default function FpsSystem() {
  const setFps = useGameStore((s) => s.setFps)
  const frames = useRef(0)
  const last   = useRef(performance.now())

  useFrame(() => {
    frames.current++
    const now = performance.now()
    if (now - last.current >= 500) {
      setFps(Math.round(frames.current * 1000 / (now - last.current)))
      frames.current = 0
      last.current = now
    }
  })

  return null
}
