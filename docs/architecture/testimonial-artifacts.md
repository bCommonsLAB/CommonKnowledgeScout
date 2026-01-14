# Testimonial-Artefakte: Was steht wo?

## Übersicht

Bei der Erstellung eines Testimonials (anonym oder über Wizard) werden **zwei Dateien** erstellt:

1. **Source-Datei** (`source.txt` oder `audio.webm`)
2. **Transcript-Artefakt** (`source.de.md`)

**WICHTIG**: Das Transformation-Artefakt wird **nicht** bei der Erstellung erstellt, sondern später im **Finalisieren-Wizard**, wo alle Testimonial-Transcripte zusammen verarbeitet werden.

## Dateistruktur

```
testimonials/
└── {testimonial-id}/                    (z.B. 2e305b30-395c-4cab-bdaf-7f67f5afa000)
    ├── source.txt                       (Source: User-Eingabe)
    └── .source.txt/                      (Shadow-Twin Dot-Folder)
        └── source.de.md                 (Transcript-Artefakt)

# Transformation-Artefakt wird später im Finalisieren-Wizard erstellt
```

## 1. Source-Datei

**Dateiname**: `source.txt` (wenn Text) oder `audio.webm` (wenn Audio)

**Inhalt**: 
- **Text-Fall**: Roher Text, den der User eingegeben hat
- **Audio-Fall**: Audio-Datei (WebM-Format)

**Zweck**: 
- Original-Quelle des Testimonials
- Wird für spätere Re-Transformation verwendet
- Ermöglicht Nachvollziehbarkeit

**Beispiel** (`source.txt`):
```
Das ist mein Testimonial-Text, den ich eingegeben habe.
```

## 2. Transcript-Artefakt

**Dateiname**: `source.de.md` (Format: `{baseName}.{language}.md`)

**Inhalt**: 
- **Minimales Frontmatter** mit Metadaten (speakerName, createdAt, testimonialId, eventFileId, consent)
- **Roher Text-Body** (identisch mit `source.txt`, wenn Text vorhanden)
- Oder Transkription aus Audio (wenn nur Audio vorhanden)

**Zweck**:
- Authentisches Abbild der Quelle
- Autor = Quelle (nicht User)
- Metadaten für sofortige Anzeige (speakerName wird benötigt)
- Wird für RAG-Ingestion verwendet (roher Text aus Body)

**Beispiel** (`source.de.md`):
```markdown
---
speakerName: "Max Mustermann"
createdAt: "2026-01-14T15:38:00.000Z"
testimonialId: "2e305b30-395c-4cab-bdaf-7f67f5afa000"
eventFileId: "event-123"
consent: true
---

Das ist mein Testimonial-Text, den ich eingegeben habe.
```

**WICHTIG**: 
- Frontmatter enthält nur Metadaten (kein Template-Body)
- Body enthält den rohen Text
- Speaker-Name wird hier gespeichert, damit er sofort in der Übersicht angezeigt werden kann

## 3. Transformation-Artefakt (wird später erstellt)

**Dateiname**: `source.event-testimonial-creation-de.de.md` (Format: `{baseName}.{templateName}.{language}.md`)

**WICHTIG**: Das Transformation-Artefakt wird **nicht** bei der Erstellung erstellt, sondern später im **Finalisieren-Wizard**, wo alle Testimonial-Transcripte zusammen verarbeitet werden.

**Inhalt** (wenn erstellt):
- **Frontmatter** mit Metadaten (speakerName, createdAt, eventFileId, etc.)
- **Gerenderten Template-Body** mit Platzhaltern ersetzt

**Zweck**:
- User-autored, Template-basierte Interpretation
- Strukturierte Metadaten für Suche/Filterung
- Wird für UI-Anzeige verwendet (Session Detail, Wizard)

