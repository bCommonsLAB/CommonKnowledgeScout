
# Konzept - wie tut man?
P: ich habe über ein RAG System zugriff auf die sourcedateien eines komplexen React Projektes. Ich möchte jetzt eine fundierte Dokumentation erstellen. Für Entwickler und für Anwender. Wie könnte ich systematisch vorgehen und alle Aspekte einer Dokumentation Berücksichtigen, aber mit den beschränkten Kontextfenstern eines LLMs umgehen? Was sind die richtigen Schritte?

Claude:
Ich schlage einen systematischen Ansatz vor, um eine umfassende Dokumentation für das React-Projekt zu erstellen, unter Berücksichtigung der LLM-Kontextfenster-Beschränkungen:

1. Strukturierte Analyse des Projekts:
   - Erstellen Sie zunächst eine Verzeichnisstruktur-Übersicht
   - Identifizieren Sie Hauptkomponenten und deren Beziehungen
   - Markieren Sie zentrale Dateien wie package.json, Konfigurationsdateien etc.

2. Dokumentations-Ebenen definieren:
   - Entwicklerdokumentation (technisch)
   - Benutzerdokumentation (anwendungsorientiert)
   - API-Dokumentation (falls vorhanden)
   - Deployment/Setup-Dokumentation

3. Systematische Verarbeitung mit LLM:

Für die Entwicklerdokumentation:
```
a) Komponenten einzeln analysieren:
   - Jede React-Komponente separat durch das LLM analysieren lassen
   - Fokus auf: Props, State, Hauptfunktionalitäten
   - Ergebnisse in einer strukturierten Markdown-Datei sammeln

b) Architektur dokumentieren:
   - Datenfluss-Diagramme erstellen lassen
   - State Management beschreiben
   - Routing-Logik erfassen
```

Für die Benutzerdokumentation:
```
a) Features identifizieren:
   - UI-Komponenten gruppieren nach Funktionalität
   - Workflows dokumentieren
   - Screenshots/Mockups einplanen

b) Anwendungsfälle beschreiben:
   - Typische Nutzerszenarien
   - Fehlerfälle und deren Behandlung
```

4. Praktische Umsetzung mit LLM:

```javascript
// Beispiel-Prompt-Struktur für Komponenten-Analyse
{
  "component": "ComponentName",
  "file_content": "...",
  "analysis_request": [
    "Props und deren Zweck",
    "Hauptfunktionalitäten",
    "Abhängigkeiten",
    "Besondere Merkmale"
  ]
}
```

5. Dokumentations-Assembly:

- Erstellen Sie ein Hauptdokument mit Verweisen auf die Teil-Dokumentationen
- Nutzen Sie ein Versionierungssystem (z.B. Git) für die Dokumentation
- Implementieren Sie eine klare Struktur mit Markdown-Dateien

6. Spezifische LLM-Strategien:

```
a) Chunking:
   - Teilen Sie große Komponenten in logische Chunks
   - Maximal 2000-3000 Tokens pro Analyse
   - Behalten Sie Kontext durch "Breadcrumbs"

b) Kontext-Management:
   - Erstellen Sie einen "Kontext-Header" für jede Analyse
   - Fügen Sie relevante Imports/Abhängigkeiten bei
   - Dokumentieren Sie Schnittstellen zwischen Chunks
```

7. Qualitätssicherung:

- Lassen Sie das LLM Code-Reviews durchführen
- Validieren Sie technische Beschreibungen
- Prüfen Sie Konsistenz der Dokumentation

8. Wartbarkeit:

- Dokumentieren Sie den Dokumentationsprozess selbst
- Erstellen Sie Templates für zukünftige Updates
- Implementieren Sie ein Änderungsprotokoll

Möchten Sie, dass ich einen dieser Aspekte detaillierter ausführe oder haben Sie spezifische Fragen zu einem der Schritte?

P: Wie könnte ich dieses Konzept Schritt für Schritt umsetzen? Welche Fragen sollte ich in welcher Reihenfolge stellen und Ergebnisse in Markdowndokumente speichern? Ich möchte eine eher knappe Dokumentation mit wesentlichen teilen.

Ich schlage folgenden konkreten Ablauf vor:

1. Erste Übersicht erstellen:
```markdown
# Projektübersicht erstellen lassen
Frage ans LLM: "Analysiere die Projektstruktur und erstelle eine knappe Übersicht der wichtigsten Verzeichnisse und deren Zweck. Beschränke dich auf die Hauptverzeichnisse."

Speichern als: 01_project_overview.md
```

2. Architektur erfassen:
```markdown
# Technische Architektur
Frage: "Analysiere die wichtigsten technischen Entscheidungen und Abhängigkeiten des Projekts. Berücksichtige:
- Haupttechnologien und Frameworks
- Datenfluss/State Management 
- API-Integration
- Build/Deploy Setup"

Speichern als: 02_architecture.md
```

3. Kernkomponenten identifizieren:
```markdown
# Core Components
Frage: "Identifiziere die 5-7 wichtigsten React-Komponenten des Projekts. Für jede Komponente beschreibe knapp:
- Hauptzweck
- Wichtigste Props
- Zentrale Funktionen
- Besonderheiten"

Speichern als: 03_core_components.md
```

