---
description: 
globs: 
alwaysApply: false
---
**Kontext:**
Die Initialisierung der App darf keine doppelten Ladezyklen oder inkonsistente States erzeugen. Grundfunktionen wie Navigation und Datei-Anzeige müssen immer funktionieren.

**Zu überarbeiten:**
- Initialisierungslogik für Bibliothek und Dateiansicht optimieren (keine doppelten Requests)
- Sicherstellen, dass Navigation und Datei-Anzeige robust funktionieren
- Fehlerquellen bei der Initialisierung identifizieren und beheben

**Hinweise:**
- Fokus auf Zuverlässigkeit und Benutzerfreundlichkeit
- Testfälle für Initialisierung und Navigation ergänzen

