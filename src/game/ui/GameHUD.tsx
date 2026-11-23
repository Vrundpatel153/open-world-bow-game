// ─────────────────────────────────────────────────────────────────────────────
// GameHUD — Authentic AAA Fantasy RPG Combat & Exploration Interface
// Features: Diegetic Skyrim-Grade Compass, Dynamic Archery Reticle,
// Monolith Objective Dossier, Cinematic Notification Toasts & Victory Modal.
// Strict Design Mandate: 100% Zero Emojis, Pure Game Typography & Heraldic Icons.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { useQuestStore, type ShrineDef } from '../stores/questStore'
import * as THREE from 'three'

interface GameHUDProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>
  cameraYawRef?: React.MutableRefObject<number>
  onSwitchSkyToNight?: () => void
  currentPhaseName?: string
}

// ── Cardinal & Ordinal Compass Headings ─────────────────────────────────────
const COMPASS_POINTS = [
  { label: 'N', deg: 0, isCardinal: true, isNorth: true },
  { label: 'NE', deg: 45, isCardinal: false },
  { label: 'E', deg: 90, isCardinal: true },
  { label: 'SE', deg: 135, isCardinal: false },
  { label: 'S', deg: 180, isCardinal: true },
  { label: 'SW', deg: 225, isCardinal: false },
  { label: 'W', deg: 270, isCardinal: true },
  { label: 'NW', deg: 315, isCardinal: false },
]

const kbdStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(214, 184, 120, 0.45)',
  borderRadius: 2,
  padding: '1px 5px',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 9,
  fontWeight: 700,
  color: '#d4af37',
}

