---
detailViewType: book
docType: commoning_methode
title: {{title|Voller Methodenname (extraktiv, deutsche Schreibweise, ohne Kapitelnummer wie "2.2", z. B. "Auftragsklärung für den Prozess hin zu einer Commoning Organisation")}}
shortTitle: {{shortTitle|≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss); max 80}}
summary: {{summary|≤1000 Zeichen, extraktiv: was ist die Methode, wofür, wie läuft sie ab?}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, extraktiv}}
authors: {{authors|Array; Autor:innen/Urheber der Methode, nur wenn im Dokument genannt; sonst []}}
date: {{date|Stand-/Erscheinungsdatum YYYY-MM-DD, nur wenn im Dokument explizit; sonst ""}}
year: {{year|YYYY oder null, nur wenn im Dokument explizit}}
language: {{language|Dokumentsprache, z. B. "de"}}
targetLanguage: {{targetLanguage|Zielsprache der Ausgabe, i.d.R. gleich language (de)}}
source: {{source|Herausgeber/Projekt/Organisation (z. B. Reihe "CommNpractice"), nur wenn explizit}}
tags: {{tags|Array, lowercase, ASCII, kebab-case, dedupliziert, HOECHSTENS 6; streng extraktiv}}
methoden_nummer: {{methoden_nummer|Laufende Methodennummer als Zahl (aus Material/Dateiname `<N>_<Name>.pdf`); wenn nicht bestimmbar: null}}
kurzbeschreibung: {{kurzbeschreibung|Text der Zeile "Kurzbeschreibung:" wörtlich (extraktiv; sonst "")}}
ziel: {{ziel|Ziel: Was soll mit der Methode geübt/erreicht werden? (extraktiv aus "Ziel:"; sonst "")}}
situation: {{situation|Situation/Problemstellung: Kontext der Methode (extraktiv; sonst "")}}
raum: {{raum|Raumbedarf/Ort (extraktiv aus "Raum:"/"Räumlichkeiten:"/"Ort:"; sonst "")}}
zeitempfehlung: {{zeitempfehlung|Zeitempfehlung/Dauer (extraktiv aus "Zeit:"/"Zeitempfehlung:"; sonst "")}}
material: {{material|Benötigtes Material (extraktiv; sonst "")}}
durchfuehrung: {{durchfuehrung|Ablauf in Kurzform: Phasen und Schritte (extraktiv; max 800 Zeichen; sonst "")}}
durchfuehrung_md: {{durchfuehrung_md|VOLLSTÄNDIGER Text des Abschnitts "Gemeinsame Durchführung" bis vor "Bezug zur Mustersprache" als Markdown: Unterabschnitte (Mitgestaltung & Vorbereitung, Durchführung, Phase 1, Phase 2 …) als "### "-Überschriften, Absätze und Aufzählungen wörtlich übernehmen, Bild-Zeilen (![…](…)) und Abbildungs-Beschriftungen weglassen; keine Kürzung; sonst ""}}
bezug_mustersprache: {{bezug_mustersprache|Prosa-Absatz unter "Bezug zur Mustersprache (und Anwendung)" (extraktiv; sonst "")}}
anwendung_musterkartenset_md: {{anwendung_musterkartenset_md|Aufzählung unter "Anwendung des Musterkartensets" als Markdown-Liste ("- …" je Punkt, wörtlich); sonst ""}}
passende_musterkarten: {{passende_musterkarten|Array von SLUGS der Musterkarten, zu denen diese Methode passt — nur aus expliziten Kartennennungen/[[Wikilinks]]; Slug = kebab-case des Kartentitels bzw. Namensteil nach dem ersten "_"; dedupliziert; sonst []}}
passende_musterkarten_md: {{passende_musterkarten_md|Dieselben Karten als Markdown-Liste, je Zeile "- [Lesbarer Name](?doc=<slug>)"; Lesbarer Name = Kartentitel wie genannt; sonst ""}}
prozessschritte: {{prozessschritte|Array aus kontrolliertem Vokabular (nur wenn im Material belegt/gepflegt): aneignen-und-kennenlernen, vermitteln-und-ausrichten, beraten-lernen, organisieren-lernen, beginnen, visionieren, projektieren, reflektieren, kultivieren, weiterentwickeln}}
lernfeld: {{lernfeld|Eine aus: selbstbildung, organisationsbildung, lernen-zwischen-organisationen — nur wenn explizit; sonst ""}}
aeced_code: {{aeced_code|AECED-Code NUR als Querverweis, nie als Schlüssel; nur wenn explizit; sonst ""}}
bearbeitungsstatus: {{bearbeitungsstatus|"fertig" oder "in-arbeit" — aus gepflegter status-Zeile; Default "fertig"}}
video_url: {{video_url|PeerTube-Watch-URL, NUR wenn sie wörtlich im Material steht (url-Zeile im Video-Frontmatter; spitze Klammern < > entfernen); sonst ""}}
video_embed_src: {{video_embed_src|PeerTube-Embed-URL (…/videos/embed/<id>), NUR wenn wörtlich im Material (embed_url-Zeile, spitze Klammern entfernen) ODER eindeutig aus video_url ableitbar (/w/<id> → /videos/embed/<id>); sonst ""}}
video_beschreibung: {{video_beschreibung|Beschreibungstext des Videos (description-Zeile), NUR wenn im Material vorhanden; sonst ""}}
video_md: {{video_md|Wenn video_url vorhanden: genau eine Markdown-Zeile "[Video zur Methode ansehen (PeerTube)](<video_url>)"; sonst ""}}
coverImageUrl: {{coverImageUrl|Dateiname des Vorschaubilds der ersten PDF-Seite aus „Verfügbare Medien" (preview_001.jpg), NUR wenn dort vorhanden; sonst ""}}
bild_vorschau: {{bild_vorschau|Gleicher Dateiname wie coverImageUrl; sonst ""}}
bild_seite_1: {{bild_seite_1|Dateiname des hochaufgelösten Bilds der ersten PDF-Seite aus „Verfügbare Medien" (page_001.jpeg), NUR wenn dort vorhanden; sonst ""}}
pdf: {{pdf|TECHNISCH: Storage-Pfad des Methoden-PDFs — IMMER "" zurückgeben}}
filename: {{filename|Originaldateiname inkl. Endung (technisch)}}
path: {{path|Verzeichnispfad relativ zur Library (technisch)}}
---

{{kurzbeschreibung}}

- **Ziel:** {{ziel}}
- **Situation / Problemstellung:** {{situation}}
- **Raum:** {{raum}}
- **Zeit:** {{zeitempfehlung}}
- **Material:** {{material}}

## Gemeinsame Durchführung

{{durchfuehrung_md}}

## Bezug zur Mustersprache und Anwendung

{{bezug_mustersprache}}

{{anwendung_musterkartenset_md}}

## Passende Musterkarten

{{passende_musterkarten_md}}

## Video

{{video_md}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter für Methoden-/Workshop-Dokumente
  aus dem Commoning-Kontext (Reihe "CommNpractice" u. ä.).
- Quellmaterial ist eine Sammeldatei: die Verknüpfungs-Markdown der Methode (Zeilen pdf:/video_md:),
  das transkribierte Methoden-PDF (Methodensteckbrief) und ggf. eine Video-Markdown mit
  Frontmatter (title, description, url, embed_url).

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Material vorkommen.
- Dateiname/Pfad sind NUR technische Kontextfelder (filename/path). Ausnahme (strukturell
  erlaubt): methoden_nummer darf aus dem Dateinamensmuster `<N>_<Name>.pdf` gelesen werden,
  weil die Namenskonvention die Nummer TRÄGT.
- Wenn eine Information nicht sicher vorliegt: "" (String), [] (Array) oder null (Zahlen).
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown.

Erkennungs-Hinweise (Methodensteckbrief):
- "Kurzbeschreibung:" → kurzbeschreibung · "Ziel:" → ziel · "Situation/Problemstellung:" → situation
- "Raum:"/"Räumlichkeiten:"/"Ort:" → raum · "Zeit:"/"Zeitempfehlung:" → zeitempfehlung · "Material:" → material
- "Gemeinsame Durchführung" mit Unterabschnitten und Phasen → durchfuehrung (Kurzform, max 800 Zeichen)
  UND durchfuehrung_md (vollständig, als Markdown mit "### "-Überschriften, ohne Bilder und Abbildungs-Beschriftungen).
- "Bezug zur Mustersprache (und Anwendung)" → bezug_mustersprache (Prosa) · "Anwendung des Musterkartensets" → anwendung_musterkartenset_md (Liste).
- Nur wenn dort konkrete Musterkarten GENANNT sind: passende_musterkarten (Slugs) und passende_musterkarten_md (Links).
- Fehlen die Marker: entsprechende Felder "" lassen.

Querverweis-Regel (wichtig für die Detailansicht):
- passende_musterkarten trägt die Richtung METHODE → MUSTERKARTEN. Nur Karten aufnehmen,
  die im Dokument tatsächlich genannt/verlinkt sind. Titel-Nennungen in Slugs wandeln
  (lowercase, kebab-case, Umlaute normalisieren), [[Wikilinks]] auf den Slug-Teil nach dem
  ersten "_" kürzen. Keine thematischen Vermutungen. Kategorien des Kartensets
  (z. B. "Soziales Miteinander") sind KEINE Karten.

Video-Regel:
- video_url/video_embed_src/video_beschreibung nur aus dem Video-Frontmatter (url, embed_url,
  description); spitze Klammern um URLs entfernen. Ableitung Watch→Embed ist erlaubt
  (peertube …/w/<id> → …/videos/embed/<id>), sonst nichts konstruieren.
- video_md ist genau eine Markdown-Link-Zeile auf video_url oder "".

Bild-Regel:
- coverImageUrl/bild_vorschau/bild_seite_1 sind DATEINAMEN aus der Liste „Verfügbare Medien"
  (preview_001.jpg bzw. page_001.jpeg). Fehlt die Datei dort, "" zurückgeben. Keine URLs, keine Pfade.

Normalisierung:
- HTML-Entities aus dem OCR-Transkript in ALLEN Textfeldern als Zeichen schreiben:
  &amp; → &, &lt; → <, &gt; → >, &quot; → ", &#39; → '. Keine Entities in der Ausgabe.
- Überschriften in durchfuehrung_md ohne abschließenden Doppelpunkt ("### Mitgestaltung & Vorbereitung").
- slug/Slugs: ASCII, lowercase, kebab-case, max 80; ä→ae, ö→oe, ü→ue, ß→ss.
- tags: lowercase, ASCII, kebab-case, dedupliziert, höchstens 6; keine Synonyme erfinden.
- shortTitle: ≤40 Zeichen, ohne abschließende Satzzeichen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "date": string,
  "year": number | null,
  "language": string,
  "targetLanguage": string,
  "source": string,
  "tags": string[],
  "methoden_nummer": number | null,
  "kurzbeschreibung": string,
  "ziel": string,
  "situation": string,
  "raum": string,
  "zeitempfehlung": string,
  "material": string,
  "durchfuehrung": string,
  "durchfuehrung_md": string,
  "bezug_mustersprache": string,
  "anwendung_musterkartenset_md": string,
  "passende_musterkarten": string[],
  "passende_musterkarten_md": string,
  "prozessschritte": string[],
  "lernfeld": "selbstbildung" | "organisationsbildung" | "lernen-zwischen-organisationen" | "",
  "aeced_code": string,
  "bearbeitungsstatus": "fertig" | "in-arbeit",
  "video_url": string,
  "video_embed_src": string,
  "video_beschreibung": string,
  "video_md": string,
  "coverImageUrl": string,
  "bild_vorschau": string,
  "bild_seite_1": string,
  "pdf": "",
  "filename": string,
  "path": string
}
