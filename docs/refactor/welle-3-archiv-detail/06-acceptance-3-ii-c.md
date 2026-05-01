# Welle 3-II-c — Acceptance (Detail-Tabs: job-report-tab + media-tab)

**Branch**: `cursor/refactor-welle-3-ii-c-detail-tabs-a03a`
**Stand**: 2026-05-01
**PR**: (folgt nach Push)
**Strategie**: 1 PR pro Welle (siehe `.cursor/rules/refactor-batch-strategy.mdc`)

## Plan-Anpassung gegenueber AGENT-BRIEF.md

AGENT-BRIEF.md schlug fuer 3-II-c einen ambitionierten Modul-Split vor:

```
job-report-tab/
  index.tsx, teaser-card.tsx, field-mapper.tsx, job-status-bar.tsx
  hooks/use-job-report.ts

media-tab/
  index.tsx, media-grid.tsx, media-row.tsx, upload-area.tsx
  hooks/use-media-data.ts
```

**Tatsaechliche Struktur** der beiden Files:
- Beide sind **monolithische Render-Funktionen** mit einer einzigen
  exportierten Komponente (`JobReportTab`, `MediaTab`).
- Es gibt **keine** `teaser-card`, `field-mapper`, `job-status-bar`,
  `media-grid`, `media-row`, `upload-area` als getrennte Code-Strukturen.
- Der Code ist tief verzahnt mit Closures (Hook-State, Callback-Scope).
- Sub-Komponenten zu erfinden wuerde Render-Logik aufbrechen ohne
  klare Schnittstelle — riskant.

**Neuer Plan fuer Welle 3-II-c**: **Konservativer Helper-Extract**.
Statt erfundene Sub-Komponenten zu schaffen, werden:
- Pure-Helper + async-Helper aus dem Top-Level ausgegliedert
- Type-Definitionen modularisiert
- Render-Logik unangetastet gelassen

Die grossen Komponenten-Splits sind **Future Work** und erfordern
zuerst eine Architektur-Entscheidung (Hook-Extraktion vs. Sub-
Komponente vs. Reducer-Extraktion).

## Inhalt (5 Schritte / 5 Commits)

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 1 | Char-Tests fuer Pure-Helpers (job-report-tab + media-tab) | 2 Test-Files (21 Cases) | 188 |
| 2 | safeParseStringArray + JobDto-Type aus job-report-tab | `job-report-tab/helpers.ts` (69z) | 163 |
| 3 | 6 Helpers + 2 Types aus media-tab | `media-tab/helpers.ts` (286z) | 616 |
| 4 | Cleanup ungenutzte Imports | (kein neuer File) | 4 |
| 5 | Acceptance-Doc | `06-acceptance-3-ii-c.md` (folgt) | ~150 |

**Brutto-Diff Gesamt**: 6 Files, +513 / -282 (795 Zeilen) — sehr klein,
gut unter 5.000-Limit.

## Volumen-Statistik

| Metrik | Vorher (master, b0b4515) | Nachher | Differenz |
|---|---:|---:|---:|
| `job-report-tab.tsx` Zeilen | 2.296 | 2.262 | **-34 (-1.5%)** |
| `media-tab.tsx` Zeilen | 1.187 | 958 | **-229 (-19.3%)** |
| Sub-Module unter `job-report-tab/` | 0 | 1 (helpers) | +1 |
| Sub-Module unter `media-tab/` | 0 | 1 (helpers) | +1 |
| Test-Files | 0 | 2 | +2 |
| Test-Cases | 0 | 21 | +21 |

## Ergebnis-Bewertung

**`media-tab.tsx`**: 19% Reduktion. Solider Erfolg — die 6 Top-Level-
Helpers + 2 Types waren sauber isolierbar.

**`job-report-tab.tsx`**: nur 1.5% Reduktion. Das ist **wenig**, aber
korrekt: nur eine Pure-Funktion (`safeParseStringArray`) und ein Type
(`JobDto`) waren auf Top-Level — der Rest ist tief verschachtelt im
Komponenten-Body. Ein groesserer Split wuerde Render-Logik aufbrechen.

