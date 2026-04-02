## Problem

`Content erstellen` zeigt aktuell nur Creation-Typen, die aus MongoDB-Templates der aktiven Library abgeleitet werden.

Aktueller Pfad:

- `src/app/library/create/page.tsx`
- `src/lib/templates/library-creation-config.ts`
- `src/app/api/templates/route.ts`
- `src/app/api/templates/[templateId]/config/route.ts`

Für neue Libraries ist das unglücklich:

- Es gibt noch keine Templates
- Deshalb ist die Create-Seite leer
- Obwohl die eigentlichen Wizard-Bausteine schon vorhanden sind

## Wichtige Beobachtung

Die gewünschte Funktionalität existiert bereits weitgehend:

- Step-Presets sind vorhanden: `welcome`, `collectSource`, `generateDraft`, `editDraft`, `previewDetail`, `publish`, ...
- Der Wizard rendert diese Presets generisch in `src/components/creation-wizard/creation-wizard.tsx`
- Beispiel-Templates mit Creation-Flow existieren bereits in `template-samples/`
  - `event-creation-de.md`
  - `event-testimonial-creation-de.md`
  - `testimonial-creation-de.md`
  - `dialograum-creation-de.md`

Das spricht klar gegen ein zweites, separates "Quick Content"-System.

## Varianten

### Variante 1: Standard-Templates als Built-in Registry, aber über denselben Template-Pfad laden

Idee:
- Wir führen eine kleine Registry für System-/Standard-Templates ein
- Diese enthält dieselbe Struktur wie `TemplateDocument`
- `Content erstellen` zeigt Union aus:
  - Library-Templates aus MongoDB
  - Built-in Templates aus Registry
- `/api/templates/[templateId]/config` kann bei "nicht in Mongo gefunden" auf diese Registry zurückfallen

Vorteile:
- Kein zweites Wizard-System
- Keine doppelte Step-Implementierung
- Neue Libraries funktionieren sofort
- Custom Templates bleiben möglich
- Built-ins können später in Mongo kopiert und angepasst werden

Nachteile:
- Leichte Erweiterung der Template-Ladepfade
- Es braucht klare Kennzeichnung: built-in vs. library-owned

### Variante 2: Beim Anlegen einer Library automatisch Standard-Templates in MongoDB seed'en

Idee:
- Neue Library bekommt beim Erstellen direkt 3-6 Standard-Templates in MongoDB
- `Content erstellen` bleibt unverändert

Vorteile:
- Technisch sehr konsistent mit dem heutigen Modell
- Keine Fallback-Logik beim Laden

Nachteile:
- Schwerer nachträglich zu ändern oder zu versionieren
- Dupliziert Daten pro Library
- Migrationsproblem bei Template-Updates

### Variante 3: "Quick Create"-Einträge ohne Templates, direkt auf Step-Presets basierend

Idee:
- Neue Content-Karten werden direkt aus hardcodierten Step-Konfigurationen gebaut
- Kein echtes Template dahinter

Vorteile:
- Schnell für einen ersten Prototyp

Nachteile:
- Höchstes Duplikationsrisiko
- Zweite Konfigurationswelt neben Templates
- Spätere Pflege wird unnötig teuer

## Entscheidung

Variante 1 ist die sauberste Lösung.

Sie nutzt das bestehende System maximal aus:
- Templates bleiben die einzige fachliche Definition
- Der Wizard bleibt unverändert oder fast unverändert
- Die Create-Seite bekommt lediglich zusätzliche "built-in" Angebote

## Empfohlene Zielarchitektur

### 1. Built-in Template Registry einführen

Neue Datei, z. B.:

- `src/lib/templates/builtin-creation-templates.ts`

Inhalt:
- kleine Liste von 3-6 Standard-Templates als `TemplateDocument`-ähnliche Objekte
- Start mit genau den Fällen, die ihr schon habt:
  - `event-creation-de`
  - `event-testimonial-creation-de`
  - `testimonial-creation-de`
  - optional `dialograum-creation-de`
  - optional `pdfanalyse`

Wichtig:
- nicht neues JSON-Format erfinden
- exakt dieselbe Struktur wie bestehende Templates verwenden

### 2. `getLibraryCreationConfig()` auf Union umstellen

`src/lib/templates/library-creation-config.ts`

Statt nur Mongo-Templates:
- lade Mongo-Templates
- lade Built-in Registry
- merge nach `templateId`
- Regel:
  - Library-Template überschreibt Built-in mit gleicher ID
  - Built-ins nur anzeigen, wenn kein gleichnamiges Library-Template existiert

Damit kann eine Library ein Standard-Template gezielt "übernehmen" und anpassen.

### 3. Template-Config-API um Built-in Fallback erweitern

`src/app/api/templates/[templateId]/config/route.ts`

Wenn Mongo `null` liefert:
- in Built-in Registry nachsehen
- falls gefunden: als normales Template-Objekt zurückgeben
- falls nicht gefunden: 404

Dadurch kann `CreationWizard` unverändert weiter über `templateId` laden.

### 4. Optional: `GET /api/templates` ebenfalls erweitern

Nur nötig, wenn die Built-ins auch im Template-Management sichtbar sein sollen.

Empfehlung:
- nicht sofort mischen
- zuerst nur `Content erstellen` mit Built-ins erweitern
- später optional eigener Bereich "Standardvorlagen"

### 5. Built-ins klar markieren

`LibraryCreationType` erweitern um z. B.:

- `source: 'library' | 'builtin'`
- optional `isReadonly: boolean`
- optional `isRecommended: boolean`

Auf der Create-Seite könnte dann stehen:
- "Standard"
- oder "Empfohlene Vorlage"

Das ist UX, nicht Kernlogik.

## Konkreter Minimal-Implementierungsplan

### Phase A: Ohne neue Editor-UI

1. Built-in Registry anlegen
2. `getLibraryCreationConfig()` auf Merge umstellen
3. `config`-API mit Built-in Fallback ergänzen
4. Create-Seite zeigt sofort Standardkarten bei leeren Libraries

Ergebnis:
- Neue Libraries haben sofort nutzbare Einträge
- Keine Template-Seeding-Logik
- Keine doppelte Step-Programmierung

### Phase B: Optional "Als eigene Vorlage übernehmen"

Später Button im Template-Management oder Create-Screen:
- "Standardvorlage kopieren"

Dann wird das Built-in einmal in Mongo gespeichert und ist ab dort editierbar.

## Warum das zur bestehenden Architektur passt

- `Content erstellen` basiert heute bereits auf Templates
- die Presets sind generisch genug
- `collectSource` enthält schon die gewünschten Einstiegsarten:
  - Diktat/Text
  - Webseite
  - Datei
  - Ordner

Das bedeutet:
Der eigentliche Mehrwert liegt nicht in neuen Komponenten, sondern im Vorhalten und Ausliefern sinnvoller Standard-Templates.

## Konkrete Antwort auf deine Kernfrage

Ja, ihr könnt sehr wahrscheinlich genau das machen:

- keine neue Logik für "Transkribieren" bauen
- stattdessen kurze, standardisierte Templates vorhalten
- diese bei neuen Libraries automatisch im Create-Screen anbieten
- und später bei Bedarf als echte Library-Templates übernehmen

Das ist die Lösung mit der geringsten Doppelprogrammierung.
