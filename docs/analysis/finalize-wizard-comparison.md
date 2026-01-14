# Vergleich: Ursprünglicher Plan vs. Generischer Wizard

## Ursprünglicher Plan (deterministisch)

### Flow C - Finalisieren (deterministisch)

**Endpoint**: `/api/library/[libraryId]/events/finalize`

**Was passiert automatisch:**
1. ✅ Findet Event-Markdown automatisch (via `eventFileId`)
2. ✅ Findet alle Testimonials automatisch (im `testimonials/` Ordner)
3. ✅ Erstellt Final-Markdown **deterministisch** (ohne LLM):
   - Event-Body bleibt erhalten
   - Testimonials werden als Liste angehängt
   - Frontmatter wird aus Original übernommen + `originalFileId`, `finalRunId`, `eventStatus: 'finalDraft'`
4. ✅ Speichert in `finals/run-<timestamp>/event-final.md`
5. ✅ **Keine User-Interaktion nötig** - alles automatisch

**Vorteile:**
- ✅ Sehr deterministisch - immer gleiches Ergebnis
- ✅ Schnell - keine LLM-Transformation
- ✅ Einfach - User muss nichts tun
- ✅ Versioniert - jeder Run erzeugt neue Datei

**Nachteile:**
- ❌ Keine LLM-Transformation (nur einfache Zusammenführung)
- ❌ Keine Anpassung möglich (User kann nichts ändern)
- ❌ Event-spezifisch (nicht generisch)

### Flow D - Publizieren (deterministisch)

**Endpoint**: `/api/library/[libraryId]/events/publish-final`

**Was passiert automatisch:**
1. ✅ Final-Datei wird ingestiert
2. ✅ Original wird aus Index gelöscht
3. ✅ Index-Swap komplett automatisch

**Vorteile:**
- ✅ Sehr deterministisch
- ✅ Einfach - ein API-Call

## Neuer generischer Ansatz (weniger deterministisch)

### Wizard-basiert

**Was der User machen muss:**
1. ⚠️ Wizard starten
2. ⚠️ Quellen auswählen (welche Testimonials verwenden?)
3. ⚠️ Transformation überprüfen (LLM-generiertes Markdown)
4. ⚠️ Frontmatter bearbeiten (falls nötig)
5. ⚠️ Body bearbeiten (falls nötig)
6. ⚠️ Vorschau prüfen
7. ⚠️ Publizieren

**Vorteile:**
- ✅ LLM-Transformation möglich (intelligente Zusammenführung)
- ✅ User kann anpassen
- ✅ Generisch (funktioniert für beliebige Verzeichnisse)
- ✅ Konsistent mit Creation-Wizard

**Nachteile:**
- ❌ Mehr User-Interaktion nötig
- ❌ Weniger deterministisch
- ❌ User muss wissen, was zu tun ist

## Vergleich

| Aspekt | Ursprünglicher Plan | Generischer Wizard |
|--------|---------------------|-------------------|
| **Determinismus** | ✅ Sehr hoch (automatisch) | ⚠️ Niedriger (User-Interaktion) |
| **Geschwindigkeit** | ✅ Schnell (kein LLM) | ⚠️ Langsamer (LLM + Review) |
| **Flexibilität** | ❌ Keine Anpassung | ✅ Vollständig anpassbar |
| **Intelligenz** | ❌ Einfache Zusammenführung | ✅ LLM-Transformation |
| **User-Aufwand** | ✅ Minimal (ein Klick) | ⚠️ Hoch (mehrere Schritte) |
| **Wiederverwendbarkeit** | ❌ Event-spezifisch | ✅ Generisch |

## Problem

Der neue Ansatz ist **zu lose** - der User muss zu viel wissen und tun. Der ursprüngliche Plan war **deterministischer** und **einfacher**.

## Lösung: Hybrid-Ansatz

Kombiniere die Vorteile beider Ansätze:

### Option 1: Zwei Modi im Wizard

**Modus A: Schnell (deterministisch)**
- Automatisch alle Testimonials verwenden
- Einfache Zusammenführung (wie ursprünglich)
- Keine LLM-Transformation
- Direkt speichern

**Modus B: Vollständig (mit LLM)**
- User wählt Testimonials aus
- LLM-Transformation
- Review/Edit möglich
- Dann speichern

### Option 2: Wizard mit Defaults

**Wizard startet mit:**
- ✅ Alle Testimonials automatisch ausgewählt
- ✅ Transformation automatisch generiert
- ✅ User kann optional anpassen
- ✅ Wenn User nichts ändert → wie ursprünglicher Plan

**Vorteile:**
- ✅ Determinismus durch Defaults
- ✅ Flexibilität durch Optionen
- ✅ User muss nichts tun, wenn Defaults OK sind

### Option 3: Beide Endpunkte behalten

**Für deterministischen Flow:**
- `/events/finalize` - Wie ursprünglich (schnell, deterministisch)

**Für flexiblen Flow:**
- Wizard - Mit LLM-Transformation und Anpassung

**Vorteile:**
- ✅ Beste aus beiden Welten
- ✅ User kann wählen

**Nachteile:**
- ❌ Zwei verschiedene Wege (kann verwirrend sein)

## Empfehlung: Option 2 (Wizard mit Defaults)

Der Wizard sollte:
1. ✅ **Automatisch alle Testimonials finden** (wie ursprünglich)
2. ✅ **Automatisch alle auswählen** (Default)
3. ✅ **Automatisch Transformation generieren** (wenn Template LLM verwendet)
4. ✅ **User kann optional anpassen** (aber muss nicht)

**Das gibt:**
- Determinismus durch Defaults
- Flexibilität durch Optionen
- Einfachheit für Standard-Fall
- Anpassbarkeit für Spezial-Fälle
