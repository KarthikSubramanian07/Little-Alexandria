import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // The API runs in `wrangler pages dev`; keep the Host header so cookies and
    // the same-origin write check see the browser's real origin.
    proxy: { '/api': { target: 'http://localhost:8788', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Never inline fonts: each unicode-range subset should be its own file the
    // browser fetches only when a page needs those characters.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
  },
})
