# Handover 2026-08-19: Welle 4 — Kurations-Patch-Route + Inline-Verifikation

Stand nach Welle 4 (diese PR). Nächste Welle laut Projektauftrag: **Welle 5 —
MCP-Brücke**. Es gelten die Cloud-Regeln aus `AGENTS.md`: **nur `pnpm test` +
`pnpm lint`**, kein `pnpm build`, eine PR, Diff-Limits, Hand-off-Block.

## Was Welle 4 gebaut hat

| Baustein | Wo |
|---|---|
| Kurations-Plan (Feld-Zaun, Verify-Stempel, Selbst-Verifikations-Invariante §3.2, Drift-Gleichheit) | `src/lib/shadow-twin/curation-plan.ts` |
| Kurations-Verdrahtung (Mongo laden → Drift-Guard gegen Spiegel → Feld-Patch, Spiegel nur in den `_`-Ordner) | `src/lib/shadow-twin/curation-patch.ts` |
| Kurations-Route (400/404/409-Codes: `invalid_request`, `artifact_not_found`, `mirror_drift`, `self_verified`) | `POST /api/library/{id}/shadow-twins/curation` |
| `actorLevel` ins Contract-Modul gezogen (keine zweite Definition) | `src/lib/shadow-twin/twin-core-fields.ts` |
| Service additiv erweitert: `shadowTwinFolderId` + `skipFilesystemMirror` am Patch/Upsert (nie Alt-Form-Sidecars erzeugen) | `src/lib/shadow-twin/store/shadow-twin-service.ts` |
| Report-Erweiterung: `families` (`TwinFamilySummary`, führendes Artefakt + Vertrauensampel), Budget `MAX_FAMILY_SUMMARIES` | `src/lib/agent-view/family-summaries.ts`, `types.ts` |
| Twin-Knoten im Baum: `twin_status`-Dropdown + Verifizieren, Overrides bis zum nächsten Scan | `twin-family-row.tsx`, `use-twin-curation.ts`, `coverage-tree*.tsx` |
| **Nachzug W1:** `GET /api/library/{id}/agent-view/coverage` existierte nie — der Hook lief immer in „noch nie gescannt" | `src/app/api/library/[libraryId]/agent-view/coverage/route.ts` |

Entscheidungen (Veto möglich):

1. **Drift-Guard als Inhalts-Vergleich** (Normalisierung = Engine-Konflikt-
   Vergleich), nicht mtime vs. `filesystemSync.lastSyncedAt` — das Feld wird
   im Bestand nie gepflegt. Contract §4.3 entsprechend präzisiert.
2. **Verify-Identität** ist `human:<user-email>` (Repo-Konvention
   „User-Email statt User-ID"); Selbst-Verifikation wird an der Route
   verweigert (409), nicht nur als Gap gemeldet.
3. **Route liegt in der Shadow-Twin-Domäne** (nicht unter `agent-view/`) —
   die Agentensicht hat keinen eigenen Schreibpfad (F4), sie ruft nur.
4. **Alt-Form-Sidecars werden nie fortgeschrieben**: Drift-Guard prüft sie,
   der Spiegel-Write geht nur in den `_`-Ordner; fehlt der Ordner, erzeugt
   ihn der nächste Export.

## Lokale Live-Verifikation (Peter, vor Merge)

1. `bash scripts/welle-pre-merge-check.sh`
2. `pnpm dev` → Library mit Twins → **Agentensicht** → „Neu scannen".
3. Im Baum unter einem Ordner: Twin-Zeile mit Ampel + Dropdown + Verifizieren.
4. Verifizieren klicken → Ampel wird grün („Von Mensch geprüft"), in Mongo
   (read-only prüfen!) trägt das führende Artefakt `verified_by: human:<email>`
   + `verified_at`; unbekannte Frontmatter-Felder und Body unverändert.
5. Obsidian-Gegenprobe (Akzeptanzkriterium 4): Spiegel-Datei im `_`-Ordner
   zeigt dieselben Felder.
6. Drift-Test: Spiegel-Datei von Hand ändern → Verifizieren → Zeile zeigt
   409-Befund „erst importieren", nichts überschrieben.
7. Re-Scan: `twin_unverified`-Gap der Quelle ist verschwunden.

## Bekannte Punkte

- Vorbestehender roter Test (auch auf `master`):
  `tests/unit/api/libraries-me-capture-route.test.ts` (Timeout).
- Der Report zeigt Kurations-Overrides nur lokal; Wahrheit bleibt der
  explizite Scan (Leitprinzip 2).
- `upload-media`/`upload-cover-image` patchen weiterhin ohne Spiegel-Ziel
  (Bestandsverhalten, Spiegel-Write kann neben der Quelle landen) — bei
  Bedarf eigener kleiner Fix nach dem Muster der Kurations-Verdrahtung.

## Nächste Welle: 5 — MCP-Brücke (Projektauftrag §5)

KnowledgeScout als MCP-Server: Werkzeuge `erschliessen`, `pruefen`/
`reparieren`/`import`/`export`, `familie_umziehen`, `abdeckung_lesen` — dünne
Schicht über den bestehenden Services, Auth per API-Key. Damit ersetzt der
Agent den Copy-Paste-Transport des Auftrags-Generators (F3). Vorher prüfen:
Wellen 0b/0e/0f (Fahrplan) sind noch offen und könnten je nach Priorität
vorgezogen werden.
