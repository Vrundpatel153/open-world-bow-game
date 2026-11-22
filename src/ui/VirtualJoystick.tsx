// ─────────────────────────────────────────────────────────────────────────────
// VirtualJoystick — On-screen analog joystick and action buttons for mobile
// Directly updates inputStore for 360-degree fluid movement
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { inputManager } from '@/systems/KeyboardInput'
import styles from './VirtualJoystick.module.css'

export default function VirtualJoystick() {
  const [isSprinting, setIsSprinting] = useState(false)
  const baseRef = useRef<HTMLDivElement>(null!)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const touchIdRef = useRef<number | null>(null)

  const radius = 45 // max travel radius in px

  const handleTouchStart = (e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return
    const touch = e.changedTouches[0]
    touchIdRef.current = touch.identifier
    setIsDragging(true)
    updateKnob(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === touchIdRef.current) {
        updateKnob(touch.clientX, touch.clientY)
        break
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null
        setIsDragging(false)
        setKnobPos({ x: 0, y: 0 })
        inputManager.joystick = { x: 0, y: 0 }
        break
      }
    }
  }

  const updateKnob = (clientX: number, clientY: number) => {
    if (!baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = clientX - centerX
    const dy = clientY - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)

    const clampedDist = Math.min(dist, radius)
    const angle = Math.atan2(dy, dx)

    const kx = Math.cos(angle) * clampedDist
    const ky = Math.sin(angle) * clampedDist

    setKnobPos({ x: kx, y: ky })

    // In Three.js: -ky is forward (inputZ positive)
    const normX = kx / radius
    const normZ = -ky / radius
    inputManager.joystick = { x: normX, y: normZ }
  }

  return (
    <div className={styles.container}>
      {/* ── Virtual Analog Stick ─────────────────────────────────────────── */}
      <div
        ref={baseRef}
        className={`${styles.base} ${isDragging ? styles.active : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={styles.knob}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        />
      </div>

      {/* ── Mobile Action Buttons ────────────────────────────────────────── */}
      <div className={styles.actionButtons}>
        <button
          type="button"
          className={`${styles.actionBtn} ${isSprinting ? styles.sprintActive : ''}`}
          onTouchStart={() => {
            const next = !isSprinting
            setIsSprinting(next)
            inputManager.joystickSprint = next
          }}
          onClick={() => {
            const next = !isSprinting
            setIsSprinting(next)
            inputManager.joystickSprint = next
          }}
        >
          SPRINT
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onTouchStart={() => {
            inputManager.joystickJump = true
          }}
          onTouchEnd={() => {
            inputManager.joystickJump = false
          }}
          onMouseDown={() => {
            inputManager.joystickJump = true
          }}
          onMouseUp={() => {
            inputManager.joystickJump = false
          }}
        >
          JUMP
        </button>
      </div>
    </div>
  )
}