4. Hauptfunktionen dokumentieren:
```markdown
# Features
Frage: "Beschreibe die Hauptfunktionen der Anwendung aus Anwendersicht:
- Was kann die App?
- Welche typischen Workflows gibt es?
- Welche Benutzergruppen gibt es?
- Welche Berechtigungen existieren?"

Speichern als: 04_features.md
```

5. Setup & Deployment:
```markdown
# Setup Guide
Frage: "Erstelle eine knappe Anleitung für:
- Lokales Setup für Entwickler
- Wichtige Umgebungsvariablen
- Build-Prozess
- Deployment-Schritte"

Speichern als: 05_setup.md
```

6. API-Dokumentation (falls relevant):
```markdown
# API Documentation
Frage: "Dokumentiere die wichtigsten API-Endpunkte:
- Endpunkt
- Methode
- Parameter
- Response
- Beispiel"

Speichern als: 06_api.md
```

7. Zusammenfassung:
```markdown
# README.md erstellen
Frage: "Erstelle ein README.md mit:
- Kurze Projektbeschreibung
- Hauptfunktionen
- Quick Start Guide
- Links zur detaillierten Dokumentation"

Speichern als: README.md
```

Empfohlener Workflow:

1. Erstellen Sie für jedes Dokument ein separates Markdown-File
2. Nutzen Sie das LLM schrittweise und speichern Sie die Antworten
3. Prüfen und ergänzen Sie die Informationen
4. Verlinken Sie die Dokumente untereinander
5. Erstellen Sie das README.md als Einstiegspunkt

Wichtige Prinzipien:

- Fokus auf Wesentliches, kein "Nice to have"
- Kurze, prägnante Beschreibungen
- Codebeispiele nur für wichtige Konzepte
- Klare Struktur und Navigation
- 
- Versionierung der Dokumentation

## Prompts


## Projektstruktur

> [!NOTE]
> Analysiere die Projektstruktur und erstelle eine knappe Übersicht der wichtigsten Verzeichnisse und deren Zweck. Identifizieren Sie Hauptkomponenten und deren Beziehungen * Markieren Sie zentrale Dateien wie package.json, Konfigurationsdateien etc.
> Können sie diese Verzeichnisstruktur genau analysieren und dies dokumentierten was da ist. Nichts frei erfinden.
> 
> Speichern als: docs\01_project_overview.md


## Technische Architektur

> [!NOTE]
> Analysiere die wichtigsten technischen Entscheidungen und Abhängigkeiten des Projekts. Berücksichtige:
> - Haupttechnologien und Frameworks
> - Datenfluss/State Management 
> - API-Integration
> - Build/Deploy Setup"
> Nichts frei erfinden.
> Speichern als: docs\02_architecture.md


# Core Components

> [!NOTE]
> Identifiziere die wichtigsten React-Komponenten des Projekts. Für jede Komponente beschreibe knapp:
> - Hauptzweck
> - Wichtigste Props
> - Zentrale Funktionen
> - Besonderheiten
> 
> Speichern als: docs\03_core_components.md


## Storage Provider

> [!NOTE]
> Wie Funktioniert das Konzept der Storage Provider? Welche komponenten spielen Server und Clientseitig wie zusammen? Erkläre wie man prinzipiell Filesystem, Sharepoint, Onedrive, Google drive, etc. einbinden kann. Wie ist der Eventfolge der Library Componente vom Client zur Api und der Datenfluss zurück? Kann man das in einem Fluss Diagramm darstellen und als svg ins dokument einbetten?
> 
> Welche Ebenen werden angesprochen und welche Funktion hat welche Ebene? 
> Speichern als: docs\04_storage-provider.md

## Features

> [!NOTE]
> Beschreibe die Hauptfunktionen der Anwendung aus Anwendersicht:
> - Was kann die App?
> - Welche typischen Workflows gibt es?
> - Welche Benutzergruppen gibt es?
> - Welche Berechtigungen existieren?"
> 
> Speichern als: docs\05_features.md


# Setup Guide

> [!NOTE]
> Erstelle eine knappe Anleitung für:
> - Lokales Setup für Entwickler
> - Wichtige Umgebungsvariablen
> - Build-Prozess
> - Deployment-Schritte"
> 
> Speichern als: docs\06_setup.md


# API Documentation

> [!NOTE]
> Dokumentiere die wichtigsten API-Endpunkte:
> - Endpunkt
> - Methode
> - Parameter
> - Response
> - Beispiel"
> 
> Speichern als: docs/07_api.md
> 

## README.md erstellen

> [!NOTE]
> Erstelle ein README.md mit:
> - Kurze Projektbeschreibung
> - Hauptfunktionen
> - Quick Start Guide
> - Links zur detaillierten Dokumentation"
> 
> Speichern als: README.md

## LLM Context

> [!NOTE]
> kannst du das Projekt für eine Programmierassistenz möglichst ausführlich aber Kompakt als LLM Kontextspeicher zusammenfassen?