export default function GameHUD({
  playerPosRef,
  cameraYawRef,
  onSwitchSkyToNight,
  currentPhaseName = 'DAYLIGHT',
}: GameHUDProps) {
  const shrines = useQuestStore((s) => s.shrines)
  const totalAwakened = useQuestStore((s) => s.totalAwakened)
  const totalCollected = useQuestStore((s) => s.totalCollected)
  const drawProgress = useQuestStore((s) => s.drawProgress)
  const isAiming = useQuestStore((s) => s.isAiming)
  const isBowEquipped = useQuestStore((s) => s.isBowEquipped)
  const activeItem = useQuestStore((s) => s.activeItem)
  const toggleItem = useQuestStore((s) => s.toggleItem)
  const hitMarkerId = useQuestStore((s) => s.hitMarkerId)
  const notification = useQuestStore((s) => s.notification)
  const gameWon = useQuestStore((s) => s.gameWon)
  const arrowsShot = useQuestStore((s) => s.arrowsShot)
  const arrowsHit = useQuestStore((s) => s.arrowsHit)
  const dayPhaseName = useQuestStore((s) => s.dayPhaseName)
  const isQuestLogCollapsed = useQuestStore((s) => s.isQuestLogCollapsed)
  const toggleQuestLog = useQuestStore((s) => s.toggleQuestLog)
  const resetGame = useQuestStore((s) => s.resetGame)

  const nearestShrine = useMemo(() => {
    if (!playerPosRef?.current) return null
    let minDist = Infinity
    let closest: { id: string; name: string; dist: number } | null = null
    const px = playerPosRef.current.x
    const pz = playerPosRef.current.z
    for (const s of shrines) {
      if (s.isRuneCollected) continue
      const dist = Math.hypot(s.position[0] - px, s.position[2] - pz)
      if (dist < minDist) {
        minDist = dist
        closest = { id: s.id, name: s.name, dist: Math.round(dist) }
      }
    }
    return closest
  }, [playerPosRef?.current?.x, playerPosRef?.current?.z, shrines])

  const [showHitMarker, setShowHitMarker] = useState(false)
  const [playerHeading, setPlayerHeading] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  // Hit marker flash trigger
  useEffect(() => {
    if (hitMarkerId > 0) {
      setShowHitMarker(true)
      const timer = setTimeout(() => setShowHitMarker(false), 220)
      return () => clearTimeout(timer)
    }
  }, [hitMarkerId])

  // Toast notification management with clean cinematic fade
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setToastVisible(true)
  }

  useEffect(() => {
    if (notification) {
      triggerToast(notification)
      const timer = setTimeout(() => setToastVisible(false), 4500)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Compass heading polling (~20Hz for butter-smooth rotation)
  useEffect(() => {
    const interval = setInterval(() => {
      if (cameraYawRef?.current !== undefined) {
        let deg = (-cameraYawRef.current * 180) / Math.PI
        deg = ((deg % 360) + 360) % 360
        setPlayerHeading(deg)
      }
    }, 45)
    return () => clearInterval(interval)
  }, [cameraYawRef])

  // Celestial night transition on victory
  useEffect(() => {
    if (gameWon) {
      onSwitchSkyToNight?.()
    }
  }, [gameWon, onSwitchSkyToNight])

  // Calculate waypoint bearing & distance on compass (-90° to +90° FOV)
  const getWaypointCompassOffset = (shrineX: number, shrineZ: number) => {
    if (!playerPosRef?.current) return null
    const px = playerPosRef.current.x
    const pz = playerPosRef.current.z
    const dx = shrineX - px
    const dz = shrineZ - pz
    const dist = Math.hypot(dx, dz)

    let targetBearing = (Math.atan2(dx, -dz) * 180) / Math.PI
    targetBearing = ((targetBearing % 360) + 360) % 360

    let diff = targetBearing - playerHeading
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360

    return { diff, dist: Math.round(dist) }
  }

  // Pre-generate compass degree marks (every 15 degrees)
  const degreeTicks = useMemo(() => {
    const ticks = []
    for (let deg = 0; deg < 360; deg += 15) {
      const isMajor = deg % 45 === 0
      ticks.push({ deg, isMajor })
    }
    return ticks
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        fontFamily: "'Cinzel', 'Marcellus', 'Barlow', serif",
        userSelect: 'none',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────────────
          1. REALISTIC DIEGETIC COMPASS BAR (SKYRIM / ELDEN RING HERITAGE)
      ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Subtle Celestial Phase Header Capsule */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 4,
            padding: '2px 10px',
            borderRadius: 12,
            background: 'rgba(10, 16, 12, 0.45)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(214, 184, 120, 0.20)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#d4af37',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          <span style={{ fontSize: 7, opacity: 0.7 }}>◆</span>
          <span style={{ fontWeight: 600 }}>{dayPhaseName || currentPhaseName}</span>
          <span style={{ opacity: 0.35 }}>|</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, color: '#f0ede6' }}>
            {String(Math.round(playerHeading)).padStart(3, '0')}°
          </span>
          <span style={{ fontSize: 7, opacity: 0.7 }}>◆</span>
        </div>

        {/* Compass Ribbon Housing - Streamlined & Translucent Frosted Glass */}
        <div
          style={{
            position: 'relative',
            width: 420,
            height: 32,
            background: 'linear-gradient(180deg, rgba(14, 20, 15, 0.42) 0%, rgba(8, 12, 9, 0.55) 100%)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(214, 184, 120, 0.25)',
            borderBottom: '1px solid rgba(214, 184, 120, 0.15)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            maskImage:
              'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
            overflow: 'hidden',
          }}
        >
          {/* Subtle horizontal graticule hairline */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(255, 255, 255, 0.08)',
            }}
          />

          {/* Compass Degree Tick Lines */}
          {degreeTicks.map(({ deg, isMajor }) => {
            let diff = deg - playerHeading
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            // Visible FOV is ±65 degrees across 440px width
            const xPercent = 50 + (diff / 65) * 50
            if (xPercent < -5 || xPercent > 105) return null

            return (
              <div
                key={`tick-${deg}`}
                style={{
                  position: 'absolute',
                  left: `${xPercent}%`,
                  bottom: 8,
                  width: 1,
                  height: isMajor ? 9 : 5,
                  background: isMajor
                    ? 'rgba(214, 184, 120, 0.55)'
                    : 'rgba(255, 255, 255, 0.22)',
                  transform: 'translateX(-50%)',
                }}
              />
            )
          })}

          {/* Compass Cardinal Points */}
          {COMPASS_POINTS.map((pt) => {
            let diff = pt.deg - playerHeading
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            const xPercent = 50 + (diff / 65) * 50
            if (xPercent < -6 || xPercent > 106) return null

            return (
              <div
                key={pt.label}
                style={{
                  position: 'absolute',
                  left: `${xPercent}%`,
                  top: 5,
                  transform: 'translateX(-50%)',
                  fontSize: pt.isNorth ? 12 : pt.isCardinal ? 10.5 : 9,
                  fontWeight: pt.isNorth ? 900 : 700,
                  letterSpacing: '0.08em',
                  color: pt.isNorth
                    ? '#ffdd77'
                    : pt.isCardinal
                    ? '#f0ede6'
                    : 'rgba(200, 195, 185, 0.65)',
                  textShadow: pt.isNorth
                    ? '0 0 8px rgba(255, 221, 119, 0.6)'
                    : '0 1px 3px rgba(0,0,0,0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {pt.isNorth && (
                  <span
                    style={{
                      fontSize: 7,
                      lineHeight: '6px',
                      color: '#d4af37',
                      marginBottom: 1,
                    }}
                  >
                    ▲
                  </span>
                )}
                {pt.label}
              </div>
            )
          })}

          {/* Shrine Waypoint Diamond Crests on Compass */}
          {shrines.map((s) => {
            const wp = getWaypointCompassOffset(s.position[0], s.position[2])
            if (!wp) return null
            const xPercent = 50 + (wp.diff / 65) * 50
            if (xPercent < 2 || xPercent > 98) return null

            return (
              <div
                key={`wp-${s.id}`}
                style={{
                  position: 'absolute',
                  left: `${xPercent}%`,
                  bottom: 3,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 3,
                }}
              >
                {/* Handcrafted Runic Diamond Icon */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    transform: 'rotate(45deg)',
                    background: s.isRuneCollected
                      ? '#c0c8cc'
                      : s.isAwakened
                      ? '#ffd700'
                      : s.color,
                    border: '1px solid rgba(0,0,0,0.6)',
                    boxShadow: s.isRuneCollected
                      ? 'none'
                      : `0 0 10px ${s.isAwakened ? '#ffd700' : s.color}`,
                    transition: 'all 0.3s ease',
                  }}
                />
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 7.5,
                    color: '#ffffff',
                    fontWeight: 600,
                    marginTop: 2,
                    textShadow: '0 1px 3px #000',
                  }}
                >
                  {wp.dist}m
                </span>
              </div>
            )
          })}
        </div>

        {/* Center Needle & Golden Crest Indicator */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {/* Top Golden Downward Arrow */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '5px solid #f5d77f',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
            }}
          />
          {/* Vertical Precision Hairline */}
          <div
            style={{
              width: 1,
              height: 22,
              background: 'linear-gradient(180deg, #f5d77f 0%, rgba(245, 215, 127, 0.2) 100%)',
            }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          2. DYNAMIC COLLAPSIBLE RPG QUEST TRACKER (TOP-LEFT)
      ───────────────────────────────────────────────────────────────────── */}
      {isQuestLogCollapsed ? (
        /* Collapsed / Hidden State: Minimal Frosted Pill Badge */
        <div
          onClick={toggleQuestLog}
          title="Click or press [J] to expand Quest Tracker"
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(10, 16, 12, 0.58)',
            border: '1px solid rgba(214, 184, 120, 0.30)',
            borderRadius: 4,
            padding: '4px 10px',
            backdropFilter: 'blur(14px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 8.5,
              fontWeight: 700,
              background: 'rgba(214, 184, 120, 0.22)',
              color: '#d4af37',
              padding: '1px 5px',
              borderRadius: 2,
              border: '1px solid rgba(214, 184, 120, 0.4)',
            }}
          >
            J
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#f5f0e6',
            }}
          >
            SANCTIFY MONOLITHS
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              color: totalCollected === 4 ? '#74ee15' : '#d4af37',
            }}
          >
            [{totalCollected}/4]
          </span>
          {nearestShrine && (
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 8.5,
                color: 'rgba(214, 184, 120, 0.75)',
              }}
            >
              · {nearestShrine.dist}m
            </span>
          )}
          <span style={{ fontSize: 8.5, color: 'rgba(214, 184, 120, 0.7)', marginLeft: 2 }}>▼</span>
        </div>
      ) : (
        /* Expanded State: Translucent Frosted Glass Card with Dynamic Progress */
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: 285,
            background: 'linear-gradient(150deg, rgba(14, 20, 16, 0.62) 0%, rgba(8, 12, 10, 0.72) 100%)',
            border: '1px solid rgba(214, 184, 120, 0.28)',
            borderRadius: 4,
            padding: '10px 14px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(16px)',
            pointerEvents: 'auto',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Subtle Decorative Corner Accent Prisms */}
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: -1,
              width: 7,
              height: 7,
              borderTop: '2px solid rgba(214, 184, 120, 0.7)',
              borderLeft: '2px solid rgba(214, 184, 120, 0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 7,
              height: 7,
              borderBottom: '2px solid rgba(214, 184, 120, 0.7)',
              borderRight: '2px solid rgba(214, 184, 120, 0.7)',
            }}
          />

          {/* Header Row: Category Badge + Progress Ratio + Hide Toggle Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 8.5,
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  color: '#d4af37',
                  textTransform: 'uppercase',
                }}
              >
                ACTIVE QUEST
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  color: totalCollected === 4 ? '#74ee15' : '#e6d8b5',
                  fontWeight: 600,
                }}
              >
                {totalCollected}/4
              </span>
            </div>

            {/* Interactive Hide/Fold Button */}
            <button
              onClick={toggleQuestLog}
              title="Hide quest log [J]"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(214, 184, 120, 0.12)',
                border: '1px solid rgba(214, 184, 120, 0.35)',
                borderRadius: 2,
                padding: '1px 6px',
                color: 'rgba(230, 225, 215, 0.85)',
                fontSize: 8.5,
                fontFamily: "'IBM Plex Mono', monospace",
                cursor: 'pointer',
                lineHeight: 1.2,
                transition: 'all 0.15s ease',
              }}
            >
              <span>[J]</span>
              <span style={{ fontSize: 8 }}>HIDE ▲</span>
            </button>
          </div>

          {/* Dynamic Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 3,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 7,
            }}
          >
            <div
              style={{
                width: `${(totalCollected / 4) * 100}%`,
                height: '100%',
                background:
                  totalCollected === 4
                    ? 'linear-gradient(90deg, #38ef7d, #74ee15)'
                    : 'linear-gradient(90deg, #d4af37, #ffcc00)',
                boxShadow: '0 0 8px rgba(212, 175, 55, 0.6)',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* Main Quest Title */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.05em',
              color: '#f5f0e6',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>SANCTIFY THE ANCIENT MONOLITHS</span>
            {nearestShrine && (
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 8.5,
                  fontWeight: 600,
                  color: '#d4af37',
                  background: 'rgba(214, 184, 120, 0.15)',
                  padding: '1px 4px',
                  borderRadius: 2,
                }}
              >
                {nearestShrine.dist}m
              </span>
            )}
          </div>

          {/* 4 Shrines Matrix Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 7 }}>
            {shrines.map((s) => {
              const hits = s.targetsHit.filter(Boolean).length
              const isNearest = nearestShrine?.id === s.id && !s.isRuneCollected

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 9.5,
                    padding: '2px 4px',
                    borderRadius: 2,
                    background: isNearest ? 'rgba(214, 184, 120, 0.08)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Status Indicator Diamond */}
                    <div
                      style={{
                        width: 5.5,
                        height: 5.5,
                        transform: 'rotate(45deg)',
                        background: s.isRuneCollected
                          ? s.color
                          : s.isAwakened
                          ? '#ffd700'
                          : isNearest
                          ? '#d4af37'
                          : 'rgba(255,255,255,0.25)',
                        boxShadow: s.isRuneCollected
                          ? `0 0 5px ${s.color}`
                          : s.isAwakened
                          ? '0 0 8px #ffd700'
                          : isNearest
                          ? '0 0 5px rgba(212, 175, 55, 0.5)'
                          : 'none',
                      }}
                    />
                    <span
                      style={{
                        color: s.isRuneCollected
                          ? '#e5e0d8'
                          : s.isAwakened
                          ? '#ffd700'
                          : isNearest
                          ? '#fff0d0'
                          : 'rgba(255,255,255,0.72)',
                        letterSpacing: '0.02em',
                        fontWeight: s.isAwakened || isNearest ? 700 : 500,
                      }}
                    >
                      {s.name}
                    </span>
                  </div>

                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 8.5,
                      color: s.isRuneCollected
                        ? s.color
                        : s.isAwakened
                        ? '#ffd700'
                        : isNearest
                        ? '#d4af37'
                        : 'rgba(255,255,255,0.45)',
                      fontWeight: 600,
                    }}
                  >
                    {s.isRuneCollected
                      ? 'SANCTIFIED'
                      : s.isAwakened
                      ? 'HARMONIZE'
                      : `${hits}/3`}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Objective Narrative Prompt */}
          <div
            style={{
              fontSize: 9.5,
              color: 'rgba(220, 215, 205, 0.75)',
              lineHeight: 1.35,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 5,
            }}
          >
            {totalCollected === 4
              ? 'All monoliths sanctified. The celestial balance of the grove is restored.'
              : totalAwakened > totalCollected
              ? 'Approach the unsealed monolith to harmonize its elemental core.'
              : 'Draw your recurve bow and dispel the 3 orbiting guardian embers around each monolith.'}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          3. CINEMATIC NOTIFICATION BANNER (TOP-CENTER)
      ───────────────────────────────────────────────────────────────────── */}
      {toastVisible && toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: 86,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, rgba(16, 22, 16, 0.94) 0%, rgba(8, 12, 9, 0.96) 100%)',
            borderTop: '1px solid rgba(214, 184, 120, 0.65)',
            borderBottom: '1px solid rgba(214, 184, 120, 0.3)',
            borderRadius: 2,
            padding: '10px 28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 15px rgba(214, 184, 120, 0.15)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            whiteSpace: 'nowrap',
            animation: 'fadeInSlideDown 0.3s ease-out forwards',
          }}
        >
          {/* Antique Heraldic Icon */}
          <div
            style={{
              width: 10,
              height: 10,
              transform: 'rotate(45deg)',
              border: '1.5px solid #d4af37',
              background: 'rgba(212, 175, 55, 0.25)',
              boxShadow: '0 0 8px #d4af37',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 8.5,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: '#d4af37',
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              CHRONICLE UPDATE
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#f0ede6',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}
            >
              {toastMessage}
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          4. DYNAMIC ARCHERY RETICLE (CENTER SCREEN)
      ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!isBowEquipped ? (
          /* Subtle minimalist exploration pip when unequipped */
          <div
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.65)',
              boxShadow: '0 0 3px rgba(0, 0, 0, 0.8)',
            }}
          />
        ) : (
          <>
            {/* Center Aim Pip */}
            <div
              style={{
                position: 'absolute',
                width: drawProgress > 0.88 ? 3 : 2.5,
                height: drawProgress > 0.88 ? 3 : 2.5,
                borderRadius: '50%',
                background: drawProgress > 0.88 ? '#ffd700' : '#ffffff',
                boxShadow:
                  drawProgress > 0.88
                    ? '0 0 8px #ffd700, 0 1px 2px rgba(0,0,0,0.8)'
                    : '0 1px 2px rgba(0,0,0,0.9)',
                transition: 'all 0.08s ease',
              }}
            />

            {/* 4 Precision Crosshair Notches (Exact match with Reference Target Image) */}
            {(() => {
              const notchOffset = Math.max(6, 9 - drawProgress * 3)
              const notchLength = 8
              const notchThickness = 2.2
              const notchColor =
                drawProgress > 0.88 ? 'rgba(255, 225, 110, 0.98)' : 'rgba(255, 255, 255, 0.92)'
              const notchShadow = '0 1px 2px rgba(0,0,0,0.9)'
              return (
                <>
                  {/* Left */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -notchOffset - notchLength,
                      width: notchLength,
                      height: notchThickness,
                      borderRadius: 1,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Right */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -notchOffset - notchLength,
                      width: notchLength,
                      height: notchThickness,
                      borderRadius: 1,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Top */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -notchOffset - notchLength,
                      width: notchThickness,
                      height: notchLength,
                      borderRadius: 1,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Bottom */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -notchOffset - notchLength,
                      width: notchThickness,
                      height: notchLength,
                      borderRadius: 1,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                </>
              )
            })()}

            {/* Hit Marker Slash (Flash on Marksmanship Hit) */}
            {showHitMarker && (
              <div
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: 13,
                    height: 2,
                    background: '#ff4d4f',
                    transform: 'rotate(45deg)',
                    boxShadow: '0 0 8px #ff4d4f',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: 13,
                    height: 2,
                    background: '#ff4d4f',
                    transform: 'rotate(-45deg)',
                    boxShadow: '0 0 8px #ff4d4f',
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          5. AUTHENTIC RPG EQUIPMENT HOTBAR & COMBAT GUIDES (BOTTOM-CENTER)
      ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {/* 5-Slot Survival Quick-Access Tray (Survivor Bag Hotbar) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(10, 14, 11, 0.90)',
            border: '1px solid rgba(214, 184, 120, 0.28)',
            padding: '4px 6px',
            borderRadius: 5,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
            pointerEvents: 'auto',
          }}
        >
          {/* Slot 1: Handcrafted Recurve Bow */}
          <div
            onClick={() => toggleItem('bow')}
            title="[1] Recurve Bow"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              cursor: 'pointer',
              background: activeItem === 'bow' ? 'rgba(214, 184, 120, 0.22)' : 'rgba(0, 0, 0, 0.45)',
              border: `1.5px solid ${activeItem === 'bow' ? '#d4af37' : 'rgba(255, 255, 255, 0.10)'}`,
              boxShadow: activeItem === 'bow' ? '0 0 12px rgba(212, 175, 55, 0.45), inset 0 0 6px rgba(212, 175, 55, 0.20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 3.5,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: activeItem === 'bow' ? '#ffd700' : 'rgba(214, 184, 120, 0.65)',
                lineHeight: 1,
              }}
            >
              1
            </span>
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 5 C19 10, 19 22, 10 27" stroke={activeItem === 'bow' ? '#f4d27a' : '#c29b62'} strokeWidth="2.4" />
              <path d="M16.2 14.5 C16.6 15.2, 16.6 16.8, 16.2 17.5" stroke="#3d2b1f" strokeWidth="2.8" />
              <line x1="10" y1="5" x2="10" y2="27" stroke="rgba(240, 235, 220, 0.85)" strokeWidth="1.2" />
              <line x1="8" y1="16" x2="25" y2="16" stroke={activeItem === 'bow' ? '#ffd700' : '#d8ba82'} strokeWidth="1.6" />
              <path d="M22 13.5 L26 16 L22 18.5" fill={activeItem === 'bow' ? '#ffd700' : '#d8ba82'} stroke={activeItem === 'bow' ? '#ffd700' : '#d8ba82'} strokeWidth="1.2" />
              <path d="M10.5 13.5 L8 16 L10.5 18.5" stroke="rgba(240, 235, 220, 0.9)" strokeWidth="1.3" />
            </svg>
          </div>

          {/* Slot 2: Wooden Fire Torch */}
          <div
            onClick={() => toggleItem('torch')}
            title="[2] Wilderness Torch"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              cursor: 'pointer',
              background: activeItem === 'torch' ? 'rgba(255, 140, 40, 0.22)' : 'rgba(0, 0, 0, 0.45)',
              border: `1.5px solid ${activeItem === 'torch' ? '#ff9426' : 'rgba(255, 255, 255, 0.10)'}`,
              boxShadow: activeItem === 'torch' ? '0 0 12px rgba(255, 148, 38, 0.45), inset 0 0 6px rgba(255, 148, 38, 0.20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 3.5,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: activeItem === 'torch' ? '#ffa733' : 'rgba(214, 184, 120, 0.65)',
                lineHeight: 1,
              }}
            >
              2
            </span>
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="27" x2="18" y2="14" stroke="#8b5a2b" strokeWidth="3" />
              <rect x="15" y="12" width="7" height="6" rx="1.5" transform="rotate(-35 15 12)" fill="#3d2b1f" stroke="#251a12" strokeWidth="1" />
              <line x1="14" y1="14" x2="19" y2="12" stroke="#d4af37" strokeWidth="1.2" />
              <path d="M19 13 C17 9, 22 6, 21 3 C25 6, 27 10, 24 14 C22 16, 20 16, 19 13 Z" fill={activeItem === 'torch' ? '#ff6600' : '#dd5500'} />
              <path d="M20 12 C19 9, 22 7, 21.5 5 C23 7, 24.5 9, 23 12 Z" fill="#ffe266" />
            </svg>
          </div>

          {/* Slot 3: Whittled Survival Sword */}
          <div
            onClick={() => toggleItem('sword')}
            title="[3] Wooden Sword"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              cursor: 'pointer',
              background: activeItem === 'sword' ? 'rgba(214, 184, 120, 0.22)' : 'rgba(0, 0, 0, 0.45)',
              border: `1.5px solid ${activeItem === 'sword' ? '#d4af37' : 'rgba(255, 255, 255, 0.10)'}`,
              boxShadow: activeItem === 'sword' ? '0 0 12px rgba(212, 175, 55, 0.45), inset 0 0 6px rgba(212, 175, 55, 0.20)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 3.5,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: activeItem === 'sword' ? '#ffd700' : 'rgba(214, 184, 120, 0.65)',
                lineHeight: 1,
              }}
            >
              3
            </span>
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 23 L22 10 L25 5 L20 8 L7 21 Z" fill={activeItem === 'sword' ? '#5a3d28' : '#3d281a'} stroke={activeItem === 'sword' ? '#d4af37' : '#9c7444'} strokeWidth="1.4" />
              <line x1="11" y1="19" x2="19" y2="11" stroke="#1d120a" strokeWidth="1.2" />
              <line x1="5" y1="19" x2="11" y2="25" stroke={activeItem === 'sword' ? '#8a6239' : '#5c3e21'} strokeWidth="3" />
              <circle cx="6" cy="20" r="0.8" fill="#d4af37" />
              <circle cx="10" cy="24" r="0.8" fill="#d4af37" />
              <line x1="6.5" y1="21.5" x2="3" y2="25" stroke="#1f1812" strokeWidth="3.2" />
              <circle cx="2.5" cy="25.5" r="1.8" fill="#5c3e21" stroke="#d4af37" strokeWidth="0.8" />
            </svg>
          </div>

          {/* Slot 4: Herbal Bandages / Field Pouch */}
          <div
            onClick={() => triggerToast('Field Pouch: Herbal Bandages (3 available)')}
            title="[4] Herbal Bandages (x3)"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1.5px solid rgba(255, 255, 255, 0.10)',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 3.5,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(214, 184, 120, 0.65)',
                lineHeight: 1,
              }}
            >
              4
            </span>
            <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 13 C9 9.5, 12.5 8, 16 8 C19.5 8, 23 9.5, 23 13 C23 21, 21 24.5, 16 24.5 C11 24.5, 9 21, 9 13 Z" fill="rgba(88, 62, 38, 0.55)" stroke="rgba(214, 184, 120, 0.55)" strokeWidth="1.4" />
              <path d="M12 11 L20 11" stroke="rgba(212, 175, 55, 0.75)" strokeWidth="1.5" />
              <line x1="16" y1="14" x2="16" y2="20" stroke="rgba(120, 210, 120, 0.9)" strokeWidth="1.6" />
              <line x1="13" y1="17" x2="19" y2="17" stroke="rgba(120, 210, 120, 0.9)" strokeWidth="1.6" />
            </svg>
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 3,
                fontSize: 8.5,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(230, 225, 215, 0.75)',
                lineHeight: 1,
              }}
            >
              x3
            </span>
          </div>

          {/* Slot 5: Field Flint & Kindling / Survival Tools */}
          <div
            onClick={() => triggerToast('Field Tools: Flint & Kindling Ready')}
            title="[5] Flint & Kindling"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1.5px solid rgba(255, 255, 255, 0.10)',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 3.5,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(214, 184, 120, 0.65)',
                lineHeight: 1,
              }}
            >
              5
            </span>
            <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 21 L15 11 L22 13 L20 22 L14 23 Z" fill="rgba(80, 80, 85, 0.6)" stroke="rgba(180, 180, 185, 0.6)" strokeWidth="1.4" />
              <line x1="8" y1="12" x2="23" y2="21" stroke="rgba(214, 184, 120, 0.7)" strokeWidth="1.8" />
              <circle cx="16" cy="16" r="1.8" fill="#ffaa33" />
            </svg>
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 3,
                fontSize: 8.5,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(230, 225, 215, 0.75)',
                lineHeight: 1,
              }}
            >
              x1
            </span>
          </div>
        </div>

        {/* Minimal Contextual Combat Keybind Ribbon (ONLY when weapon is active - ZERO duplicate item names) */}
        {activeItem !== 'none' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(8, 14, 10, 0.82)',
              border: '1px solid rgba(214, 184, 120, 0.22)',
              padding: '3px 12px',
              borderRadius: 3,
              backdropFilter: 'blur(8px)',
              fontSize: 9,
              letterSpacing: '0.04em',
              color: 'rgba(230, 225, 215, 0.85)',
            }}
          >
            {activeItem === 'bow' && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>LMB (HOLD)</kbd>
                  Draw
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>RELEASE</kbd>
                  Shoot
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>RMB</kbd>
                  Focus Aim
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>1</kbd>
                  Stow
                </span>
              </>
            )}

            {activeItem === 'torch' && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>LMB</kbd>
                  Wave Flare
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>2</kbd>
                  Extinguish
                </span>
              </>
            )}

            {activeItem === 'sword' && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>LMB</kbd>
                  3-Slash Combo
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>LMB (HOLD)</kbd>
                  Charge Strike
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>RMB</kbd>
                  Guard
                </span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={kbdStyle}>3</kbd>
                  Sheathe
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          6. GRAND HERALDIC VICTORY PROCLAMATION (MODAL ON 4/4 RESTORED)
      ───────────────────────────────────────────────────────────────────── */}
      {gameWon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(4, 8, 5, 0.85)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            animation: 'fadeIn 0.5s ease-out forwards',
          }}
        >
          <div
            style={{
              position: 'relative',
              background:
                'linear-gradient(155deg, rgba(18, 24, 18, 0.96) 0%, rgba(8, 12, 9, 0.98) 100%)',
              border: '1px solid rgba(214, 184, 120, 0.55)',
              borderRadius: 4,
              padding: '40px 54px',
              textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 24px rgba(214, 184, 120, 0.2)',
              maxWidth: 480,
            }}
          >
            {/* Ornamental Corner Brackets */}
            <div
              style={{
                position: 'absolute',
                top: -2,
                left: -2,
                width: 14,
                height: 14,
                borderTop: '2px solid #d4af37',
                borderLeft: '2px solid #d4af37',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 14,
                height: 14,
                borderTop: '2px solid #d4af37',
                borderRight: '2px solid #d4af37',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                left: -2,
                width: 14,
                height: 14,
                borderBottom: '2px solid #d4af37',
                borderLeft: '2px solid #d4af37',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 14,
                height: 14,
                borderBottom: '2px solid #d4af37',
                borderRight: '2px solid #d4af37',
              }}
            />

            {/* Crest Emblem */}
            <div
              style={{
                width: 32,
                height: 32,
                margin: '0 auto 16px',
                transform: 'rotate(45deg)',
                border: '2px solid #d4af37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(212, 175, 55, 0.4)',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  background: '#d4af37',
                }}
              />
            </div>

            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: '#d4af37',
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              CELESTIAL HARMONY RESTORED
            </div>

            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: '#f5f0e6',
                letterSpacing: '0.08em',
                margin: '0 0 14px 0',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              }}
            >
              THE ANCIENT GROVE IS SANCTIFIED
            </h1>

            <p
              style={{
                color: 'rgba(220, 215, 205, 0.85)',
                fontSize: 12.5,
                lineHeight: 1.6,
                margin: '0 0 24px 0',
              }}
            >
              Through archery precision and steadfast spirit, all four elemental monoliths have
              been re-awakened. The grove now flourishes in eternal balance.
            </p>

            {/* Marksmanship Record Dossier */}
            <div
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-around',
                marginBottom: 26,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#8c9b90',
                  }}
                >
                  Arrows Released
                </div>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#f5f0e6',
                    marginTop: 3,
                  }}
                >
                  {arrowsShot}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#8c9b90',
                  }}
                >
                  Embers Cleansed
                </div>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#74ee15',
                    marginTop: 3,
                  }}
                >
                  {arrowsHit}
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#8c9b90',
                  }}
                >
                  Precision
                </div>
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#4deeea',
                    marginTop: 3,
                  }}
                >
                  {arrowsShot > 0 ? Math.round((arrowsHit / arrowsShot) * 100) : 100}%
                </div>
              </div>
            </div>

            {/* Begin Anew Action */}
            <button
              onClick={() => resetGame()}
              style={{
                background: 'linear-gradient(180deg, #d4af37 0%, #aa8420 100%)',
                color: '#080c09',
                border: 'none',
                borderRadius: 2,
                padding: '12px 32px',
                fontFamily: "'Cinzel', serif",
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(212, 175, 55, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              COMMENCE NEW VOYAGE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
