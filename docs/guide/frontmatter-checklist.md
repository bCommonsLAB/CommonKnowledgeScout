---
title: Frontmatter-Checkliste für saubere Ingestion
updated: 2025-10-24
status: draft
---

## Ziel

Diese Checkliste hilft dir, Event‑Markdowns (aus dem Scraping) so zu prüfen, dass der spätere Ingestion‑Pfad (Pinecone + Mongo) ohne Datenlücken läuft. Der PDF‑Flow bleibt unverändert – wir prüfen nur die Qualität der Event‑Markdowns.

## Minimal erforderliche Struktur

Frontmatter muss am Dokumentanfang stehen und mit `---` beginnen/enden. Beispiel‑Gerüst (Event):

```yaml
---
title: "The CRA: an Open Source Sustainability law?"
event: "SFSCON"
track: "Open Source"
day: "2025-11-07"
starttime: "10:30"
endtime: "11:15"
speakers: ["Jordan Maris"]
language: "en"
url: "https://www.sfscon.it/speakers/jordan-maris/"
summary: "How the CRA will help strengthen the sustainability of Open Source projects."
pages: 1
chapters:
  - order: 1
    title: "Talk"
    startPage: 1
    endPage: 1
    summary: "Overview of CRA impact"
    keywords: ["CRA","Open Source","Sustainability"]
---
```

Hinweise:
- Zeiten: ISO‑Datum (`YYYY-MM-DD`) und 24h‑Zeit (`HH:mm`).
- `speakers` immer als Array.
- `pages` ist Gesamtseitenzahl (bei Web‑Texten mindestens 1). Wird für Kapitel‑Grenzen verwendet.

## Pflicht‑Felder (saubere Ingestion)
- title: string
- summary: string (Doc‑Zusammenfassung, wird für Doc‑Embedding genutzt)
- chapters: Array mit mind. einem Eintrag
  - order: number (0..n, stabil sortiert)
  - title: string
  - startPage: number ≥ 1
  - endPage: number ≥ startPage
  - summary: string (kurze Kapitelfassung)
  - keywords: string[] (optional, empfohlen)
- pages: number ≥ max(endPage) aller Kapitel

## Empfohlene Event‑Felder (für Facetten/Filter)
- event: string
- track: string
- day: string (YYYY-MM-DD)
- starttime, endtime: string (HH:mm)
- speakers: string[]
- language: string (z. B. `en`, `de`)
- url: string (Quelle)
- tags: string[] (frei)
- source: string (z. B. `web`)

Diese Felder können je Library in den Facet‑Defs konfiguriert sein. Fehlende Facetten werden toleriert, liefern aber weniger Filtermöglichkeiten.

## Validierungsregeln (was der Ingestion‑Code erwartet)
- Frontmatter muss parsebar sein (keine Syntaxfehler; Keys eindeutig).
- `summary` und `chapters` sollten vorhanden sein – fehlen sie, wird ingestiert, aber mit Warnungen und schlechterem Retrieval.
- Kapitelbereiche müssen innerhalb `1..pages` liegen; Leerbereiche werden toleriert, aber logged.
- Strings ohne überflüssige Anführungszeichen (wir entfernen zwar einige, aber sauber ist besser).
- Arrays wirklich als Arrays, nicht als kommaseparierte Strings.

## Manuelle Prüfschritte (Quick‑Audit)
1. Datei öffnen: Prüfen, dass das Frontmatter direkt oben steht und mit `---` … `---` korrekt abgeschlossen ist.
2. YAML‑Lint (optional): In einem YAML‑Validator kurz prüfen, dass die Map valide ist.
3. Pflicht‑Felder: title, summary, chapters[0], pages vorhanden?
4. Kapitelkonsistenz: `startPage/endPage` in `1..pages`; Reihenfolge und `order` stabil.
5. Sprecher + Zeiten: `speakers[]` nicht leer; `day/starttime/endtime` plausibel.
6. Links im Body: Bild‑Links relativ in den extrahierten Pfaden (z. B. `./.MyTalk/page_001.png`).
7. Sprache: `language` gesetzt (wird für Dateinamenssuffix/Shadow‑Twin genutzt).

## Häufige Fehler & Behebung
- Fehlendes Frontmatter oder doppelter Block → Erst alle Frontmatter‑Blöcke entfernen, dann genau einen Block oben einfügen.
- `speakers` als String → in Array umwandeln (`["Name"]`).
- Kapitel ohne `summary` → kurze 1–2 Sätze ergänzen (verbessert Facetten und Chat‑Antworten).
- `pages` kleiner als `endPage` → `pages` erhöhen oder Kapitel anpassen.

## Heuristik „Haupt‑Markdown“ bei Archiven
Falls mehrere `.md` im Archiv vorhanden sind:
1. Bevorzuge Dateien im Wurzelbereich (nicht unter `/assets/`).
2. Bevorzuge Sprache (`*.de.md`/`*.en.md`) passend zur Extraktion.
3. Sonst größte `.md` nach Byte‑Größe wählen.

## Nächste Schritte (wenn Check bestanden)
- Schritt 2: Ingestion aktivieren (Mongo DocMeta upsert + Pinecone Upsert). PDF‑Flow bleibt unverändert; Event‑Markdown wird parallel ingestiert.



