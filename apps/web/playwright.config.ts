import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E web.
 * - Sin backend: `pnpm e2e` (pruebas públicas y de protección de rutas; Supabase sin configurar).
 * - Con backend: E2E_BACKEND=1 y la app construida con credenciales de un Supabase local
 *   (`supabase start` o scripts/local-stack/start.sh). Ver README › Pruebas.
 */
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const backend = process.env.E2E_BACKEND === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  grep: backend ? /@backend/ : undefined,
  grepInvert: backend ? undefined : /@backend/,
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: existsSync(chromium) ? { executablePath: chromium } : {} } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: existsSync(chromium) ? { executablePath: chromium } : {} }, grepInvert: /@desktop-only|@backend/ },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
