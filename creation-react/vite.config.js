import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: ['es2015', 'chrome70', 'firefox65', 'safari12', 'edge79'],
    minify: false, // Disable minification for debugging
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:5482',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:5482',
        changeOrigin: true,
        secure: false,
      },
      '/errors': {
        target: 'http://localhost:5482',
        changeOrigin: true,
        secure: false,
      },
      // Proxy all other routes to the backend
      '^/(?!@|src|node_modules|public)': {
        target: 'http://localhost:5482',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  define: {
    global: 'globalThis',
  }
})