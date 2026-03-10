# Medien-Lebenszyklus: 3-Phasen-Architektur

## Grundprinzip

Medien (Bilder, PDFs, Audio) durchlaufen drei Phasen.
In jeder Phase gelten unterschiedliche Regeln für Speicherung und Referenzierung.

**Kernregel:** Frontmatter-Felder enthalten **immer nur Dateinamen** (relativ zum Verzeichnis),
**niemals** Azure-Blob-URLs. Blob-URLs entstehen erst bei Ingestion & Publishing (Phase 3).

## Phase 1: Transkription (Extract)

```
Quelldatei (PDF, Audio, Video, Office)
  → Maschinenlesbare Artefakte erzeugen
  → Im Verzeichnis oder als binaryFragments im Shadow-Twin speichern
```

- **Input:** Quelldatei im Storage-Verzeichnis
- **Output je nach Quelldatei-Typ:**
  - **PDF:** Extrahierte Bilder (als Binärdaten gespeichert) + OCR-Text
  - **Audio/Video:** Transkript (Markdown-Datei, kein Binär-Audio)
  - **Office-Dokumente:** Extrahierter Text (Markdown)
- **Speicherung:** Bilder aus PDFs im Verzeichnis oder als `binaryFragments` im Shadow-Twin.
  Transkripte und Texte als Markdown-Dateien (keine Binärdaten).
- **Referenzierung:** Shadow-Twin kennt die Fragmente über `binaryFragments[]`

## Phase 2: Transformation (Template)

```
Fragmente + Template
  → LLM generiert Markdown + Frontmatter
  → Frontmatter enthält NUR Dateinamen (keine URLs)
  → _source_files: Quelldateinamen für Rekonstruktion
```

- **Input:** Transkripte/Fragmente aus Phase 1, Template, LLM-Anweisungen
- **Output:** Markdown-Datei mit Frontmatter
- **Frontmatter-Werte:** Nur **Dateinamen**, die sich auf Dateien im aktuellen Verzeichnis beziehen

### Warum nur Dateinamen?

1. **Portabilität:** Verzeichnisse werden mit anderen Personen geteilt (z.B. via Nextcloud, OneDrive).
   Die Empfänger müssen Artefakte lokal rekonstruieren können.
2. **Determinismus:** Ein Dateiname ist stabil. Eine Azure-URL ist an einen Container/Account gebunden.
3. **Offline-Fähigkeit:** Ohne Internet-Zugang sind Blob-URLs nicht auflösbar.

### Richtig vs. Falsch

```yaml
# ✅ RICHTIG: Nur Dateinamen im Frontmatter
coverImageUrl: cover-mahnwache.jpg
speakers_image_url: ["speaker1.jpg", "speaker2.jpg"]
galleryImageUrls: ["bild1.jpg", "bild2.jpg", "bild3.jpg"]
_source_files: ["praesentation.pdf", "interview.mp3"]

# ❌ FALSCH: Azure-URLs im Frontmatter
coverImageUrl: https://knowledgescout.blob.core.windows.net/.../abc123.jpg
```

### Multi-Source: `_source_files`

Eine Transformation kann mehrere Quelldateien verwenden (z.B. PDF + Audio + Text).
Bilder und andere Binärdaten stecken in den Shadow-Twins der jeweiligen Quelldateien.

Das Feld `_source_files` im Frontmatter speichert die **Dateinamen** aller verwendeten Quellen:

```yaml
_source_files: ["praesentation.pdf", "interview.mp3", "bericht.pdf"]
```

**Rekonstruktions-Ablauf:**
1. `_source_files` aus dem Frontmatter lesen
2. Quelldateien im Verzeichnis finden
3. Deren Shadow-Twins aufbereiten (Phase 1: Transkription)
4. Danach sind alle `binaryFragments` in den Shadow-Twins verfügbar
5. Frontmatter-Dateinamen (coverImageUrl etc.) können aufgelöst werden