## Future Work (nicht Teil dieser Welle)

Folgende Komponenten-Splits sind technisch moeglich, aber nicht
trivial und sollten erst nach Architektur-Diskussion gemacht werden:

### job-report-tab.tsx (-2.262 Zeilen restlich)
- **State + Effects als Custom-Hook** (`use-job-report-data`):
  Job-Loader, Frontmatter-Parser, Cover-Image-Resolver etc. → ca.
  300-400 Zeilen extrahierbar
- **Tab-Bodies als Sub-Komponenten** (markdown/meta/chapters/media/
  ingestion/process): 6 Tabs zu je ~150-300 Zeilen → groessere
  Re-Architektur, weil Closures geteilt werden
- **Inline-Editing-Logik** als eigener Hook (`use-frontmatter-editor`)

### media-tab.tsx (-958 Zeilen restlich)
- **GalleryItem-Builder** als Hook (`use-gallery-items`): kombiniert
  Siblings + binaryFragments → ca. 200 Zeilen
- **Slot-first-Zuordnung** als Hook (`use-assignment-target`)
- **Upload-Area + Slot-Renderer** als Sub-Komponenten

### Empfehlung
Diese Future-Work-Items in einem separaten Refactor-Cycle (z.B.
"Welle 3-III: Hooks-Extraktion") angehen, wenn klar ist welche
Architektur-Form (Hooks vs. Sub-Komponenten) das Team praeferiert.

## Methodik-DoD

| Kriterium | Status | Belege |
|---|---|---|
| 1 PR pro Welle | OK | `cursor/refactor-welle-3-ii-c-detail-tabs-a03a` |
| Pro Schritt eigener Commit | OK | 5 Commits (Char-Tests, 2 Helper-Extracts, Cleanup, Doc) |
| Char-Tests vor Code-Aenderungen | OK | Schritt 1 |
| `pnpm test` gruen | OK | 1.093 Tests / 172 Files (18.5s) |
| `pnpm lint` gruen | OK | nur vor-existierende Warnings ausserhalb Welle 3 |
| `pnpm build` gruen | OK | exit 0 (79s) |
| < 1.000 Zeilen Diff pro Commit | OK | max 616z (media-tab Helpers) |
| < 5.000 Zeilen Brutto pro PR | OK | 795z |
| < 15 Commits pro PR | OK | 5 Commits |
| Cleanup im selben PR | OK | Schritt 4 hat 2 ungenutzte Imports entfernt |
| Keine neuen `any`, keine neuen `catch{}` | OK | 1:1 portierter Code |

## Methodik-Lehre PR #31 hat zum 4. Mal funktioniert

`pnpm build` lokal hat **vor dem Push** 2 ungenutzte Imports in
`media-tab.tsx` abgefangen (`fetchShadowTwinMarkdown`,
`updateShadowTwinMarkdown` — wurden mit den 4 async-Helpers
ausgegliedert). Ohne diese Pruefung: Hotfix-PR analog #30 noetig.

## Smoke-Test fuer User

3 kurze Klicks zur Verifikation:

1. **Datei-Detail oeffnen mit Transform-Tab** → JobReportTab rendert
   wie bisher mit Markdown/Meta/Chapters/Media/Ingestion/Process-Tabs;
   Frontmatter-Felder werden korrekt geparst (Arrays + JSON-Strings).
2. **Media-Tab oeffnen** → Galerie zeigt Geschwister-Dateien +
   binaryFragments korrekt; Slot-Auswahl funktioniert; Upload + Anhang-
   Entfernen funktionieren.
3. **`.url`-Datei** im Original-Tab → URL wird korrekt geparst und
   im Iframe angezeigt (Bestands-Verhalten unveraendert).

Wenn OK: PR mergen, dann Welle 3-II-d (detail + flow + shared).

## Verweise

- Welle 3-II-b Acceptance: `06-acceptance-3-ii-b.md`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc` (PR #35)
- Methodik-Lehre `pnpm build`-Pflicht: PR #31
