import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'import.meta.env.VITE_API_URL': '""' },
  server: { port: 5199, proxy: { '/api': { target: 'http://127.0.0.1:8021', changeOrigin: true } } },
})
