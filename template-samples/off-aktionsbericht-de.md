---
docType: {{docType|Wird automatisch gesetzt (event)}}
detailViewType: session
language: de
targetLanguage: de
title: {{title|Titel der Aktion (z.B. "Mahnwache für Klimagerechtigkeit")}}
shortTitle: {{shortTitle|Kurztitel für Listen (max. 50 Zeichen)}}
slug: {{slug|Wird automatisch gesetzt (aus Dateiname)}}
teaser: {{teaser|Kurzer Teaser-Text für die Vorschau (1-2 Sätze, motivierend)}}
summary: {{summary|Kurze Zusammenfassung in 2-3 Sätzen: Was ist passiert, wer war beteiligt und warum ist es wichtig.}}
date: {{date|Datum der Aktion (ISO oder frei)}}
location: {{location|Ort der Aktion (z.B. "Waltherplatz, Bozen")}}
year: {{year|Jahr (z.B. 2026)}}
tags: {{tags|Tags (Array, z.B. ["klimaschutz", "mahnwache", "petition"])}}
topics: {{topics|Themen (Array, z.B. ["Klimagerechtigkeit", "Mobilität"])}}
authors: {{authors|Array von Personen/Organisationen (z.B. ["Oldies for Future", "Stadtwerke Brixen"])}}
authors_image_url: {{authors_image_url|Array von Bild-Dateinamen, index-parallel zu authors (z.B. ["oldies.jpg", "stadtwerke.jpg"]). Nur Dateinamen aus den verfuegbaren Medien verwenden, sonst [] oder "" pro Eintrag.}}
organisation: Oldies for Future
event: {{event|Aktionsname oder Anlass (z.B. "Globaler Klimastreik März 2026")}}
video_url: {{video_url|Video-URL falls vorhanden (optional)}}
coverImageUrl: {{coverImageUrl|Dateiname des Titelbilds. Nur aus "Verfügbare Medien im Verzeichnis" waehlen. Keine URL. Wenn unsicher: "".}}
galleryImageUrls: {{galleryImageUrls|Array von Bild-Dateinamen fuer die Galerie (ohne Coverbild), nur aus "Verfügbare Medien im Verzeichnis". Keine URLs. Wenn keine passenden Bilder: [].}}
attachments_url: {{attachments_url|Array von Dateinamen fuer Anhaenge (z.B. PDF/Office), bevorzugt aus den Quell-Dateien in der Quellenuebersicht. Keine URLs. Wenn keine passenden Anhaenge: [].}}
url: {{url|URL zur Original-Webseite oder Social-Media-Post (optional)}}
testimonialWriteKey: {{testimonialWriteKey|Wird automatisch gesetzt (für QR Upload)}}
creation:
  preview:
    detailViewType: session
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
    createInOwnFolder: false
  supportedSources:
    - id: text
      type: text
      label: "Text (tippen oder diktieren)"
      helpText: "Beschreibe die Aktion kurz. Was wurde gemacht, wo und wann?"
    - id: url
      type: url
      label: "Webseite oder Social-Media-Link"
      helpText: "Importiere Informationen von einer Webseite oder einem Beitrag"
    - id: folder
      type: folder
      label: "Verzeichnis mit Artefakten"
      helpText: "Audio, Video, PDF oder Office – alle bereits transkribiert"
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: CollectSource
        preset: collectSource
        title: "Quelle erfassen"
      - id: SelectArtifacts
        preset: selectFolderArtifacts
        title: "Artefakte auswählen"
      - id: Generate
        preset: generateDraft
        title: "Blogartikel erstellen"
      - id: Details
        preset: editDraft
        title: "Aktions-Details"
        fields:
          - title
          - shortTitle
          - teaser
          - summary
          - authors
          - date
          - location
          - year
          - event
          - video_url
          - url
          - tags
          - topics
      - id: UploadImages
        preset: uploadImages
        title: "Medien zuordnen"
        fields:
          - coverImageUrl
          - authors_image_url
          - galleryImageUrls
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
      - id: Publish
        preset: publish
        title: "Fertigstellen"
        description: "Blogartikel wird gespeichert. Muss noch manuell publiziert werden."
        ingestOnFinish: false
  ui:
    displayName: "Blogartikel aus Aktionen erstellen"
    description: "Erstelle einen Blogartikel über Aktionen von Oldies for Future"
    icon: Megaphone
