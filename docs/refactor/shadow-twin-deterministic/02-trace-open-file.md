# Phase 0b — Trace: `_Ökoniomie_en_Innen.pdf` öffnen

Status: ENTWURF (wird beim lokalen Lauf befüllt)
Reproduktion: PDF öffnen, dann **alle Tabs je einmal** anklicken (Transkript, Übersicht, Story,
Bild-/Seiten-Render-Ansichten). Log vorher geleert.

> Roh-Logs liegen in `tmp/dev-trace.log` (gitignored). Diese Datei = ausgewertete Zusammenfassung.

---

## Setup beim Lauf

- Library-Id (Tamera): `bf29edda-fdc3-4ac0-ae54-90133c2e1517`
- Collection: `shadow_twins__bf29edda-fdc3-4ac0-ae54-90133c2e1517` (dev-DB `common-knowledge-scout`)
- sourceId der PDF: `QXJ0aWNsZXMvX8OWa29uaW9taWVfZW5fSW5uZW4ucGRm` (= base64 `Articles/_Ökoniomie_en_Innen.pdf`)
- Storage: **nextcloud** (WebDAV), Pfad `/OffenesOhr/Tapping into Abundance/Tamera`
- shadowTwin-Config: `mode=v2, primaryStore=mongo, persistToFilesystem=true, allowFilesystemFallback=true`
- Erwartung (aus §1 Plan): Transkript-Inhalt = nur Seite 20, obwohl `pages: 20`. → **BESTÄTIGT**, siehe 0c.

---

## Mongo-Snapshot (Phase 0c) — BEFUND (2026-06-23, dev-DB)

Backup: `tmp/mongodump-dev-20260623-000816/` (ganze Collection, 56 Dokumente). Read-only, kein Write.

**Artefakte der Quelle:**

| Artefakt | Form | Länge | Seiten-Marker | updatedAt | fm.pages |
|---|---|---|---|---|---|
| `transcript` | single-record | **908** | **2** | **2026-06-22T20:41:34Z** | (leeres FM) |
| `transformation[tamera-extract-en][en]` | record | 11475 | 0 | 2026-06-22T20:26:27Z | 20 |
| `transformation[tamera][en]` | record | 4490 | 0 | 2026-06-22T20:32:15Z | 20 |
| `binaryFragments` | — | 0 Fragmente | — | — | — |

**Schlüssel-Beobachtungen:**
1. **Transkript ist NACH den Transformationen geschrieben** (20:41 > 20:32 > 20:26). Ein Transkript,
   aus dem Transformationen abgeleitet werden, kann nicht später entstehen → **ein Write hat das
   Transkript um 20:41 überschrieben.**
2. **Transkript ist KEIN Legacy-Map**, sondern ein Single-Record → die „neuester-gewinnt"-Toleranz
   in `readTranscriptRecord` ist hier NICHT der Täter. Täter ist ein **Write beim Lesen**.
3. **Transkript-Inhalt = genau eine Seite** (`page_020.jpeg`, Spenden-/Impressumseite), 908 Zeichen.
   Interner Stempel im Markdown: „*Automatisch erstellt am 19.5.2026, 15:08:47*" → es wurde ein
   **alter Mai-Artefakt** als Transkript reingeschrieben (vom Storage importiert).
4. **`binaryFragments: 0`** → die Seiten-JPGs liegen nicht in Mongo, sondern im Nextcloud-Storage.
5. **Config-Beweis:** `allowFilesystemFallback=true` + `persistToFilesystem=true` = der Pfad, über
   den ein Read auf den Storage fällt, die alte `.md` findet und per `lazyReconstructToMongo`
   zurückschreibt.

**Transkript-Inhalt (gekürzt, als Beleg):**
```
# page_020.jpeg
## Quelle
**PDF-Datei:** _Ökoniomie_en_Innen.pdf
**Bild:** page_020.jpeg
**Seite:** 20
## Extrahierter Text
PORTUGAL: Associação para um mundo humanitário … (Spenden-/Impressumseite)
---
*Automatisch erstellt am 19.5.2026, 15:08:47*
```

### Mechanismus (Code-Beleg, statisch bestätigt)

**Zwei automatische Write-on-Read-Pfade feuern beim Öffnen:**

