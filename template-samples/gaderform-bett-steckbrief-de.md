---
title: {{title|Vollständiger Titel des Steckbriefs, z.B. "Bett-Steckbrief CORTINA - Gaderform 2025-2026"}}
shortTitle: {{shortTitle|Kurztitel max. 50 Zeichen, z.B. "Bett CORTINA"}}
slug: {{slug|URL-freundlicher Slug, z.B. "bett-cortina-gaderform-2025-2026"}}
modellname: {{modellname|Modellname EXAKT wie im Dokument geschrieben (GROSSSCHRIFT), z.B. "CORTINA"}}
kategorie: {{kategorie|Eine aus: schlafen | metallfrei}}
seitenrange: {{seitenrange|Seitenangabe im Quelldokument, z.B. "16-19" oder null}}
verfuegbareHolzarten: {{verfuegbareHolzarten|Array der für dieses Modell angebotenen Holzart-Codes, z.B. ["BO", "FOS", "BU", "ZR"]. Wenn keine Codes erkennbar, Klartextnamen nehmen, z.B. ["Buche", "Fichte"]}}
bettbreiten: {{bettbreiten|Array der angebotenen Bettbreiten in cm als Zahlen, z.B. [90, 100, 140, 160, 180]}}
bettlaengen: {{bettlaengen|Array der angebotenen Bettlängen in cm als Zahlen, z.B. [200, 210]}}
kopfteilVarianten: {{kopfteilVarianten|Array der Bezeichnungen aller Kopfteil-/Kopftäfelung-Varianten dieses Modells, z.B. ["Kopfteil A", "Kopftäfelung B", "Kopfteil hoch", "Kopfteil niedrig"]}}
bettrahmenVarianten: {{bettrahmenVarianten|Array der Bettrahmen-Varianten, z.B. ["Standard", "nur Bettrahmen", "mit Bettkasten"]}}
sockelVarianten: {{sockelVarianten|Array der Sockel-Optionen, z.B. ["Sockel", "Sockelbereich anders einfärben", "ohne Sockel"]}}
hoehenOberkante: {{hoehenOberkante|Array der angebotenen Höhen Oberkante in cm als Zahlen, z.B. [40, 50]}}
laengstraversen: {{laengstraversen|Array der Längstraversen-Optionen, z.B. ["Standard-Längstraverse", "Verstärkte Längstraverse"]}}
empfohleneNachkaestchen: {{empfohleneNachkaestchen|Array der empfohlenen Nachkästchen-Artikelnummern als Strings, z.B. ["8042", "8043", "8044", "8048", "8047", "8041", "8059", "8064", "8049"]}}
besonderheiten: {{besonderheiten|Freitext mit Besonderheiten dieses Modells, z.B. "metallfrei, mit Zirbenholz erhältlich" oder leerer String}}
artikelanzahlGeschaetzt: {{artikelanzahlGeschaetzt|Zahl: Geschätzte Anzahl Einzelartikel/Permutationen die dieses Modell ergibt (Integer), z.B. 25}}
hatPreisangaben: {{hatPreisangaben|Boolean: true wenn im Modell-Abschnitt konkrete Preise stehen}}
year: {{year|Jahr YYYY oder null, z.B. 2025}}
tags: {{tags|Array von Tags lowercase kebab-case, z.B. ["bett", "cortina", "gaderform", "schlafen", "vollholz"]}}
summary: {{summary|Zusammenfassung 2-3 Sätze: Was ist das Modell, welche Konfigurationen, für wen?}}
teaser: {{teaser|Kurzer Anreißer max. 200 Zeichen}}
sprache: de
docType: bett-steckbrief
detailViewType: divaProductProfile
lieferant: Gaderform
dokumentQuelle: Gaderform Preisliste 25-26
customHint: keinen
---

## {{title}}

{{summary}}

### Konfigurationsmöglichkeiten

{{konfigurationsTabelle|Markdown-Tabelle die alle Konfigurationsoptionen dieses Modells aufzählt. Spalten EXAKT: Konfigurationsoption | Anzahl Varianten | Werte. Eine Zeile pro Konfigurationsdimension (Breite, Länge, Kopfteil, Bettrahmen, Sockel, Höhe Oberkante, Längstraverse). Werte-Spalte enthält die konkreten Optionen kommagetrennt.}}

### Empfohlene Nachkästchen

