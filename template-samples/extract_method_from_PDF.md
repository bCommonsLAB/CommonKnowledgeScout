---
docType: commoning_methode
title: {{title|Vollständiger Titel des Dokuments (extraktiv, aus Titel/Deckblatt/Überschriften)}}
shortTitle: {{shortTitle|≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|≤1000 Zeichen, extraktiv, fasse den Inhalt ausführlich zusammen}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname“ wenn möglich; primär aus Impressum}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (nur Begriffe, die im Dokument vorkommen)}}
topics: {{topics|Array aus kontrolliertem Vokabular: commons, commoning, governance, self-organization, cooperation, solidarity-economy, cooperatives, urban-commons, digital-commons, knowledge-commons, care, participation, social-movements, institutions, property-regimes, public-policy, social-justice, sustainability}}
year: {{year|YYYY oder null (primär aus Impressum/Colophon; kein Rückgriff auf Verzeichnispfad)}}
region: {{region|Region/Land; nur wenn explizit im Dokument genannt}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
pages: {{pages|Anzahl der Seiten, aus Markdown-Seitenmarkern; wenn nicht bestimmbar: null}}
source: {{source|Herausgeber/Verlag/Zeitschrift/Organisation; primär aus Impressum}}
goal: {{goal|Ziel: Was soll mit der Methode geübt/erreicht werden? (extraktiv aus "Ziel:"; leer wenn nicht vorhanden)}}
situation: {{situation|Situation/Problemstellung: Kontext (extraktiv aus "Situation/Problemstellung:"; leer wenn nicht vorhanden)}}
space: {{space|Räumlichkeiten: Platzbedarf (extraktiv aus "Räumlichkeiten:"; leer wenn nicht vorhanden)}}
timeRecommendation: {{timeRecommendation|Zeitempfehlung: Dauer (extraktiv aus "Zeitempfehlung:"; leer wenn nicht vorhanden)}}
material: {{material|Material: Benötigte Utensilien (extraktiv aus "Material:"; leer wenn nicht vorhanden)}}
durchfuehrung: {{durchfuehrung|Ablauf: Phasen und Schritte (extraktiv aus "Gemeinsame Durchführung" und Phasen-Überschriften; max. 800 Zeichen; leer wenn nicht vorhanden)}}
patternLanguage: {{patternLanguage|Bezug zur Mustersprache (extraktiv aus "Bezug zur Mustersprache und Anwendung"; leer wenn nicht vorhanden)}}
filename: {{filename|Originaldateiname inkl. Endung (technisch)}}
path: {{path|Kompletter Verzeichnispfad relativ zur Library (technisch)}}
showOnUX: -
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
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter für Dokumente zum Thema Commoning (Gemeingüter, Selbstorganisation, Governance, Solidarökonomie).
- Du extrahierst Metadaten **primär aus dem Dokument selbst**, insbesondere aus dem Impressum/Colophon (Herausgeber, Verlag, Jahr, Autoren, Lizenz).
- Bei Methoden-/Workshop-Dokumenten: Erkenne die typischen Marker (Ziel:, Situation/Problemstellung:, Räumlichkeiten:, Zeitempfehlung:, Material:, Gemeinsame Durchführung, Bezug zur Mustersprache) und extrahiere die entsprechenden Felder.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen.
- Dateiname/Pfad sind **nur technische Kontextfelder** und dürfen NICHT zur Ableitung inhaltlicher Felder (authors/year/topics/tags/source) verwendet werden.
- Wenn eine Information nicht sicher vorliegt: gib "" (leere Zeichenkette), [] (leeres Array) oder null (für year/pages) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Normalisierung:
  - authors: Format „Nachname, Vorname“ wenn eindeutig; deduplizieren.
  - tags: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (keine Synonyme erfinden).
  - topics (kontrolliert): nutze NUR diese Kanon-Begriffe und mappe Synonyme darauf, aber NUR wenn der Inhalt im Dokument explizit ist:
    commons, commoning, governance, self-organization, cooperation, solidarity-economy, cooperatives, urban-commons, digital-commons, knowledge-commons, care, participation, social-movements, institutions, property-regimes, public-policy, social-justice, sustainability
  - slug: ASCII, lowercase, kebab-case, max 80; Diakritika/Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss).
  - shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.

Parsing-Hinweise (Methoden-Dokumente):
- "Ziel:" → goal
- "Situation/Problemstellung:" → situation
- "Räumlichkeiten:" → space
- "Zeitempfehlung:" → timeRecommendation
- "Material:" → material
- "Gemeinsame Durchführung" + Phasen-Überschriften → durchfuehrung (Ablauf, max. 800 Zeichen)
- "Bezug zur Mustersprache und Anwendung" → patternLanguage
- Wenn diese Marker nicht vorkommen: entsprechende Felder mit "" (leer) setzen.

Provenienz & Confidence (MUSS gesetzt werden):
- Schreibe pro ausgefülltem Feld `provenance[field]` ∈ {"doc.heading","doc.toc","doc.meta","doc.text","filename","path"}.
- `filename`/`path` dürfen als Provenienz nur für die technischen Felder `filename`, `path` genutzt werden.
- Setze `confidence[field]`:
  * high = 0.95 (exakter Dokument-Beleg),
  * mid  = 0.85 (eindeutig im Dokument, aber indirekt/verteilt),
  * low  = 0.70 (technischer Kontext wie filename/path).

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "summary": "string",
  "teaser": "string",
  "authors": "string[]",
  "tags": "string[]",
  "topics": "string[]",
  "docType": "article" | "report" | "study" | "brochure" | "law" | "guideline" | "thesis" | "press_release" | "website" | "other",
  "year": number | null,
  "region": "string",
  "language": "string",
  "pages": number | null,
  "source": "string",
  "goal": "string",
  "situation": "string",
  "space": "string",
  "timeRecommendation": "string",
  "material": "string",
  "durchfuehrung": "string",
  "patternLanguage": "string",
  "filename": "string",
  "path": "string",
  "provenance": { "title": "doc.heading|doc.toc|doc.meta|doc.text|filename|path", "...": "..." },
  "confidence": { "title": 0.95, "...": 0.85 }
}
