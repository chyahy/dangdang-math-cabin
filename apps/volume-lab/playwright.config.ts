import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4178', viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', headless: true, screenshot: 'only-on-failure', launchOptions: { args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run dev -- --port 4178 --strictPort', url: 'http://127.0.0.1:4178', reuseExistingServer: true },
});