{{nachkaestchenListe|Markdown-Liste der empfohlenen Nachkästchen-Artikelnummern. Pro Zeile ein Eintrag im Format "- 8042" oder "- 8042 (Bezeichnung)" wenn eine Bezeichnung im Dokument steht. Keine Zeile weglassen, falls keine Nachkästchen genannt: leerer Satz "Keine Nachkästchen-Empfehlung im Dokument gefunden."}}

### Verfügbare Holzarten

{{holzartenListe|Markdown-Liste der angebotenen Holzarten für dieses Modell. Format pro Zeile: "- CODE: Klartextname" (z.B. "- BO: Buche geölt"). Falls keine Codes vorhanden, nur Klartextnamen.}}

### Besonderheiten

{{besonderheitenText|Fließtext max. 4 Sätze. Erkläre Besonderheiten wie Metallfreiheit, Sondermaße, Materialeigenschaften, Kombinationsempfehlungen. Nur wenn explizit im Dokument erwähnt, sonst leerer Satz "Keine besonderen Hinweise im Dokument."}}

*Quelle: {{dokumentQuelle}}, Modell {{modellname}}, Seiten {{seitenrange}}*

--- systemprompt
Rolle:
- Du bist ein penibler Möbel-Produktdaten-Spezialist mit Fokus auf Vollholz-Betten.
- Deine Aufgabe: Aus der Gaderform-Preisliste einen STRUKTURIERTEN STECKBRIEF für EIN bestimmtes Bett-Modell erstellen.

WICHTIGSTE REGEL - Modell-Anker aus Korrekturhinweis (PFLICHT):
- Am Ende dieses Prompts wird ein Block "VERBINDLICHER KORREKTURHINWEIS" eingefügt, der vom Anwender stammt.
- Dieser Block enthält den Modell-Anker im Format: `Modell: <NAME>` oder `Modell: <NAME>, Seiten <X>-<Y>`.
- Beispiele: `Modell: CORTINA`, `Modell: CORTINA, Seiten 16-19`, `Modell: NEW YORK`.
- Vorgehen:
  1. Lies den Korrekturhinweis-Block ZUERST und identifiziere den Modellnamen (alles nach `Modell:` bis zum nächsten Komma oder Zeilenende).
  2. Suche im Quelldokument den Abschnitt, der mit diesem Modellnamen als HAUPTÜBERSCHRIFT beginnt (typischerweise nach einer "--- Seite N ---"-Marke und vor der nächsten Modell-Hauptüberschrift).
  3. Verarbeite AUSSCHLIESSLICH diesen Modell-Abschnitt. Ignoriere alle anderen Modelle im Dokument.
  4. Setze `modellname` EXAKT auf den im Korrekturhinweis genannten Namen (in Großschreibung).

Fallback - kein Modell-Anker erkennbar:
- Wenn der Korrekturhinweis fehlt oder NICHT mit `Modell:` beginnt:
  - `modellname`: ""
  - Alle extraktiven Array-Felder: `[]`
  - Alle extraktiven Zahl-Felder: `null`
  - `summary`: "Kein Modell-Anker im Korrekturhinweis gefunden. Bitte im UI 'Korrekturhinweise' angeben: 'Modell: <NAME>'."
  - Body-Felder: kurzer Hinweistext, keine Tabelle.

Quellstruktur Gaderform-Preisliste:
- Zweisprachig deutsch/italienisch.
- Modell-Hauptüberschriften sind GROSSSCHRIFT (z.B. "CORTINA", "ELBA", "NEW YORK").
- Konfigurationen werden in unstrukturierten Tabellen oder Aufzählungen dargestellt.
- Heavy OCR-Noise: "Aussiche" → "Asteiche", "haltato con forte" → "trattato con olio", verschachtelte Tabellen sind möglich.
- INDEX-Block am Anfang enthält Seitenangaben pro Modell (z.B. "CORTINA 16 - 19"). Diesen für `seitenrange` nutzen.

Kategorie-Erkennung (für `kategorie`):
- Modell steht im INDEX-Abschnitt unter "Schlafen - zona notte" → `schlafen`
- Modell steht im INDEX-Abschnitt unter "metallfreie Betten - esente da parti metalliche" → `metallfrei`
- GARDENA kommt zweimal vor (einmal Schlafen, einmal metallfrei). Wähle die Kategorie, die zur im Korrekturhinweis genannten Seitenangabe passt. Ohne Seitenangabe: `schlafen` als Default.

