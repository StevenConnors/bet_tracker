import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", globalSetup: "./e2e/global-setup.mjs", timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3100", screenshot: "only-on-failure" },
  webServer: { command: "npm run dev -- --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false, env: { MONGODB_URI: "mongodb://127.0.0.1:27018/stakeout_e2e", AUTH_SECRET: "e2e-test-secret-at-least-32-characters", AUTH_URL: "http://127.0.0.1:3100", EMAIL_SERVER: "smtp://127.0.0.1:2526", EMAIL_FROM: "Stakeout <noreply@localhost>", ADMIN_EMAIL: "admin@example.test" } },
});
