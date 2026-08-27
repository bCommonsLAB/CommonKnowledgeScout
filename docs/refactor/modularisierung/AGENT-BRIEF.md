# Agent-Brief: Modularisierung — Welle M1 (Workspace + `@ks/viewers`)

Stand: 2026-08-27. Erstellt am Ende der Konzept-Session, für die erste
Umsetzungs-Session.

## Kontext (lies das ZUERST, in dieser Reihenfolge)

1. **`CLAUDE.md`** im Repo-Root — Einstiegs-Memory: Routing-Index (Pfad →
   Contract → Skill → ADR), Coding-Konventionen. Lädt die immer geltenden
   Contracts per `@`-Import.
2. **`AGENTS.md`** §Aktueller Fahrplan — die Modularisierung ist der laufende
   Strang; Werkbank (W1–W8, A1–A6) ist abgeschlossen, die Juni-Roadmap ruht.
3. **[`migrations-strategie.md`](../../architecture/migrations-strategie.md)** —
   die fünf Garantien. **Wichtigste**: G2 (`git mv`, nie kopieren) und G4
   (Verhaltensneutralität ist Abnahmekriterium).
4. **[`modul-landkarte.md`](../../architecture/modul-landkarte.md)** §1 (Paket-
   Zuschnitt), §4 (Import-Grenzregeln), §5 (Wellenplan M1–M8).
5. **ADR [0007](../../adr/0007-modularisierung-monorepo-schale-module.md)**
   (Pakete/Schichten) und
   **[0008](../../adr/0008-deployment-ziele.md)** §4 (Module exportieren
   montierbare Wurzelkomponenten — greift ab M4, nicht in M1).

## Aufgabe M1

Zwei Dinge, mehr nicht:

**(a) Workspace-Fundament**

- `pnpm-workspace.yaml` anlegen (`packages/*`).
- `transpilePackages` in `next.config.js` setzen — die Voll-App konsumiert
  Workspace-Pakete als Source, KEIN separater Paket-Build im Deployment.
- Prüfen, dass Electron (`electron-builder.yml`) und `build:package`
  unverändert bauen.

**(b) Erstes Paket `@ks/viewers` — bewusst winziger Erstschnitt**

Ziel ist der **Beweis der Mechanik**, nicht Vollständigkeit. Verschiebe per
`git mv` nur:

| Datei | Zeilen | Importeure |
|---|---|---|
| `src/components/library/markdown-preview/md-renderer.ts` | 233 | 4 |
| `src/components/library/markdown-preview/markdown-helpers.ts` | 323 | 3 |

**NICHT** in M1: `text-transform.tsx` (719 Z.), `search-popover.tsx`,
`src/lib/markdown/**` (Frontmatter-Serializer — steht unter dem Contract
`frontmatter-single-serializer` und hängt an der Pipeline; eigene Welle),
PDF-/Audio-/Image-Viewer. Das gesamte `markdown-preview`-Verzeichnis hat 33
Importeure — zu breit für die erste Welle.

### Die eine Design-Entscheidung, die M1 treffen muss

`md-renderer.ts` und `markdown-helpers.ts` importieren zwei App-Pfade:
`@/lib/debug/logger` und `@/lib/storage/types`. Ein Paket, das zurück in die
App importiert, ist die falsche Richtung (Landkarte §4).

**Empfehlung**: Für M1 den Import über eine tsconfig-Pfad-Zuordnung
bestehen lassen und als benannte Schuld in `docs/refactor/modularisierung/`
notieren; M2 löst sie auf (`@ks/contracts` nimmt die Typen, Logger wird
injiziert oder wandert in ein `@ks/util`). Alternative — nur die tatsächlich
gebrauchten Typen schon in M1 nach `@ks/contracts` ziehen — bläht M1 auf und
ist nur zu wählen, wenn es wirklich ein oder zwei Interfaces sind. **Prüfe
das zuerst**, dann entscheide und begründe im PR.

## Ablauf

1. Workspace + `transpilePackages`, Voll-App startet ⇒ committen.
2. `packages/viewers/` anlegen (`package.json` mit Name `@ks/viewers`,
   `tsconfig.json` nach Vorbild des Roots).
3. Die zwei Dateien per `git mv` verschieben, Importe der 7 Aufrufer anpassen.
   Wo Pfade zu breit streuen: dünne Re-Export-Fassade am alten Pfad stehen
   lassen (G2) und im PR benennen — eine Folgewelle räumt sie ab.
4. ESLint-Import-Regel für die Paketgrenze vorbereiten (Landkarte §4) —
   darf in M1 als Warnung laufen, muss nicht sofort hart sein.
5. Bestehende Tests der verschobenen Dateien mitziehen.

## Definition of Done

- `pnpm test` + `pnpm lint` grün (Referenz: **3247 Tests, 0 Lint-Errors**,
  Stand 99a7c83 — jede Abweichung ist deine).
- Voll-App startet, Markdown-Vorschau verhält sich identisch (G4).
- `git log --follow` funktioniert für die verschobenen Dateien (echte Renames,
  keine Neuanlage).
- Kein Feature existiert doppelt (G2).
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.
- Hand-off-Block für M2 im PR-Body (`AGENTS.md` §Hand-off).

## Stop-Bedingungen (abbrechen + melden, nicht raten)

Zusätzlich zu den allgemeinen in `AGENTS.md`:

- `transpilePackages` bricht den Electron- oder `build:package`-Build.
- Die Import-Anpassung zieht mehr als ~15 Dateien nach sich ⇒ Schnitt ist zu
  breit, kleiner ansetzen.
- Die Abhängigkeitsrichtung lässt sich nicht sauber lösen ⇒ Entscheidung dem
  Owner vorlegen, statt eine Notlösung zu bauen.

## Was M1 ausdrücklich NICHT ist

- Keine SiteConfig, keine Schale, kein Modul-Paket (das sind M3/M4).
- Keine API-Umbenennungen oder Route-Umzüge (G4 — eigene Vorhaben).
- Kein `apps/`-Verzeichnis (die Voll-App bleibt, wo sie ist, bis M3).
- Keine Verhaltensänderung, auch keine „kleine Verbesserung nebenbei".
