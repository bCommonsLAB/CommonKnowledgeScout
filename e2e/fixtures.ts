import { test as base, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

/**
 * Erweitert den Standard-`page`-Fixture: vor jedem Test wird der
 * Clerk-Testing-Token auf die Seite gelegt. Dadurch kann die gespeicherte
 * Session (tmp/e2e-auth.json) den Clerk-Handshake auch im automatisierten
 * Browser abschließen. Anonyme Kontexte (browser.newContext() in Akt 3)
 * bekommen den Token bewusst NICHT — sie sollen unangemeldet bleiben.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page })
    await use(page)
  },
})

export { expect }
