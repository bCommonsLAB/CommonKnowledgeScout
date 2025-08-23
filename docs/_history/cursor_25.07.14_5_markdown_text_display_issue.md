# Markdown text display issue
_Exported on 7/14/2025 at 17:33:48 GMT+2 from Cursor (1.2.4)_

---

**User**

@markdown-preview.tsx 

Warum wird dieser Markdown Text nur so  wie im Bild angezeigt?:

Es fehlt die Einleitung und Kopfteil HB04 Aiko

# page_003.jpg

## Quelle
**PDF-Datei:** 01OKT2024_Livique_Sørensen Bedding_Boxspringbett_llm.pdf
**Bild:** page_003.jpg
**Sprache:** de
**Seite:** 3

## Extrahierter Text
# Boxspringbett Sørensen Bedding | EK Preisliste

## Schritt 1: Kopfteil

### Kopfteil HB04 Aiko
- Gepolstertes Kopfteil
- 2 Höhe: ca 110 cm | 120 cm, bodenstehend
- Tiefe: ca 18 cm
- Kopfteilbreite zzgl. beidseitig ca 4-5 cm
- Höhenkürzung in 5 cm Schritt möglich, Aufpreis 86,-
- Rückseite mit Möbelstoff bezogen
- LED Leseleuchten nicht möglich

| Masse | 80 cm | 90 cm | 100 cm | 120 cm | 140 cm | 160 cm | 180 cm | 200 cm | 220 cm |
|-------|-------|-------|--------|--------|--------|--------|--------|--------|--------|
| Preise| -     | -     | -      | -      | 284,-  | 305,-  | 328,-  | 350,-  | 374,-  |

### Kopfteil HB05 Lykke
- Gepolstertes Kopfteil
- 2 Höhe: ca 110 cm | 120 cm, bodenstehend
- Tiefe: ca 12 cm
- Höhenkürzung in 5 cm Schritt möglich, Aufpreis 86,-
- Rückseite mit Möbelstoff bezogen

| Masse | 80 cm | 90 cm | 100 cm | 120 cm | 140 cm | 160 cm | 180 cm | 200 cm | 220 cm |
|-------|-------|-------|--------|--------|--------|--------|--------|--------|--------|
| Preise| 222,- | 230,- | 246,-  | 258,-  | 269,-  | 285,-  | 303,-  | 318,-  | 337,-  |

### Kopfteil HB06 Hedda
- Gepolstertes Kopfteil
- 2 Höhe: ca 110 cm | 120 cm, bodenstehend
- Tiefe: ca 9 cm
- Höhenkürzung in 5 cm Schritt möglich, Aufpreis 86,-
- Rückseite mit Möbelstoff bezogen

| Masse | 80 cm | 90 cm | 100 cm | 120 cm | 140 cm | 160 cm | 180 cm | 200 cm | 220 cm |
|-------|-------|-------|--------|--------|--------|--------|--------|--------|--------|
| Preise| 154,- | 159,- | 173,-  | 185,-  | 195,-  | 210,-  | 226,-  | 242,-  | 266,-  |

---

Gültig ab: 01.10.2024  
Alle Preise in Euro. Preisänderungen und Irrtümer vorbehalten.

---
*Automatisch erstellt am 14.7.2025, 15:42:36*

---

**Cursor**

**Analyse des Problems**

Du beschreibst, dass im Markdown-Preview (siehe Screenshot) die Einleitung und das Kopfteil HB04 Aiko fehlen, obwohl sie im extrahierten Markdown-Text vorhanden sind. Im Bild sieht man, dass die Vorschau mit einer Tabelle beginnt und erst ab „Kopfteil HB05 Lykke“ anzeigt – der Abschnitt zu HB04 Aiko fehlt komplett.

**Mögliche Ursachen**

1. **Frontmatter-Handling**  
   Im Code von `markdown-preview.tsx` wird der Markdown-Text nach Frontmatter (`--- ... ---`) durchsucht und alles davor/innerhalb entfernt.  
   ```ts
   const mainContent = content.split('---').length > 2 
     ? content.split('---').slice(2).join('---')
     : content;
   ```
   Das bedeutet:  
   - Wenn dein Markdown-Text irgendwo zwei `---` enthält, wird alles davor und dazwischen entfernt.
   - Alles nach dem zweiten `---` bleibt übrig.

2. **Dein Markdown-Text**  
   Dein Text enthält am Ende zwei `---`-Blöcke (für Trennlinien).  
   Beispiel:
   ```
   ...
   | Preise| 154,- | 159,- | ... | 266,-  |

   ---

   Gültig ab: 01.10.2024  
   ...
   ---

   *Automatisch erstellt ...*
   ```
   Das erste `---` nach der letzten Tabelle wird als Frontmatter-Ende interpretiert, und alles davor (inkl. Einleitung und HB04 Aiko) wird entfernt.

