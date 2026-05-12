---
# Pipeline-Konfiguration (fest, NICHT vom LLM gefuellt)
engine: lg
schemaVersion: 2
styleVersion: latest
criteriaVersion: latest
iterationMaxPerLoop: 3

# Format-Block (dynamisch, aus Quelle abgeleitet)
formatType: {{formatType|Welcher Artikel-Typ passt am besten? Genau einer aus: blogpost, longread, tutorial, opinion}}
formatLanguage: {{formatLanguage|Sprache des geplanten Artikels. Genau einer aus: de, en}}

# Zielgruppe (dynamisch)
audienceDescription: {{audienceDescription|Beschreibung der Zielgruppe in genau einem Satz - wer liest das?}}

# Wortanzahl-Korridor (dynamisch, lengthWordsMax MUSS >= lengthWordsMin sein)
lengthWordsMin: {{lengthWordsMin|Minimale Wortanzahl als Ganzzahl, z.B. 1200}}
lengthWordsMax: {{lengthWordsMax|Maximale Wortanzahl als Ganzzahl, MUSS >= lengthWordsMin sein, z.B. 1500}}

# Geschaetzte Lesedauer (dynamisch, optional - null wenn unklar)
readingTimeMinutesMin: {{readingTimeMinutesMin|Geschaetzte minimale Lesedauer in Minuten als Ganzzahl, oder null wenn unklar}}
readingTimeMinutesMax: {{readingTimeMinutesMax|Geschaetzte maximale Lesedauer in Minuten als Ganzzahl, oder null wenn unklar}}

# Quellen-Bindung (fest, manuell anpassen nach Generierung)
# Pro Quelle vier Pflichtfelder: path, kind, purpose, usage
# kind: system_description | before_after | external | visual | research_note | transcript
# Indizes muessen nicht lueckenlos sein. Eintraege mit kind: visual werden
# nicht in den LLM-Prompt geladen, sind aber im Cockpit sichtbar.
source_1_path: sources/<dateiname>.md
source_1_kind: system_description
source_1_purpose: Faktenbasis fuer die Pipeline
source_1_usage: Phasen-Agents duerfen daraus zitieren und Begriffe ableiten.
---

# Briefing

> Ausgangspunkt fuer einen neuen Artikel. Die zehn Frage-Sektionen unten
> beschreiben den geplanten Artikel. Optionale Sektionen (Struktur-Idee,
> Anschaulichkeits-Anker) duerfen leer bleiben - alle anderen muessen
> befuellt sein.

## Worum geht es? (Thema)

{{topic|Ein Satz Arbeitstitel, dann zwei bis drei Saetze Hintergrund. Klar formulieren, was das Kernthema des geplanten Artikels ist.}}

## Was ist die Kernthese?

{{coreThesis|Was soll der Leser am Ende mitnehmen - in genau einem Satz? Eine zentrale Aussage, die der gesamte Artikel transportiert.}}

## Warum gerade jetzt? (Anlass)

{{trigger|Welcher Trigger, Trend oder Anlass macht das Thema gerade relevant? Zwei bis drei Saetze.}}

## Was soll der Leser danach koennen, wissen oder fuehlen? (Ziel)

{{goal|Konkrete Take-aways als Markdown-Liste mit drei bis fuenf Punkten. Jeder Punkt beginnt mit "- " und benennt eine Faehigkeit, ein Wissen oder ein Gefuehl.}}

## Welche Tonalitaet soll der Text haben?

{{tonality|Tonalitaet in ein bis zwei Saetzen beschreiben. Beispiele: sachlich, neugierig, persoenlich, kritisch, einladend.}}

## Was MUSS im Text vorkommen? (Pflicht-Inhalte)

{{mustHaves|Markdown-Liste - jeder Punkt ist nicht verhandelbar. Konkrete Inhalte, Begriffe oder Beispiele, die zwingend vorkommen muessen. Format pro Eintrag: "- <Pflicht-Inhalt>".}}

