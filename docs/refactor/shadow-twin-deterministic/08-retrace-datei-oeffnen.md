# Phase 8 — Re-Trace 2026-06-23 (manuell durchgeklickt: Datei öffnen)

Status: BEFUND + Plan-Update. Quelle: manuelles Durchklicken (Archiv → Ordner
"Articles" → Datei `9783927266575_Interior.pdf` → Vorschau-Tabs). Server-Log 2632
Zeilen, per Subagent ausgewertet. Ergänzt — nicht ersetzt — `06-optimierungsplan.md`.

> Messung: EINE Datei öffnen = **~88 HTTP-Calls**, Wall-Clock **~28,6 s**, **0 Writes**
> (korrekt). Library Tamera (`bf29edda-…`, Nextcloud/WebDAV). sourceId der Datei:
> `QXJ0aWNsZXMvOTc4MzkyNzI2NjU3NV9JbnRlcmlvci5wZGY=`.

---

## A. Neue Befunde (zusätzlich zu 06)

### R1 — `batch-resolve` läuft 2× komplett pro Öffnen (NEU, hoher Hebel)
Z. 1653 (**5493 ms**) + Z. 2630 (**6615 ms**): zweimal voller 52-Source-Batch mit
identischen Ergebnissen → ~**12 s** doppelte Volllast. Die 52 `selectShadowTwinArtifact`-
Logs erscheinen entsprechend doppelt (Z. 797–1652 / 1829–2628).
**Fix-Richtung:** Doppel-Aufruf entkoppeln/deduplizieren — ein Resolve pro Öffnen,
Ergebnis im Request wiederverwenden.

### R2 — Shadow-Twin der geöffneten Datei 3× geladen (NEU)
Z. 679 (2918 ms) + Z. 794 (1810 ms) + Z. 1696 (5039 ms) = ~**9,8 s** für dreimal
dieselbe Datei. Dazu `ingestion-status` 2× (Z. 603 `includeChapters=true` + Z. 687
`compact=1`).
**Fix:** einmal laden, wiederverwenden.

### P-Clerk — Auth-Lookup nie gecacht (NEU)
~**88×** `GET api.clerk.com/v1/users` mit "cache skip" (`auto no cache` /
`revalidate: 0`), je 233–453 ms — ein Clerk-Roundtrip pro Top-Level-Call.
**Fix:** Clerk-User-Lookup pro Request cachen (einmal auflösen, durchreichen).

### T1 — Thumbnail-Sturm an Datei-Öffnen gekoppelt (NEU / Erweiterung C2)
Öffnen **1** Datei → Auflösen der Thumbnails/Artefakte für ~**52 Fremd-PDFs** des
Ordners: 14× `resolve-binary-url`, 11× `streaming-url 302`. Ordner-Thumbnails und
Datei-Öffnen sind nicht entkoppelt.

---

## B. Aus 06 bestätigt (Re-Trace #2 belegt sie erneut)

- **A1 — falsche Sprache/Template:** geöffnete Datei `targetLanguage:'en'` →
  `selectedLang:'de'` (Z. 858–861, 1833–1836); zusätzlich `selectedLang:'de'` bei
  `selectedTemplate:'tamera-extract-en'` (Etikett-Inkonsistenz). Viele Artikel-PDFs →
  `meeting_analyse-de` (falsches Template), z.B. Z. 2083/2115; sogar
  `tamera_manifest_en.pdf` → `meeting_analyse-de` (Z. 2387). `'unknown'`-Template
  Z. 1076/2051. `hasRecord:false` Z. 802.
- **B2 — Provider-Cache kaputt:** **29** Evictions, durchgehend
  `cachedLibraryPath:'nicht verfügbar'`, teils 2–3 Evictions in <1 s (Resolver räumen
  sich gegenseitig weg). Hauptursache der 2,4–4,3 s je `resolve-binary-url`
  (WebDAV-Reconnect pro Call).
- **B3 — seriell statt gebündelt:** 14 `resolve-binary-url` seriell über ~13 s, Summe
  ~**45,6 s** Serverzeit; 11 `streaming-url` als zweite Welle (doppelter Resolver-Pfad).
- **B1 — Fragmente fehlen:** durchgehend `willAttemptFallback:true`, MongoDB-Auflösung
  leer (`fragmentCount:0`) → WebDAV-Fallback ist hier der Normalpfad, nicht die Ausnahme.
- **0 Writes** beim Öffnen — Overwrite-Bug bleibt behoben.

---

## C. Aktualisierte Priorisierung

| # | Was | Klasse | Aufwand | Hebel |
|---|---|---|---|---|
| 1 | **A1** exakte Sprach-/Template-Auswahl (kein stiller Cross-Fallback) | Korrektheit | mittel | hoch (falsche Inhalte) |
| 2 | **R1** `batch-resolve` nicht 2× (dedupe/cache) | Redundanz | klein | hoch (~12 s) |
| 3 | **R2** Shadow-Twin 1× statt 3× laden | Redundanz | klein | hoch (~10 s) |
| 4 | **B2** Provider-Cache-Key fixen | Perf | klein | hoch |
| 5 | **B3** Binär-Auflösung batchen/parallelisieren | Perf | mittel | hoch |
| 6 | **T1** Thumbnail-Last vom Datei-Öffnen entkoppeln | Perf/Redundanz | mittel | hoch |
| 7 | **P-Clerk** Auth-Lookup pro Request cachen | Perf | klein | mittel |
| 8 | **B1** Bild-Fragmente via Storage-Sync für alle registrieren | Perf | mittel | hoch |

