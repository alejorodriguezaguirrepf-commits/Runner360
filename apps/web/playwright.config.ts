import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Pruebas E2E. Requieren la app corriendo con un backend Supabase (real o local):
 *   bash scripts/local-backend/start.sh   (o `supabase start`)
 *   pnpm --filter web build && pnpm --filter web start
 *   pnpm test:e2e
 * Las pruebas que necesitan backend se saltean si no hay Supabase configurado.
 */
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
