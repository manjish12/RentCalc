import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-icon-180x180.png',
        'android-icon-192x192.png',
        'android-icon-512x512.png'
      ],
      manifest: {
        id: '/',
        name: 'RentCalc - Rent Management System',
        short_name: 'RentCalc',
        description: 'Manage rent payments, track history, and communicate with owners/tenants',
        start_url: '/',
        theme_color: '#3498db',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/android-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/android-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})