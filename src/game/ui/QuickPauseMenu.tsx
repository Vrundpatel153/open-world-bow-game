// ─────────────────────────────────────────────────────────────────────────────
// QuickPauseMenu — Professional In-Game Pause & Graphics Specifications Modal
// Triggered dynamically by pressing [ESC] or releasing pointer lock.
// Features: Full real-time graphics scaling, resolution adjustment, audio bus mixers,
// diegetic keybind index, and live hardware inspector.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import {
  useSettingsStore,
  type QualityPreset,
  type ShadowQuality,
  type FoliageDensity,
  type ViewDistance,
  type AntiAliasing,
} from '@/stores/settingsStore'
import { useGameStore } from '@/stores/gameStore'
import { sound } from '@/game/audio/SoundSynthesizer'
import styles from './QuickPauseMenu.module.css'

interface HardwareInfo {
  renderer: string
  vendor: string
  screenRes: string
  dpr: number
  viewport: string
}

export default function QuickPauseMenu() {
  const isQuickMenuOpen = useSettingsStore((s) => s.isQuickMenuOpen)
  const setQuickMenuOpen = useSettingsStore((s) => s.setQuickMenuOpen)
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)

  const graphics = useSettingsStore((s) => s.graphics)
  const audio = useSettingsStore((s) => s.audio)
  const applyPreset = useSettingsStore((s) => s.applyPreset)
  const setResolutionScale = useSettingsStore((s) => s.setResolutionScale)
  const setShadowQuality = useSettingsStore((s) => s.setShadowQuality)
  const setFoliageDensity = useSettingsStore((s) => s.setFoliageDensity)
  const setViewDistance = useSettingsStore((s) => s.setViewDistance)
  const setAntiAliasing = useSettingsStore((s) => s.setAntiAliasing)
  const setViewmodelLighting = useSettingsStore((s) => s.setViewmodelLighting)
  const setTargetFps = useSettingsStore((s) => s.setTargetFps)
  const toggleFullscreen = useSettingsStore((s) => s.toggleFullscreen)

  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume)
  const setAmbienceVolume = useSettingsStore((s) => s.setAmbienceVolume)
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume)
  const setMuted = useSettingsStore((s) => s.setMuted)
  const resetToRecommended = useSettingsStore((s) => s.resetToRecommended)

  const fps = useGameStore((s) => s.fps)

  // Hardware spec detection
  const [hw, setHw] = useState<HardwareInfo>({
    renderer: 'Hardware Accelerated WebGL 2.0',
    vendor: 'Standard GPU',
    screenRes: typeof window !== 'undefined' ? `${window.screen.width} x ${window.screen.height}` : '1920 x 1080',
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    viewport: typeof window !== 'undefined' ? `${window.innerWidth} x ${window.innerHeight}` : '1920 x 1080',
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Accelerated'
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'GPU'
          setHw({
            renderer,
            vendor,
            screenRes: `${window.screen.width} x ${window.screen.height}`,
            dpr: window.devicePixelRatio,
            viewport: `${window.innerWidth} x ${window.innerHeight}`,
          })
        }
      }
    } catch (_) {}
  }, [])

  if (!isQuickMenuOpen) return null

  const handleResume = () => {
    sound.playHudToggle(true)
    setQuickMenuOpen(false)
    const canvas = document.querySelector('canvas')
    if (canvas) {
      try {
        const p = (canvas as any).requestPointerLock?.()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      } catch (_) {}
    }
  }

  const handleRespawn = () => {
    if ((window as any).__setPlayerPos) {
      ;(window as any).__setPlayerPos(0, 8.5)
    }
    handleResume()
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleResume()}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.mainTitle}>System & Specifications</h2>
            <span className={styles.subTitle}>Game Paused • Real-Time Settings Engine</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleResume}>
            Resume Game [ESC]
          </button>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────────────── */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'graphics' ? styles.activeTab : ''}`}
            onClick={() => {
              sound.playHotbarClick(1)
              setActiveTab('graphics')
            }}
          >
            Graphics & Presets
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'audio' ? styles.activeTab : ''}`}
            onClick={() => {
              sound.playHotbarClick(2)
              setActiveTab('audio')
            }}
          >
            Audio & Nature SFX
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'controls' ? styles.activeTab : ''}`}
            onClick={() => {
              sound.playHotbarClick(3)
              setActiveTab('controls')
            }}
          >
            Keyboard Controls
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'hardware' ? styles.activeTab : ''}`}
            onClick={() => {
              sound.playHotbarClick(4)
              setActiveTab('hardware')
            }}
          >
            Hardware Specs
          </button>
        </div>

        {/* ── Tab Content Body ───────────────────────────────────────────────── */}
        <div className={styles.body}>
          {activeTab === 'graphics' && (
            <>
              {/* One-Click Presets */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Quality Presets</h3>
                  <span className={styles.sectionDesc}>Select tailored profile for your machine</span>
                </div>
                <div className={styles.presetGrid}>
                  <div
                    className={`${styles.presetCard} ${graphics.preset === 'low' ? styles.presetCardActive : ''}`}
                    onClick={() => {
                      sound.playHotbarClick(1)
                      applyPreset('low')
                    }}
                  >
                    <span className={styles.presetName}>Low</span>
                    <span className={styles.presetTarget}>Low-End / Integrated GPU</span>
                    <ul className={styles.presetBullets}>
                      <li>75% render scale</li>
                      <li>Shadows disabled</li>
                      <li>196k blades, 1-segment</li>
                      <li>45m cull distance</li>
                    </ul>
                  </div>

                  <div
                    className={`${styles.presetCard} ${graphics.preset === 'medium' ? styles.presetCardActive : ''}`}
                    onClick={() => {
                      sound.playHotbarClick(2)
                      applyPreset('medium')
                    }}
                  >
                    <span className={styles.presetName}>Medium</span>
                    <span className={styles.presetTarget}>Balanced / Laptops</span>
                    <ul className={styles.presetBullets}>
                      <li>100% native resolution</li>
                      <li>Low 512 shadow maps</li>
                      <li>392k blades, 2-segment</li>
                      <li>65m view distance</li>
                    </ul>
                  </div>

                  <div
                    className={`${styles.presetCard} ${graphics.preset === 'high' ? styles.presetCardActive : ''}`}
                    onClick={() => {
                      sound.playHotbarClick(3)
                      applyPreset('high')
                    }}
                  >
                    <span className={styles.presetName}>High</span>
                    <span className={styles.presetTarget}>Standard PC (Recommended)</span>
                    <ul className={styles.presetBullets}>
                      <li>100% native resolution</li>
                      <li>High PCFSoft shadows</li>
                      <li>616k blades, 3-segment</li>
                      <li>80m view distance</li>
                    </ul>
                  </div>

                  <div
                    className={`${styles.presetCard} ${graphics.preset === 'ultra' ? styles.presetCardActive : ''}`}
                    onClick={() => {
                      sound.playHotbarClick(4)
                      applyPreset('ultra')
                    }}
                  >
                    <span className={styles.presetName}>Ultra</span>
                    <span className={styles.presetTarget}>High-End Dedicated GPU</span>
                    <ul className={styles.presetBullets}>
                      <li>125% supersampling</li>
                      <li>2048 high-res soft penumbra</li>
                      <li>784k dense turf lawn</li>
                      <li>110m horizon view</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Detailed Stacks & Specs */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Detailed Specifications</h3>
                  <span className={styles.sectionDesc}>Fine-tune individual engine parameters</span>
                </div>

                {/* Resolution Scale */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Resolution Scale</span>
                    <span className={styles.settingSub}>Internal 3D rendering buffer resolution</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5].map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        className={`${styles.optBtn} ${graphics.resolutionScale === scale ? styles.optBtnActive : ''}`}
                        onClick={() => {
                          sound.playHotbarClick(1)
                          setResolutionScale(scale)
                        }}
                      >
                        {scale * 100}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shadow Quality */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Sun & Moon Shadows</span>
                    <span className={styles.settingSub}>Cascaded soft penumbra map precision</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    {(['off', 'low', 'medium', 'high', 'ultra'] as ShadowQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`${styles.optBtn} ${graphics.shadowQuality === q ? styles.optBtnActive : ''}`}
                        onClick={() => {
                          sound.playHotbarClick(2)
                          setShadowQuality(q)
                        }}
                      >
                        {q.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Foliage Density */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Meadow Foliage Density</span>
                    <span className={styles.settingSub}>Grass blade instance count and segment detail</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    {(['low', 'medium', 'high', 'ultra'] as FoliageDensity[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`${styles.optBtn} ${graphics.foliageDensity === d ? styles.optBtnActive : ''}`}
                        onClick={() => {
                          sound.playHotbarClick(3)
                          setFoliageDensity(d)
                        }}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* View Distance */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Foliage View Distance</span>
                    <span className={styles.settingSub}>Maximum distance before blade culling fades</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    {(['low', 'medium', 'high', 'ultra'] as ViewDistance[]).map((vd) => (
                      <button
                        key={vd}
                        type="button"
                        className={`${styles.optBtn} ${graphics.viewDistance === vd ? styles.optBtnActive : ''}`}
                        onClick={() => {
                          sound.playHotbarClick(4)
                          setViewDistance(vd)
                        }}
                      >
                        {vd === 'low' ? '45M' : vd === 'medium' ? '65M' : vd === 'high' ? '80M' : '110M'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anti-Aliasing */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Edge Smoothing (AA)</span>
                    <span className={styles.settingSub}>Geometry edge anti-aliasing method</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    {(['off', 'fxaa', 'msaa'] as AntiAliasing[]).map((aa) => (
                      <button
                        key={aa}
                        type="button"
                        className={`${styles.optBtn} ${graphics.antiAliasing === aa ? styles.optBtnActive : ''}`}
                        onClick={() => {
                          sound.playHotbarClick(1)
                          setAntiAliasing(aa)
                        }}
                      >
                        {aa.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weapon Viewmodel Key/Fill Lighting */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Viewmodel Steel Highlights</span>
                    <span className={styles.settingSub}>Dedicated key and fill reflections on weapons</span>
                  </div>
                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={`${styles.optBtn} ${graphics.viewmodelLighting ? styles.optBtnActive : ''}`}
                      onClick={() => {
                        sound.playHotbarClick(2)
                        setViewmodelLighting(true)
                      }}
                    >
                      ENABLED
                    </button>
                    <button
                      type="button"
                      className={`${styles.optBtn} ${!graphics.viewmodelLighting ? styles.optBtnActive : ''}`}
                      onClick={() => {
                        sound.playHotbarClick(3)
                        setViewmodelLighting(false)
                      }}
                    >
                      DISABLED
                    </button>
                  </div>
                </div>

                {/* Display Mode Fullscreen */}
                <div className={styles.settingRow}>
                  <div className={styles.settingMeta}>
                    <span className={styles.settingLabel}>Display Mode</span>
                    <span className={styles.settingSub}>Fullscreen borderless canvas presentation</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.optBtn} ${graphics.fullscreen ? styles.optBtnActive : ''}`}
                    style={{ padding: '8px 20px', border: '1px solid rgba(214, 184, 120, 0.4)' }}
                    onClick={() => {
                      sound.playHotbarClick(4)
                      toggleFullscreen()
                    }}
                  >
                    {graphics.fullscreen ? 'EXIT FULLSCREEN' : 'ENTER FULLSCREEN'}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'audio' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Audio Sub-Buses</h3>
                <span className={styles.sectionDesc}>Adjust volume levels for nature and game soundscapes</span>
              </div>

              {/* Master Volume */}
              <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                  <span className={styles.settingLabel}>Master Volume</span>
                  <span className={styles.settingSub}>Overall sound output level</span>
                </div>
                <div className={styles.sliderControl}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audio.masterVolume}
                    className={styles.rangeSlider}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                  />
                  <span className={styles.sliderValue}>{Math.round(audio.masterVolume * 100)}%</span>
                </div>
              </div>

              {/* Nature & Birds Ambience Volume */}
              <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                  <span className={styles.settingLabel}>Nature & Wildlife Ambience</span>
                  <span className={styles.settingSub}>Forest birds chirping, gentle wind, crickets</span>
                </div>
                <div className={styles.sliderControl}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audio.ambienceVolume}
                    className={styles.rangeSlider}
                    onChange={(e) => setAmbienceVolume(parseFloat(e.target.value))}
                  />
                  <span className={styles.sliderValue}>{Math.round(audio.ambienceVolume * 100)}%</span>
                </div>
              </div>

              {/* Combat & SFX Volume */}
              <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                  <span className={styles.settingLabel}>Combat & World SFX</span>
                  <span className={styles.settingSub}>Bowstring twang, footsteps, sword slashes, torch</span>
                </div>
                <div className={styles.sliderControl}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audio.sfxVolume}
                    className={styles.rangeSlider}
                    onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                  />
                  <span className={styles.sliderValue}>{Math.round(audio.sfxVolume * 100)}%</span>
                </div>
              </div>

              {/* Mute Toggle */}
              <div className={styles.settingRow}>
                <div className={styles.settingMeta}>
                  <span className={styles.settingLabel}>Mute Sound Engine</span>
                  <span className={styles.settingSub}>Instantly silence all procedural audio</span>
                </div>
                <button
                  type="button"
                  className={`${styles.optBtn} ${audio.isMuted ? styles.optBtnActive : ''}`}
                  style={{ padding: '8px 20px', border: '1px solid rgba(214, 184, 120, 0.4)' }}
                  onClick={() => {
                    setMuted(!audio.isMuted)
                    sound.setMuted(!audio.isMuted)
                  }}
                >
                  {audio.isMuted ? 'UNMUTE ALL' : 'MUTE ALL'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Keyboard & Mouse Mappings</h3>
                <span className={styles.sectionDesc}>Diegetic input layout for combat and exploration</span>
              </div>
              <div className={styles.keyGrid}>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Move Explorer</span>
                  <span className={styles.keyBadge}>WASD</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Look & Aim Camera</span>
                  <span className={styles.keyBadge}>MOUSE</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Sprint Locomotion</span>
                  <span className={styles.keyBadge}>SHIFT</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Jump Leap</span>
                  <span className={styles.keyBadge}>SPACE</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Draw / Shoot / Swing</span>
                  <span className={styles.keyBadge}>LMB</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Focus Aim / Parry Guard</span>
                  <span className={styles.keyBadge}>RMB</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Ready Recurve Bow</span>
                  <span className={styles.keyBadge}>[1]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Ignite Pine Torch</span>
                  <span className={styles.keyBadge}>[2]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Draw Steel Knight Blade</span>
                  <span className={styles.keyBadge}>[3]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Field Herbal Pouch</span>
                  <span className={styles.keyBadge}>[4]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Field Tools</span>
                  <span className={styles.keyBadge}>[5]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Toggle HUD Overlay Cards</span>
                  <span className={styles.keyBadge}>[J]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Toggle Skyrim Compass</span>
                  <span className={styles.keyBadge}>[C]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Advance Day/Night Time</span>
                  <span className={styles.keyBadge}>[T]</span>
                </div>
                <div className={styles.keyItem}>
                  <span className={styles.keyAction}>Quick Pause & Settings</span>
                  <span className={styles.keyBadge}>[ESC]</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Hardware & WebGL Diagnostic</h3>
                <span className={styles.sectionDesc}>Detected graphics hardware and live rendering telemetry</span>
              </div>
              <div className={styles.specList}>
                <div className={styles.specRow}>
                  <span className={styles.specName}>GPU Video Driver / Accelerator</span>
                  <span className={styles.specVal}>{hw.renderer}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Hardware Vendor</span>
                  <span className={styles.specVal}>{hw.vendor}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Live Engine Frame Rate</span>
                  <span className={styles.specVal} style={{ color: '#88e078' }}>
                    {fps} FPS
                  </span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Viewport Resolution</span>
                  <span className={styles.specVal}>{hw.viewport}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Display Native Resolution</span>
                  <span className={styles.specVal}>{hw.screenRes}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Device Pixel Ratio (DPR)</span>
                  <span className={styles.specVal}>{hw.dpr.toFixed(2)}x</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specName}>Active Quality Preset</span>
                  <span className={styles.specVal} style={{ color: '#d6b878' }}>
                    {graphics.preset.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ─────────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <div className={styles.footActions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                sound.playHotbarClick(1)
                resetToRecommended()
              }}
            >
              Reset to Recommended
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                sound.playHotbarClick(2)
                handleRespawn()
              }}
            >
              Respawn at Meadow
            </button>
          </div>
          <button type="button" className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={handleResume}>
            Resume Game [ESC]
          </button>
        </div>
      </div>
    </div>
  )
}
