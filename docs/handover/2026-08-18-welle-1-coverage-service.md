# Handover 2026-08-18: Welle 1 — Coverage-Service (Cloud-Session)

Für eine **Online-/Cloud-Session** (Cursor Cloud oder Claude Code Web).
Es gelten die Cloud-Regeln aus `AGENTS.md`: **nur `pnpm test` + `pnpm lint`**,
kein `pnpm build`, keine Live-Datenbank, kein Dev-Server — Verifikation
ausschließlich über Unit-Tests mit Mocks. Eine PR, Diff-Limits,
Hand-off-Block am Ende.

## Ausgangslage (Stand master nach Merge #166–#168)

Alle 0er-Fundamente sind da und im Pilot (`25.01 Common Secretary`,
Library „Onedrive Test") real bewiesen:

| Baustein | Wo |
|---|---|
| Twin-Kern-Feldsatz + Helfer (`missingTwinCoreFields`, `isVerificationValid` mit temporaler Regel, `selectLeadingArtifact`) | `src/lib/shadow-twin/twin-core-fields.ts` (0a) |
| Writer-Stempel (`generated_by`/`generated_at` in Pipeline UND Adoption) | `twin-core-stamp.ts`, `shadow-twin-migration-writer.ts` (0a/0g) |
| Sync-Engine-Check: EIN Plan, Report mit Befunden (`needs-pipeline`, `conflict`, `legacy-transcript-name`, `path-too-long`) | `src/lib/shadow-twin/sync-engine/run-library-sync.ts`, `report-types.ts` |
| Ausschluss-Muster (`scanExcludeGlobs`) inkl. `skippedExcluded`-Zähler | `sync-engine/scan-exclude.ts`, `resolve-sources.ts` (0b) |
| Familien-Umzug (`moveFamily` + Route + UI) | `src/lib/shadow-twin/move-family.ts` (0e) |
| Freshness-Prüfung | `src/app/api/library/[libraryId]/shadow-twins/freshness/` |
| Library-Verifikation A1 (`missing-base-field` je Dokument) | `src/lib/library-verification/` |
| Archiv-Seite: `_INDEX.md` mit `bearbeitungsstand`/`bearbeitungsstand_seit`, Berichte mit `type`/`generated_*`, Verweise als Links | von Cowork gepflegt |

## Aufgabe: Welle 1 des Projektauftrags — Coverage-Service (ohne UI)

Pflichtlektüre in dieser Reihenfolge:
1. `AGENTS.md` (Regeln + Stop-Bedingungen)
2. `docs/concepts/projektauftrag-agentensicht.md` — §2 Leitprinzipien
   (KOMPOSITION, doppelte Buchhaltung), F2 Gap-Tabelle MIT Herkunftsspalte,
   §4 Leitplanken, §7 Akzeptanzkriterien 6–9
3. `docs/concepts/twin-datei-contract.md` — §2b (führendes Artefakt), §3
4. `docs/concepts/erschliessungszyklus.md` — §4 (Soll/Ist am `bearbeitungsstand`)

### Was zu bauen ist

Neues Modul **`src/lib/agent-view/`** als **dünne Kompositionsschicht** —
ausdrücklich KEIN drittes Prüfsystem, kein eigener Provider-Scan:

1. **`coverage-service.ts`** — orchestriert vorhandene Prüfer:
   - Sync-Engine-Plan über `runLibrarySync({ mode: 'check', preset: 'repair', scope })`
     → liefert `source_without_twin` (adopt/needs-pipeline), `orphan_twin`
     (Mongo ohne Scan-Fund), `conflict`, Namens-Befunde; `skippedExcluded`
     in den Report übernehmen (Gap-Budget, kein stilles Auslassen).
   - Twin-Kern-/Verifikations-Regeln aus `twin-core-fields.ts`
     (`twin_core_missing`, `twin_unverified` am FÜHRENDEN Artefakt,
     `self_verified`, `transformation_missing`, `transformation_stale`).
   - Archiv-Regeln (NEU, reine Funktionen in einer Registry):
     `report_missing`, `index_missing`, `bearbeitungsstand`-Abgleich
     (`stand_widerspruch` gegen `bearbeitungsstand_seit`), `bericht_veraltet`.
   - **Verweis-Audit** (NEU, reine Funktion, ohne LLM): Bodies von
     `BERICHT.md`/`_INDEX.md` auf Wikilinks `[[…]]` + relative MD-Links
     parsen → `verweis_tot`, `verweis_veraltet`, `bericht_unvollstaendig`.
   - Jeder Gap trägt `actor` (`mensch | cowork | knowledgescout`) und
     `zyklusSchritt` (Todo-Routing, F2).
2. **Report-Cache**: EIN `CoverageReport`-Dokument je Library in Mongo
   (`generatedAt`, als abgeleitet/wegwerfbar dokumentiert). Eigenes kleines
   Repo-Modul nach `mongodb-repository-pattern.md`.
3. **API** nach `api-route-conventions.md`:
   `GET /api/library/{id}/agent-view/coverage` (jüngster Report, 404 wenn
   keiner) und `POST /api/library/{id}/agent-view/scan` (expliziter Scan,
   `maxDuration` großzügig; optional `scope.folderId`).
4. **Unit-Tests** je NEUEM Gap-Typ (positiv + negativ) — wiederverwendete
   Prüfungen NICHT duplizieren. Verweis-Parser mit Fixtures testen.
   Report-Wegwerf-Test (Akzeptanzkriterium 6): Scan aus identischen
   Eingaben ⇒ identischer Report.

### Harte Grenzen (Stop + melden statt raten)

- Keine Änderungen an Sync-Engine, A1, `BASE_REQUIRED_FIELDS`, `TWIN_CORE_FIELDS`.
- Kein UI-Code, keine Imports aus `components/hooks/contexts`
  (`shadow-twin-contracts.mdc` §3 sinngemäß für `agent-view`).
- Coverage wird BERECHNET; einzige Persistenz ist der wegwerfbare Report.
  Kein Write-Through, kein Index über Storage-Inhalte.
- Erklärte Stände (`bearbeitungsstand`) werden NIE geschrieben — nur gelesen
  und abgeglichen (doppelte Buchhaltung, Leitprinzip 6).
- Dateien ≤ 200 Zeilen; typisierte Fehler; `no-silent-fallbacks`
  (Scan-Fehler je Teilbaum isolieren und im Report ausweisen).

### Cloud-Besonderheiten

- Kein Live-Zugriff: `_INDEX.md`-Frontmatter-Lesen über den Provider
  mocken; Engine-/Freshness-/A1-Aufrufe in Tests mocken.
- `pnpm test` + `pnpm lint` müssen grün sein; kein `pnpm build`.
- Die LIVE-Verifikation (Pilot-Ordner müsste grün erscheinen, Rest der
  Library mit Gaps) macht Peter danach lokal — als To-do in den
  Hand-off-Block schreiben.

### Start-Prompt (kopierbar)

```
Lies zuerst AGENTS.md, dann docs/handover/2026-08-18-welle-1-coverage-service.md
(dieses Dokument) und die dort gelistete Pflichtlektuere. Setze Welle 1 des
Projektauftrags Agentensicht um: src/lib/agent-view/ als Kompositionsschicht
(Coverage-Service + Gap-Registry + Verweis-Audit + Report-Cache + API), OHNE
UI, exakt in den Grenzen des Handovers. Cloud-Regeln: nur pnpm test +
pnpm lint. Eine PR (claude/agentensicht-welle-1-coverage) mit
Hand-off-Block: naechste Welle 2 (Baum-UI + Zyklus-Board) und die lokale
Live-Verifikation fuer Peter.
```

Modellempfehlung: **Opus mit Thinking** (Kompositions-Design, viele Verträge).
Kosten: eine mittlere Cloud-Session.

## Weitere offene Aufgaben (eigene Sessions)

- **Welle 0f — Typ-Templates** (lokal ODER Cloud): Library-Config-Map
  `doc_type → Template` (Fallback Einzel-Template), Typ-Erkennungsschritt
  nach dem Transkript (ACHTUNG: JSON-Form explizit in den Prompt-Text,
  Secretary erzwingt schema_json nicht), Standard-Typ-Templates. Details:
  `docs/handover/2026-08-18-zyklus-v2-naechste-wellen.md`.
- **0g-Rest**: (a) Kombi-Split — Grundsatzentscheidung bei Peter (echte
  Transformation via Pipeline vs. ehrlicher Name; zusätzlich: Split-Kopie
  künftig in den Twin-Ordner statt neben das Original); (e) `generatedBy`
  für transform-service/testimonial-writer/write-bundle.
- **Danach**: Welle 2 (Baum-UI + Zyklus-Board), 3 (Auftrags-Generator +
  Todo-Listen), 4 (Abnahme-UI), MCP-Brücke (Projektauftrag §5, Welle 5).

## Betriebs-Notizen

- Git-Worktrees: `.env` prüfen (`MONGODB_DATABASE_NAME` kann auf PROD
  zeigen!), `pnpm install` je Worktree.
- Testdaten lokal: Library „Onedrive Test", Pilot-Ordner
  `6. bCommonsLab prototyping/25.01 Common Secretary` ist komplett
  abgenommen (idealer Grün-Fall); `temp/`-Ausschluss über `scanExcludeGlobs`
  konfigurierbar.
