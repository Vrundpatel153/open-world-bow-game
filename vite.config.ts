import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Vite config — Vite 8 / rolldown compatible
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Rolldown (Vite 8) requires manualChunks as a function
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three'))                        return 'three-vendor'
          if (id.includes('@react-three/fiber') || id.includes('@react-three/drei')) return 'r3f-vendor'
          if (id.includes('leva'))                                      return 'leva-vendor'
          if (id.includes('zustand'))                                   return 'state-vendor'
        },
      },
    },
    target: 'esnext',
    sourcemap: true,
  },
  base: './',
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'leva', 'zustand', 'lucide-react'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
