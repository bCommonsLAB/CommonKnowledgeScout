# Testimonial Transformation: Konzeptproblem

## Problemstellung

Bei der Erstellung eines Testimonials mit **reinem Text-Eingabe** (kein Audio, kein LLM) werden aktuell **zwei Artefakte** erstellt:

1. **Transcript** (`source.de.md`): Roher Text ohne Frontmatter
2. **Transformation** (`source.event-testimonial-creation-de.de.md`): Template-formatierter Text mit Frontmatter

## Frage: Warum gibt es ein Transformation-Artefakt?

Laut Shadow-Twin-Architektur:
- **Transcript**: Authentisches Abbild der Quelle (UC-A), Autor = Quelle
- **Transformation**: User-autored, Template-basierte Interpretation (UC-B)

## Aktuelle Situation bei Testimonials

### Was passiert aktuell:

1. **User gibt Text ein** → `source.txt`
2. **Transcript wird erstellt** → `source.de.md` (gleicher Text, ohne Frontmatter)
3. **Transformation wird erstellt** → `source.event-testimonial-creation-de.de.md`:
   - Frontmatter wird aus Metadaten generiert
   - Template-Body wird gerendert (Platzhalter ersetzt)
   - **ABER**: Kein LLM wird verwendet, keine echte "Transformation"

### Was das Template erwartet:

Das Template `event-testimonial-creation-de.md` hat einen `systemprompt`:
```
Role:
- You extract structured testimonial information from user input.
```

Das deutet darauf hin, dass eigentlich ein **LLM verwendet werden sollte**, um strukturierte Informationen zu extrahieren.

## Mögliche Interpretationen

### Variante A: Transformation = Template-Formatierung (auch ohne LLM)

**Argumentation**:
- Transformation bedeutet nicht zwingend LLM-Transformation
- Template-Formatierung (Frontmatter + Body-Rendering) ist auch eine "Transformation"
- Ermöglicht konsistente Struktur für UI-Anzeige

**Pro**:
- Konsistent mit Shadow-Twin-Architektur
- Transformation-Artefakt enthält strukturierte Metadaten (für Suche/Filterung)
- UI kann Transformation-Artefakt für Anzeige verwenden

**Contra**:
- Keine echte "Transformation" im Sinne von LLM-Interpretation
- Verwirrend, wenn kein LLM verwendet wird

### Variante B: Transformation nur bei LLM-Transformation

**Argumentation**:
- Transformation sollte nur erstellt werden, wenn tatsächlich eine LLM-Transformation stattfindet
- Bei reinem Text-Eingabe: Nur Transcript erstellen
- Frontmatter könnte direkt im Transcript stehen (aber das widerspricht der Architektur)

**Pro**:
- Klarere Semantik: Transformation = echte Transformation
- Weniger Artefakte bei einfachen Fällen

**Contra**:
- Widerspricht Shadow-Twin-Architektur (Transcript = ohne Frontmatter)
- UI braucht strukturierte Metadaten (Frontmatter)
- Inkonsistent mit anderen Medien (PDF, Audio)

### Variante C: Hybrid-Ansatz

**Argumentation**:
- Bei reinem Text-Eingabe: Nur Transcript erstellen
- Transformation wird später erstellt, wenn:
  - LLM-Transformation gewünscht ist
  - Oder wenn User explizit "Finalisieren" klickt (dann LLM-Transformation)

**Pro**:
- Klare Trennung: Transcript = Quelle, Transformation = Interpretation
- Transformation wird nur erstellt, wenn tatsächlich transformiert wird

**Contra**:
- Komplexer: Zwei Phasen (Erstellung + Finalisierung)
- UI braucht sofort strukturierte Metadaten

## Empfehlung

**Variante A** scheint am konsistentesten:
- Transformation = Template-basierte Formatierung (mit oder ohne LLM)
- Ermöglicht konsistente Struktur für alle Testimonials
- UI kann immer Transformation-Artefakt für Anzeige verwenden

**Aber**: Das Template sollte klarstellen, ob LLM verwendet wird oder nicht.

## Offene Fragen

1. **Soll das Template `event-testimonial-creation-de.md` einen LLM verwenden?**
   - Aktuell: Nein (nur Platzhalter-Ersetzung)
   - Template erwartet aber LLM (`systemprompt`)

2. **Soll bei reinem Text-Eingabe nur Transcript erstellt werden?**
   - Aktuell: Beide Artefakte werden erstellt
   - Alternative: Nur Transcript, Transformation später

3. **Was ist der Zweck des Transformation-Artefakts bei Testimonials?**
   - Strukturierte Metadaten für Suche/Filterung?
   - UI-Anzeige?
   - Oder tatsächlich transformierter Inhalt?

## Nächste Schritte

1. Klären, ob LLM-Transformation für Testimonials gewünscht ist
2. Entscheiden, ob Transformation-Artefakt auch ohne LLM erstellt werden soll
3. Dokumentation aktualisieren, um Konzept zu klären
