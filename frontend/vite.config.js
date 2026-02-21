import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'headysystems.com',
      'www.headysystems.com',
      'app.headysystems.com',
      'api.headysystems.com',
      'admin.headysystems.com',
      'headyconnection.org',
      'www.headyconnection.org',
      'app.headyconnection.org',
      'api.headyconnection.org',
      'admin.headyconnection.org',
      'headyme.com',
      'www.headyme.com',
      'app.headyme.com',
      'api.headyme.com',
      'admin.headyme.com'
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
