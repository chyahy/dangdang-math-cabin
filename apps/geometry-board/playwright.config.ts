import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4184",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 4184 --strictPort",
      url: "http://127.0.0.1:4184",
      reuseExistingServer: true,
    },
    {
      command: "npx vite ../../site --host 127.0.0.1 --port 4185 --strictPort",
      url: "http://127.0.0.1:4185",
      reuseExistingServer: true,
    },
  ],
});
