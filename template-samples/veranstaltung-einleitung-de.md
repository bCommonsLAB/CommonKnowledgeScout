---
detailViewType: book
docType: veranstaltung
language: de
targetLanguage: de
title: {{title|Titel der Veranstaltung laut Einladung oder Flyer (max. 90 Zeichen, ohne Untertitel)}}
shortTitle: {{shortTitle|Kurztitel für Listen, max. 40 Zeichen, z. B. "Fortbildung Armut und Medien"}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss); max 80}}
teaser: {{teaser|2–3 Sätze: Worum ging es bei der Veranstaltung, für wen, was war das Ziel. Aus Flyer und Begrüßung}}
summary: {{summary|Zusammenfassung der Veranstaltung als Ganzes (250–500 Wörter, Markdown): Anlass und Ziel laut Einladung, wer eingeladen hat, wer begrüßt und einführt, welche Vorträge folgen und was die Einführung als roten Faden vorgibt}}
authors: {{authors|Array der Personen, die begrüßen oder einführen (Vor- und Nachname), nur wenn im Material genannt; sonst []}}
affiliations: {{affiliations|Array parallel zu authors: Organisation oder Rolle laut Flyer oder Vorstellung; sonst ""}}
organisation: {{organisation|Veranstalter laut Flyer oder Einladung; bei mehreren mit Komma; sonst ""}}
source: {{source|Herausgebende oder veranstaltende Organisation (Basis-Feld); gleicher Wert wie organisation}}
event: {{event|Name der Veranstaltung laut Flyer, derselbe Wert wie bei den zugehörigen Vorträgen, z. B. "Armut verstehen und sichtbar machen (Fortbildung für Medienschaffende, 25.09.2026)"}}
date: {{date|Datum der Veranstaltung YYYY-MM-DD laut Flyer oder Dateiname; sonst ""}}
year: {{year|Jahr als Zahl aus date; sonst null}}
location: {{location|Veranstaltungsort laut Flyer, z. B. "Pastoralzentrum Bozen"; sonst ""}}
region: {{region|Eine aus: Südtirol, Trentino, Italien, Schweiz, Österreich, Deutschland, Europa, International; sonst ""}}
zielgruppe: {{zielgruppe|Array aus kontrolliertem Vokabular, für wen die Veranstaltung gedacht war: medienschaffende, fachkraefte-soziales, betroffene, buergerinnen-buerger, politik-verwaltung, ehrenamt, mehrsprachige-communities. Mehrere möglich; mindestens eine}}
thema: {{thema|Array aus kontrolliertem Vokabular, maximal 3: armut, wohnen, arbeit-einkommen, gesundheit, pflege, migration-integration, inklusion-behinderung, kinder-jugend-familie, alter, bildung, medien-kommunikation, ehrenamt-engagement, sozialpolitik, demokratie-teilhabe}}
sprachniveau: {{sprachniveau|Eine aus: fachsprache, standard, einfache-sprache — nach der Sprache des Materials}}
tags: {{tags|Array, lowercase, ASCII, kebab-case, dedupliziert, höchstens 8; nur Begriffe, die im Material vorkommen}}
topics: {{topics|Array der 4–8 wichtigsten Stichworte der Veranstaltung, kebab-case}}
attachments_url: {{attachments_url|Array der DATEINAMEN aller PDF-Einträge aus „Verfügbare Medien" (nur Dateiname, ohne Pfad), zuerst die Einladung; sonst []}}
coverImageUrl: {{coverImageUrl|Dateiname des Vorschaubilds der ersten Seite der Einladung aus „Verfügbare Medien" (preview_001.jpg), NUR wenn dort vorhanden; sonst ""}}
---

## {{title}}

{{einleitung_md|Die Begrüßung und Einführung als lesbarer Text in Markdown (400–800 Wörter): Wer begrüßt, mit welchem Anliegen, welche Erwartungen und Fragen werden an die Fortbildung gestellt, welche Hinweise zum Ablauf gibt es. Aus dem Audio-Transkript; Füllwörter weglassen, nichts erfinden. Begrüßende mit Namen, wenn genannt; Teilnehmende nur als Rolle}}

## Programm

{{programm_md|Das Programm laut Einladung oder Flyer als Markdown-Liste: Uhrzeiten, Programmpunkte, Vortragende mit Funktion, Moderation, Sprache, Anmeldung oder Kosten, wenn angegeben. Wörtlich aus dem Flyer, nichts ergänzen}}

## Die Vorträge

{{vortraege_md|Markdown-Liste der Vorträge dieser Veranstaltung. Wenn das Material (Sammeldatei) bereits fertige Markdown-Links zu den Vorträgen enthält, diese Zeilen WÖRTLICH übernehmen, jeweils mit einem Halbsatz, worum es im Vortrag geht (aus Flyer oder Einführung). Sonst die Vorträge laut Programm ohne Link auflisten}}

## Veranstalter und Hintergrund

{{hintergrund_md|2–5 Sätze zu den veranstaltenden Organisationen und zum Anlass laut Flyer oder Begrüßung (z. B. Netzwerk, Kooperationspartner, Förderung). Nur was im Material steht; sonst ""}}

--- systemprompt
Rolle:
- Du beschreibst eine Fortbildung oder Tagung eines Sozialverbands als Einleitungs-Dokument, das die Veranstaltung als Ganzes vorstellt. Die einzelnen Vorträge sind eigene Dokumente; du fasst sie nicht zusammen, sondern verweist auf sie.
- Das Material ist ein Sammel-Transkript: der eigene Text der Sammeldatei (mit Links zu den Vorträgen), das Audio-Transkript der Begrüßung und Einführung und die Einladung oder der Flyer als PDF. Unter „Verfügbare Medien" stehen die Seitenbilder der PDFs.
- Schreibe klar, sachlich und in Standardsprache.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die im Material vorkommen. Keine Ergänzungen aus eigenem Wissen.
- Personen, die begrüßen oder vortragen, mit Namen, wenn im Material genannt. Teilnehmende nur als Rolle.
- Fertige Markdown-Links aus der Sammeldatei wörtlich übernehmen, Ziel-Adresse unverändert.
- Fehlende Information: "" , [] oder null. Nie raten.
- Dateinamen in coverImageUrl und attachments_url NUR aus „Verfügbare Medien" übernehmen, ohne Pfad, exakt wie dort geschrieben.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Kein Text davor oder danach, keine Code-Fences.

Zuordnung der Quellen:
- Sammeldatei (eigener Text): Links zu den Vorträgen für vortraege_md.
- Audio-Transkript (Begrüßung, Einführung): Grundlage für einleitung_md, authors, Teile von summary.
- Einladung oder Flyer (PDF): Grundlage für title, event, date, location, organisation, programm_md, hintergrund_md, coverImageUrl, attachments_url.

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "teaser": "string",
  "summary": "string (Markdown)",
  "authors": "string[]",
  "affiliations": "string[]",
  "organisation": "string",
  "source": "string",
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
  "attachments_url": "string[]",
  "coverImageUrl": "string",
  "einleitung_md": "string (Markdown)",
  "programm_md": "string (Markdown)",
  "vortraege_md": "string (Markdown)",
  "hintergrund_md": "string (Markdown)"
}
