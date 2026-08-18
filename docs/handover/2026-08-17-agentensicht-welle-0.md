# Handover 2026-08-17: Agentensicht-Prototyp — Welle 0

Für die nächste KnowledgeScout-Session (Cloud oder lokal). Konzept-Grundlage:
`docs/concepts/` (PR #159 gemerged + Nachtrag „Transformation führt").

## Ausgangslage

- Das Konzept-Set liegt unter `docs/concepts/`: `twin-datei-contract.md`
  (inkl. §2b „Die Transformation führt, das Transkript belegt"),
  `projektauftrag-agentensicht.md` (Wellen-Plan §5, Gap-Tabelle F2),
  `erschliessungszyklus.md`, `bruchstellen-katalog.md`,
  `cowork-briefing-archivsicht.md`.
- Die Archiv-Seite ist bereits umgestellt (Cowork-Session am 2026-08-17:
  Konventionen mit Twin-Abschnitt, 10 Berichte mit `type`/`generated_*`,
  13 `_INDEX.md` mit `bearbeitungsstand: strukturiert`, Tool
  `Organisation/Tools/erschliessung.py`).
- Pilot-Kandidat für den Ende-zu-Ende-Nachweis:
  `6. bCommonsLab prototyping/25.01 Common Secretary` (vier Aufnahmen ohne
  Transkript). **Der Erschließungszyklus ist ohne neue UI fahrbar** — die
  Wellen machen ihn bequem, sie sind keine Voraussetzung für den Archiv-Pilot.

## Welle 0 — zwei kleine PRs

### 0a: Twin-Kern-Feldsatz

- Neues Modul `src/lib/shadow-twin/twin-core-fields.ts` analog
  `src/lib/detail-view-types/base-fields.ts`: `TWIN_CORE_FIELDS` als
  `as const`-Array (`type`, `source_file`, `template`, `language`,
  `generated_by`, `generated_at`) + Kurations-Felder (`twin_status`,
  `verified_by`, `verified_at`) + reine Helfer (`missingTwinCoreFields()`,
  `isVerificationValid()` mit der temporalen Regel
  `verified_at >= generated_at`, `leadingArtifact()`-Semantik nach Contract §2b).
- Writer-Integration am Engpass: Beim Erzeugen/Upsert von Twin-Artefakten
  setzt der Schreibpfad `generated_by`/`generated_at` ins Frontmatter —
  Pipeline-Kontext, nie das LLM. Kandidat ist `upsertMarkdown()` im
  `ShadowTwinService` (einziger zulässiger Einstiegspunkt laut
  `shadow-twin-contracts.mdc` §6) — zuerst die Schreibstellen inventarisieren,
  dann EINEN Engpass wählen, nicht jede Aufrufstelle einzeln.
- Bestand wird NICHT rückwirkend gepatcht (fehlender Kern ist später ein
  Agentensicht-Befund `twin_core_missing`, kein Fehler).
- Test ergänzen: `patchArtifactFrontmatter` erhält unbekannte Felder + Body.

### 0b: Ausschluss-Globs pro Library

- Library-Config-Feld nach Checkliste `.cursor/rules/library-config-field.mdc`
  (Typ, Settings-UI, Persistenz, Default leer).
- Konsumenten: Sync-Engine-Root-Scan
  (`src/lib/shadow-twin/sync-engine/resolve-sources.ts`) und der künftige
  Coverage-Scan überspringen matchende Teilbäume — mit sichtbarem Vermerk im
  Report (kein stilles Auslassen, `no-silent-fallbacks`).
- Motivation: `temp/` mit 1.610 Dateien (Bruchstelle B8).

## Harte Grenzen (Stop + melden statt raten)

- `BASE_REQUIRED_FIELDS`/A0-Gates unverändert —
  `tests/unit/detail-view-types/base-fields.test.ts` (Exact-Match) bleibt
  unangetastet grün.
- Keine Änderung an `ArtifactKey`-Semantik, keine neuen Collections, keine UI
  in Welle 0.
- Standard-Stop-Bedingungen aus `AGENTS.md`.

## Verifikation

- Cloud: `pnpm test` + `pnpm lint` (kein `pnpm build`).
- Bei Änderungen am Twin-Schreibpfad: Skill `shadow-twin-verify` read-only
  (Presets repair/import) gegen eine Dev-Library.
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.

## Empfehlung

- **Modell:** Sonnet mit kurzem Thinking (mechanisch, contract-getrieben);
  Opus erst ab Welle 1 (Kompositions-Design des Coverage-Service).
- **Agent:** NEUER Agent (Default). Branches:
  `claude/agentensicht-welle-0a-twin-kern`,
  `claude/agentensicht-welle-0b-ausschluss-globs`. Eine PR pro Teilwelle,
  Diff-Limits + Hand-off-Block nach `AGENTS.md`.
- **Kosten:** je Teilwelle eine kleine Session (grob 2–5 USD Cloud).

## Start-Prompt für Welle 0a (kopierbar)

```
Lies zuerst AGENTS.md (Pflicht-Lektüre + Stop-Bedingungen), dann:
- docs/concepts/twin-datei-contract.md (§2b, §3, §4)
- docs/concepts/projektauftrag-agentensicht.md (§4 Leitplanken, §5 Welle 0)
- docs/handover/2026-08-17-agentensicht-welle-0.md (dieses Dokument, Abschnitt 0a)
- .cursor/rules/shadow-twin-contracts.mdc

Aufgabe: Welle 0a des Agentensicht-Projekts — Twin-Kern-Feldsatz.
1. src/lib/shadow-twin/twin-core-fields.ts: TWIN_CORE_FIELDS (type,
   source_file, template, language, generated_by, generated_at) +
   Kurations-Felder (twin_status, verified_by, verified_at) als as-const-
   Arrays + reine Helfer missingTwinCoreFields() und isVerificationValid()
   (temporale Regel verified_at >= generated_at). Unit-Tests dazu.
2. Writer-Integration: Schreibstellen inventarisieren, dann am Engpass
   (Kandidat: ShadowTwinService.upsertMarkdown) generated_by/generated_at
   ins Frontmatter neu erzeugter Artefakte setzen — aus dem Pipeline-
   Kontext, nie vom LLM. Bestand nicht rückwirkend patchen.
3. Test ergänzen: patchArtifactFrontmatter erhält unbekannte Felder + Body.
HARTE GRENZEN: BASE_REQUIRED_FIELDS und tests/unit/detail-view-types/
base-fields.test.ts unverändert; keine UI; keine neuen Collections;
Dateien <= 200 Zeilen; pnpm test + pnpm lint.
Eine PR (claude/agentensicht-welle-0a-twin-kern) mit Hand-off-Block:
naechste Teilwelle 0b (Ausschluss-Globs, siehe Handover-Dokument).
```

## Danach

Welle 1 (Coverage-Service als Komposition über Engine-Check +
Library-Verifikation + Freshness, Report-Cache, API) — Hand-off am Ende der
0a/0b-PRs. **Parallel und unabhängig davon** kann der Archiv-Pilot bereits
laufen: `erschliessung.py` → KS-Pipeline über den Common-Secretary-Ordner →
Cowork-Bericht auf Twin-Basis → „Prüfen" (Import) + Abnahme per
Obsidian-Frontmatter (Zyklus §6 der Konzepte).
