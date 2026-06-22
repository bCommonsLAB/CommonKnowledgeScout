# Plan (lokale Session): Deterministisches Shadow-Twin Daten- & Dateimodell — Fallbacks eliminieren

Status: ENTWURF für lokale Session
Erstellt: Remote-Session (peter.aichner)
Zielbranch lokal: von `master` (enthält die gemergten Transkript-Änderungen, in denen das Problem auftritt)
Umfang (erweitert 2026-06-22): **ALLE Artefakte**, nicht nur `transcript`. Entscheidung des
Users in lokaler Session: Untersuchung in EINEM Wasch, Reparatur in Familien (siehe §1a, §4).

---

## 0. Ziel & Leitprinzipien

**Ziel:** Ein **deterministisches** Daten- und Dateimodell für Shadow-Twins über **alle
Artefakt-Familien** (Markdown: transcript / transformation / canonical / raw — sowie Binär:
Bilder, Seiten-Renders, previews/thumbnails). Genau **eine** kanonische Stelle, die „Quelle →
Artefakte" auflöst; **alle** Konsumenten nutzen dieses eine Objekt. **Alle Fallbacks entfernen.**
Ein **Reparaturskript** bringt MongoDB + Filesystem in den konsistenten Zustand, der die
Fallbacks überflüssig macht. **Zugleich Performance-Ziel:** Verzeichnis- und Datei-Öffnen sind
heute spürbar langsam — die vielen redundanten, parallelen Resolver-Calls (mehrfache Reads pro
Datei, Storage-Fallbacks, Lese-getriggerte Reconstructs) sind ein Hauptkostentreiber. Weniger
Pfade = weniger I/O = schneller. Performance ist ein **explizites Abnahmekriterium** (§7).

**Leitprinzipien:**
- **Lesen hat NIE Schreib-Nebenwirkungen.** (Heutiges Hauptübel: `lazyReconstructToMongo` / `importStorageArtifacts` schreiben beim Lesen.)
- **Eine Quelle der Wahrheit** pro Lese-Frage. Keine parallelen Resolver.
- **Schnell durch Determinismus:** genau **ein** Resolver-Call pro Frage, **ein** DB-Read statt N Fallback-Versuche, **kein** Storage-Roundtrip beim Lesen. Redundanz ist sowohl Korrektheits- als auch Performance-Bug.
- **Kein stiller Fallback** (vgl. `no-silent-fallbacks.mdc`). Fehlt etwas → klarer Fehler/leeres Ergebnis, nicht „irgendwas Ähnliches".
- **MongoDB = primär** für die Auflösung; Filesystem ist Spiegel/Export, **nie** Lese-Quelle für „welches Artefakt ist gültig".
- **Reparatur statt Toleranz:** statt tolerante Reader bauen wir die Daten so um, dass exakte Reader genügen.

---

## 1. Aktueller Befund (aus Remote-Session, als Ausgangs-Audit)

