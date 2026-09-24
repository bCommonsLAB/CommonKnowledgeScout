#!/bin/bash
# SessionStart-Hook für Claude Code im Web: installiert die Abhängigkeiten,
# damit pnpm test, pnpm lint und tsc in derselben Cloud-Session laufen.
# Lokal (kein CLAUDE_CODE_REMOTE) tut der Hook nichts.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Telemetrie-Abfragen von Next unterdrücken (nicht interaktiv)
export NEXT_TELEMETRY_DISABLED=1
echo 'export NEXT_TELEMETRY_DISABLED=1' >> "${CLAUDE_ENV_FILE:-/dev/null}"

# Idempotent: pnpm überspringt, was schon im Store liegt.
pnpm install --frozen-lockfile --prefer-offline

# Playwright-Browser liegen im Container schon unter /opt/pw-browsers;
# kein Download nötig (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ist gesetzt).
echo "session-start: Abhängigkeiten installiert ($(node --version), pnpm $(pnpm --version))"