**Reihenfolge-Logik:** A1 zuerst (zeigt falsche Inhalte). Dann die billigen
Redundanz-Killer **R1/R2/B2** — zusammen grob 24–34 s Ersparnis bei kleinem Eingriff.
Dann **B3/T1** (Gesamt-Last senken), danach Clerk-Cache und **B1/Storage-Sync**.

---

## D. Verifikation nach A1 + B2 (Re-Trace #3, 2026-06-23)

Zweiter manueller Durchklick mit eingebauten Fixes (Datei diesmal
`_Ökoniomie_en_Innen.pdf`, die schwere reparierte mit 20 Seiten/40 Bildern). Log
1505 Zeilen, gezielt ausgewertet.

- **B2 verifiziert ✅:** **0** Provider-Evictions ("Cache entfernt") — vorher 29. Der
  pauschale `clearProvider`-Aufruf ist raus, der config-bewusste Cache hält den Provider.
- **A1 verifiziert ✅:** **0×** `selectedLang:'de'` bei `targetLanguage:'en'` (vorher u. a.
  Interior). **0×** `hasRecord:false`/`selectedLang:null` → in diesem Ordner haben alle
  Quellen Englisch, also keine leeren Karten als Nebenwirkung. Kein stiller Sprach-Fallback mehr.
- **R1 (offen):** `batch-resolve` feuerte diesen Lauf **1×** (Z. 632, 3077 ms statt vorher
  5493+6615 ms). Nicht durch Code gefixt — navigationsabhängig; deterministische Dedup steht aus.
- **R2 (offen):** geöffnete Datei → `GET …/shadow-twins/<id>` weiterhin **3×** (Z. 1352/1378/1504),
  `ingestion-status` **2×** (Z. 1359/1377). Unverändert — noch nicht angegangen.
- **Keine Fehler** (0× 4xx/5xx/Exception), **0 Writes**.
- **Nebenbefund:** die schweren Calls sind jetzt Mongo-/Content-gebunden, nicht provider-
  gebunden: `shadow-twins/<id>` 9272 ms, `ingestion-status` 9531 ms, `content?kind=transcript`
  6346 ms — Kandidaten für späteres Mongo-/Content-Profiling (eher B4 als B2/B3).

> Belege: Server-Log-Auswertung 2026-06-23 (Re-Trace #1 Datei `9783927266575_Interior.pdf`;
> Verifikation #3 Datei `_Ökoniomie_en_Innen.pdf`). Alles read-only; **0 Writes** bestätigt.

---

## E. R2 umgesetzt + verifiziert (TanStack Query)

R2 wurde idiomatisch gelöst: Einführung von `@tanstack/react-query` + `QueryProvider`
(Root-Layout). Datei-Vorschau und Artefakt-Info-Panel nutzen jetzt den geteilten Hook
`useSourceArtifacts` (`src/hooks/use-source-artifacts.ts`, queryKey pro Library+Quelle).

- **Ursache 1 (Vorschau lud 2×):** Der alte Effect hing an wackeligen Job-/Twin-Atom-
  Dependencies → Re-Run kurz nach dem Öffnen. Behoben: queryKey hängt an Quell-Identität,
  nicht an Render-State. Job-Ende-Refresh nur noch beim echten Übergang `running/queued →
  completed` (nicht bei Atom-Hydration `undefined → completed`).
- **Ursache 2 (komponentenübergreifend):** Beide Komponenten teilen denselben queryKey →
  React-Query dedupliziert.
- **Live verifiziert (Server-Probe `[R2PROBE-LIST-GET]`):** **genau 1×** Listen-Call pro
  Datei-Öffnen (vorher 3×). Probe danach wieder entfernt.
- Offen bleibt **R2-ingestion-status** (2×, verschiedene Komponenten/Params) — separat.

Commit: `perf(shadow-twin): geteilter React-Query-Cache fuer Artefakt-Liste (R2)`.

---

## F. Daten-Befund (NICHT R2/Öffnen): Über-Maskierung in neuer Transform-Pipeline

Beim Verifizieren der Transformation von `_Ökoniomie_en_Innen.pdf` zeigte der Tab einen
JSON-Parse-Fehler. Inspektion des Mongo-Datensatzes (read-only) belegt: **kein Schreiben
beim Öffnen**, sondern ein Generierungs-/Serialisierungs-Bug in der NEUEN Pipeline.

- Zwei `en`-Transformationen: `tamera-extract-en` (08:10, **einfach** maskiert, gültig:
  `title: "ABOUT THE \"HUMANIZATION OF MONEY\" …"`) und `tamera` (09:49:50, **mehrfach**
  maskiert + „Content-Snippet"-Fehlertext als Inhalt → kaputt).
- Das kaputte `tamera`-Artefakt stammt aus PR #119 („tamera-template-unify") + Secretary-
  Commit `da8db8ce` („callTransformerChat auf JSON-Body umstellen"). Die Metadaten-Quotes
  werden beim Re-Serialisieren **mehrfach escaped** (jede Runde eine Ebene).
- `selectShadowTwinArtifact` (A1) wählt korrekt das **neueste** gleichsprachige Artefakt →
  `tamera` (kaputt) statt `tamera-extract-en` (gültig). A1 ist nicht die Ursache.
- **0 Writes beim Öffnen bleibt bestätigt:** `updatedAt` änderte sich bei späteren
  Öffnungen NICHT (blieb 09:49:50). Der Schaden entstand einmalig bei der Generierung.

**Owner:** die Session mit dem tamera/Secretary-Work (PR #119 / `da8db8ce`). **Sofort-Fix
je Datei:** „Neu generieren". **Root-Cause:** Quote-Über-Maskierung im Extraktions-/
Speicherpfad der neuen Pipeline.
