// ─────────────────────────────────────────────────────────────────────────────
// HUD — First-Person Stylized Open World HUD
// Crosshair reticle, Sky Preset Switcher, 360° FPS Controls Guide, and Mobile Joysticks
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { inputManager } from '@/systems/KeyboardInput'
import type { SkyMode } from '@/components/skyDome/constants'
import VirtualJoystick from './VirtualJoystick'
import styles from './HUD.module.css'

interface HUDProps {
  currentSky: SkyMode
  onSelectSky: (mode: SkyMode) => void
}

const SKY_OPTIONS: { id: SkyMode; label: string; icon: string }[] = [
  { id: 'day', label: 'Day', icon: '' },
  { id: 'sunset', label: 'Sunset', icon: '' },
  { id: 'night', label: 'Night', icon: '' },
  { id: 'sunrise', label: 'Sunrise', icon: '' },
]

export default function HUD({ currentSky, onSelectSky }: HUDProps) {
  const fps = useGameStore((s) => s.fps)
  const [isLocked, setIsLocked] = useState(inputManager.isLocked)
  const [showJoystick, setShowJoystick] = useState(false)

  useEffect(() => {
    return inputManager.onLockChange((locked) => {
      setIsLocked(locked)
    })
  }, [])

  return (
    <div className={styles.wrapper}>
      {/* ── Top Bar: Title & Sky Presets ──────────────────────────────────── */}
      <header className={styles.topBar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Stylized Open World</h1>
          <span className={styles.subtitle}>
            First Person • 360° Look • Real 3JS Grass & Foliage
          </span>
        </div>

        {/* Sky Mode Switcher */}
        <div className={styles.skyPills}>
          {SKY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`${styles.skyPill} ${currentSky === opt.id ? styles.activeSky : ''}`}
              onClick={() => onSelectSky(opt.id)}
            >
              <span className={styles.skyIcon}>{opt.icon}</span>
              <span className={styles.skyLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── First-Person Crosshair & Pointer Lock Prompt ──────────────────── */}
      <div className={styles.centerReticle}>
        <div className={styles.crosshairDot} />
        {!isLocked && (
          <div className={styles.clickPrompt}>
            Click screen to lock cursor (360° Mouse Look)
          </div>
        )}
      </div>

      {/* ── Virtual Joystick (Mobile & Touch) ─────────────────────────────── */}
      {showJoystick && <VirtualJoystick />}

      {/* ── Bottom Controls Guide & Status Bar ────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.controlsBadge}>
          <span className={styles.keyTag}>WASD</span> Move
          <span className={styles.separator}>•</span>
          <span className={styles.keyTag}>MOUSE</span> 360° Look
          <span className={styles.separator}>•</span>
          <span className={styles.keyTag}>SHIFT</span> Sprint
          <span className={styles.separator}>•</span>
          <span className={styles.keyTag}>SPACE</span> Jump
          <span className={styles.separator}>•</span>
          <span className={styles.keyTag}>ESC</span> Unlock Cursor
        </div>

        <div className={styles.statusGroup}>
          <button
            type="button"
            className={styles.toggleTouchBtn}
            onClick={() => setShowJoystick(!showJoystick)}
            title="Toggle touch joystick overlay"
          >
            {showJoystick ? 'Touch: ON' : 'Touch: OFF'}
          </button>
          <span className={styles.fps}>{fps} FPS</span>
        </div>
      </footer>
    </div>
  )
}
