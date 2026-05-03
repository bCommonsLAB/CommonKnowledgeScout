import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Wichtig: TSX/JSX in Tests soll den "automatic" Runtime nutzen,
  // damit Komponenten kein `import React from "react"` benötigen.
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // Vitest-Default ist 5000ms. Heavy-Import-Char-Tests (z.B.
    // chat-panel-facade, story-topics-contract) laden grosse
    // Modulbaeume kalt und liegen nahe oder ueber dem Default.
    // 15000ms ist konservativ genug, um Cold-Module-Loads auf
    // Windows unter paralleler Test-Last zu ueberstehen, ohne
    // echte Performance-Regressions zu verstecken (>15s ist auch
    // dann noch ein klares Smell).
    testTimeout: 15000,
  },
})


