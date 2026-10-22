import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4178",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 4178 --strictPort",
      url: "http://127.0.0.1:4178",
      reuseExistingServer: true,
    },
    {
      command: "npx vite ../../site --host 127.0.0.1 --port 4179 --strictPort",
      url: "http://127.0.0.1:4179",
      reuseExistingServer: true,
    },
  ],
});
