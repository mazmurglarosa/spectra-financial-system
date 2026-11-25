import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    '__VERCEL_ENV__': JSON.stringify(process.env.VERCEL_ENV || process.env.VITE_VERCEL_ENV || ''),
  }
})
