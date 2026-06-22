# Plan (lokale Session): Deterministisches Shadow-Twin Daten- & Dateimodell — Fallbacks eliminieren

Status: ENTWURF für lokale Session
Erstellt: Remote-Session (peter.aichner)
Zielbranch lokal: von `master` (enthält die gemergten Transkript-Änderungen, in denen das Problem auftritt)

---

## 0. Ziel & Leitprinzipien

**Ziel:** Ein **deterministisches** Daten- und Dateimodell für Shadow-Twins. Genau **eine** kanonische Stelle, die „Quelle → Artefakte (transcript / transformation / …)" auflöst; **alle** Konsumenten nutzen dieses eine Objekt. **Alle Fallbacks entfernen.** Ein **Reparaturskript** bringt MongoDB + Filesystem in den konsistenten Zustand, der die Fallbacks überflüssig macht.

**Leitprinzipien:**
- **Lesen hat NIE Schreib-Nebenwirkungen.** (Heutiges Hauptübel: `lazyReconstructToMongo` / `importStorageArtifacts` schreiben beim Lesen.)
- **Eine Quelle der Wahrheit** pro Lese-Frage. Keine parallelen Resolver.
- **Kein stiller Fallback** (vgl. `no-silent-fallbacks.mdc`). Fehlt etwas → klarer Fehler/leeres Ergebnis, nicht „irgendwas Ähnliches".
- **MongoDB = primär** für die Auflösung; Filesystem ist Spiegel/Export, **nie** Lese-Quelle für „welches Artefakt ist gültig".
- **Reparatur statt Toleranz:** statt tolerante Reader bauen wir die Daten so um, dass exakte Reader genügen.

---

## 1. Aktueller Befund (aus Remote-Session, als Ausgangs-Audit)

