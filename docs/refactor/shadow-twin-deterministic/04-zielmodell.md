# Phase 2 — Zielmodell: kanonischer Resolver + Daten-Contract

Status: ENTWURF (2026-06-23, baut auf 01/02/03 auf)
Leitprinzipien: **Lesen ohne Schreib-Nebenwirkung · eine Quelle der Wahrheit · kein stiller Fallback ·
schnell durch Determinismus** (vgl. `00-plan.md` §0).

---

## 1. Daten-Contract (MongoDB = primär)

Pro Quelle genau ein Dokument `shadow_twins__<libraryId>` (`sourceId` unique). Form je Familie:

| Artefakt | Form | Regel |
|---|---|---|
| `artifacts.transcript` | genau **ein** `ShadowTwinArtifactRecord` (sprach-neutral) | **keine** Legacy-`{lang}`-Map mehr (Reparatur kollabiert sie) |
| `artifacts.transformation[template][lang]` | genau ein Record | je (Template × Sprache) eindeutig |
| `artifacts.canonical[lang]` / `artifacts.raw` | je ein Record (heute selten) | mitführen, nicht driften lassen |
| `binaryFragments[]` | je Fragment **mit persistierter `url`** (Azure) oder `fileId` | **kein Live-WebDAV beim Lesen** (Fix P1) |

**Integritäts-Invariante (optional, Gate):** `pages > 1` ⇒ Transkript-Markdown darf nicht „eine Seite"
sein (Heuristik: Seiten-Marker/Länge). Sonst Status `needs-reextract` (nicht stumm tolerieren).

**Filesystem/Storage = Spiegel/Export, NIE Auflösungs-Quelle** für „welches Artefakt ist gültig".

---

## 2. Eine kanonische Auflösung

```ts
// Neu: src/lib/shadow-twin/resolve-shadow-twin.ts
export interface ResolvedShadowTwin {
  transcript: ResolvedArtifact | null
  transformations: ResolvedArtifact[]   // alle Template×Sprache
  canonical: ResolvedArtifact[]
  raw: ResolvedArtifact | null
  binaries: ResolvedBinaryFragment[]    // read-only-Spur, URLs aus Mongo
}

export async function resolveShadowTwinArtifacts(
  libraryId: string,
  sourceId: string,
): Promise<ResolvedShadowTwin>
```

**Eigenschaften:**
- **Pure read aus MongoDB**, exakt — baut auf dem sauberen Pfad `getAllArtifacts` / `pickArtifact`
  (= heutiges `shadow-twins/content` GET, L1 im Audit). **Kein** `resolveArtifact`/`pickBest*` (Storage),
  **kein** `reconstructFromFolder`, **kein** `lazyReconstruct`, **kein** „bestes raten".
- **Kein stiller Fallback:** fehlt ein Artefakt → `null`/leeres Array, klar, nicht „etwas Ähnliches".
- **Eine Sprach-Quelle:** targetLanguage einmal bestimmt (Fix P8 — kein de/en-Drift).
- **Performance:** ein DB-Read pro Quelle; für Listen ein Batch-Read (`getShadowTwinsBySourceIds`),
  Binär-URLs kommen mit (keine N serielle WebDAV-Calls, Fix P1/P2/P3).

**Ein Endpoint, ein Client-Atom:**
- Server: ein Endpoint (z.B. `GET /shadow-twins/<id>/resolved` bzw. der vorhandene `content`/`[sourceId]`
  konsolidiert) nutzt `resolveShadowTwinArtifacts`.
- Client: **ein** Jotai-Atom/Query, gespeist aus diesem einen Endpoint. Ersetzt die 3 Transkript-Quellen
  (Audit D) und die Übersicht-Doppel-Calls.

---

## 3. Schreiben strikt getrennt (kein Write-on-Read)

