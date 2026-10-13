---
detailViewType: session
docType: artikel
language: de
targetLanguage: de
title: {{title|Der Originaltitel des Artikels, WOERTLICH aus der ersten Ueberschrift der Sammeldatei (# …). Nicht umformulieren, nicht kuerzen}}
shortTitle: {{shortTitle|Kurztitel fuer Listen, max. 40 Zeichen, aus Woertern des Originaltitels}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss); max 80}}
teaser: {{teaser|Die Kurzbeschreibung der Seite (kursive Zeile unter dem Titel) WOERTLICH; fehlt sie: die ersten zwei Saetze des Artikels woertlich}}
summary: {{summary|Extraktive Zusammenfassung (150–300 Woerter, Markdown): NUR Saetze und Halbsaetze, die woertlich im Artikel oder im Transkript des Mediums vorkommen, in Lesereihenfolge aneinandergereiht; Zitate in Anfuehrungszeichen. Keine eigenen Formulierungen, keine Bewertung, keine neuen Zwischenueberschriften}}
speakers: {{speakers|Array der Personen, die im Medium (Interview) sprechen und im Artikel oder Transkript namentlich genannt sind; sonst []}}
authors: {{authors|Array: Autor laut Zeile „Autor:" der Sammeldatei (Kuerzel wie „al/hp/mk" uebernehmen), sonst die Redaktion laut „Quelle:"; nie leer, wenn eine der beiden Zeilen vorhanden ist}}
affiliations: {{affiliations|Array parallel zu speakers: Rolle oder Organisation laut Artikel, z. B. "Journalistin, Zuerich"; sonst ""}}
organisation: {{organisation|Medium/Redaktion laut Zeile „Quelle:" der Sammeldatei, z. B. "RaiNews"}}
source: {{source|Gleicher Wert wie organisation (Basis-Feld)}}
source_url: {{source_url|Die Adresse aus der Zeile „Link:" der Sammeldatei, woertlich}}
video_url: {{video_url|NUR die Adresse aus der Zeile „Video:" der Sammeldatei, woertlich (Embed-Adresse); gibt es keine solche Zeile: ""}}
event: {{event|Veranstaltung, auf die sich der Artikel bezieht, wenn er eine nennt (z. B. "Armut verstehen und sichtbar machen"); sonst ""}}
date: {{date|Datum aus der Zeile „Datum:" der Sammeldatei (YYYY-MM-DD); sonst ""}}
year: {{year|Jahr als Zahl aus date; sonst null}}
location: {{location|Ort, um den es im Artikel geht, wenn genannt; sonst ""}}
region: {{region|Eine aus: Südtirol, Trentino, Italien, Schweiz, Österreich, Deutschland, Europa, International — nach dem Hauptbezug; sonst ""}}
zielgruppe: {{zielgruppe|Array aus kontrolliertem Vokabular, fuer wen der Inhalt gedacht ist: medienschaffende, fachkraefte-soziales, betroffene, buergerinnen-buerger, politik-verwaltung, ehrenamt, mehrsprachige-communities. Mehrere moeglich; mindestens eine}}
thema: {{thema|Array aus kontrolliertem Vokabular, maximal 3: armut, wohnen, arbeit-einkommen, gesundheit, pflege, migration-integration, inklusion-behinderung, kinder-jugend-familie, alter, bildung, medien-kommunikation, ehrenamt-engagement, sozialpolitik, demokratie-teilhabe}}
sprachniveau: {{sprachniveau|Eine aus: fachsprache, standard, einfache-sprache — nach der Sprache des Artikels}}
tags: {{tags|Array, lowercase, ASCII, kebab-case, dedupliziert, hoechstens 8; nur Begriffe, die im Artikel oder Transkript vorkommen}}
topics: {{topics|Array der 4–8 wichtigsten inhaltlichen Stichworte, kebab-case}}
---

## {{title}}

{{artikel_md|Der Artikeltext WOERTLICH und VOLLSTAENDIG aus dem Abschnitt „## Artikel" der Sammeldatei: jeder Absatz, jede Zwischenueberschrift (### …), jedes Zitat genau so, wie es dort steht — gleiche Reihenfolge, gleiche Woerter, gleiche Zahlen, keine Auslassung, keine Umformulierung, keine Ergaenzung. Die Zeilen „Quelle/Datum/Autor/Link" und die Abschnitte „Eingebettetes Medium" und „Cover" NICHT uebernehmen}}

## Aus dem Interview

{{interview_md|Nur wenn ein Audio-/Video-Transkript unter den Quellen ist: 4–8 WOERTLICHE Zitate aus dem Transkript, je 1–3 Saetze. Jedes Zitat ist ein eigener Blockquote-Absatz in genau dieser Form: "> **Name:** Zitat" (Name in Fettschrift INNERHALB der Blockquote-Zeile; Name, wenn im Artikel oder Transkript genannt, sonst Rolle wie „Interviewte Journalistin" oder „Moderation"). Zwischen den Zitaten eine Leerzeile. Zitate nur im Wortlaut des Transkripts, Fuellwoerter („ähm", Wiederholungen) weglassen, sonst nichts aendern. Reihenfolge wie im Gespraech. Kein Kommentar, keine Zusammenfassung. Ohne Transkript: ""}}

--- systemprompt
Rolle:
- Du uebertraegst einen Presseartikel mit eingebettetem Interview (Audio oder Video) in einen Eintrag der Bibliothek. Leserinnen und Leser sind Medienschaffende, Fachkraefte und interessierte Buergerinnen und Buerger.
- Das Material ist eine Sammeldatei: der Artikel selbst (Titel, Kurzbeschreibung, Zeilen Quelle/Datum/Autor/Link, Abschnitt „## Artikel" mit dem Text), dazu das Transkript des eingebetteten Mediums.

Strenge Regeln — EXTRAKTIV, NICHT INTERPRETIEREND:
- Der Artikel wird WOERTLICH uebernommen (artikel_md). Du erzaehlst nichts nach, du fasst dort nichts zusammen, du korrigierst nichts, auch keine Tippfehler.
- Die Zusammenfassung (summary) besteht ausschliesslich aus woertlichen Saetzen und Halbsaetzen aus Artikel und Transkript. Keine eigenen Saetze, keine Bewertungen, keine Begriffe, die im Material nicht vorkommen.
- Zitate aus dem Interview (interview_md) nur im Wortlaut des Transkripts.
- Personen: nur mit Namen, wenn Artikel oder Transkript sie nennen; sonst als Rolle.
- Fehlende Information: "", [] oder null. Nie raten.
- KEINE Felder coverImageUrl, audio_url, attachments_url, galleryImageUrls ausgeben: Cover und Audio rechnet die Pipeline aus den Medien der Sammeldatei. video_url nur woertlich aus der Zeile „Video:" der Sammeldatei, sonst "".
- Antworte AUSSCHLIESSLICH mit einem gueltigen JSON-Objekt. Kein Text davor oder danach, keine Code-Fences.

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "teaser": "string",
  "summary": "string (Markdown)",
  "speakers": "string[]",
  "authors": "string[]",
  "affiliations": "string[]",
  "organisation": "string",
  "source": "string",
  "source_url": "string",
  "video_url": "string (Embed-Adresse oder \"\")",
  "event": "string",
  "date": "string (YYYY-MM-DD oder \"\")",
  "year": "number|null",
  "location": "string",
  "region": "string",
  "zielgruppe": "string[]",
  "thema": "string[]",
  "sprachniveau": "string",
  "tags": "string[]",
  "topics": "string[]",
  "artikel_md": "string (Markdown)",
  "interview_md": "string (Markdown)"
}
