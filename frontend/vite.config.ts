import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    host: true, // bind 0.0.0.0 so the dev server is reachable from outside its Docker container
  },
})
