> **ERLEDIGT (2026-08-18, gleiche PR wie Wellen 1+2):** Welle 3 wurde auf
> Peters Wunsch direkt in der Cloud-Session der Wellen 1+2 umgesetzt —
> inklusive der beiden offenen Punkte (Settings-Formular `config.agentView`,
> A1-Anbindung `core_fields_missing`). Dieses Dokument bleibt als
> Kontext-Archiv stehen; NAECHSTE Welle ist 4 (Kurations-Patch-Route +
> Inline-Verifikation, Contract §4) — siehe Hand-off-Block der PR.

# Handover 2026-08-18: Welle 3 — Auftrags-Generator + Todo-Listen

Für eine **Online-/Cloud-Session**. Es gelten die Cloud-Regeln aus `AGENTS.md`:
**nur `pnpm test` + `pnpm lint`**, kein `pnpm build`, keine Live-Datenbank,
kein Dev-Server. Eine PR, Diff-Limits, Hand-off-Block am Ende.

## Ausgangslage (Wellen 1 + 2 gemerged)

Die Agentensicht rechnet und zeigt. Was da ist:

| Baustein | Wo |
|---|---|
| Gap-Registry (Akteur, Zyklus-Schritt, Schwere, Herkunft je Gap-Typ) | `src/lib/agent-view/gap-registry.ts` |
| Coverage-Service als Kompositionsschicht über Ports | `src/lib/agent-view/coverage-service.ts` |
| Archiv-Scan (`_INDEX.md`/`BERICHT.md`, Twin-Ordner, Ausschlüsse) | `src/lib/agent-view/archive-scan.ts` |
| Archiv-Regeln, Twin-Regeln, Engine-Übersetzung, Inventar-Abgleich | `archive-rules.ts`, `twin-rules.ts`, `engine-gaps.ts`, `inventory-gaps.ts` |
| Verweis-Audit (Wikilinks + relative MD-Links, ohne LLM) | `reference-parser.ts`, `reference-audit.ts`, `document-audit.ts` |
| Gap-Budget, Baum-Aggregation, Soll/Ist-Regel, Board-Karten | `gap-budget.ts`, `tree-builder.ts`, `stand-widerspruch.ts`, `vorhaben-board.ts` |
| Report-Cache (ein Dokument je Library, wegwerfbar) | `src/lib/repositories/agent-view-coverage-repo.ts` |
| API | `GET/POST /api/library/{id}/agent-view/{coverage,scan}` |
| Baum-UI + Zyklus-Board (read-only) | `/library/agent-view`, `src/components/library/agent-view/` |
| Per-Library-Konventionen | `library.config.agentView` (Typ in `src/types/library.ts`) |

## Aufgabe: Welle 3 — Auftrags-Generator (F3) + Todo-Listen nach Akteur

Pflichtlektüre: `AGENTS.md`, `docs/concepts/projektauftrag-agentensicht.md`
(F3 + §7), `docs/concepts/erschliessungszyklus.md` (§5 Nahtstellen).

Zu bauen:

1. **Todo-Listen nach Akteur** (Mensch / Cowork / KnowledgeScout) aus
   `report.gaps` — reine Funktion über `GAP_REGISTRY`, gruppiert nach
   `actor` + `zyklusSchritt`. KS-Todos verlinken auf die vorhandenen Buttons
   (Prüfen/Reparieren, Pipeline), Cowork-Todos gehen in den Generator.
2. **Auftrags-Generator**: Auswahl von Lücken → kopierfertiger Auftragstext.
   Vorlage je Gap-Typ, Kontextkopf (Library, Pfade, Pflichtlektüre),
   Abschlusskriterium („Danach verschwinden die Gaps X, Y im nächsten Scan"),
   und am Ende der **Konsistenz-Rückmeldungsblock**.
   Ausgabe in v1: **Clipboard only** — keine `auftraege/`-Dateien.
3. **Pfad-Darstellung**: archiv-relative Pfade; optional ein
   Library-Config-Feld „lokaler Wurzelpfad" für absolute Pfade.

### Harte Grenzen

- Keine Schreiboperation in den Bestand (der Kurations-Patch ist Welle 4).
- Vorlagen als reine Funktionen + Unit-Test je Gap-Typ-Vorlage.
- Dateien ≤ 200 Zeilen, kein `any`, keine stillen Fallbacks.

## Offene Punkte aus Welle 1/2 (bewusst nicht gebaut)

- **`core_fields_missing` (A1) nicht angeschlossen.** Die Library-Verifikation
  hat eigene Route/UI; die Einbindung als Coverage-Gap braucht `facetDefs` +
  `libraryDetailViewType` und gehört sauber in eine eigene kleine Welle.
- **Settings-Formular für `library.config.agentView`.** Typ und Auswertung
  sind da (`vorhabenFolderPattern`, `indexRequiredMaxDepth`,
  `berichtFreshness`); die Form-Schritte 3–6 aus
  `.cursor/rules/library-config-field.mdc` fehlen noch. Ohne Konfiguration
  gelten die Defaults: Vorhaben = Ordner mit `bearbeitungsstand` im
  `_INDEX.md`, `_INDEX.md`-Pflicht inaktiv, Bericht-Frische aktiv.
- **`twin_stale` kommt aus dem Engine-Befund `needs-pipeline`**, nicht aus der
  separaten Freshness-Route — bewusst, um keinen zweiten Scan zu fahren.
- **Vorbestehender roter Test** (nicht von dieser Welle): 
  `tests/unit/api/libraries-me-capture-route.test.ts` läuft auch auf `master`
  in einen Timeout (`canCapture=true mit Rolle, wenn erfass-berechtigt`).

## Lokale Live-Verifikation (Peter, vor Merge)

1. `bash scripts/welle-pre-merge-check.sh`
2. `pnpm dev`, Library „Onedrive Test" wählen, Menüpunkt **Agentensicht**.
3. „Neu scannen" → Baum + Zyklus-Board erscheinen.
4. Erwartung: `6. bCommonsLab prototyping/25.01 Common Secretary` ist grün
   (abgenommen, keine Befunde); der Rest der Library zeigt Gaps;
   `temp/` erscheint nicht, wird aber im Kopf als „ausgeschlossen" gezählt.
5. Rückfall-Test: eine Datei unter dem Pilot-Ordner anfassen → erneut scannen
   → Karte wechselt in „Abgenommen, aber nicht mehr aktuell".
6. Wegwerf-Test: Collection `agent_view_coverage__<libraryId>` löschen →
   Seite lädt „Noch kein Scan" → „Neu scannen" stellt den Report her.