**Konkreter Fall:** `_Ökoniomie_en_Innen.pdf` (Library „Tamera", Articles)
- **Transkript-Tab** zeigt Inhalt `# page_020.jpeg … Seite: 20` → nur **eine Seite** (Spenden-/Impressumseite), obwohl `pages: 20`.
- **Übersicht** listet als Transkript `_Ökoniomie_en_Innen.md` (ORIGINAL, **22:41**), Transformationen `…tamera.en.md` (22:32) und `…tamera-extract-en.en.md` (22:26).
- **Verdacht:** Das Transkript (22:41) ist **neuer** als die Transformationen → nach den Transformationen hat ein **Lese-getriggerter Reconstruct/Import** das (volle) Transkript mit einer **einseitigen** `{base}.md` **überschrieben**. Begünstigt durch die kürzlich gemergten Änderungen: suffixlose `{base}.md` + toleranter `pickBestTranscript` + `readTranscriptRecord` („neuester gewinnt").

**Parallele Auflösungs-Pfade (Server) — zu auditieren:**
1. `getAllArtifacts(libraryId, sourceId)` (`src/lib/repositories/shadow-twin-repo.ts`) → flache Liste; transcript via `readTranscriptRecord` (Single-Record / Legacy-Map „neuester gewinnt").
2. `ShadowTwinService.getMarkdown({kind:'transcript'})` (`src/lib/shadow-twin/store/shadow-twin-service.ts`) → MongoStore → `getShadowTwinArtifact`→`pickArtifact`→`readTranscriptRecord`; **+ Filesystem-Fallback-Store + `lazyReconstructToMongo` (SCHREIBT)**.
3. `selectShadowTwinArtifact(doc,'transcript',lang)` (`src/lib/shadow-twin/shadow-twin-select.ts`).
4. `resolveArtifact({preferredKind:'transcript'})` (`src/lib/shadow-twin/artifact-resolver.ts`) → `pickBestTranscript` (Filesystem; bevorzugt `{base}.md`, toleriert `{base}.{lang}.md`).
5. `POST /api/library/[id]/artifacts/batch-resolve` → `selectShadowTwinArtifact` + `resolveFromStorageFallback`.
6. `analyzeShadowTwin(WithService)` (`src/lib/shadow-twin/analyze-shadow-twin.ts`) → setzt `shadowTwinState.transcriptFiles`.
7. **Reconstruct/Import** (SCHREIBEN): `POST /api/library/[id]/shadow-twins/reconstruct`, `importStorageArtifacts` (`src/hooks/use-shadow-twin-analysis.ts`), `lazyReconstructToMongo`.

Plus die Loader-Kette `loadShadowTwinMarkdown('forTemplateTransformation' | 'forIngestOrPassthrough')` (`src/lib/external-jobs/phase-shadow-twin-loader.ts`) mit eigener 5–6-stufiger Prioritäten-/Fallback-Logik.

**Parallele Pfade (Client) — speisen den Transkript-Tab (`src/components/library/file-preview.tsx`):**
- `allTranscriptFiles` ← GET `/shadow-twins/<id>` (nur wenn >1 Transkript, sonst `[]`)
- `shadowTwinState.transcriptFiles` ← `/artifacts/batch-resolve` (Jotai-Atom)
- `transcript.transcriptItem` ← Hook `useResolvedTranscriptItem` (`src/components/library/shared/use-resolved-transcript-item.ts`)
- **Übersicht** (`artifact-info-panel.tsx`) liest separat GET `/shadow-twins/<id>` (`getAllArtifacts`).

---

## 2. Phase 0 — Reproduktion & Log-Audit (lokal, ZUERST)

**Logging-Quellen** (`FileLogger`, `src/lib/debug/logger.ts`):
- **Server** (API-Routes, Repo, Store, Loader, analyze): erscheinen im **`pnpm dev`-Terminal** (`console.*`). Das sind die meisten Auflösungs-/Schreibpfade.
- **Client** (`useShadowTwinAnalysis`, batch-resolve-Aufruf): **Browser-DevTools-Konsole** + **In-App-Debug-Footer** (via `subscribeToLogs`).
- Filter-Komponenten (component-Strings): `phase-shadow-twin-loader`, `shadow-twin-repo`, `mongo-shadow-twin-store`, `shadow-twin-service`/`ShadowTwinService`, `artifact-resolver`, `useShadowTwinAnalysis`, `artifacts/batch-resolve`, `shadow-twins/sync*`, `extract-only`.

**Schritt 0a — Archivverzeichnis öffnen:**
1. `pnpm dev` starten, Terminal-Log leeren.
2. Das Articles-Verzeichnis öffnen.
3. Erfassen: welche Endpunkte/Resolver feuern, **wie oft** (Redundanz!), ob **Reconstruct/Import** ausgelöst wird (Pfad 7), ob mehrere Quellen parallel analysiert werden.
4. Notieren in `docs/refactor/shadow-twin-deterministic/01-trace-open-dir.md`.

**Schritt 0b — Einzelne Datei öffnen (`_Ökoniomie_en_Innen.pdf`):**
1. Terminal-Log + Browser-Konsole leeren.
2. Datei öffnen, Transkript-Tab + Übersicht + Story-Tab je einmal anklicken.
3. Erfassen pro Tab: welcher Resolver-Pfad, welche fileId/Name, **doppelte Reads**, **Schreib-Nebenwirkungen** (suche `lazyReconstruct`, `reconstruct`, `Storage-Import`).
4. Notieren in `02-trace-open-file.md`.

**Schritt 0c — Daten-Snapshot:**
- Mongo: `db.shadow_twins__<libraryId>.findOne({ sourceId: "<id>" }, { 'artifacts.transcript': 1, sourceName:1, updatedAt:1 })` → Form (Single-Record vs Legacy-Map?), `markdown`-Länge, `updatedAt`.
- Filesystem: Inhalt des Shadow-Twin-Ordners der PDF (welche `.md`-Dateien? gibt es eine partielle `_Ökoniomie_en_Innen.md`?).
- ⚠️ **Vorher `mongodump`** der Collection.

**Erwartete Erkenntnisse:** Welche Pfade redundant feuern; ob ein Lese-Vorgang das Transkript überschreibt; ob die Daten (Mongo/FS) bereits inkonsistent sind.

---

## 3. Phase 1 — Audit-Tabelle vervollständigen

Aus Phase 0 + Code: pro Pfad (1–7 + Loader + Client) festhalten:
| Pfad | Datei/Endpoint | Lesen/Schreiben | Fallback-Kette | Konsumenten | Behalten / Ersetzen / Entfernen |

Besonders markieren:
- **Lese-Pfade mit Schreib-Nebenwirkung** → müssen entkoppelt werden.
- **Stille Fallbacks** → entfernen.
- **Toleranzen** (`pickBestTranscript`, „neuester gewinnt") → durch exakten Read ersetzen, sobald Daten repariert.

Deliverable: `03-audit.md` (vollständige Tabelle + Entscheidung je Pfad).

---

## 4. Phase 2 — Zielmodell definieren (deterministisch)

**Daten-Contract (MongoDB):**
- `artifacts.transcript` = genau **ein** `ShadowTwinArtifactRecord` (sprach-neutral). **Keine** Legacy-`{lang}`-Map mehr (per Reparatur kollabiert).
- `artifacts.transformation[templateName][targetLanguage]` = genau ein Record.
- Optional Integritäts-Invarianten: `pages > 1` ⇒ Transkript darf nicht „eine Seite" sein (Heuristik: Anzahl Seiten-Marker / Länge); sonst „needs-reextract".

**Dateimodell (Filesystem-Spiegel):**
- Deterministischer Name je Artefakt; **ein** Speicherort. Filesystem ist **Export/Spiegel**, **nie** Auflösungs-Quelle.

**Eine kanonische Auflösung:**
```ts
// Vorschlag: src/lib/shadow-twin/resolve-shadow-twin.ts
resolveShadowTwinArtifacts(libraryId, sourceId): {
  transcript: ResolvedArtifact | null,
  transformations: ResolvedArtifact[],
}
```
- **Pure read aus MongoDB**, exakt (kein Filesystem-Fallback, kein Reconstruct, kein „bestes raten").
- Alle Konsumenten (Übersicht, Transkript-Tab, Wizard `existingArtifacts`, Loader, Freshness, batch-resolve) lesen **nur** daraus.
- Client: **ein** Atom/Query, gespeist aus **einem** Endpoint, der `resolveShadowTwinArtifacts` nutzt.

**Schreiben strikt getrennt:** Reconstruct/Import nur als **explizite** Aktion (Button/Skript), nie als Lese-Nebenwirkung.

Deliverable: `04-zielmodell.md` (Contract + Resolver-Signatur + Konsumenten-Liste).

---

## 5. Phase 3 — Reparaturskript (Mongo + Filesystem)

`scripts/repair-shadow-twins.ts` (idempotent, `--dry-run`, pro Library):
1. **Transkript-Map kollabieren:** Legacy `transcript.{lang}` → Single-Record.
   - ⚠️ **WICHTIG:** **„vollständigster gewinnt", NICHT „neuester gewinnt".** (Das „neueste" war hier die kaputte Einseiten-Version — Ursache des Chaos.) Heuristik: längster `markdown` / meiste Seiten-Marker.
2. **Kaputte Transkripte erkennen & melden:** `pages > 1` aber Transkript hat nur 1 Seiten-Marker → in Report als „re-extract nötig" markieren (NICHT automatisch löschen).
3. **Filesystem-Abgleich:** verwaiste/partielle `{base}.md` erkennen; gegen Mongo-Wahrheit spiegeln oder melden.
4. **Report-first:** Dry-Run gibt Tabelle aus (Quelle, vorher/nachher, Aktion). Erst mit `--apply` schreiben.
5. **Backup-Pflicht** im Skript-Header dokumentieren.

Deliverable: Skript + `05-repair-report-beispiel.md`.

---

## 6. Phase 4 — Fallbacks entfernen (Reihenfolge wichtig)

1. `resolveShadowTwinArtifacts` einführen (+ ein Endpoint + ein Client-Atom).
2. Konsumenten umstellen (Übersicht, Transkript-Tab, Wizard, Loader-Prioritäten, Freshness, batch-resolve) → nutzen nur noch den kanonischen Resolver.
3. **Erst dann** entfernen:
   - `lazyReconstructToMongo` (Lese-Nebenwirkung) — raus.
   - `allowFilesystemFallback` beim **Lesen** — raus.
   - `pickBestTranscript`-Toleranz / „neuester gewinnt" in `readTranscriptRecord` — durch exakten Single-Record-Read ersetzen.
   - 3 Client-Transkript-Quellen → **1**.
   - Reconstruct/Import nur noch explizit (Button), nie automatisch in `useShadowTwinAnalysis`.
4. Reconstruct ist nach der Reparatur unnötig (Daten sind konsistent) → entweder entfernen oder klar als „manuelle Wartung" kennzeichnen.

---

## 7. Phase 5 — Tests & Verifikation

- **Unit:** `resolveShadowTwinArtifacts` (Single-Record vorhanden; kein Artefakt → null; Legacy-Map nach Reparatur nicht mehr nötig → optional Test, dass Legacy NICHT mehr toleriert wird).
- **Integration (lokal):** Datei öffnen → **genau ein** Resolver-Call, **keine** Schreib-Nebenwirkung in den Logs; Transkript-Tab + Übersicht zeigen **dasselbe** Artefakt (Name + Inhalt konsistent).
- `pnpm test` + `pnpm lint` grün.

---

## 8. Risiken / Stop-Bedingungen

- **Mongo-Backup vor jeder Reparatur** (`mongodump`).
- Reparatur-Heuristik „**vollständigster** gewinnt" — niemals „neuester".
- Breaking-Change am Daten-Contract: erst Resolver+Migration, dann Reader verschärfen (sonst brechen un-reparierte Libraries).
- Diff-Limits beachten (AGENTS.md): in kleine PRs schneiden (Resolver → Konsumenten → Fallback-Entfernung → Reparaturskript).

---

## 9. Start-Prompt für die lokale Session (kopierbar)

> Lies `docs/refactor/shadow-twin-deterministic/00-plan.md`. Wir arbeiten Phase 0 ab:
> 1. Starte die App lokal, öffne das Articles-Verzeichnis und danach `_Ökoniomie_en_Innen.pdf`.
> 2. Sammle die FileLogger-Ausgaben (Terminal + Browser-Konsole) für „Verzeichnis öffnen" und „Datei öffnen".
> 3. Erstelle `01-trace-open-dir.md` und `02-trace-open-file.md` mit den feuernden Auflösungs-/Schreibpfaden (welcher Resolver, welche fileId, doppelte Reads, Schreib-Nebenwirkungen).
> 4. Mache einen Mongo-Snapshot von `artifacts.transcript` der Quelle (+ `mongodump` Backup) und liste den Filesystem-Ordnerinhalt.
> Danach füllen wir die Audit-Tabelle (Phase 1) und entwerfen den kanonischen Resolver (Phase 2). Ziel: alle Fallbacks raus, ein deterministisches Modell, Reparaturskript.