---
{{blogartikel|Schreibe einen vollständigen Blogartikel auf Basis aller bereitgestellten Quellen (Text, URL, Dateien/Artefakte). Thema, Schwerpunkt und Ton ergeben sich aus dem Material. Der Artikel muss komplett in Markdown formatiert sein. Erzeuge die Struktur dynamisch: Die Überschrift wird später ergänzt. Beginne also mit einer kurzen Einleitung und danach sinnvolle H2-Zwischenueberschriften, die zum konkreten Thema passen. Verwende keine starre Standard-Gliederung. Der Text soll je nach Inhalt folgendes abdecken, soweit die Quellen es hergeben: Was ist passiert, wer war beteiligt, wie lief die Aktion ab, welche Reaktionen gab es, welche Botschaften stehen im Mittelpunkt und warum ist das im groesseren Zusammenhang relevant. Wenn Zitate, Eindruecke oder besondere Momente vorliegen, integriere sie passend. Wenn etwas nicht belegt ist, lasse es weg. Achte auf abwechslungsreiche Satzanfaenge, gute Lesbarkeit und einen runden, motivierenden Abschluss.}}

--- systemprompt
Du bist Autorin oder Autor fuer die Initiative **Oldies for Future**.
Die Zielgruppe umfasst auch aeltere Leserinnen und Leser.

Dauerhafte Schreibregeln:
- Schreibe klar, lebendig und gut verstaendlich.
- Nutze kurze bis mittlere Saetze und gut lesbare Absaetze.
- Formuliere respektvoll, sachlich engagiert und ohne Uebertreibung.
- Variiere Satzanfaenge und vermeide monotone Wiederholungen.

Quellenlogik:
- Verarbeite alle bereitgestellten Quellen gemeinsam (Text, URL, Ordner/Artefakte).
- Fuehre Informationen zusammen, ohne Details zu erfinden.
- Bei widerspruechlichen Angaben nutze nur klar belegbare Informationen.
- Wenn Angaben fehlen oder unsicher sind, nutze "" oder null (je nach Feldtyp).

Medien-Zuordnung:
- Verwende fuer Medienfelder ausschliesslich Dateinamen, niemals externe URLs.
- Erlaube nur Dateinamen, die in "Verfügbare Medien im Verzeichnis" oder in der Quellenuebersicht auftauchen.
- coverImageUrl: genau ein Bild-Dateiname oder "".
- galleryImageUrls: Bild-Dateinamen als Array, ohne Coverbild.
- attachments_url: Dateinamen von Anhaengen (z. B. PDF) als Array.
- authors_image_url: index-parallel zu authors; wenn kein sicheres Bild: "" am jeweiligen Index.

Strenge Regeln:
- Verwende ausschliesslich Inhalte, die explizit in den Quellen vorkommen.
- Keine Halluzinationen, keine erfundenen Zitate, keine erfundenen Zahlen.
- Antworte ausschliesslich mit einem gueltigen JSON-Objekt.

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "shortTitle": "string (max 50 Zeichen)",
  "teaser": "string (1-2 Sätze)",
  "summary": "string (kurze Zusammenfassung, 2-3 Sätze)",
  "blogartikel": "string (Markdown, vollständiger Blogartikel)",
  "authors": "string[] (Personen/Organisationen, z.B. [\"Oldies for Future\"])",
  "authors_image_url": "string[] (Bild-Dateinamen, index-parallel zu authors)",
  "date": "string (ISO oder frei)",
  "location": "string",
  "year": "string (YYYY)",
  "event": "string oder null",
  "video_url": "string oder null",
  "coverImageUrl": "string (Dateiname oder \"\")",
  "galleryImageUrls": "string[] (Bild-Dateinamen)",
  "attachments_url": "string[] (Dateinamen von Anhängen, z. B. PDF)",
  "url": "string oder null",
  "tags": "string[]",
  "topics": "string[]"
}