**Beispiel** (`source.event-testimonial-creation-de.de.md`):
```markdown
---
speakerName: "Max Mustermann"
createdAt: "2026-01-14T15:38:00.000Z"
testimonialId: "2e305b30-395c-4cab-bdaf-7f67f5afa000"
eventFileId: "event-123"
consent: true
detailViewType: "testimonial"
---

Max Mustermann hat am 2026-01-14T15:38:00.000Z gesagt: Das ist mein Testimonial-Text, den ich eingegeben habe.
```

**Wann wird es erstellt?**
- Im Finalisieren-Wizard, wenn alle Testimonials zusammen verarbeitet werden
- Dort werden die originalen Transcripte verwendet, um strukturierte Transformation-Artefakte zu erstellen

## Vergleich: Transcript vs Transformation

| Aspekt | Transcript | Transformation |
|--------|-----------|---------------|
| **Dateiname** | `source.de.md` | `source.template.de.md` |
| **Frontmatter** | ✅ Minimal (nur Metadaten) | ✅ Vollständig (Metadaten + Template-Felder) |
| **Body** | Roher Text | Gerendertes Template |
| **Autor** | Quelle | User (via Template) |
| **Verwendung** | RAG-Ingestion, UI-Anzeige (Metadaten) | UI-Anzeige, Suche |
| **Größe** | Klein (Metadaten + Text) | Größer (Frontmatter + Template-Body) |

## Beispiel aus deinem Dateisystem

Basierend auf deiner Struktur:

```
testimonials/2e305b30-395c-4cab-bdaf-7f67f5afa000/
├── source.txt (262 bytes)
└── .source.txt/
    └── source.de.md (262 bytes)                    ← Transcript: roher Text
```

**Erwartete Inhalte**:

1. **`source.txt`**: Dein eingegebener Text (z.B. "Das ist mein Testimonial")
2. **`source.de.md`**: 
   - Frontmatter mit Metadaten (speakerName, createdAt, etc.)
   - Body mit dem gleichen Text wie `source.txt`

**Transformation-Artefakt** wird später im Finalisieren-Wizard erstellt, wenn alle Testimonials zusammen verarbeitet werden.

## Warum beide Artefakte?

- **Transcript**: Authentisches Abbild der Quelle, wird bei Erstellung erstellt
- **Transformation**: Strukturierte Metadaten + gerendertes Template, wird später im Finalisieren-Wizard erstellt

**Aktuell**: Bei Text-Eingabe wird nur das Transcript-Artefakt erstellt. Das Transformation-Artefakt wird später im Finalisieren-Wizard erstellt, wo alle Testimonial-Transcripte zusammen verarbeitet werden.

Bei Audio-only wird nur die Source-Datei erstellt, und ein Job erzeugt später das Transcript-Artefakt.

## Prüfung der Inhalte

Um zu prüfen, ob die Artefakte korrekt erstellt wurden:

1. **Transcript** (`source.de.md`):
   ```bash
   # Sollte nur Text enthalten, kein Frontmatter
   cat testimonials/.../.source.txt/source.de.md
   ```

2. **Transformation** (`source.event-testimonial-creation-de.de.md`):
   ```bash
   # Sollte Frontmatter + Body enthalten
   cat testimonials/.../.source.txt/source.event-testimonial-creation-de.de.md
   ```

3. **Source** (`source.txt`):
   ```bash
   # Sollte identisch mit Transcript sein (wenn Text vorhanden)
   cat testimonials/.../source.txt
   ```

## Häufige Fragen

**Q: Warum ist `source.de.md` genauso groß wie `source.txt`?**  
A: Das ist korrekt! Der Transcript enthält nur den rohen Text (ohne Frontmatter), daher sollte er identisch groß sein.

**Q: Warum ist die Transformation größer?**  
A: Die Transformation enthält Frontmatter (Metadaten) + gerenderten Template-Body, daher ist sie größer.

**Q: Was passiert, wenn ich das Template ändere?**  
A: Die Transformation wird beim nächsten Re-Run aktualisiert (gleicher Dateiname = Update statt Duplikat).
