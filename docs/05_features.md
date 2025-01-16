# Funktionen und Benutzergruppen

## Hauptfunktionen

### Dokumenten-Management

```mermaid
graph LR
    subgraph "Dokumentenverwaltung"
        A[Dateien hochladen] --> B[Organisieren]
        B --> C[Vorschau]
        B --> D[Teilen]
        C --> E[Bearbeiten]
    end
```

#### Datei-Operationen
- Hochladen von Dokumenten und Medien
- Erstellen von Ordnerstrukturen
- Verschieben und Umbenennen
- Löschen von Dateien und Ordnern
- Vorschau verschiedener Dateitypen
- Datei-Sharing und Berechtigungsverwaltung

#### Organisationsfunktionen
- Hierarchische Ordnerstruktur
- Datei-Kategorisierung
- Metadaten-Verwaltung
- Suchfunktion über Inhalte und Namen
- Sortierung und Filterung

### Bibliotheks-Management

```mermaid
graph TD
    subgraph "Bibliotheksverwaltung"
        A[Bibliothek erstellen] --> B[Provider konfigurieren]
        B --> C[Berechtigungen setzen]
        C --> D[Nutzer einladen]
        D --> E[Aktivitäten überwachen]
    end
```

- Verwaltung mehrerer Bibliotheken
- Integration verschiedener Storage-Provider
- Konfiguration von Zugriffsrechten
- Benutzer- und Gruppenverwaltung
- Aktivitätsprotokollierung

## Typische Workflows

### 1. Dokumenten-Upload und Organisation

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Storage
    
    User->>App: Login
    User->>App: Bibliothek auswählen
    User->>App: Zielordner navigieren
    User->>App: Dateien hochladen
    App->>Storage: Speichern
    App->>User: Bestätigung
    User->>App: Metadaten bearbeiten
    User->>App: Berechtigungen setzen
```

### 2. Dokumenten-Suche und Zugriff

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Search
    
    User->>App: Suchbegriff eingeben
    App->>Search: Suche ausführen
    Search-->>App: Ergebnisse
    App-->>User: Ergebnisliste
    User->>App: Dokument auswählen
    App-->>User: Vorschau anzeigen
```

### 3. Kollaboration und Sharing

```mermaid
sequenceDiagram
    participant Owner
    participant App
    participant User
    
    Owner->>App: Dokument auswählen
    Owner->>App: Sharing aktivieren
    Owner->>App: Berechtigungen festlegen
    App->>User: Einladung senden
    User->>App: Zugriff akzeptieren
    User->>App: Dokument bearbeiten
```

## Benutzergruppen und Rollen

### Administrator
- Vollzugriff auf alle Funktionen
- Bibliotheken erstellen und konfigurieren
- Benutzer und Gruppen verwalten
- System-Einstellungen anpassen
- Zugriffsprotokolle einsehen

### Bibliotheks-Manager
- Bibliothek-spezifische Verwaltung
- Ordnerstrukturen erstellen
- Berechtigungen verwalten
- Benutzer einladen
- Aktivitäten überwachen

### Standard-Benutzer
- Dokumente hochladen und verwalten
- Ordner erstellen und organisieren
- Eigene Dateien teilen
- Suchen und Zugreifen
- Metadaten bearbeiten

### Gast-Benutzer
- Lesezugriff auf freigegebene Inhalte
- Dokumenten-Vorschau
- Basis-Suchfunktion
- Keine Bearbeitungsrechte

## Berechtigungskonzept

### Zugriffsebenen

```mermaid
graph TD
    A[System-Ebene] --> B[Bibliotheks-Ebene]
    B --> C[Ordner-Ebene]
    C --> D[Datei-Ebene]
    
    subgraph "Berechtigungen"
        E[Vollzugriff]
        F[Schreibzugriff]
        G[Lesezugriff]
        H[Kein Zugriff]
    end
```

### Berechtigungstypen
- **Vollzugriff**: Alle Operationen erlaubt
- **Schreibzugriff**: Lesen, Hochladen, Bearbeiten
- **Lesezugriff**: Nur Ansicht und Download
- **Kein Zugriff**: Keine Operationen erlaubt

### Vererbung
- Berechtigungen werden hierarchisch vererbt
- Überschreibungen auf jeder Ebene möglich
- Explizite Berechtigungen haben Vorrang
- Automatische Propagierung von Änderungen 