# Analyse: Fehlgeschlagenes Deployment vom 2026-03-22

## Ausgangslage

Der letzte fehlgeschlagene Lauf ist `ci-main` Run `23414919876` (Job: `CI Prod`).
Der Job bricht bereits im Checkout-Schritt ab, bevor Build/Test/Push starten.

Relevante Log-Zeilen:

- `fatal: could not read Username for 'https://github.com': terminal prompts disabled`
- Fehler tritt bei `actions/checkout@v4` auf (`git fetch ... origin ...`).

Damit ist die unmittelbare Ursache ein Authentifizierungsproblem beim Git-Fetch.
Es gibt keinen Hinweis auf einen TypeScript-, Build- oder Testfehler.

## Beobachtete Konfiguration

In `.github/workflows/ci-main.yml` wird `actions/checkout@v4` explizit mit
`token: ${{ secrets.CI_PAT }}` aufgerufen.
Wenn `CI_PAT` fehlt, leer ist, abgelaufen ist oder für den Kontext nicht verfügbar ist,
schlägt Checkout direkt fehl.

## Lösungsvarianten

### Variante A: `CI_PAT` weiter nutzen, Secret-Handling reparieren

- Maßnahmen: Secret im Environment/Repo prüfen, Token erneuern, Berechtigungen anpassen.
- Vorteil: Kein Workflow-Code muss geändert werden.
- Nachteil: Höhere Betriebsabhängigkeit von einem zusätzlichen Secret.
- Risiko: Gleiches Problem kann bei Token-Ablauf erneut auftreten.

### Variante B: Fallback nutzen (`CI_PAT` sonst `github.token`)

- Maßnahmen: Checkout-Token per Expression fallback-fähig machen.
- Vorteil: Robust gegen fehlendes PAT.
- Nachteil: Workflow bleibt komplexer; zwei Auth-Pfade müssen verstanden werden.
- Risiko: Uneinheitliches Verhalten zwischen Checkout und Push, wenn später weiter `CI_PAT` genutzt wird.

### Variante C (gewählt): Standardisieren auf eingebautes `GITHUB_TOKEN`

- Maßnahmen:
  1. Checkout ohne `CI_PAT` (Default-Token von `actions/checkout`).
  2. Push-Schritt ohne manuelles `git remote set-url ... CI_PAT ...`.
- Vorteil: Weniger Geheimnisse, weniger Fehlerquellen, konsistente Authentifizierung.
- Nachteil: Funktioniert nur, wenn Workflow-`permissions` korrekt gesetzt sind.
- Risiko: Gering, da `contents: write` bereits gesetzt ist.

## Entscheidung

Variante C wird umgesetzt, weil sie den Fehler am direktesten behebt und die
Wahrscheinlichkeit ähnlicher Ausfälle reduziert.
Die Änderung ist klein, lokal auf den Workflow begrenzt und beeinflusst den
Anwendungs-Code nicht.

