// ─────────────────────────────────────────────────────────────────────────────
// LoadingOverlay — full-screen spinner shown while the GLB + shaders compile.
// ─────────────────────────────────────────────────────────────────────────────

import styles from './LoadingOverlay.module.css'

export default function LoadingOverlay() {
  return (
    <div className={styles.overlay}>
      <div className={styles.inner}>
        <div className={styles.blade} />
        <div className={styles.blade} style={{ animationDelay: '0.15s' }} />
        <div className={styles.blade} style={{ animationDelay: '0.30s' }} />
        <p className={styles.label}>Growing the grass field&hellip;</p>
      </div>
    </div>
  )
}
