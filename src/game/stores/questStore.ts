// ─────────────────────────────────────────────────────────────────────────────
// questStore — Central Game Objective, Archery & Shrine State
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { sound } from '../audio/SoundSynthesizer'

export interface ShrineDef {
  id: string
  name: string
  element: string
  color: string
  position: [number, number, number]
  targetsTotal: number
  targetsHit: [boolean, boolean, boolean]
  isAwakened: boolean
  isRuneCollected: boolean
}

export const INITIAL_SHRINES: ShrineDef[] = [
  {
    id: 'west-wind',
    name: 'Shrine of the Whispering Wind',
    element: 'Aero',
    color: '#38ef7d', // Emerald / Mint
    position: [-22, 0, 8],
    targetsTotal: 3,
    targetsHit: [false, false, false],
    isAwakened: false,
    isRuneCollected: false,
  },
  {
    id: 'south-sun',
    name: "Shrine of the Solar Flame",
    element: 'Solar',
    color: '#ff9900', // Amber Gold
    position: [14, 0, -25],
    targetsTotal: 3,
    targetsHit: [false, false, false],
    isAwakened: false,
    isRuneCollected: false,
  },
  {
    id: 'north-twilight',
    name: 'Shrine of the Twilight Star',
    element: 'Cosmic',
    color: '#b845ff', // Purple / Violet
    position: [20, 0, 20],
    targetsTotal: 3,
    targetsHit: [false, false, false],
    isAwakened: false,
    isRuneCollected: false,
  },
  {
    id: 'deep-earth',
    name: 'Shrine of the Ancient Titan',
    element: 'Earth',
    color: '#00d2ff', // Cyan / Frost
    position: [-8, 0, -22],
    targetsTotal: 3,
    targetsHit: [false, false, false],
    isAwakened: false,
    isRuneCollected: false,
  },
]

interface QuestState {
  shrines: ShrineDef[]
  totalAwakened: number
  totalCollected: number
  arrowsShot: number
  arrowsHit: number
  gameWon: boolean
  isAiming: boolean
  isBowEquipped: boolean
  drawProgress: number
  hitMarkerId: number
  notification: string | null

  // Actions
  hitTarget: (shrineId: string, targetIdx: number) => void
  collectRune: (shrineId: string) => void
  recordShot: () => void
  setAiming: (aiming: boolean) => void
  setDrawProgress: (p: number) => void
  setBowEquipped: (equipped: boolean) => void
  toggleBowEquipped: () => void
  resetGame: () => void
}

export const useQuestStore = create<QuestState>((set, get) => ({
  shrines: INITIAL_SHRINES,
  totalAwakened: 0,
  totalCollected: 0,
  arrowsShot: 0,
  arrowsHit: 0,
  gameWon: false,
  isAiming: false,
  isBowEquipped: true,
  drawProgress: 0,
  hitMarkerId: 0,
  notification: 'Dispel the guardian embers around the four ancient monoliths.',

  hitTarget: (shrineId: string, targetIdx: number) => {
    const { shrines } = get()
    const shrine = shrines.find((s) => s.id === shrineId)
    if (!shrine || shrine.targetsHit[targetIdx]) return

    const newHit: [boolean, boolean, boolean] = [...shrine.targetsHit]
    newHit[targetIdx] = true
    const hitCount = newHit.filter(Boolean).length
    const nowAwakened = hitCount === shrine.targetsTotal

    sound.playTargetHit(targetIdx)

    if (nowAwakened) {
      setTimeout(() => sound.playShrineAwakened(), 180)
    }

    const updatedShrines = shrines.map((s) => {
      if (s.id !== shrineId) return s
      return {
        ...s,
        targetsHit: newHit,
        isAwakened: nowAwakened || s.isAwakened,
      }
    })

    const totalAwakened = updatedShrines.filter((s) => s.isAwakened).length

    set({
      shrines: updatedShrines,
      arrowsHit: get().arrowsHit + 1,
      hitMarkerId: Date.now(),
      totalAwakened,
      notification: nowAwakened
        ? `${shrine.name.toUpperCase()} UNSEALED — Harmonize the Elemental Core`
        : `Guardian Ember [${hitCount}/3] dispelled at ${shrine.name}`,
    })
  },

  collectRune: (shrineId: string) => {
    const { shrines } = get()
    const shrine = shrines.find((s) => s.id === shrineId)
    if (!shrine || !shrine.isAwakened || shrine.isRuneCollected) return

    sound.playRunePickup()

    const updated = shrines.map((s) => (s.id === shrineId ? { ...s, isRuneCollected: true } : s))
    const totalCollected = updated.filter((s) => s.isRuneCollected).length
    const gameWon = totalCollected >= 4

    set({
      shrines: updated,
      totalCollected,
      gameWon,
      notification: gameWon
        ? 'GROVE RESTORED — All four ancient monoliths sanctified'
        : `${shrine.element} Core claimed — [${totalCollected}/4 Shrines Harmonized]`,
    })
  },

  recordShot: () => {
    set((state) => ({ arrowsShot: state.arrowsShot + 1 }))
  },

  setAiming: (isAiming) => set({ isAiming }),

  setDrawProgress: (drawProgress) => set({ drawProgress }),

  setBowEquipped: (isBowEquipped) => set({ isBowEquipped }),

  toggleBowEquipped: () => {
    const nextState = !get().isBowEquipped
    if (nextState) {
      sound.playBowEquip()
    } else {
      sound.playBowUnequip()
    }
    set({
      isBowEquipped: nextState,
      isAiming: false,
      drawProgress: 0,
      notification: nextState ? 'Recurve Bow readied [1 to stow]' : 'Recurve Bow stowed [1 to draw]',
    })
  },

  resetGame: () => {
    set({
      shrines: INITIAL_SHRINES.map((s) => ({
        ...s,
        targetsHit: [false, false, false],
        isAwakened: false,
        isRuneCollected: false,
      })),
      totalAwakened: 0,
      totalCollected: 0,
      arrowsShot: 0,
      arrowsHit: 0,
      gameWon: false,
      notification: 'Dispel the guardian embers around the four ancient monoliths.',
    })
  },
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { __questStore: typeof useQuestStore }).__questStore = useQuestStore
}
