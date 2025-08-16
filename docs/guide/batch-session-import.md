---
title: Batch Session Import
---

# Batch Session Import

> Status: 📝 Konzept (UI/Flow dokumentiert; Serverabhängigkeiten prüfen)

Erweitert das Session Import Modal um einen Massenimport (Batch) von einer Übersichtsseite.

## Features
- Single Import mit Vorschau
- Batch Import mit Status-Tracking und Fehlertoleranz

## API-Templates (Secretary Service)
- `ExtractSessiondataFromWebsite` (Einzel-Session)
- `ExtractSessionListFromWebsite` (Liste mit optionalem globalem Event/Track)

## Workflow (Kurz)
1) URL der Übersichtsseite eingeben, Sprachen wählen
2) Session-Liste laden → Anzeige und Prüfung
3) X Sessions importieren → sequenziell mit Fortschrittsanzeige

## Priorität der Felder
1. Event: global (Liste) > einzeln (Seite)
2. Track: Liste > einzeln


