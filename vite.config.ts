import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 상대 경로(./)로 빌드해서 GitHub Pages의 어떤 저장소 이름에서도 그대로 동작해요.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      },
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '뜨개 다이어리',
        short_name: '뜨개 다이어리',
        description: '뜨개 작품 기록, 단수 카운터, PDF 내보내기',
        lang: 'ko',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F7F5EF',
        theme_color: '#4F6F55',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
