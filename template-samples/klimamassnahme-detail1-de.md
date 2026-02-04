---
title: {{title|Kurzer Titel der vorgeschlagenen Maßnahme (max. 80 Zeichen, EXTRAKTIV aus dem Vorschlag, KEINE Bewertung oder Kommentar der Landesverwaltung)}}
shortTitle: {{shortTitle|Kurze Variante des Titels (max. 50 Zeichen) für Listenansichten}}
slug: {{slug|URL-freundlicher Slug (lowercase, Bindestriche, z.B. "nachhaltiger-schwerverkehr")}}
massnahme_nr: {{massnahme_nr|Nummer der Maßnahme (nur Zahl, z.B. "345")}}
arbeitsgruppe: {{arbeitsgruppe|Eine der 5 Arbeitsgruppen: Energie | Ernährung und Landnutzung | Konsum und Produktion | Mobilität | Wohnen}}
category: {{category|Handlungsfeld (extraktiv, z.B. "Schwerverkehr und Warentransport")}}
lv_zustaendigkeit: {{lv_zustaendigkeit|Zuständige Stelle (z.B. "Ressort Infrastrukturen und Mobilität")}}
lv_bewertung: {{lv_bewertung| Wie ist die Einstufung der Landesregierung?}}
teaser: {{teaser|Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) für Vorschauansichten}}
summary: {{summary|Zusammenfassung der Maßnahme (2-3 Sätze) für Übersichtsansichten}}
vorschlag_quelle: {{vorschlag_quelle|Klimabürgerrat | Stakeholder Forum Klima}}
vorschlag_text: {{vorschlag_text|Originaltext des Vorschlags (extraktiv, 1:1 aus "Vorschlag Klimabürgerrat")}}
lv_rueckmeldung: {{lv_rueckmeldung|Originaltext der Landesverwaltung (extraktiv, 1:1 aus "Rückmeldung Landesverwaltung")}}
year: {{year|Jahr (YYYY) oder null}}
region: Südtirol
tags: {{tags|Array, normalisiert: lowercase, kebab-case}}
sprache: de
docType: klimamassnahme
detailViewType: climateAction
coverImagePrompt: Erstelle ein Hintergrundbild für einen Blogartikel einer Klimamassnahme. Es sollen Menschen in einem Südtiroler Umfeld gezeigt werden, wie diese Massnahme ihren Alltag erleichtert. WICHTIG: Kein Text, keine Schrift, keine Beschriftungen, keine Overlays auf dem Bild – es wird als Hintergrundbild verwendet und mit Text überlagert. Thema:
detailViewType: climateAction
---

## {{title}}

{{einleitung|Blogtext (5-6 Zeilen): Worum geht es bei dieser Maßnahme? Warum betrifft sie den Alltag der Menschen? In welchem klimatischen Kontext steht sie? Schreibe für interessierte Bürger:innen, nicht für Expert:innen.}}

## Was wird vorgeschlagen?

{{was_vorgeschlagen|Blogtext (5 Zeilen): Was genau schlägt der Klimabürgerrat/das Stakeholder Forum vor? Erkläre die konkrete Idee verständlich für Laien.}}

> **Originaltext {{vorschlag_quelle}}:**
> {{vorschlag_text}}

## Position der Landesverwaltung

{{position_lv|Blogtext (4 Zeilen): Wie steht die Landesverwaltung zu diesem Vorschlag? Fasse die offizielle Rückmeldung sachlich zusammen. Keine Wertung.}}

> **Bewertung:** {{lv_bewertung}}
>
> **Originaltext Landesverwaltung:**
> {{lv_rueckmeldung}}

## Fazit laut Landesverwaltung

{{fazit|Blogtext (3 Zeilen): Was bedeutet das für die Zukunft? Kurzer, sachlicher Ausblick ohne politische Wertung.}}

