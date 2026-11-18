import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 배포할 때마다 바뀌는 버전 표시 (한국 시간)
const BUILD = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

// 상대 경로(./)로 빌드해서 GitHub Pages의 어떤 저장소 이름에서도 그대로 동작해요.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    {
      // 앱이 새 버전을 확인할 때 읽는 파일 (캐시하지 않아요)
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
      }
    },
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // 글꼴 정보 파일은 처음 필요할 때 받아서 저장해두고, 그다음부터는 오프라인에서도 써요
        runtimeCaching: [{ urlPattern: /\/pdfjs\//, handler: 'CacheFirst', options: { cacheName: 'pdfjs-assets' } }]
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
