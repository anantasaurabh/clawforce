import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3050,
    strictPort: true,
    host: true,
    allowedHosts: ["hq-clawforce.altovation.in"]
  },
  preview: {
    port: 3050,
    strictPort: true,
    host: true,
    allowedHosts: ["hq-clawforce.altovation.in"]
  }
})
