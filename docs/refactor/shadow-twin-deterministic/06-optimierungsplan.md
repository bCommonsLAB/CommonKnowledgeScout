# Phase 6 — Optimierungsplan (Re-Trace 2026-06-23, aktueller Code)

Status: BEFUND + Plan. Quelle: Re-Trace des Articles-Erstladens (Library Tamera) gegen die
Phase-0-Baseline (`01-trace-open-dir.md`). Log: 1922 Zeilen, per Subagent ausgewertet.

> Messung: Articles öffnen = **28 HTTP-Calls**, Wall-Clock **~34 s**. 1× batch-resolve (**9183 ms**),
> 23× `resolve-binary-url` (Summe ~63,6 s Server-Zeit, seriell), **43** Provider-Cache-Evictions,
> **0** Writes (korrekt). 3 von 23 Quellen haben jetzt Mongo-Bild-Fragmente.

---

## A. Fehllogik (Korrektheit) — höchste Priorität

### A1 — Falsche Sprache/Template bei `batch-resolve` (stiller Cross-Fallback)
**Befund (verbatim):** Quelle `9783927266575_Interior.pdf` mit `targetLanguage: 'en'` →
`selectedLang: 'de'`, `selectedTemplate: 'tamera-extract-en'`; dutzende Quellen mit
`targetLanguage: 'en'` → `selectedTemplate: 'meeting_analyse-de'` (ein **deutsches Meeting-Template**
für Artikel-PDFs). Die UI fragt Englisch an, bekommt still ein deutsches/falsches Artefakt.
**Ort:** `selectShadowTwinArtifact` (`shadow-twin-select.ts`) — „angeforderte Sprache, sonst erste
verfügbare, neuester `updatedAt`" → substituiert quer über Sprachen/Templates.
**Fix:** exakter Match auf (kind, targetLanguage, templateName). Kein stiller Cross-Sprach-/
Cross-Template-Fallback (vgl. `no-silent-fallbacks.mdc`). Fehlt das angefragte Artefakt → **null**
(UI zeigt „nicht vorhanden"), NICHT ein fremdsprachiges. Optional: bewusst-gewählter Fallback nur,
wenn der Aufrufer ihn explizit erlaubt (Flag), nie implizit.
**Risiko:** Verändert sichtbares Verhalten (manche Karten werden leer, wo vorher fälschlich ein
de-Artefakt stand) — gewollt. Tests für select-Logik anpassen.

---

## B. Performance — hoher Hebel

### B1 — Bild-Fragmente für ALLE Quellen registrieren (P1)
**Befund:** nur **3/23** Quellen haben `binaryFragments` in Mongo (40 / 16 / 327) → diese 3
überspringen den Storage-Fallback. Die 20 anderen machen pro Datei einen WebDAV-Fallback
(`willAttemptFallback: true` → `Shadow-Twin-Ordner Suche` → live laden).
**Fix:** Die Bild-Registrierung (heute nur via „Aus Storage übernehmen"/`reconstructPageImages`) in
die **Storage-Sync**-Operation bündeln, sodass ein Sync pro Library alle Quellen abdeckt. Danach
liest die Übersicht/Liste die Bilder aus Mongo statt live.
**Nebenbefund:** die 3 registrierten haben `fragmentsWithUrl>0` aber `fragmentsWithFileId: 0` — die
Fragmente hängen nur an einer URL, nicht an einer stabilen `fileId`. Prüfen, ob das bei
URL-Ablauf/Provider-Wechsel bricht.

### B2 — StorageFactory-Provider-Cache reparieren (P4) — billigster großer Gewinn
**Befund:** **43** Evictions in einem Verzeichnis-Öffnen, jeweils `cachedLibraryPath: 'nicht verfügbar'`
→ Cache-Key matcht nie → Provider wird ~2×/`resolve-binary-url` neu gebaut (`tryCreateProvider`).
**Fix:** Cache-Key korrekt setzen (Library-Pfad beim Cachen befüllen, statt „nicht verfügbar"), sodass
der Provider über den ganzen Batch wiederverwendet wird. Kein Rebuild pro Hop.

### B3 — Binär-Auflösung batchen + parallelisieren (P2/P3)
**Befund:** 23 `resolve-binary-url` **seriell**, je 1,4–6,0 s. Auch `binary-fragments` (Übersicht) lädt
URLs seriell (~64 s/40 Bilder, früher gemessen).
**Fix:** mehrere Fragmente in einem Request auflösen und `getStreamingUrl`/Fallback mit `Promise.all`
parallelisieren. Ziel: Verzeichnis-Öffnen von ~34 s auf wenige Sekunden.

### B4 — `batch-resolve` Regression untersuchen
**Befund:** 5009 ms → **9183 ms** (+83 %) gegenüber Baseline.
**Fix:** profilen, was `batch-resolve` verlangsamt (mehr Storage-Fallback-Arbeit? content-aware
Reads?). Erst messen, dann optimieren.

---

## C. Redundanz

### C1 — Provider-Neubau pro Call (Teilmenge B2)
~43 Rebuilds; mit B2 behoben.

### C2 — (aus 02-trace) mehrere Resolver pro Datei
Beim Datei-Öffnen feuern `artifacts/resolve` + `batch-resolve` + `getAllArtifacts` (mehrfach) +
`freshness` + `content` für dieselbe Quelle. In diesem Erstladen-Trace nicht erneut gemessen
(nur Verzeichnis-Ebene), bleibt aus 02 offen → mit dem kanonischen Resolver (Phase 2/4) bündeln.

---

## Priorisierung

| # | Was | Klasse | Aufwand | Hebel |
|---|---|---|---|---|
| 1 | **A1** exakte Sprach-/Template-Auswahl (kein stiller Cross-Fallback) | Korrektheit | mittel | hoch (falsche Inhalte) |
| 2 | **B2** Provider-Cache-Key fixen | Perf | klein | hoch |
| 3 | **B1** Bild-Fragmente via Storage-Sync für alle registrieren | Perf | mittel | hoch |
| 4 | **B3** Binär-Auflösung batchen/parallelisieren | Perf | mittel | hoch |
| 5 | **B4** batch-resolve-Regression profilen | Perf | klein | mittel |
| 6 | **C2** Resolver pro Datei bündeln (kanonischer Resolver) | Redundanz | groß | mittel |

**Bezug zur „Storage sync"-Vision:** B1 ist Teil der Sync-Konsolidierung (ein Lauf registriert alle
Bilder). B2/B3 machen sowohl Sync als auch normales Browsen schnell. A1 ist unabhängig (Korrektheit)
und sollte zuerst, da es falsche Inhalte zeigt.

> Hinweis: Alle Werte read-only gemessen; **0 Writes** beim Laden bestätigt — der ursprüngliche
> Overwrite-Bug ist weiterhin behoben.