1. **Client-Auto-Reconstruct (Haupttäter)** — `src/hooks/use-shadow-twin-analysis.ts`
   - `useEffect` (Z.124) startet beim Öffnen die Bulk-Analyse (batch-resolve).
   - Liefert die Auflösung ein Transkript/Transformation mit **echter Storage-ID** (nicht Mongo-virtuell),
     gilt es als „aus Filesystem-Fallback gefunden" → `foundFromStorage` (Z.383–388) →
     `storageImportTargets.push(...)`.
   - Z.443: `void importStorageArtifacts(...)` (fire-and-forget) → `POST /shadow-twins/reconstruct` (Z.52)
     → schreibt den Storage-Inhalt nach Mongo. **Das überschreibt `artifacts.transcript`.**
   - D.h.: Solange die veraltete suffixlose `_Ökoniomie_en_Innen.md` (Mai) physisch im Nextcloud-Ordner
     liegt, findet der Storage-Fallback sie, gibt sie als Transkript zurück → Auto-Reconstruct schreibt
     die Einzelseite bei **jedem Öffnen** erneut nach Mongo.

2. **Server-Lazy-Reconstruct** — `src/lib/shadow-twin/store/shadow-twin-service.ts:225` (`getMarkdown`)
   - Mongo-Miss → bei `allowFilesystemFallback` aus FS lesen → `lazyReconstructToMongo` (Z.246/266)
     schreibt den FS-Inhalt nach Mongo. Greift, wenn Mongo den Key gerade nicht hat.

