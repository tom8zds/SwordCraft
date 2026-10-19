import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        artPreview: 'art-preview.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