**Wichtig:** Hochgeladene Dateien (Audio, Bilder, Texte, Webseiten-Crawls) müssen **zuerst
im Store persistiert** und transkribiert werden, bevor sie als Quelle verwendet werden können.

### Medien-Zuordnung im Wizard und im Transformationsdialog

Beide Flows müssen **identische Ergebnisse** produzieren:

- **Transformationsdialog (MediaTab):** Benutzer wählt Medium aus Galerie → Dateiname wird
  ins Frontmatter geschrieben, Datei wird als `binaryFragment` im Shadow-Twin registriert.
- **Creation Wizard (UploadImagesStep):** Benutzer lädt Bild hoch oder wählt aus Verzeichnis
  → Datei wird als `binaryFragment` im Shadow-Twin registriert, Dateiname ins Frontmatter.

Beide Wege nutzen die gleiche Upload-API:
`POST /api/library/{libraryId}/shadow-twins/upload-media`

## Phase 3: Ingestion & Publishing

```
Markdown + Frontmatter (mit Dateinamen)
  → Dateien auflösen (binaryFragments, Verzeichnis)
  → Medien nach Azure Blob Storage publizieren (web-fähig)
  → Frontmatter-URLs durch öffentliche Blob-URLs ersetzen
  → RAG-Vektoren erzeugen, Dokument ins Werk ingestieren
```

- **Input:** Markdown mit Dateinamen im Frontmatter
- **Output:** Publizierte Story mit Azure-URLs, Vector-Store-Einträge
- **Doppelte Funktion:**
  - **Publishing:** Medien werden in web-fähigen Blob Storage hochgeladen,
    Frontmatter-URLs durch öffentliche Azure-URLs ersetzt. Das Metadoc dient der Web-Ansicht.
  - **Ingestion:** Dokument wird ins Werk (RAG/Vector-Store) aufgenommen,
    damit es durchsuchbar und auffindbar wird.
- **Erst hier** werden Blob-URLs erzeugt.

## Multi-Source: Wiki-Link-basiertes Sammel-Transkript

### Problem

Der JobWorker arbeitet immer mit **einer** Quelldatei. Bei Multi-Source (mehrere Dateien)
kann er nicht direkt mehrere Quellen verarbeiten.

### Lösung: Referenz-Datei mit Wiki-Links + dynamische Resolution

Statt Transkript-Inhalte zu kopieren, wird eine **leichtgewichtige Referenz-Datei**
mit Obsidian-Wiki-Links erzeugt. Die Transkripte werden erst bei der Transformation
dynamisch aufgelöst (nie persistiert).

```
Phase 1 (pro Quelle):
  praesentation.pdf  → Shadow-Twin mit Transkript + binaryFragments
  interview.mp3      → Shadow-Twin mit Transkript
  bericht.pdf        → Shadow-Twin mit Transkript + binaryFragments

Sammel-Schritt (vor Phase 2):
  Referenz-Datei mit Wiki-Links erzeugen
    → [[praesentation.pdf]], [[interview.mp3]], [[bericht.pdf]]
    → _source_files im Frontmatter setzen
    → Verfügbare Medien als Wiki-Links auflisten
    → Im Storage als Datei speichern (< 1 KB)

Phase 2 (dynamische Resolution im JobWorker):
  JobWorker erkennt kind: composite-transcript
    → Wiki-Links dynamisch auflösen (MongoDB-first)
    → Geflachte Version im Speicher erzeugen (nie persistiert)
    → Transformation mit aufgelöstem Content starten
```

### Zwei Formen des Sammel-Markdowns

#### Persistierte Form (im Storage, Obsidian-kompatibel)

Leichtgewichtig, nur Wiki-Links. Wird im Dateisystem gespeichert und ist
in Obsidian direkt nutzbar (Links sind klickbar).