3. **Falsche Annahme im Code**  
   Der Code nimmt an, dass nur am Anfang Frontmatter steht. In deinem Fall sind die `---` aber Trennlinien im Text, keine Frontmatter.

---

**Lösungsvorschläge**

**Variante 1: Frontmatter nur am Anfang erkennen**  
Passe die Frontmatter-Erkennung so an, dass sie nur am Anfang des Dokuments greift (wie es bei YAML-Frontmatter üblich ist):

```ts
// Statt:
const mainContent = content.split('---').length > 2 
  ? content.split('---').slice(2).join('---')
  : content;

// Besser:
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
const mainContent = content.replace(frontmatterRegex, '');
```
Dadurch wird nur Frontmatter am Anfang entfernt, Trennlinien im Text bleiben erhalten.

---

**Variante 2: Frontmatter-Entfernung komplett abschalten**  
Wenn du keine Frontmatter verwendest, kannst du das Entfernen ganz weglassen:

```ts
const mainContent = content;
```

---

**Variante 3: Robustere Frontmatter-Erkennung**  
Erkenne Frontmatter nur, wenn sie wirklich am Anfang steht und mindestens eine Zeile enthält:

```ts
const frontmatterRegex = /^---\n[\s\S]+?\n---\n?/;
const mainContent = content.replace(frontmatterRegex, '');
```

---

**Empfehlung & Nächste Schritte**

- **Empfohlen:** Variante 1 – Frontmatter nur am Anfang entfernen.
- **Begründung:** Das ist Standard bei Markdown/YAML und verhindert, dass Trennlinien im Text als Frontmatter interpretiert werden.
- **Test:**  
  1. Passe die Zeile in `markdown-preview.tsx` wie oben an.  
  2. Lade die Seite neu und prüfe, ob die Einleitung und HB04 Aiko angezeigt werden.

---

**Zusammenfassung**

Das Problem entsteht, weil der Code alle Inhalte vor/nach dem zweiten `---` entfernt – und damit auch die Einleitung und HB04 Aiko.  
Mit einer gezielten Frontmatter-Erkennung am Anfang des Dokuments wird das Problem gelöst.

**Soll ich die Änderung direkt für dich im Code umsetzen?**

```typescript
   const mainContent = content.split('---').length > 2 
     ? content.split('---').slice(2).join('---')
     : content;
```

```plaintext
   ...
   | Preise| 154,- | 159,- | ... | 266,-  |

   ---

   Gültig ab: 01.10.2024  
   ...
   ---

   *Automatisch erstellt ...*
```

```typescript
// Statt:
const mainContent = content.split('---').length > 2 
  ? content.split('---').slice(2).join('---')
  : content;

// Besser:
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
const mainContent = content.replace(frontmatterRegex, '');
```

```typescript
const mainContent = content;
```

```typescript
const frontmatterRegex = /^---\n[\s\S]+?\n---\n?/;
const mainContent = content.replace(frontmatterRegex, '');
```

---

**User**

ja bitte nur am Anfang suchen

---

**Cursor**

```typescriptreact
// ... existing code ...
  // Memoize the markdown renderer
  const renderedContent = React.useMemo(() => {
    if (!content) return '';

    // Entferne Frontmatter nur am Anfang des Dokuments
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
    const mainContent = content.replace(frontmatterRegex, '');

    // Process the main content
    const processedContent = processObsidianContent(
      mainContent,
      currentFolderId,
      provider
    );

    const rendered = md.render(processedContent);
    
    return rendered;
  }, [content, currentFolderId, provider]);
// ... existing code ...
```

Die Anpassung ist erfolgt:  
Im `MarkdownPreview` wird jetzt Frontmatter nur noch am Anfang des Dokuments entfernt – Trennlinien (`---`) im restlichen Text bleiben erhalten.

**Ergebnis:**  
Deine Einleitung und „Kopfteil HB04 Aiko“ werden wieder korrekt angezeigt.  
Die Änderung ist minimal-invasiv und entspricht dem Standardverhalten für Markdown/YAML-Frontmatter.

**Test:**  
- Lade eine betroffene Datei neu in der Vorschau.
- Prüfe, ob alle Abschnitte (inkl. Einleitung und HB04 Aiko) sichtbar sind.

Wenn noch etwas fehlt oder du weitere Anpassungen brauchst, sag Bescheid!