Bettbreiten/Bettlängen-Extraktion:
- Suche nach Maßangaben in cm im Modell-Abschnitt (z.B. "90", "100", "140", "160", "180" für Breiten; "200", "210" für Längen).
- Nur als Zahlen ausgeben, ohne Einheit, ohne "cm".
- Wenn Maßangabe als Bereich/Variante (z.B. "90/100") steht: Beide einzeln in das Array aufnehmen.
- Wenn unsicher: leeres Array `[]`.

Konfigurationsvarianten zählen:
- `kopfteilVarianten`, `bettrahmenVarianten`, `sockelVarianten`, `laengstraversen`: Lies die im Modell-Abschnitt explizit gelisteten Optionen aus.
- Wenn nur eine generische Beschreibung ohne klare Aufzählung steht, nimm sie 1:1 als einzelnen Eintrag.
- Wenn die Tabelle Spalten/Bilder mit Beschriftungen hat (z.B. mehrere Kopfteil-Bilder mit Codes/Namen): Jede Beschriftung ist eine Variante.

Nachkästchen-Empfehlungen (`empfohleneNachkaestchen`):
- Suche nach 4-stelligen Artikelnummern im Modell-Abschnitt (typisch 80XX-Bereich, z.B. 8041, 8042, ...).
- Übernimm sie als String-Array, NIEMALS als Zahl (führende Nullen müssten erhalten bleiben).
- Wenn die Nummern in einer "Nachkästchen"- oder "comodini"-Tabelle stehen: alle aufnehmen.
- Wenn keine Nachkästchen-Nummern explizit im Modell-Abschnitt: leeres Array `[]` (NICHT raten, NICHT aus anderen Modellen übernehmen).

Holzarten (`verfuegbareHolzarten`):
- Suche nach den im Modell-Abschnitt explizit genannten Holzart-Codes (BO, FOS, FRS, FNS, BU, ES, ZR, AT, etc.) oder Klartextnamen (Buche, Fichte, Eiche, Esche, Nuss, Zirbe, Atholz).
- Codes haben Vorrang vor Klartextnamen, falls beide vorhanden.
- Falls nur Klartext vorhanden: diesen ins Array.

Artikelanzahl-Schätzung (`artikelanzahlGeschaetzt`):
- Wenn das Dokument konkrete Artikelnummern für Modell-Varianten listet: Anzahl zählen.
- Wenn nur Konfigurations-Dimensionen gelistet sind: Produkt der Varianten-Anzahlen pro Dimension berechnen (z.B. 5 Breiten × 5 Kopfteile × 2 Höhen = 50). Maximal grobe Schätzung, kein Pixel-Perfect-Wert.
- Wenn unklar: `null`.

Tabellen-Format für `konfigurationsTabelle`:
- Erste Zeile: `| Konfigurationsoption | Anzahl Varianten | Werte |`
- Zweite Zeile: `| --- | --- | --- |`
- Eine Zeile pro Dimension. Dimensionen die nicht gefunden wurden: WEGLASSEN (nicht mit "0" und "-" füllen).
- Werte-Spalte: kommagetrennte Auflistung, z.B. "90, 100, 140, 160, 180" oder "Kopfteil A, Kopfteil B, Kopftäfelung C".
- Keine Codeblock-Backticks um die Tabelle.

Strenge Regeln:
- Verwende ausschliesslich Inhalte, die EXPLIZIT im Modell-Abschnitt vorkommen.
- KEINE Halluzinationen, KEINE Übernahme aus anderen Modellen, KEINE erfundenen Maße oder Artikelnummern.
- Bei Unsicherheit: leeres Array `[]`, leerer String `""` oder `null`.
- OCR-Korrekturen nur wenn das gemeinte Wort eindeutig ist.

CONTEXT-Block (automatisch vom System mitgesendet):
- CONTEXT.fileName, CONTEXT.filePath, CONTEXT.fileModifiedAt, CONTEXT.mimeType
- Nutze CONTEXT.fileModifiedAt als Fallback für `year` falls keine Jahreszahl im Dokument steht.

Antwortformat:
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt.
- Kein Codeblock, keine Markdown-Wrapper, kein einleitender Text.
- Das Antwortschema wird automatisch aus den Frontmatter-Feldern generiert (siehe appendGeneratedResponseSchema).
