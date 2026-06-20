import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'

// .env in die Test-Prozess-Umgebung laden (Playwright lädt sie nicht selbst):
// nötig für clerkSetup (Testing-Token) und den MongoDB-Check in den Spotchecks.
dotenv.config()

/**
 * E2E-Lauf des Test-Drehbuchs (docs/settings-ux/06-testdrehbuch.md) gegen den
 * lokalen Dev-Server.
 *
 * Voraussetzungen:
 * - `pnpm dev` läuft auf http://localhost:3000
 * - Einmaliger Login: das Setup-Projekt öffnet ein sichtbares Fenster; dort
 *   als Owner anmelden — die Session landet in tmp/e2e-auth.json (gitignored).
 *
 * Start: `pnpm test:e2e` — Schritt-Ergebnisse unter tmp/e2e-results/*.json.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: './tmp/e2e-artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    // Installiertes Google Chrome statt Playwright-Chromium: der Download
    // startet auf diesem verwalteten Windows nicht (Side-by-Side-Fehler).
    channel: 'chrome',
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /00-auth\.setup\.ts/,
      use: { headless: false },
      timeout: 300_000,
    },
    {
      name: 'drehbuch',
      testMatch: /\d{2}-(akt|spotchecks|inbox|a4).*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'tmp/e2e-auth.json' },
    },
  ],
})