**Konkreter Fall:** `_Ökoniomie_en_Innen.pdf` (Library „Tamera", Articles)
- **Transkript-Tab** zeigt Inhalt `# page_020.jpeg … Seite: 20` → nur **eine Seite** (Spenden-/Impressumseite), obwohl `pages: 20`.
- **Übersicht** listet als Transkript `_Ökoniomie_en_Innen.md` (ORIGINAL, **22:41**), Transformationen `…tamera.en.md` (22:32) und `…tamera-extract-en.en.md` (22:26).
- **Verdacht:** Das Transkript (22:41) ist **neuer** als die Transformationen → nach den Transformationen hat ein **Lese-getriggerter Reconstruct/Import** das (volle) Transkript mit einer **einseitigen** `{base}.md` **überschrieben**. Begünstigt durch die kürzlich gemergten Änderungen: suffixlose `{base}.md` + toleranter `pickBestTranscript` + `readTranscriptRecord` („neuester gewinnt").

> **BESTÄTIGT durch Daten (Phase 0c, 2026-06-23, dev-DB)** — Details in `02-trace-open-file.md`:
> - libraryId `bf29edda-…`, Collection `shadow_twins__bf29edda-…`, sourceId `QXJ0aWNsZXMv…` (`Articles/_Ökoniomie_en_Innen.pdf`).
> - `transcript`: single-record, **908 Zeichen, 1 Seite** (`page_020.jpeg`), `updatedAt 2026-06-22T20:41:34Z` (= 22:41 lokal). Transformationen 20:26 / 20:32 → **Transkript ist nachweislich später geschrieben.**
> - **Korrektur zum Verdacht:** Es ist **kein** Legacy-Map → die „neuester-gewinnt"-Toleranz in `readTranscriptRecord` ist hier NICHT der Täter. Täter ist ein **Write beim Lesen** (zwei Pfade, Code-Beleg in `02-trace-open-file.md`): **(1) Client-Auto-Reconstruct** — `use-shadow-twin-analysis.ts` ruft beim Öffnen automatisch `importStorageArtifacts` → `POST /shadow-twins/reconstruct` für jede Quelle, deren Artefakt eine echte Storage-ID hat (`foundFromStorage`); **(2) Server-`lazyReconstructToMongo`** in `getMarkdown` bei Mongo-Miss. Beide ausgelöst durch Library-Config **`allowFilesystemFallback: true` + `persistToFilesystem: true`** (Storage = Nextcloud/WebDAV) + eine **veraltete suffixlose `_Ökoniomie_en_Innen.md`** im Storage. Der Markdown-Inhalt trägt intern „erstellt am 19.5.2026" → alter Storage-Artefakt importiert.
> - `binaryFragments: 0` (Seiten-JPGs nur im Storage). `filesystemSync.enabled: false`.
> - ⚠️ **Security-Nebenbefund:** Nextcloud-`appPassword` liegt **im Klartext** in der Library-Config (MongoDB) — verstößt gegen die Secret-Masking-Regel; separat beheben.

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

## 1a. Artefakt-Universum (verifiziert, lokale Session 2026-06-22)

Der Shadow-Twin ist **mehr** als das Transkript. Es gibt **drei Familien** (Code-Beleg
`src/lib/shadow-twin/artifact-types.ts:28` + `store/shadow-twin-store.ts`):

| Familie | Konkret | Speicher | Auflöse-Logik | Risiko |
|---|---|---|---|---|
| **Markdown** | `transcript`, `transformation`, `canonical`, `raw` | MongoDB `artifacts.*` | mehrere parallele Pfade, geteilte Funktionen (`selectShadowTwinArtifact`, `resolveArtifact`, `readTranscriptRecord`) | **HOCH** — transcript (Chaos-Zentrum) + transformation (latent dieselbe Krankheit) |
| **Binär** | eingebettete Bilder, Seiten-Renders (`page_NNN.jpeg`, `variant='page-render'`, `pageNumber`), `preview`, `thumbnail` | MongoDB-Fragmente + Azure/Storage | 1 Lookup + Alias-Abgleich (Name/URL/Hash) + 3 **Lese**-Fallbacks | NIEDRIG — Fallbacks lesen nur, **kein** Zurückschreiben |
| **Zwischendaten** | per-Seite-Markdown (`page_NNN.md`) | nur Arbeitsverzeichnis | bewusst **nicht** als Artefakt registriert | — siehe unten |

**Per-Seite-Markdown (`page_NNN.md`) = totes Gewicht (bestätigt):**
- Erzeugt in `src/lib/transform/image-extraction-service.ts` (`page_NNN.md`).
- **Absichtlich nicht** in Mongo registriert: `reconstruct-from-storage.ts` überspringt Dateien,
  die nicht mit `{sourceBaseName}.` beginnen; `shadow-twins/migrate` warnt, rohe Seiten-OCR würde
  „das echte Transkript überschreiben".
- **Einziger Leser:** `src/lib/pdf/page-filename-heuristic.ts` (Ableitung sprechender Dateinamen)
  + `markdown-page-splitter.ts` (Seiten-Marker im **Transkript**, nicht die `.md`-Dateien selbst).
- → Nicht im Datenmodell, nicht im UI sichtbar. **Kandidat: nicht mehr erzeugen / nur Arbeitsdatei.**

**Auflöse-Pfade pro Markdown-Typ (zu auditieren in Phase 1):**
- `transcript`: 3+ Pfade (Mongo-Legacy-Toleranz `readTranscriptRecord`, Filesystem-Fallback
  `pickBestTranscript`, `ShadowTwinService`-Orchestrierung) **+ Schreib-Nebenwirkung** `lazyReconstructToMongo`.
- `transformation`: 2 Pfade (Mongo-direkt + `resolveArtifact`); Toleranz „ohne Template-Name →
  neuestes gewinnt" = dieselbe Bauart wie transcript, nur (noch) nicht eskaliert.
- `canonical` / `raw`: je 1 Pfad (Mongo-direkt), kaum genutzt.

**Binär-Auflösung (gesünder, eigene Spur):** `POST /shadow-twins/resolve-binary-url`
(`matchBinaryFragmentByLookupName`, `binary-fragment-lookup.ts`) → Mongo-Fragmentliste →
Shadow-Folder → Sibling. Fallbacks vorhanden, aber **read-only** → nicht zerstörerisch.

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
4. **Performance messen (Baseline):** Wall-Clock bis Verzeichnis sichtbar; Anzahl HTTP-Calls + langsamste Calls (Network-Tab / `preview_network`); Calls **pro Datei** (skaliert die Liste linear?).
5. Notieren in `docs/refactor/shadow-twin-deterministic/01-trace-open-dir.md`.

**Schritt 0b — Einzelne Datei öffnen (`_Ökoniomie_en_Innen.pdf`):**
1. Terminal-Log + Browser-Konsole leeren.
2. Datei öffnen, **alle** Tabs je einmal anklicken: Transkript, Übersicht, Story, **und alle, die
   Bilder/Seiten-Renders zeigen** (inline-Bilder im Markdown, preview/thumbnail).
3. Erfassen pro Tab — für **jede Artefakt-Familie**: welcher Resolver-Pfad, welche fileId/Name,
   **doppelte Reads**, **Schreib-Nebenwirkungen** (suche `lazyReconstruct`, `reconstruct`,
   `Storage-Import`, `resolve-binary-url`).
4. **Performance messen (Baseline):** Wall-Clock je Tab bis Inhalt sichtbar; Anzahl + Dauer der
   HTTP-Calls pro Tab; markieren, welche Calls den Tab-Wechsel blockieren (synchron) und welche
   redundant sind.
5. Notieren in `02-trace-open-file.md` — getrennt nach Familie (Markdown / Binär), plus „feuert
   per-Seite-`page_NNN.md` irgendwo als Leser?" (Erwartung: nein).

**Schritt 0c — Daten-Snapshot (alle Artefakte):**
- Mongo, ganzes Dokument der Quelle:
  `db.shadow_twins__<libraryId>.findOne({ sourceId: "<id>" }, { artifacts:1, binaryFragments:1, sourceName:1, updatedAt:1 })`
  → pro Artefakt: Form (Single-Record vs Legacy-Map?), `markdown`-Länge, `updatedAt`; bei
  `transformation` die Template×Sprache-Map; bei Binär die Fragment-Liste (`variant`, `pageNumber`).
- Filesystem: Inhalt des Shadow-Twin-Ordners der PDF (welche `.md`, welche `page_NNN.jpeg`,
  welche `page_NNN.md`? gibt es eine partielle `_Ökoniomie_en_Innen.md`?).
- ⚠️ **Vorher `mongodump`** der Collection.

**Erwartete Erkenntnisse:** Welche Pfade redundant feuern (pro Familie); ob ein Lese-Vorgang ein
Artefakt überschreibt (transcript, evtl. transformation); ob die Daten (Mongo/FS) inkonsistent
sind; wie viele verwaiste `page_NNN.md` herumliegen.

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

**Daten-Contract (MongoDB) — ganze Markdown-Familie:**
- `artifacts.transcript` = genau **ein** `ShadowTwinArtifactRecord` (sprach-neutral). **Keine** Legacy-`{lang}`-Map mehr (per Reparatur kollabiert).
- `artifacts.transformation[templateName][targetLanguage]` = genau ein Record.
- `artifacts.canonical[targetLanguage]` / `artifacts.raw` = je genau ein Record (heute schon 1 Pfad — mit aufnehmen, damit sie nicht später driften).
- Optional Integritäts-Invarianten: `pages > 1` ⇒ Transkript darf nicht „eine Seite" sein (Heuristik: Anzahl Seiten-Marker / Länge); sonst „needs-reextract".

**Binär-Familie (eigene, gesündere Spur):** Auflösung bleibt bei `resolve-binary-url` /
`matchBinaryFragmentByLookupName`, wird aber in denselben Contract eingehängt (read-only, kein
Reconstruct beim Lesen). Niedrigere Priorität — erst nach der Markdown-Familie anfassen.

**Per-Seite-`page_NNN.md`:** Einzelentscheidung in `04-zielmodell.md` festhalten — nicht mehr
erzeugen ODER explizit als „Arbeitsdatei, nie Artefakt" kennzeichnen. Keine Auflöse-Logik nötig.

**Dateimodell (Filesystem-Spiegel):**
- Deterministischer Name je Artefakt; **ein** Speicherort. Filesystem ist **Export/Spiegel**, **nie** Auflösungs-Quelle.

**Eine kanonische Auflösung (deckt alle Markdown-Artefakte ab):**
```ts
// Vorschlag: src/lib/shadow-twin/resolve-shadow-twin.ts
resolveShadowTwinArtifacts(libraryId, sourceId): {
  transcript: ResolvedArtifact | null,
  transformations: ResolvedArtifact[],   // alle Template×Sprache
  canonical: ResolvedArtifact[],         // pro Sprache
  raw: ResolvedArtifact | null,
  binaries: ResolvedBinaryFragment[],    // read-only-Spur, optional zunächst separat
}
```
- **Pure read aus MongoDB**, exakt (kein Filesystem-Fallback, kein Reconstruct, kein „bestes raten").
- Alle Konsumenten (Übersicht, Transkript-Tab, Wizard `existingArtifacts`, Loader, Freshness, batch-resolve) lesen **nur** daraus.
- Client: **ein** Atom/Query, gespeist aus **einem** Endpoint, der `resolveShadowTwinArtifacts` nutzt.

**Schreiben strikt getrennt:** Reconstruct/Import nur als **explizite** Aktion (Button/Skript), nie als Lese-Nebenwirkung.

Deliverable: `04-zielmodell.md` (Contract + Resolver-Signatur + Konsumenten-Liste + per-Seite-md-Entscheidung).

---

## 5. Phase 3 — Reparaturskript (Mongo + Filesystem)

`scripts/repair-shadow-twins.ts` (idempotent, `--dry-run`, pro Library):
1. **Transkript-Map kollabieren:** Legacy `transcript.{lang}` → Single-Record.
   - ⚠️ **WICHTIG:** **„vollständigster gewinnt", NICHT „neuester gewinnt".** (Das „neueste" war hier die kaputte Einseiten-Version — Ursache des Chaos.) Heuristik: längster `markdown` / meiste Seiten-Marker.
2. **Transformation/canonical normalisieren:** sicherstellen, dass `transformation[template][lang]`
   und `canonical[lang]` je genau ein Record sind (Duplikate/Toleranz-Reste entfernen, „neuester gewinnt"
   nur hier zulässig, da diese user-autored sind — im Report ausweisen).
3. **Kaputte Transkripte erkennen & melden:** `pages > 1` aber Transkript hat nur 1 Seiten-Marker → in Report als „re-extract nötig" markieren (NICHT automatisch löschen).
4. **Filesystem-Abgleich:** verwaiste/partielle `{base}.md` erkennen; **verwaiste `page_NNN.md`
   zählen/melden** (Kandidaten zum Löschen, nicht automatisch). Gegen Mongo-Wahrheit spiegeln oder melden.
5. **Report-first:** Dry-Run gibt Tabelle aus (Quelle, vorher/nachher, Aktion). Erst mit `--apply` schreiben.
6. **Backup-Pflicht** im Skript-Header dokumentieren.

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
- **Performance (Abnahmekriterium):** dieselbe Messung wie Phase 0 (0a/0b) wiederholen und
  vergleichen — Ziel: deutlich weniger HTTP-Calls pro Datei (Redundanz weg), spürbar schnelleres
  Verzeichnis- und Datei-Öffnen, **0** Schreib-Calls beim Lesen. Vorher/Nachher-Zahlen in
  `05-`/Verifikations-Doc festhalten.
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
