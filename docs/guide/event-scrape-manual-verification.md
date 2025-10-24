---
title: Event-Scrape – Manuelle Verifikation von Markdown & Frontmatter
updated: 2025-10-24
status: draft
---

## Ziel

Pragmatische Schritt-für-Schritt-Anleitung, um Event-Scrape-Ergebnisse zu prüfen, bevor der Ingestion-Pfad aktiviert wird. Fokus: korrekte Ablage im Storage, konsistente Frontmatter-Inhalte.

## Voraussetzungen
- Event-Archiv pro Session liegt als ZIP (Base64/Download) über den Event-Monitor vor.
- Client-Flow zum Entpacken/Upload (bestehender `BatchArchiveDialog`).
- Zugriff auf die Library (z. B. OneDrive) und Ordner der Originalquelle.

## Schritte
1. Archiv herunterladen
   - Über den Event-Monitor „Archiv herunterladen“ (Job-Details/Batch-Ansicht).
2. Entpacken & Upload
   - Im Dialog „Archiv anwenden“ den clientseitigen Entpack-Flow nutzen (bestehend):
     - Bilder/Assets: in Unterordner `.<basename>/` hochladen
     - Haupt-Markdown: im selben Ordner wie die Quelle speichern (`basename.<lang>.md` empfohlen)
   - Heuristik für Haupt‑Markdown beachten (siehe Checkliste): nicht unter `/assets/`, Sprachsuffix bevorzugen.
3. Sichtprüfung im Storage
   - Prüfe, ob `.<basename>/` existiert und Bilder (`page_###.png|jpg`) enthalten sind.
   - Öffne die Haupt‑Markdown im Web-Viewer (sofern vorhanden) oder lade sie lokal.
4. Frontmatter prüfen
   - Nutze die Checkliste in `docs/guide/frontmatter-checklist.md`:
     - Pflichtfelder: `title`, `summary`, `chapters[]`, `pages`
     - Kapitelbereiche vs. `pages` konsistent
     - Event-Felder (event, track, day, times, speakers) plausibel
5. Body prüfen
   - Verweise auf Bilder relativ und vorhanden (`./.MyTalk/page_001.png`).
   - Keine doppelten Frontmatter-Blöcke; genau ein Block am Anfang.
6. Korrekturen (falls nötig)
   - Kleinere Korrekturen am Markdown direkt im Storage-Editor oder lokal dann erneut hochladen.
7. Ergebnis protokollieren (optional)
   - Liste geprüfter Sessions und „OK/Fehler + Hinweis“ erfassen, damit Schritt 2 gezielt gestartet werden kann.

## Tipps
- Sprachsuffix konsistent halten (`.de.md`, `.en.md`) – erleichtert Erkennung.
- Bei mehreren `.md` im Archiv: die inhaltlich umfangreichere Datei als Haupt‑Markdown wählen.
- Lieber `chapters` mit minimalen, aber sinnvollen Segmenten (z. B. 1–3 Kapitel) als ganz ohne Kapitel.

## Nächster Schritt
- Wenn die wichtigsten Sessions „OK“ sind, Schritt 2 starten: Ingestion (Mongo/Pinecone) parallel zum PDF-Flow.


