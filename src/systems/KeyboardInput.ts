// ─────────────────────────────────────────────────────────────────────────────
// KeyboardInput — High-Performance Zero-Allocation Input Handler
// Keeps keyboard & pointer lock state in synchronous memory.
// ZERO React re-renders on keystrokes: prevents 60Hz UI thrashing & screen shaking.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuestStore } from '@/game/stores/questStore'

class InputManager {
  private keys = new Set<string>()
  private _isLocked = false
  private _isMouseDown = false
  private _mouseDeltaX = 0
  private _mouseDeltaY = 0

  // Mobile virtual joystick vector (-1 to +1)
  public joystick = { x: 0, y: 0 }
  public joystickSprint = false
  public joystickJump = false

  // Callbacks for pointer lock changes
  private lockListeners: ((locked: boolean) => void)[] = []

  public setLocked(val: boolean) {
    this._isLocked = val
    for (const listener of this.lockListeners) {
      listener(this._isLocked)
    }
  }

  constructor() {
    if (typeof window === 'undefined') return

    ;(window as any).__inputManager = this

    window.addEventListener('keydown', this.handleKeyDown, { passive: false })
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore typing in input fields
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    const code = e.code
    const key = e.key.toLowerCase()

    // Prevent default browser scrolling on navigation and game keys
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD'
    ) {
      e.preventDefault()
    }

    this.keys.add(code)
    this.keys.add(key)

    // Hotbar Item Toggles: [1] Bow, [2] Torch, [3] Wooden Sword, [4] Herbal Bandages, [5] Field Tools
    if (code === 'Digit1' || key === '1') {
      useQuestStore.getState().toggleItem('bow')
    } else if (code === 'Digit2' || key === '2') {
      useQuestStore.getState().toggleItem('torch')
    } else if (code === 'Digit3' || key === '3') {
      useQuestStore.getState().toggleItem('sword')
    } else if (code === 'Digit4' || key === '4') {
      useQuestStore.setState({ notification: 'Field Pouch: Herbal Bandages (3 available)' })
    } else if (code === 'Digit5' || key === '5') {
      useQuestStore.setState({ notification: 'Field Tools: Flint & Kindling' })
    } else if (code === 'KeyJ' || key === 'j') {
      useQuestStore.getState().toggleQuestLog()
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
    this.keys.delete(e.key.toLowerCase())
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('[class*="leva"], button, a')) return
    this._isMouseDown = true
  }

  private handleMouseUp = () => {
    this._isMouseDown = false
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (this._isLocked || this._isMouseDown) {
      this._mouseDeltaX += e.movementX
      this._mouseDeltaY += e.movementY
    }
  }

  private handlePointerLockChange = () => {
    this._isLocked = !!document.pointerLockElement
    for (const cb of this.lockListeners) {
      cb(this._isLocked)
    }
  }

  public isKeyDown(...aliases: string[]): boolean {
    for (const a of aliases) {
      if (this.keys.has(a) || this.keys.has(a.toLowerCase())) return true
    }
    return false
  }

  public isMovingForward(): boolean {
    return this.isKeyDown('KeyW', 'ArrowUp', 'w') || this.joystick.y > 0.1
  }

  public isMovingBackward(): boolean {
    return this.isKeyDown('KeyS', 'ArrowDown', 's') || this.joystick.y < -0.1
  }

  public isMovingLeft(): boolean {
    return this.isKeyDown('KeyA', 'ArrowLeft', 'a') || this.joystick.x < -0.1
  }

  public isMovingRight(): boolean {
    return this.isKeyDown('KeyD', 'ArrowRight', 'd') || this.joystick.x > 0.1
  }

  public isSprinting(): boolean {
    return (
      this.isKeyDown('ShiftLeft', 'ShiftRight', 'shift') ||
      this.joystickSprint
    )
  }

  public isJumping(): boolean {
    return this.isKeyDown('Space', ' ') || this.joystickJump
  }

  public get isLocked(): boolean {
    return this._isLocked
  }

  public get isMouseDown(): boolean {
    return this._isMouseDown
  }

  public mouseDeltaX = 0
  public mouseDeltaY = 0

  public consumeMouseDelta(): { dx: number; dy: number } {
    const delta = { dx: this._mouseDeltaX, dy: this._mouseDeltaY }
    this.mouseDeltaX = this._mouseDeltaX
    this.mouseDeltaY = this._mouseDeltaY
    this._mouseDeltaX = 0
    this._mouseDeltaY = 0
    return delta
  }

  public onLockChange(cb: (locked: boolean) => void): () => void {
    this.lockListeners.push(cb)
    return () => {
      this.lockListeners = this.lockListeners.filter((l) => l !== cb)
    }
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mouseup', this.handleMouseUp)
    window.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange)
    this.lockListeners = []
    this.keys.clear()
  }
}

export const inputManager = new InputManager()
