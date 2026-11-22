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
  const hitMarkerId = useQuestStore((s) => s.hitMarkerId)
  const notification = useQuestStore((s) => s.notification)
  const gameWon = useQuestStore((s) => s.gameWon)
  const arrowsShot = useQuestStore((s) => s.arrowsShot)
  const arrowsHit = useQuestStore((s) => s.arrowsHit)
  const resetGame = useQuestStore((s) => s.resetGame)

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
  useEffect(() => {
    if (notification) {
      setToastMessage(notification)
      setToastVisible(true)
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
        {/* Subtle Celestial Phase Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            fontSize: 9.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#c8b89a',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          <span style={{ opacity: 0.6 }}>◆</span>
          <span>{currentPhaseName}</span>
          <span style={{ opacity: 0.35 }}>|</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>
            {String(Math.round(playerHeading)).padStart(3, '0')}°
          </span>
          <span style={{ opacity: 0.6 }}>◆</span>
        </div>

        {/* Compass Ribbon Housing */}
        <div
          style={{
            position: 'relative',
            width: 440,
            height: 38,
            background: 'linear-gradient(180deg, rgba(14, 20, 15, 0.85) 0%, rgba(8, 12, 9, 0.92) 100%)',
            borderTop: '1px solid rgba(214, 184, 120, 0.45)',
            borderBottom: '1px solid rgba(214, 184, 120, 0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
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
            top: 18,
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
              borderTop: '6px solid #f5d77f',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
            }}
          />
          {/* Vertical Precision Hairline */}
          <div
            style={{
              width: 1,
              height: 26,
              background: 'linear-gradient(180deg, #f5d77f 0%, rgba(245, 215, 127, 0.2) 100%)',
            }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          2. AUTHENTIC RPG QUEST DOSSIER (TOP-LEFT)
      ───────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          width: 320,
          background: 'linear-gradient(145deg, rgba(14, 18, 14, 0.9) 0%, rgba(8, 12, 9, 0.94) 100%)',
          border: '1px solid rgba(214, 184, 120, 0.35)',
          borderRadius: 4,
          padding: '14px 18px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          pointerEvents: 'none',
        }}
      >
        {/* Subtle Decorative Corner Accent Prisms */}
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: -1,
            width: 8,
            height: 8,
            borderTop: '2px solid #d4af37',
            borderLeft: '2px solid #d4af37',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 8,
            height: 8,
            borderBottom: '2px solid #d4af37',
            borderRight: '2px solid #d4af37',
          }}
        />

        {/* Small Caps Category */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.22em',
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
              fontSize: 10,
              color: totalCollected === 4 ? '#74ee15' : 'rgba(255,255,255,0.6)',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            {totalCollected} / 4 HARMONIZED
          </span>
        </div>

        {/* Main Quest Title */}
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#f5f0e6',
            marginBottom: 8,
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          SANCTIFY THE ANCIENT MONOLITHS
        </div>

        {/* Golden Hairline Divider */}
        <div
          style={{
            width: '100%',
            height: 1,
            background:
              'linear-gradient(to right, rgba(214, 184, 120, 0.6) 0%, rgba(214, 184, 120, 0.1) 100%)',
            marginBottom: 10,
          }}
        />

        {/* 4 Shrines Matrix Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {shrines.map((s) => {
            const hits = s.targetsHit.filter(Boolean).length
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10.5,
                  padding: '2px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {/* Status Diamond Indicator */}
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      transform: 'rotate(45deg)',
                      background: s.isRuneCollected
                        ? s.color
                        : s.isAwakened
                        ? '#ffd700'
                        : 'rgba(255,255,255,0.2)',
                      boxShadow: s.isRuneCollected
                        ? `0 0 6px ${s.color}`
                        : s.isAwakened
                        ? '0 0 8px #ffd700'
                        : 'none',
                    }}
                  />
                  <span
                    style={{
                      color: s.isRuneCollected
                        ? '#e5e0d8'
                        : s.isAwakened
                        ? '#ffd700'
                        : 'rgba(255,255,255,0.7)',
                      letterSpacing: '0.03em',
                      fontWeight: s.isAwakened ? 700 : 500,
                    }}
                  >
                    {s.name}
                  </span>
                </div>

                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9.5,
                    color: s.isRuneCollected
                      ? s.color
                      : s.isAwakened
                      ? '#ffd700'
                      : 'rgba(255,255,255,0.4)',
                    fontWeight: 600,
                  }}
                >
                  {s.isRuneCollected
                    ? 'SANCTIFIED'
                    : s.isAwakened
                    ? 'HARMONIZE [E]'
                    : `${hits}/3 EMBERS`}
                </span>
              </div>
            )
          })}
        </div>

        {/* Objective Narrative Prompt */}
        <div
          style={{
            fontSize: 10.5,
            color: 'rgba(220, 215, 205, 0.85)',
            lineHeight: 1.45,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 8,
          }}
        >
          {totalCollected === 4
            ? 'All monoliths sanctified. The celestial balance of the grove is restored.'
            : totalAwakened > totalCollected
            ? 'Approach the unsealed monolith and press [E] to harmonize its elemental core.'
            : 'Draw your recurve bow and dispel the 3 orbiting guardian embers around each monolith.'}
        </div>
      </div>

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
            {/* Dynamic Contracting Tension Ring (fades in as tension builds) */}
            {drawProgress > 0.04 && (
              <div
                style={{
                  position: 'absolute',
                  width: Math.max(8, 26 - drawProgress * 18),
                  height: Math.max(8, 26 - drawProgress * 18),
                  borderRadius: '50%',
                  border: `1.5px solid ${
                    drawProgress > 0.88 ? '#ffd700' : 'rgba(240, 235, 220, 0.75)'
                  }`,
                  boxShadow:
                    drawProgress > 0.88
                      ? '0 0 10px rgba(255, 215, 0, 0.8)'
                      : '0 0 4px rgba(0, 0, 0, 0.6)',
                  transition: 'border-color 0.08s ease',
                }}
              />
            )}

            {/* Center Aim Pip */}
            <div
              style={{
                position: 'absolute',
                width: drawProgress > 0.88 ? 3.5 : 2.5,
                height: drawProgress > 0.88 ? 3.5 : 2.5,
                borderRadius: '50%',
                background: drawProgress > 0.88 ? '#ffd700' : '#ffffff',
                boxShadow:
                  drawProgress > 0.88
                    ? '0 0 8px #ffd700, 0 1px 2px rgba(0,0,0,0.8)'
                    : '0 1px 2px rgba(0,0,0,0.9)',
                transition: 'all 0.1s ease',
              }}
            />

            {/* 4 Precision Crosshair Notches (Dynamic Inward Contraction) */}
            {(() => {
              const notchOffset = Math.max(5, 12 - drawProgress * 7)
              const notchColor =
                drawProgress > 0.88 ? 'rgba(255, 220, 100, 0.9)' : 'rgba(255, 255, 255, 0.75)'
              const notchShadow = '0 1px 2px rgba(0,0,0,0.8)'
              return (
                <>
                  {/* Left */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -notchOffset - 5,
                      width: 5,
                      height: 1.5,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Right */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -notchOffset - 5,
                      width: 5,
                      height: 1.5,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Top */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -notchOffset - 5,
                      width: 1.5,
                      height: 5,
                      background: notchColor,
                      boxShadow: notchShadow,
                    }}
                  />
                  {/* Bottom */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -notchOffset - 5,
                      width: 1.5,
                      height: 5,
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
        {/* 3-Slot Equipment Matrix Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(8, 14, 10, 0.92)',
            borderTop: '1px solid rgba(214, 184, 120, 0.45)',
            borderBottom: '1px solid rgba(214, 184, 120, 0.22)',
            padding: '5px 12px',
            borderRadius: 3,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}
        >
          {/* Slot 1: Bow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 2,
              background: activeItem === 'bow' ? 'rgba(214, 184, 120, 0.18)' : 'transparent',
              border: `1px solid ${activeItem === 'bow' ? '#d4af37' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: activeItem === 'bow' ? '0 0 10px rgba(212, 175, 55, 0.35)' : 'none',
            }}
          >
            <kbd
              style={{
                background: activeItem === 'bow' ? '#d4af37' : 'rgba(255,255,255,0.12)',
                color: activeItem === 'bow' ? '#121612' : '#d4af37',
                border: '1px solid rgba(214, 184, 120, 0.5)',
                borderRadius: 2,
                padding: '1px 5px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              1
            </kbd>
            <span
              style={{
                fontSize: 10,
                fontWeight: activeItem === 'bow' ? 700 : 500,
                color: activeItem === 'bow' ? '#fff6dd' : 'rgba(220, 215, 205, 0.65)',
                letterSpacing: '0.04em',
              }}
            >
              BOW
            </span>
          </div>

          {/* Slot 2: Wood Torch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 2,
              background: activeItem === 'torch' ? 'rgba(255, 140, 40, 0.2)' : 'transparent',
              border: `1px solid ${activeItem === 'torch' ? '#ff9426' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: activeItem === 'torch' ? '0 0 10px rgba(255, 148, 38, 0.4)' : 'none',
            }}
          >
            <kbd
              style={{
                background: activeItem === 'torch' ? '#ff9426' : 'rgba(255,255,255,0.12)',
                color: activeItem === 'torch' ? '#140c06' : '#d4af37',
                border: '1px solid rgba(255, 148, 38, 0.5)',
                borderRadius: 2,
                padding: '1px 5px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              2
            </kbd>
            <span
              style={{
                fontSize: 10,
                fontWeight: activeItem === 'torch' ? 700 : 500,
                color: activeItem === 'torch' ? '#fff0d8' : 'rgba(220, 215, 205, 0.65)',
                letterSpacing: '0.04em',
              }}
            >
              TORCH
            </span>
          </div>

          {/* Slot 3: Wooden Sword */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 2,
              background: activeItem === 'sword' ? 'rgba(214, 184, 120, 0.18)' : 'transparent',
              border: `1px solid ${activeItem === 'sword' ? '#d4af37' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: activeItem === 'sword' ? '0 0 10px rgba(212, 175, 55, 0.35)' : 'none',
            }}
          >
            <kbd
              style={{
                background: activeItem === 'sword' ? '#d4af37' : 'rgba(255,255,255,0.12)',
                color: activeItem === 'sword' ? '#121612' : '#d4af37',
                border: '1px solid rgba(214, 184, 120, 0.5)',
                borderRadius: 2,
                padding: '1px 5px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              3
            </kbd>
            <span
              style={{
                fontSize: 10,
                fontWeight: activeItem === 'sword' ? 700 : 500,
                color: activeItem === 'sword' ? '#fff6dd' : 'rgba(220, 215, 205, 0.65)',
                letterSpacing: '0.04em',
              }}
            >
              SWORD
            </span>
          </div>
        </div>

        {/* Dynamic Contextual Action Keybind Ribbon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(8, 14, 10, 0.82)',
            border: '1px solid rgba(214, 184, 120, 0.22)',
            padding: '4px 16px',
            borderRadius: 2,
            backdropFilter: 'blur(8px)',
            fontSize: 9.5,
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

          {activeItem === 'none' && (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}>1</kbd>
                Bow
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}>2</kbd>
                Torch
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}>3</kbd>
                Sword
              </span>
            </>
          )}

          <span style={{ opacity: 0.3 }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>E</kbd>
            Claim Core
          </span>
        </div>
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
