---
engine: lg
schemaVersion: 2

# Audience: kurzer Freitext, Pflicht. Wer liest das?
audienceDescription: Beschreibung der Zielgruppe in einem Satz.

# Format-Block. formatType: blogpost | longread | tutorial | opinion.
# formatLanguage: de | en (muss zum Stilprofil passen).
formatType: blogpost
formatLanguage: de

# Wortanzahl-Korridor. lengthWordsMax muss >= lengthWordsMin sein.
lengthWordsMin: 1200
lengthWordsMax: 1500

# Optionale geschaetzte Lesedauer in Minuten. Beide Felder duerfen
# weggelassen werden, wenn unklar.
readingTimeMinutesMin: 5
readingTimeMinutesMax: 6

# Pipeline-Versionen. "latest" = aktuelle, oder z.B. style_v1, quality_criteria_v1.
styleVersion: latest
criteriaVersion: latest

# Maximale Iterationen pro Phase-Loop (Default 3).
iterationMaxPerLoop: 3

# Quellen als flaches Array. Pro Quelle vier Pflichtfelder:
#   path     relativ zum Artikel-Ordner (z.B. "sources/foo.md")
#   kind     einer aus: system_description | before_after | external |
#            visual | research_note | transcript
#   purpose  ein Satz, was die Quelle ist
#   usage    ein Satz, wie die Pipeline sie nutzen darf
#
# Indizes muessen nicht lueckenlos sein. Eintraege mit kind: visual
# werden nicht in den LLM-Prompt geladen (Token-Verschwendung), sind
# aber im Cockpit sichtbar und stehen Phase 09 als Inspiration zur
# Verfuegung.
source_1_path: sources/<dateiname>.md
source_1_kind: system_description
source_1_purpose: Faktenbasis fuer die Pipeline
source_1_usage: Phasen-Agents duerfen daraus zitieren und Begriffe ableiten.
---

# Briefing

> Ausgangspunkt fuer einen neuen Artikel. Fuelle die zehn Frage-Sektionen
> unten aus. Optionale Sektionen (Struktur-Idee, Anschaulichkeits-Anker)
> duerfen leer bleiben - alle anderen muessen befuellt sein.

## Worum geht es? (Thema)

Ein Satz Arbeitstitel, dann zwei bis drei Saetze Hintergrund.

## Was ist die Kernthese?

Was soll der Leser am Ende mitnehmen - in einem Satz?

## Warum gerade jetzt? (Anlass)

Welcher Trigger, Trend oder Anlass macht das Thema gerade relevant?

## Was soll der Leser danach koennen, wissen oder fuehlen? (Ziel)

Konkrete Take-aways - gerne als kurze Liste.

## Welche Tonalitaet soll der Text haben?

Sachlich, neugierig, persoenlich, kritisch ...

## Was MUSS im Text vorkommen? (Pflicht-Inhalte)

Listenform - jeder Punkt ist nicht verhandelbar.

## Was DARF NICHT vorkommen? (Avoid-Liste)

Wortgenaue Begriffe, je mit kurzer Begruendung. Format:

- "<wort>" - <kurze Begruendung>

## Wie soll der Text gegliedert sein? (Struktur-Idee, optional)

Hook, Beats, Sonderwuensche zur Form. Darf leer bleiben, wenn es keine
spezifischen Vorgaben gibt.

## Welches durchgaengige Mini-Beispiel verankert die Erklaerung? (Anschaulichkeits-Anker)

Ein konkretes Bild, das sich durch die Erklaerung zieht. Darf leer
bleiben.

## Wie sieht Erfolg aus? (Selbsttest)

Ein Satz, den ein Leser nach dem Lesen sagen koennen soll.
