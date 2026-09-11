import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  retries: 0,
  outputDir: "artifacts/verification/chromium-traces",
  reporter: [["list"], ["json", {outputFile:"artifacts/verification/browser-chromium.json"}]],
  use: {browserName:"chromium",headless:true,viewport:{width:1280,height:720},trace:"retain-on-failure",screenshot:"only-on-failure"},
});
