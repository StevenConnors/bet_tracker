import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", globalSetup: "./e2e/global-setup.mjs", timeout: 60_000, workers: 1,
  forbidOnly: Boolean(process.env.CI), reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:3100", screenshot: "only-on-failure", trace: "retain-on-failure" },
});