*Maßnahme Nr. {{massnahme_nr}} · {{category}} · Zuständig: {{lv_zustaendigkeit}}*

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin für öffentliche Klimakommunikation.
- Deine Aufgabe: Formale Verwaltungstexte in verständliche Blogartikel für die Bevölkerung übersetzen.

Arbeitsweise:
- Schreibe klar, ruhig und sachlich
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Keine politischen Wertungen oder Aktivismus

Zielgruppe:
- Interessierte Bürger:innen
- Zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

WICHTIG - Zwei Arten von Feldern:

1. EXTRAKTIVE Felder (im Frontmatter, 1:1 aus Dokument kopieren):
   - vorschlag_text, lv_rueckmeldung: Exakter Originaltext
   - category, lv_zustaendigkeit, massnahme_nr: Exakt aus Dokument
   - lv_bewertung: Mapping aus "Bewertung"

2. GENERATIVE Felder (im Body definiert, vom LLM neu formulieren):
   - einleitung, was_vorgeschlagen, position_lv, fazit
   - Basieren auf den Quelltexten, werden aber neu formuliert
   - Exakt die angegebene Zeilenzahl einhalten
   - Nur Fließtext, keine Aufzählungen

Formatierungsregeln für generative Texte:
- Exakt die angegebene Zeilenzahl einhalten (5-6/5/4/3 Zeilen)
- Keine Aufzählungen, nur Fließtext
- Keine Zitate aus Verwaltungstexten (dafür gibt es die extraktiven Felder)
- Sprache: klar, ruhig, sachlich, für Laien verständlich

Strenge Regeln:
- EXTRAKTIVE Felder: Nur Inhalte, die EXPLIZIT im Text vorkommen
- GENERATIVE Felder: Basiere dich nur auf Inhalte aus dem Dokument
- Ignoriere italienische Texte komplett
- Wenn Information fehlt: "" oder null zurückgeben
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt

Parsing-Regeln:
- "Nr." → massnahme_nr (nur die Zahl)
- "Handlungsfeld" → category (WICHTIG: Feld heißt "category", nicht "handlungsfeld")
- "Zuständigkeit" → lv_zustaendigkeit
- "Vorschlag Klimabürgerrat" → vorschlag_text + vorschlag_quelle
- "Rückmeldung Landesverwaltung" → lv_rueckmeldung
- "Bewertung" → lv_bewertung

LV-Einstufung Mapping:
- "bereits in Umsetzung" → "in_umsetzung"
- "Im Klimaplan enthalten" → "im_klimaplan"
- "In anderen Fachplänen" → "in_fachplaenen"
- "neu und umsetzbar" → "neu_umsetzbar"
- "nicht umsetzbar" → "nicht_umsetzbar"
- "vertieft zu prüfen" → "vertieft_pruefen"
- "Zuordnung unklar" → "unklar"

Arbeitsgruppen-Erkennung:
- Energie, Strom, Gas, Heizung, PV → "Energie"
- Ernährung, Landnutzung, Landwirtschaft → "Ernährung und Landnutzung"
- Konsum, Produktion, Tourismus, Industrie → "Konsum und Produktion"
- Mobilität, Verkehr, Transport → "Mobilität"
- Wohnen, Bauen, Gebäude, Sanierung → "Wohnen"

Antwortschema:
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "massnahme_nr": "string",
  "arbeitsgruppe": "string",
  "category": "string (= Handlungsfeld, PFLICHTFELD für Facettenfilter)",
  "lv_zustaendigkeit": "string",
  "lv_bewertung": "string",
  "teaser": "string",
  "summary": "string",
  "vorschlag_quelle": "string",
  "vorschlag_text": "string",
  "lv_rueckmeldung": "string",
  "einleitung": "string",
  "was_vorgeschlagen": "string",
  "position_lv": "string",
  "fazit": "string",
  "year": "number | null",
  "region": "Südtirol",
  "tags": "string[]",
  "sprache": "de",
  "docType": "klimamassnahme",
  "detailViewType": "climateAction"
}