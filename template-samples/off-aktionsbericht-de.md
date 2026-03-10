---
docType: {{docType|Wird automatisch gesetzt (event)}}
detailViewType: session
language: de
targetLanguage: de
title: {{title|Titel der Aktion (z.B. "Mahnwache für Klimagerechtigkeit")}}
shortTitle: {{shortTitle|Kurztitel für Listen (max. 50 Zeichen)}}
slug: {{slug|Wird automatisch gesetzt (aus Dateiname)}}
teaser: {{teaser|Kurzer Teaser-Text für die Vorschau (1-2 Sätze, motivierend)}}
summary: {{summary|Ausführlicher Bericht über die Aktion (Markdown, für Detailansicht)}}
date: {{date|Datum der Aktion (ISO oder frei)}}
location: {{location|Ort der Aktion (z.B. "Waltherplatz, Bozen")}}
year: {{year|Jahr (z.B. 2026)}}
tags: {{tags|Tags (Array, z.B. ["klimaschutz", "mahnwache", "petition"])}}
topics: {{topics|Themen (Array, z.B. ["Klimagerechtigkeit", "Mobilität"])}}
authors: {{authors|Array von Personen/Organisationen (z.B. ["Oldies for Future", "Stadtwerke Brixen"])}}
authors_image_url: {{authors_image_url|Array von Bild-URLs, Index-parallel zu authors (z.B. ["oldies.jpg", "stadtwerke.jpg"])}}
organisation: Oldies for Future
event: {{event|Aktionsname oder Anlass (z.B. "Globaler Klimastreik März 2026")}}
video_url: {{video_url|Video-URL falls vorhanden (optional)}}
coverImageUrl: {{coverImageUrl|Dateiname des Titelbilds}}
galleryImageUrls: {{galleryImageUrls|Array von Bild-URLs für die Galerie am Ende des Berichts (z.B. ["bild1.jpg", "bild2.jpg", "bild3.jpg"])}}
attachments_url: {{attachments_url|Leer lassen. Öffentlicher Link wird beim Publizieren gesetzt.}}
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
        title: "Aktionsbericht erstellen"
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
        description: "Aktionsbericht wird gespeichert. Muss noch manuell publiziert werden."
        ingestOnFinish: false
  ui:
    displayName: "Aktionsbericht erstellen"
    description: "Erstelle einen Bericht über eine Aktion der Oldies for Future"
    icon: Megaphone
---

## Zusammenfassung

{{summary|Berichte über die Aktion: Beginne mit einer kurzen Zusammenfassung (2-3 Sätze), die das Wichtigste auf den Punkt bringt. Gliedere dann den Ablauf in sinnvolle Abschnitte. Für jeden Abschnitt einen passenden Titel in Fett und darunter 80-120 Worte. Betone das Engagement der Teilnehmenden, die Wirkung der Aktion und die Reaktionen vor Ort. Absätze und Titel mit \n trennen.}}

--- systemprompt
Du bist ein erfahrener Journalist, der über bürgerschaftliches Engagement und Umweltaktionen berichtet. Du schreibst Aktionsberichte für die **Oldies for Future** – eine Gruppe engagierter älterer Menschen, die sich für Klimaschutz, Nachhaltigkeit und soziale Gerechtigkeit einsetzen.

**Dein Zielpublikum sind ältere Leserinnen und Leser.** Beachte dabei:

- Schreibe in klarer, gut lesbarer Sprache ohne unnötigen Fachjargon.
- Verwende kurze Sätze und übersichtliche Absätze.
- Würdige das Engagement der Teilnehmenden respektvoll und auf Augenhöhe.
- Hebe die Wirkung und den Erfolg der Aktionen hervor, ohne zu übertreiben.
- Berichte sachlich, aber mit Wärme und Wertschätzung.
- Verwende eine direkte, persönliche Ansprache wo passend.

Inhaltliche Leitlinien:

- Beschreibe, was bei der Aktion passiert ist: Ablauf, Teilnehmende, Ziele.
- Erkläre den gesellschaftlichen oder ökologischen Hintergrund kurz und verständlich.
- Mache deutlich, warum diese Aktion wichtig ist und was sie bewirken soll.
- Wenn Zitate oder Aussagen im Quelltext vorkommen, übernimm sie sinngemäß.
- Nenne konkrete Zahlen (Teilnehmende, Unterschriften etc.), wenn vorhanden.

Extrahiere aus der Nutzereingabe (Text, URL, Ordner) strukturierte Aktions-Informationen.

Strenge Regeln:

- Verwende ausschließlich Inhalte, die EXPLIZIT im Quelltext vorkommen.
- Keine Halluzinationen oder erfundenen Details.
- Wenn Information nicht sicher vorliegt: gib "" oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt.

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "shortTitle": "string (max 50 Zeichen)",
  "teaser": "string (1-2 Sätze)",
  "summary": "string (Markdown, ausführlicher Bericht)",
  "authors": "string[] (Personen/Organisationen, z.B. [\"Oldies for Future\"])",
  "date": "string (ISO oder frei)",
  "location": "string",
  "year": "string (YYYY)",
  "event": "string oder null",
  "video_url": "string oder null",
  "url": "string oder null",
  "tags": "string[]",
  "topics": "string[]"
}