```markdown
---
_source_files: ["praesentation.pdf", "interview.mp3"]
kind: composite-transcript
createdAt: 2026-03-07T14:30:00Z
---

# Sammel-Transkript

## Quellen
- [[praesentation.pdf]]
- [[interview.mp3]]

## Verfügbare Medien

### Im Verzeichnis
- [[max-mustermann.jpg]]
- [[cover-klimaschutz.jpg]]

### Aus Quelldateien extrahiert
- [[praesentation.pdf#img-0.jpeg]]
- [[praesentation.pdf#img-1.jpeg]]
```

#### Aufgelöste Form (nur im Speicher, für LLM)

Wird dynamisch vom JobWorker erzeugt und nie persistiert.
Enthält die vollständigen Transkripte in `<source>`-Blöcken.

```markdown
---
_source_files: ["praesentation.pdf", "interview.mp3"]
kind: composite-transcript
---

# Quellenübersicht
| Nr. | Datei | Typ |
|-----|-------|-----|
| 1 | praesentation.pdf | PDF |
| 2 | interview.mp3 | Audio |

## Verfügbare Medien im Verzeichnis
- max-mustermann.jpg (Bild, 245 KB)
- cover-klimaschutz.jpg (Bild, 1.2 MB)
- img-0.jpeg (PDF-Fragment aus praesentation.pdf, 89 KB)

---

<source file="praesentation.pdf" index="1">
(Transkript aus Shadow-Twin, dynamisch geladen)
</source>

<source file="interview.mp3" index="2">
(Transkript aus Shadow-Twin, dynamisch geladen)
</source>
```

### Wiki-Link-Syntax

Zwei Link-Typen werden verwendet:

- `[[dateiname.ext]]` — Direkte Datei im Verzeichnis (Quellen + Medien)
- `[[quelldatei.pdf#fragment.jpeg]]` — Binary Fragment aus dem Shadow-Twin einer Quelldatei

Die `#`-Syntax ist Obsidian-kompatibel (Abschnitts-Referenz) und erlaubt
die Zuordnung von extrahierten Bildern zu ihrer Herkunftsdatei.

### Resolution-Reihenfolge: MongoDB-first

Bei der Auflösung wird zuerst MongoDB durchsucht, dann das Storage-Filesystem:

1. **MongoDB** Shadow-Twin durchsuchen (binaryFragments, Transkript-Artefakte)
2. **Storage-Filesystem** als Fallback (direkte Datei oder `.shadow-twin`-Ordner)

Für die Transformation (Phase 2) braucht das LLM nur die **Dateinamen** der Medien
für semantische Zuordnung — keine Binärdaten. Die URL-Auflösung (Azure Blob)
passiert erst in Phase 3.

### Vorteile gegenüber Inline-Kopien

- **Keine Redundanz:** Transkripte existieren nur in ihren Shadow-Twins
- **Obsidian-kompatibel:** Wiki-Links sind nativ klickbar
- **Immer aktuell:** Resolution liest stets das neueste Transkript
- **Kleine Dateien:** Die persistierte Datei ist unter 1 KB
- **Storage-unabhängig:** Funktioniert unabhängig von `persistToFilesystem`

**Warum `<source>`-Tags in der aufgelösten Version?**
Quell-Transkripte können selbst `##`-Überschriften enthalten (z.B. ein 80-seitiges PDF).
Markdown-Überschriften als Trenner würden mit dem Quellinhalt kollidieren.
XML-artige `<source>`-Tags sind eindeutig und werden von LLMs (Claude, GPT) zuverlässig
als Sektions-Begrenzer erkannt.

### Semantische Medien-Zuordnung über Dateinamen

Die Sektion "Verfügbare Medien" dient dem LLM als Zuordnungs-Hinweis.
Wenn Bilder sprechende Dateinamen haben, kann die Transformation sie
automatisch den passenden Frontmatter-Feldern zuordnen:

- `max-mustermann.jpg` → `speakers_image_url` für Speaker "Max Mustermann"
- `cover-klimaschutz.jpg` → `coverImageUrl`
- `logo-oldies-for-future.png` → Organisations-Bild
- `mahnwache-panorama.jpg` → `galleryImageUrls`

