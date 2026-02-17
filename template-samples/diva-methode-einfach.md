---
# Vereinfachtes Template für DIVA-Methoden (Workshop-Formate)
# Nur Pflichtfelder – extraktiv aus dem Dokument
title: {{title|Titel der Methode (extraktiv, aus Überschrift/Deckblatt, z.B. "9.1 Gordischer Knoten")}}
summary: {{summary|Kurzbeschreibung: 2–4 Sätze, extraktiv aus dem Abschnitt "Kurzbeschreibung" oder Einleitung}}
goal: {{goal|Ziel: Was soll mit der Methode geübt/erreicht werden? (extraktiv aus "Ziel:")}}
situation: {{situation|Situation/Problemstellung: Kontext, wofür die Methode geeignet ist (extraktiv aus "Situation/Problemstellung:")}}
space: {{space|Räumlichkeiten: Platzbedarf (extraktiv aus "Räumlichkeiten:")}}
timeRecommendation: {{timeRecommendation|Zeitempfehlung: Dauer in Minuten (extraktiv aus "Zeitempfehlung:")}}
material: {{material|Material: Benötigte Utensilien (extraktiv aus "Material:")}}
durchfuehrung: {{durchfuehrung|Ablauf der Methode: Phasen und Schritte (extraktiv aus "Gemeinsame Durchführung" und den Phasen-Überschriften); max. 800 Zeichen, strukturiert)}}
patternLanguage: {{patternLanguage|Bezug zur Mustersprache: Welche Commoning-Muster werden adressiert? (extraktiv aus "Bezug zur Mustersprache und Anwendung")}}
sprache: de
format: diva-methode
---

# {{title}}

{{summary}}

## Ziel
{{goal}}

## Situation / Problemstellung
{{situation}}

## Rahmenbedingungen
- **Räumlichkeiten:** {{space}}
- **Zeitempfehlung:** {{timeRecommendation}}
- **Material:** {{material}}

## Durchführung

{{durchfuehrung}}

## Bezug zur Mustersprache
{{patternLanguage}}

--- systemprompt
Rolle:
- Du bist ein extraktiver Sachbearbeiter für Workshop-Methoden und Übungsformate (z.B. aus dem DIVA-Kontext).
- Du extrahierst die wichtigsten Felder **direkt aus dem Dokument**. Erkenne typische Marker wie "Ziel:", "Situation/Problemstellung:", "Räumlichkeiten:", "Zeitempfehlung:", "Material:", "Bezug zur Mustersprache".

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Text vorkommen.
- Keine Halluzinationen. Wenn eine Information fehlt: gib "" zurück.
- Für `durchfuehrung`: Fasse den Ablauf (Phasen, Schritte) zusammen – den Haupttext unter "Gemeinsame Durchführung" und den Phasen. Max. 800 Zeichen, strukturiert.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Hinweise:
- "Kurzbeschreibung:" → summary
- "Ziel:" → goal
- "Situation/Problemstellung:" → situation
- "Räumlichkeiten:" → space
- "Zeitempfehlung:" → timeRecommendation (z.B. "60 min")
- "Material:" → material
- "Bezug zur Mustersprache und Anwendung:" oder "Bezug zur Mustersprache" → patternLanguage
- Der Fließtext unter "Gemeinsame Durchführung" und den Phasen-Überschriften → durchfuehrung

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "summary": "string",
  "goal": "string",
  "situation": "string",
  "space": "string",
  "timeRecommendation": "string",
  "material": "string",
  "durchfuehrung": "string",
  "patternLanguage": "string"
}