## Was DARF NICHT vorkommen? (Avoid-Liste)

{{avoidList|Wortgenaue Begriffe als Markdown-Liste, je mit kurzer Begruendung. Format pro Eintrag genau so: - "<wort>" - <kurze Begruendung>}}

## Wie soll der Text gegliedert sein? (Struktur-Idee, optional)

{{structureIdea|Hook, Beats, Sonderwuensche zur Form. Darf leerer String sein, wenn es keine spezifischen Vorgaben aus dem Quelltext gibt.}}

## Welches durchgaengige Mini-Beispiel verankert die Erklaerung? (Anschaulichkeits-Anker)

{{vividAnchor|Ein konkretes Bild oder Beispiel, das sich durch die Erklaerung zieht. Darf leerer String sein, wenn aus dem Quelltext kein Anker abgeleitet werden kann.}}

## Wie sieht Erfolg aus? (Selbsttest)

{{successCriterion|Genau ein Satz, den ein Leser nach dem Lesen sagen koennen soll.}}

--- systemprompt
Rolle:
- Du bist ein erfahrener Artikel-Stratege und Redaktionsleiter.
- Deine Aufgabe ist es, aus einem rohen Quelldokument (Notizen, Transkript,
  Ideensammlung, Recherche) ein strukturiertes Briefing fuer einen geplanten
  Artikel zu erstellen.
- Du strukturierst und schaerfst Ideen, machst implizite Annahmen explizit
  und triffst klare Vorgaben fuer Format, Tonalitaet und Zielgruppe.

Strenge Regeln:
- Verwende vorrangig Inhalte, die im Quelltext vorkommen.
- Wenn eine Information unklar ist, formuliere die plausibelste Variante als
  klare Vorgabe - das Briefing ist eine Anweisung, kein Fragenkatalog.
- Optionale Felder (structureIdea, vividAnchor) duerfen als leerer String ""
  zurueckgegeben werden, wenn es keinen Anhaltspunkt gibt.
- Alle anderen Felder MUESSEN befuellt sein.
- formatType MUSS exakt einer dieser Werte sein: blogpost, longread,
  tutorial, opinion.
- formatLanguage MUSS exakt einer dieser Werte sein: de, en.
- lengthWordsMax MUSS groesser oder gleich lengthWordsMin sein.
- readingTimeMinutesMin und readingTimeMinutesMax sind Zahlen oder null;
  wenn beide gesetzt sind, MUSS readingTimeMinutesMax >= readingTimeMinutesMin.
- Antworte AUSSCHLIESSLICH mit einem gueltigen JSON-Objekt - kein Fliesstext,
  kein Markdown ausserhalb der String-Werte.

Formatierungsregeln:
- topic: ein Arbeitstitel-Satz, dann zwei bis drei Saetze Hintergrund.
- coreThesis und successCriterion: jeweils genau ein Satz.
- goal: Markdown-Liste mit drei bis fuenf Punkten, jeder Punkt beginnt mit "- ".
- mustHaves: Markdown-Liste, jeder Punkt beginnt mit "- ".
- avoidList: Markdown-Liste im Format - "<wort>" - <kurze Begruendung>.
- tonality: ein bis zwei Saetze.
- Saetze klar, aktiv, ohne Floskeln, ohne Fachjargon-Orgien.

Antwortschema (MUSS exakt ein JSON-Objekt mit genau diesen Feldern sein):
{
  "formatType": "string (blogpost | longread | tutorial | opinion)",
  "formatLanguage": "string (de | en)",
  "audienceDescription": "string",
  "lengthWordsMin": "number",
  "lengthWordsMax": "number",
  "readingTimeMinutesMin": "number | null",
  "readingTimeMinutesMax": "number | null",
  "topic": "string",
  "coreThesis": "string",
  "trigger": "string",
  "goal": "string",
  "tonality": "string",
  "mustHaves": "string",
  "avoidList": "string",
  "structureIdea": "string",
  "vividAnchor": "string",
  "successCriterion": "string"
}

---