Das Systemprompt des Templates kann das LLM anweisen:
"Ordne verfügbare Bilder anhand ihrer Dateinamen den passenden Frontmatter-Feldern zu."

So können Bilder **ohne manuelle Zuordnung** ihren Weg ins Frontmatter finden,
sofern die Dateinamen semantisch aussagekräftig sind.

### Vorteile

- **JobWorker unverändert:** Arbeitet weiter mit einer Quelldatei.
  Die Pipeline erkennt Markdown-Quellen und überspringt Phase 1 automatisch.
- **Übersichtlich:** Das Sammel-Markdown enthält alle Transkripte, Frontmatter
  und verfügbare Medien als strukturierte Übersicht.
- **Automatische Zuordnung:** Sprechende Dateinamen ermöglichen semantische
  Medien-Zuordnung durch das LLM ohne manuelle Intervention.
- **Testbar:** Der Sammel-Schritt ist unabhängig von der Pipeline testbar.
- **Identisch für beide Modi:** File Preview und Wizard nutzen dieselbe Library-Funktion.

### Ablauf im File Preview Mode (Experten)

1. Benutzer wählt mehrere Dateien in der Dateiliste (Checkboxen existieren bereits)
2. Prüfung: Haben alle Quellen bereits Transkripte? Falls nicht → Transkription starten
3. Transkripte und Artefakte aller Quellen werden in ein Sammel-Markdown zusammengestellt
4. Sammel-Markdown wird im Storage gespeichert
5. File Preview zeigt das Sammel-Markdown an
6. Benutzer startet die Transformation (Phase 2) → normaler JobWorker-Lauf

### Ablauf im Wizard (Laien)

1. Benutzer sammelt Quellen (Upload, Text, URL)
2. Uploads werden **zuerst im Store persistiert** und transkribiert
3. Sammel-Markdown wird mit derselben Library-Funktion erzeugt
4. Transformation nutzt den normalen JobWorker

## Auflösungs-Kaskade (zur Laufzeit)

Wenn ein Frontmatter-Feld einen Dateinamen enthält, wird er so aufgelöst:

1. `binaryFragments` im eigenen Shadow-Twin prüfen → `resolvedUrl` verwenden
2. Bei Multi-Source: `_source_files` → Shadow-Twins der Quellen durchsuchen
3. Geschwister-Dateien im Verzeichnis prüfen → via `streaming-url` ausliefern
4. Falls nirgends gefunden → Warnung, Medium nicht gefunden

## Zusammenfassung

| Phase | Name | Frontmatter-Wert | Speicherort |
|-------|------|-----------------|-------------|
| 1 | **Transkription** (Extract) | – | Verzeichnis / Shadow-Twin binaryFragments |
| 2 | **Transformation** (Template) | **Dateiname** + `_source_files` | Verzeichnis / Shadow-Twin binaryFragments |
| 3 | **Ingestion & Publishing** | Azure-URL (final) | Azure Blob Storage + Vector-Store |

## Architektur-Prinzip: Experten-Modus zuerst

Neue Features werden zuerst im **File Preview Mode** (Experten) implementiert und getestet.
Der **Creation Wizard** (Laien) baut darauf auf und nutzt dieselbe API/Logik.

Begründung: Ein Laie soll nicht mehr können als ein Experte.
Der Wizard ist eine geführte Version desselben Prozesses.

## Konsequenzen für den Creation Wizard

Der Wizard darf **nicht** `/api/creation/upload-image` verwenden (gibt Azure-URL zurück).
Stattdessen muss er `/api/library/{libraryId}/shadow-twins/upload-media` verwenden,
die den Dateinamen zurückgibt und das `binaryFragment` im Shadow-Twin registriert.

### Voraussetzung

Der Shadow-Twin muss existieren, bevor Medien hochgeladen werden können.
Im Wizard bedeutet das: Der Shadow-Twin wird beim Erstellen des Drafts angelegt,
und Medien-Uploads geschehen danach.
