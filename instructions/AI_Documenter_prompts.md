
# Konzept - wie tut man?
Ich möchte systematisch eine Dokumentation für dieses Projekt erstellen.
Ich werde einige Fragen stellen und die Antworten in Markdown Dateien speichern.
Sollte es diese Dateien schon geben,  diese nicht Blind überschreiben, sondern nur ergänzen, wenn es sinnvoll ist.

bitte nur folgende Verzeichnsisse analysieren und dokumentieren:
app/
docs/
src/
konfigrationsdateien

Hier die Prompts

## Projektstruktur
> [!NOTE]
> evtl. bestehende docs/01_project_overview.md analysieren und ergänzen:
> Analysiere die Projektstruktur und erstelle eine knappe Übersicht der wichtigsten Verzeichnisse und deren Zweck. Identifizieren Sie Hauptkomponenten und deren Beziehungen * Markieren Sie zentrale Dateien wie package.json, Konfigurationsdateien etc.
> Können sie diese Verzeichnisstruktur genau analysieren und dies dokumentierten was da ist. Nichts frei erfinden.
> 
> Speichern als: docs\01_project_overview.md


## Technische Architektur
> [!NOTE]
> evtl. bestehende docs/02_architecture.md analysieren und ergänzen:
> Analysiere die wichtigsten technischen Entscheidungen und Abhängigkeiten des Projekts. Berücksichtige:
> - Haupttechnologien und Frameworks
> - Datenfluss/State Management 
> - API-Integration
> - Build/Deploy Setup"
> Nichts frei erfinden.
> Speichern als: docs\02_architecture.md


# Core Components
> [!NOTE]
> evtl. bestehende docs/03_core_components.md analysieren und ergänzen:
> Identifiziere die wichtigsten React-Komponenten des Projekts. Für jede Komponente beschreibe knapp:
> - Hauptzweck
> - Wichtigste Props
> - Zentrale Funktionen
> - Besonderheiten
> 
> Speichern als: docs\03_core_components.md


## Storage Provider
> [!NOTE]
> evtl. bestehende docs/04_storage-provider.md analysieren und ergänzen:
> Wie Funktioniert das Konzept der Storage Provider? Welche komponenten spielen Server und Clientseitig wie zusammen? Erkläre wie man prinzipiell Filesystem, Sharepoint, Onedrive, Google drive, etc. einbinden kann. Wie ist der Eventfolge der Library Componente vom Client zur Api und der Datenfluss zurück? Kann man das in einem Fluss Diagramm darstellen und als svg ins dokument einbetten?
> 
> Welche Ebenen werden angesprochen und welche Funktion hat welche Ebene? 
> Speichern als: docs\04_storage-provider.md

## Features
> [!NOTE]
> evtl. bestehende docs/05_features.md analysieren und ergänzen:
> Beschreibe die Hauptfunktionen der Anwendung aus Anwendersicht:
> - Was kann die App?
> - Welche typischen Workflows gibt es?
> - Welche Benutzergruppen gibt es?
> - Welche Berechtigungen existieren?"
> 
> Speichern als: docs\05_features.md

## Library Components
> [!NOTE]
> evtl. bestehende docs/06_library_components.md analysieren und ergänzen:
> Dokumentiere die speziellen Features der Library-Komponenten unter src/components/library:
> - FileList
> - FileTree
> - Library
> - Breadcrumb
> - FilePreview
> - MarkdownPreview mit eingebettet Audio, youtube, Bilder
> - MarkdownMetadata
> 
> Speichern als: docs\06_library_components.md

## Setup Guide
> [!NOTE]
> evtl. bestehende docs/06_setup.md analysieren und ergänzen:
> Erstelle eine knappe Anleitung für:
> - Lokales Setup für Entwickler
> - Wichtige Umgebungsvariablen
> - Build-Prozess
> - Deployment-Schritte"
> 
> Speichern als: docs\06_setup.md

## API Documentation
> [!NOTE]
> evtl. bestehende docs/07_api.md analysieren und ergänzen:
> Dokumentiere die wichtigsten API-Endpunkte:
> - Endpunkt
> - Methode
> - Parameter
> - Response
> - Beispiel"
> 
> Speichern als: docs/07_api.md
 

## README.md erstellen
> [!NOTE]
> evtl. bestehende README.md analysieren und ergänzen mit:
> - Kurze Projektbeschreibung
> - Hauptfunktionen
> - Quick Start Guide
> - Links zur detaillierten Dokumentation die unter docs/* organisiert sind
> 
> Speichern als: README.md

## LLM Context
> [!NOTE]
> kannst du das Projekt für eine Programmierassistenz möglichst ausführlich aber Kompakt als LLM Kontextspeicher zusammenfassen?
> Kannst du die bestehende .cursorrules analysieren und evtl. erweitern?
> 
> Speichern als: .cursorrules
