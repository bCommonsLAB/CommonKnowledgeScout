# Architekturvorschlag: Wizard als Vorstufe zum JobWorker

## Kernidee

Der Creation Wizard wird aus der File-Listenansicht gestartet. Der Anwender hat Zugriff auf Storage und Dateien. Die Publikation erfolgt normalerweise über den JobWorker. **Der Wizard soll daher nicht selbst publizieren**, sondern nur Dateien im Filesystem anlegen, die der JobWorker anschließend wie gewohnt verarbeiten und publizieren kann.

## Formulierung (prägnant)

> **Der Wizard erzeugt nur eine neue Datei im Storage – keine zusätzlichen Artefakte. Er dokumentiert ausschließlich Referenzen auf bestehende Artefakte. Die Publikation übernimmt der JobWorker, sobald der Transformationsflow im Filesystem vorhanden ist.**

## Architektur-Prinzipien

### 1. Wizard = Datei-Erzeuger, kein Publisher

- Der Wizard legt **eine** neue Markdown-Datei im Filesystem an.
- Diese Datei entspricht strukturell dem, was der JobWorker als Ausgangsdatei erwartet (analog zur PDF als Source).
- Die Datei-ID dieser Markdown-Datei dient als **Source-File-ID** und kann in MongoDB referenziert werden.
- **Kein** direkter Ingestion-Aufruf durch den Wizard.

### 2. Gleiche Struktur wie JobWorker-Output

- Die erzeugte Datei folgt dem gleichen Schema wie die JobWorker-Transformation:
  - Frontmatter mit Metadaten
  - Body mit Inhalt
  - Referenzen auf Quell-Artefakte (z.B. `sourceFileIds`, `creationFlowMetadata`)
- Damit ist die Datei für den JobWorker und die File-Preview konsistent interpretierbar.

### 3. Keine zusätzlichen Artefakte

- Der Wizard erzeugt **keine** separaten Transcript- oder Transformations-Artefakte im Shadow-Twin.
- Es werden nur **Referenzen** auf bestehende Artefakte (z.B. aus dem gewählten Ordner) im Frontmatter dokumentiert.
- Die Markdown-Datei selbst ist die einzige neue Datei.

### 4. Publikation über JobWorker

- Wenn der Transformationsflow im Filesystem vorhanden ist, übernimmt der **JobWorker** die Publikation.
- Der Anwender löst die Publikation aus der File-Listenansicht aus (z.B. „Publizieren“ / „Ingestion starten“).
- Der JobWorker nutzt dieselbe Logik wie bei PDFs: Source-ID → Transformation → Ingest.

## Ablauf (Zielbild)

```
[File-Listenansicht]
       │
       ▼
[Wizard starten] (z.B. aus Ordner-Kontext)
       │
       ▼
[Quellen sammeln] → Referenzen auf bestehende Artefakte
       │
       ▼
[Markdown generieren] (Template, Metadaten, Body)
       │
       ▼
[Eine Datei speichern] → Markdown im Storage (Source-File-ID)
       │
       ▼
[Fertig] – Keine Ingestion
       │
       ▼
[Anwender öffnet Datei] → File-Preview, ggf. Bearbeitung
       │
       ▼
[„Publizieren“] → JobWorker / Ingest-Markdown (wie bei PDF)
```

## Vorteile

1. **Einheitlicher Flow**: Wizard und JobWorker nutzen dieselbe Speicherlogik und denselben Publikationspfad.
2. **Konsistenz**: Keine Abweichung zwischen Wizard-Output und JobWorker-Output (MongoDB vs. nur Filesystem).
3. **Nachvollziehbarkeit**: Der Anwender sieht in der File-Liste die erzeugte Datei und kann sie wie jede andere über den JobWorker publizieren.
4. **Vereinfachung**: Der Wizard entfällt als Sonderfall; er erzeugt nur eine Datei, die der JobWorker versteht.

## Klarstellung: Datei ist bereits Transformation

Die Wizard-generierte Datei ist **bereits eine Transformation** – gleichzeitig Transcript und Transformation. Es gibt nur diese eine Datei im Filesystem. Siehe `wizard-transformation-source-und-single-truth.md` für Details zu:

- Frontmatter-Flag `transformationSource: true` für Pipeline-Steuerung
- Überspringen von Extract und Template, optionaler Edit/Enrich-Schritt
- Keine Redundanz: Datei als Single Point of Truth
- Vermeidung von Divergenz zwischen MongoDB und Datei

## Offene Punkte

- Wie genau löst der JobWorker die Publikation aus – über einen expliziten „Publizieren“-Button in der File-Preview oder über die bestehende Job-Infrastruktur?
- Sollen Referenzen auf bestehende Artefakte (z.B. `sourceFileIds`) für die Ingestion genutzt werden, oder dient die Markdown-Datei als alleinige Quelle?
