---
title: Analyse zur Trennung der Template-Tests in einen Dialog
status: draft
date: 2026-01-18
---

## Kontext und Ziel
Die aktuelle Vorlagenverwaltung zeigt rechts den Block "Transformation testen". Das erzeugt visuelle Überfrachtung und zwingt die Template-Gestaltung in eine halbe Breite. Gewünscht ist eine klare Trennung: die Template-Gestaltung nutzt die gesamte Breite, während die Transformationstests als eigenständige Funktion per Button auf der Homepage erreichbar sind und in einem Dialog laufen.

Zusätzliche Anforderungen: Der Test muss weiterhin Kontext-Dateien und Freitext unterstützen, Ergebnisse speichern können und möglichst die aktuelle Template-Definition nutzen. Gleichzeitig soll die UI schlank bleiben, keine unnötigen Abhängigkeiten einführen und die bestehenden Atome/Services weiterverwenden.

## Varianten
### Variante A: Dialog direkt in der Template-Seite (kein Home-Button)
**Idee:** Den Test-Block in einen Dialog innerhalb `TemplateManagement` verschieben, öffnen über Button in der Toolbar.  
**Vorteile:** Minimaler Code, nutzt bestehende Form-Werte (auch ungespeichert), keine zusätzliche Logik.  
**Nachteile:** Kein Button auf der Homepage, Anforderung nicht erfüllt.

### Variante B: Gemeinsamer Dialog, wiederverwendbar in Home + Template-Seite
**Idee:** Eigenes Dialog-Component für Tests. Es kann entweder mit "aktuellen Form-Werten" arbeiten (Template-Seite) oder mit geladenen Templates (Homepage).  
**Vorteile:** Ein UI, zwei Einstiege. Die Template-Seite bleibt breit. Anforderungen erfüllt.  
**Nachteile:** Etwas mehr Refactoring, braucht klar definierte Props/Helper.

### Variante C: Home-Button führt zu `/templates?test=1` und öffnet Dialog dort
**Idee:** Home-Button navigiert zur Template-Seite; dort öffnet ein Dialog automatisch.  
**Vorteile:** Kein zusätzlicher Test-Dialog im Home, geringe UI-Komplexität.  
**Nachteile:** Nicht wirklich "auf der Homepage im Dialog"; weniger direkt, zusätzlicher Seitenwechsel.

## Entscheidung
**Gewählt: Variante A.**  
Der Button zum Öffnen der Testumgebung bleibt innerhalb der Template-Seite. Damit ist die Trennung der UI erreicht, ohne einen Home-Button oder zusätzliche Navigation einzuführen. Die Template-Gestaltung erhält volle Breite, und die Test-Logik bleibt direkt am Editor gebunden.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)
