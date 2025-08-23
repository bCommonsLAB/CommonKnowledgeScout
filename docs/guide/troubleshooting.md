---
title: Troubleshooting
---

# Troubleshooting

## Anmeldung fehlgeschlagen
- Erneut anmelden und Browser-Blocker prüfen.
- Server-Logs prüfen (Auth-Routen).

## Bibliothek nicht konfiguriert
- Hinweis „Bitte konfigurieren Sie die Bibliothek...“: `/settings` → Bibliothek und Storage prüfen.
- Provider-Anmeldestatus im Header/Storage-Kontext prüfen.

## Upload schlägt fehl
- Dateigröße/Format prüfen.
- Storage-Provider-Berechtigungen prüfen.

## Vorschau zeigt nichts
- Datei-Typ unterstützen? Für Binärformate ggf. Download nutzen.

## Transformation/Transkription läuft nicht an
- Event-Monitor prüfen (Batch/Job-Status, Fehler).
- `Secretary Service` Konfiguration und API-Erreichbarkeit prüfen.