**Gemeinsame Wurzel:** Storage-Fallback beim Lesen + automatisches Zurückschreiben + eine veraltete
`{base}.md` im Storage. Beseitigt durch Plan-Phase 4 (Fallback/Auto-Reconstruct raus) + Phase 3
(Reparatur: stale `{base}.md` entfernen/ersetzen, „vollständigster gewinnt").

**Noch live zu erfassen (0a/0b):** Bestätigen, dass für DIESE Datei Pfad 1 (und/oder 2) feuert;
Redundanz/Anzahl Calls + Timing (Performance-Baseline); WebDAV-Inhalt des Tamera-Ordners
(liegt dort die partielle `_Ökoniomie_en_Innen.md` + `page_NNN.md`/`page_NNN.jpeg`?).

---

## Auflösung pro Artefakt-Familie & Tab

### Markdown — Transkript-Tab
| Resolver-Pfad | Component-String | fileId / Name | Calls | doppelte Reads | Schreib-Nebenwirkung |
|---|---|---|---|---|---|
| | | | | | |

### Markdown — Übersicht (ArtifactInfoPanel)
| Resolver-Pfad | Component-String | fileId / Name | Calls | Auffälligkeit |
|---|---|---|---|---|
| | | | | |

### Markdown — Story-Tab
| Resolver-Pfad | Component-String | fileId / Name | Calls | Auffälligkeit |
|---|---|---|---|---|
| | | | | |

### Binär — Bilder / Seiten-Renders (`resolve-binary-url`)
| Resolver-Pfad | Component-String | fragment (name/variant) | Calls | Fallback ausgelöst |
|---|---|---|---|---|
| | | | | |

---

## Kernfragen (mit Belegen beantwortet — Live-Trace 2026-06-23)

1. **Schreibt ein Lese-Vorgang das Transkript?** — In diesem Lauf **NEIN**: über das ganze 0b kein
   `reconstruct`, kein `upsert`, kein `Lazy` (Whole-Log-Suche, 0 Treffer). **ABER** der Mechanismus
   existiert (siehe „Mechanismus") und feuert bei **Mongo-Miss** → das war der ursprüngliche
   20:41-Overwrite. Steady-State (Mongo hat den kaputten Record) ⇒ kein erneuter Write.
2. **Zeigen Transkript-Tab und Übersicht dasselbe Artefakt?** — Ja, **dieselbe Quelle**: Übersicht
   liest `GET /shadow-twins/<id>` (getAllArtifacts), Transkript-Tab lädt `GET /shadow-twins/content?kind=transcript`
   (denselben Mongo-Record, 908 Z., `page_020`). Der Listen-Titel „Donation Information: Associação…"
   ist aus eben dieser Einzelseite abgeleitet → Korruption ist bis in Galerie/Liste sichtbar.
   **Augenschein (User, 2026-06-23) bestätigt:** der Transkript-Tab zeigte nur die eine Spendenseite,
   nicht 20 Seiten.
3. **Wie viele unabhängige Resolver-Calls?** — Für **eine** geöffnete Datei feuern parallel:
   `GET artifacts/resolve` (preferredKind=transcript, **6964 ms**), `POST artifacts/batch-resolve`
   (selectShadowTwinArtifact), **`GET /shadow-twins/<id>` ZWEIMAL** (getAllArtifacts, redundant),
   `POST /shadow-twins/freshness`, `GET ingestion-status` (2×), `GET nextcloud?action=binary`.
   → mehrere überlappende Auflöse-Pfade für dieselbe Quelle.
4. **Wird `page_NNN.md` als Leser angefasst?** — **Nein** (kein Log-Treffer) → bestätigt totes Gewicht.

## Auflösung pro Tab (Live-Trace 2026-06-23, Server-Logs)

| Tab | Resolver-Endpoint | Dauer | Auffälligkeit |
|---|---|---|---|
| Original (öffnen) | `GET artifacts/resolve?preferredKind=transcript&targetLanguage=de` | 894 ms (einmal 6964 ms) | + `GET /shadow-twins/<id>` 2× |
| **Transkript** | `GET /shadow-twins/content?kind=transcript&targetLanguage=en` | **2658 ms** | lädt den (kaputten) 908-Z.-Record |
| **Transformation** | `GET /shadow-twins/content?kind=transformation&templateName=tamera&targetLanguage=en` | 347 ms | — |
| **Übersicht** | `GET /shadow-twins/<id>` (getAllArtifacts) | bis **6355 ms** | **4× wiederholt** über die Session |
| **Story** | löst `POST batch-resolve` + `POST binary-fragments` aus | **11568 ms** / **14719 ms** | re-triggert Verzeichnis-Level-Arbeit + Bild-Storm |

## Performance-Baseline (Datei + Tabs, Live 2026-06-23)

- **Writes: 0** über das ganze 0b (kein `reconstruct`/`upsert`/`Lazy`, Whole-Log).
- **Massive Redundanz pro Datei-Session:** `artifacts/resolve` 2×, `getAllArtifacts` 4×,
  `sibling-files` 2×, `freshness` 2× (1098 + 1951 ms), `batch-resolve` 2× (6088 + **11568 ms**),
  plus `binary-fragments` **14719 ms** und dutzende `resolve-binary-url`.
- **Tab-Wechsel re-triggert Verzeichnis-Level-Arbeit:** Story löst ein erneutes `batch-resolve`
  über den ganzen Ordner + einen Bild-Storm aus — Hauptgrund für „dauert ewig" auch innerhalb einer Datei.
- **Sprach-Inkonsistenz:** `artifacts/resolve` nutzt `targetLanguage=de`, `shadow-twins/content`
  nutzt `targetLanguage=en` — zwei Pfade, zwei Sprachannahmen für dieselbe Quelle.
- **Clerk-Auth:** jeder Call `(cache skip)`, je ~160–380 ms → summiert erheblich.
- Render-Zyklus laut Client-Log: **42411 ms** „Gesamter Render-Zyklus".

## Befund (Zusammenfassung)

- **Root Cause bestätigt:** Das Transkript wurde durch einen **Write-on-Read** auf eine veraltete
  Einzelseite (`page_020`, Mai-Artefakt) überschrieben — ausgelöst bei **Mongo-Miss** über
  Client-Auto-Reconstruct (`importStorageArtifacts`→`reconstruct`) bzw. Server-`lazyReconstructToMongo`,
  begünstigt durch `allowFilesystemFallback: true` + eine stale `_Ökoniomie_en_Innen.md` im Nextcloud.
- **Steady-State:** Beim normalen Öffnen heute **0 Writes** — der Schaden ist schon angerichtet und
  persistent in Mongo. Reparatur (Phase 3) nötig, nicht nur Fallback-Entfernung.
- **Mehrere überlappende Resolver** für dieselbe Quelle (`artifacts/resolve` + `batch-resolve` +
  `getAllArtifacts` 2×) → bestätigt die fehlende „eine Quelle der Wahrheit".
- **Korruption bis ins UI:** Listen-/Galerie-Titel = aus der Einzelseite abgeleitet
  („Donation Information…").
- **Performance:** Datei-Resolve ~7 s; Verzeichnis-Render-Zyklus ~42 s; dominiert von serieller
  Nextcloud-Binär-Auflösung + Provider-Cache-Thrashing + un-gecachter Clerk-Auth (siehe 01).
- **`page_NNN.md`:** kein Leser → totes Gewicht (bestätigt).

## Roh-Log-Auszüge (relevante Zeilen)

```
<einfügen>
```