| Heute | Ziel |
|---|---|
| `getMarkdown`→`lazyReconstructToMongo` (W1) | **entfernen** |
| `artifacts/resolve` GET → `reconstructFromFolder` (W2) | **Write raus**; GET wird reiner Read (oder entfällt zugunsten Resolver) |
| Client `importStorageArtifacts`→`reconstruct` auto beim Öffnen (W3) | **nur noch explizit** (Button „Aus Storage importieren") |
| `reconstruct` / `sync-*` (W4/W7) | bleiben, aber **nur explizit** ausgelöst |

→ Nach diesem Schnitt kann **kein Lesen** je ein Artefakt überschreiben (der 20:41-Vorfall wird unmöglich).

---

## 4. Konsumenten-Migration (alle lesen nur noch den Resolver)

| Konsument | Heute | Nachher |
|---|---|---|
| Transkript-Tab | `useResolvedTranscriptItem`→`artifacts/resolve` (Write!) | Resolver-Atom |
| Übersicht (`artifact-info-panel`) | `GET /shadow-twins/<id>` + `GET /content` | Resolver-Atom |
| file-list Bulk (`use-shadow-twin-analysis`) | `batch-resolve` (FS-Scan) | Batch-Resolver (pur Mongo) |
| Wizard `existingArtifacts` | resolve/select gemischt | Resolver |
| Pipeline-Loader (`loadShadowTwinMarkdown`) | 5-stufige Prioritäten | Resolver (transcript für Transformation; klare Fehler statt Fallback) |
| Freshness-Banner | eigener Pfad | Resolver-Daten + expliziter Compare |
| Bilder/Galerie | `resolve-binary-url`/`binary-fragments` live | Resolver-`binaries` (URLs aus Mongo) |

---

## 5. Binär-Spur (eigene, gesündere Spur)

- **Fragment-URLs bei jedem Write in Mongo persistieren** (P1) → Lesen rein aus Mongo.
- `resolve-binary-url`/`binary-fragments`: **parallelisieren** + nur als Fallback wenn Mongo-Fragment
  fehlt (nach Reparatur selten). `getStreamingUrl`-Schleife → `Promise.all` (P3).
- read-only, **nie** Reconstruct beim Lesen.

## 6. per-Seite-`page_NNN.md`

Kein Leser (0b bestätigt). **Entscheidung:** nicht mehr erzeugen (oder klar als Arbeitsdatei kennzeichnen,
nie als Artefakt registrieren). Seiten-Renders `page_NNN.jpeg` bleiben — als Mongo-`binaryFragment`.

---

## 7. Performance-Anforderungen (Abnahme, vgl. 00-plan §7)

Gemessen gegen die Baseline (01/02):
- Verzeichnis öffnen: **ein** Batch-Read (Mongo) statt 1 batch-resolve + 23 serielle WebDAV-Calls.
- Datei öffnen: **ein** Resolver-Call; getAllArtifacts/resolve/freshness **nicht** mehrfach.
- Tab-Wechsel: **kein** erneutes Verzeichnis-`batch-resolve` (P6 — Tab-State entkoppeln).
- **0** Schreib-Calls beim Lesen.
- Provider-Cache-Key fixen (P4); Clerk-Auth serverseitig cachen (P5).

## 8. Migrations-Reihenfolge (Breaking-Change vermeiden)

1. **Resolver + ein Endpoint + ein Atom** einführen (additiv, nichts entfernt).
2. Konsumenten umstellen (Tab, Übersicht, Bulk, Wizard, Loader, Freshness, Bilder).
3. **Reparaturskript** (Phase 3) laufen lassen — Daten konsistent machen
   („vollständigster gewinnt"), stale `{base}.md` entfernen.
4. **Erst dann** Reader verschärfen / Fallbacks entfernen (W1/W2, F4–F6, `allowFilesystemFallback`,
   `readTranscriptRecord`-Legacy-Toleranz, 3 Client-Quellen → 1).
5. Reconstruct/Import nur noch explizit.

> Reihenfolge wichtig: erst Resolver+Migration, dann Reader verschärfen — sonst brechen
> un-reparierte Libraries (Legacy-Map, fehlende Fragment-URLs).

---

## 9. Storage-Contract & Reconcile (Entscheidungen 2026-06-23)

**Grundsatz:** Auch der **Storage** wird repariert, nicht nur Mongo. Der Storage ist die dauerhafte
Quelle — ist er inkonsistent (volle `.en.md` + kaputte `.md` nebeneinander), bleibt jede Mongo-Reparatur
fragil. Ziel: deterministisches, kanonisches Layout im Storage **und** in Mongo.

### 9.1 Kanonisches Storage-Layout (pro Quelle, im Shadow-Twin-Ordner)

| Artefakt | Kanonischer Dateiname | Regel |
|---|---|---|
| Transkript | **`{base}.md`** (suffixlos, sprach-neutral) | **genau eine** Datei; Inhalt = vollständigste Variante |
| Transformation | `{base}.{template}.{lang}.md` | je Template×Sprache eine |
| canonical / raw | `{base}.canonical.{lang}.md` / `{base}.raw.{ext}` | wie gehabt |
| Seiten-Render | `page_NNN.jpeg` | **behalten** (als Mongo-`binaryFragment` registrieren) |
| per-Seite-Markdown | `page_NNN.md` | **entfernen** (totes Gewicht) |
| Vorschau/Thumbnail | `preview_NNN.jpg` / Thumbnail | wie bestehend |

### 9.2 Geteilte Auswahl `selectBestArtifactVariant` (Kern-Fix, ersetzt suffixlos/neuer)

- **Input:** alle Kandidaten einer Quelle — Storage `{base}.md` + `{base}.{lang}.md` **und** Mongo-Record.
- **Regel:** **vollständigster gewinnt** = max( Seiten-Marker-Anzahl, dann Markdown-Länge ).
  **Nicht** suffixlos-bevorzugt, **nicht** neuester.
- **Gewinner → in beide schreiben:** kanonische `{base}.md` (Storage) **und** `artifacts.transcript` (Mongo).
- **Genutzt von:** Reconcile (5b), `reconstruct`, `sync-from-storage`, Import — eine Implementierung.

### 9.3 Reconcile-Algorithmus (per Quelle; idempotent; Dry-Run zuerst)

1. Kandidaten sammeln (Storage-Varianten + Mongo).
2. `selectBestArtifactVariant` → Gewinner.
3. Gewinner als kanonische `{base}.md` (Storage) + `artifacts.transcript` (Mongo) persistieren.
4. **Löschen** der strikt unterlegenen Storage-Varianten (`{base}.{lang}.md`, alte kaputte `{base}.md`).
5. tote `page_NNN.md` löschen.
6. Transformationen analog normalisieren (Namensschema, Duplikate).
7. fehlende `binaryFragment`-URLs (P1) beim Durchlauf in Mongo nachtragen.

### 9.4 Harte Sicherheitsregeln (Löschen ist irreversibel)

- **Nur löschen, was strikt kleiner ist** (weniger Seiten-Marker bzw. kürzer) als die **bereits
  persistierte** kanonische Version. Die vollste/einzige Kopie wird **nie** gelöscht.
- **Konflikt** (zwei „volle", aber **unterschiedlicher** Inhalt) → **melden + überspringen**, nichts
  löschen, nichts überschreiben. Manuell entscheiden.
- **`needs-reextract`**: `pages > 1`, aber **alle** Varianten 1 Seite → melden, nichts löschen.
- **Dry-Run/Preview Pflicht** vor `--apply`/Schreiben; **mongodump** vorher. Idempotent: 2. Lauf = No-Op.

### 9.5 Reconcile-Report (Deliverable `05-reconcile-report-beispiel.md`)

Pro Quelle: gewählte kanonische Version (Quelle storage/mongo + Größe/Seiten), zu löschende Dateien,
Konflikte, `needs-reextract`, nachgetragene Fragment-URLs. Erst nach Sichtung `--apply`.
