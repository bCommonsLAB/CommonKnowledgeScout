---
docType: {{docType|Wird automatisch gesetzt (event)}}
detailViewType: session
title: {{title|Titel des Events/Talks}}
shortTitle: {{shortTitle|Kurztitel für Listen (max. 50 Zeichen)}}
slug: {{slug|Wird automatisch gesetzt (aus Dateiname)}}
teaser: {{teaser|Kurzer Teaser-Text}}
summary: {{summary|Ausführliche Zusammenfassung (Markdown, für Detailansicht)}}
date: {{date|Datum (ISO oder frei)}}
location: {{location|Ort}}
year: {{year|Jahr (z.B. 2026)}}
tags: {{tags|Tags (Array oder Text)}}
topics: {{topics|Themen (Array oder Text)}}
speakers: {{speakers|Sprecher/Personen (Array, z.B. ["Max Mustermann", "Anna Schmidt"])}}
speakers_image_url: {{speakers_image_url|URLs zu Speaker-Bildern (Array, falls aus Quelle extrahierbar)}}
speakers_url: {{speakers_url|URLs zu Speaker-Profilen (Array, optional)}}
organisation: {{organisation|Organisation/Verein des Vortrags (z.B. "OEW", "Kolpingjugend", "AVS")}}
event: {{event|Event-Name (z.B. "SFSCON 2024")}}
track: {{track|Track/Seminar (z.B. "Main Track")}}
video_url: {{video_url|peertube/Vimeo/YouTube Embed-URL (falls vorhanden)}}
coverImageUrl: {{coverImageUrl|Dateiname des Thumbnails (z.B. aus events-Liste, für Galerie-Cover)}}
attachments_url: {{attachments_url|Leer lassen. Öffentlicher Link zum PDF wird erst beim Publizieren gesetzt (PDF hat zu diesem Zeitpunkt noch keine öffentliche URL). Optional manuell ergänzen, falls bereits ein Freigabe-Link existiert.}}
url: {{url|URL zur Original-Webseite (optional)}}
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
      helpText: "Beschreibe den Event kurz. Titel, Ort, Datum und Ziel sind hilfreich."
    - id: url
      type: url
      label: "Webseite"
      helpText: "Importiere Informationen von einer Webseite"
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
        title: "Event-Details extrahieren"
      - id: Details
        preset: editDraft
        title: "Event-Details"
        fields:
          - title
          - shortTitle
          - teaser
          - summary
          - speakers
          - organisation
          - date
          - location
          - year
          - event
          - track
          - video_url
          - coverImageUrl
          - attachments_url
          - url
          - tags
          - topics
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
      - id: Publish
        preset: publish
        title: "Fertigstellen"
        description: "Event wird gepeichert. Muss noch manuell publiziert werden."
        ingestOnFinish: false
  ui:
    displayName: "Event erstellen"
    description: "Erstelle eine Event-Seite als Container (mit Platz für Testimonials)"
    icon: Calendar
---

## Zusammenfassung & Highlights
{{summary|Bitte die Texte des Video-Transcripts, des Web-Texts und der Slide-Texte sinnvoll auswerten. Zuerst eine kurze Zusammenfassung. Darunter den Text in treffenden Abschnitten gliedern. Für jeden Abschnitt einen passenden Titel in Fett darstellen und darunter jeden Abschnitt ausführlich mit mindestens 120 Worten zusammenfassen. Absätze und Titel mit \n trennen.}}

--- systemprompt
Du bist ein spezialisierter Journalist, der Themen für Umwelt- und Sozialverbände recherchiert und verständlich sowie anwendbar aufbereitet. Deine Aufgabe ist es, komplexe Entwicklungen aus Open Source, Software-Entwicklung, Infrastruktur, Netzwerken, Sicherheit und Hardware so darzustellen, dass ihre Bedeutung für nachhaltige, soziale und gemeinschaftsorientierte Transformationsprozesse klar wird.

- Kommuniziere klar, präzise und reflektiert.
- Vermeide Fachjargon oder erkläre ihn kurz, falls notwendig.
- Hebe stets den Bezug zur ökosozialen Transformation hervor.
- Stelle praxisnahe Anwendungen in den Vordergrund, insbesondere für Eco-Social Designer.
- Berücksichtige ethische, soziale und ökologische Fragestellungen.

Extrahiere aus der Nutzereingabe (Text, URL, Ordner) strukturierte Event-/Session-Informationen.

Als url verwenden wir den Eintrag zu CAST Webseite: https://climateaction.bz/neuigkeiten/

Suche in folgender Liste den passenden Eintrag anhand des Session-Titels und setze:
- **video_url** aus dem Feld `url`
- **coverImageUrl** aus dem Feld `thumbnail` (Dateiname des Bildes im Ordner – wird für die Galerie-Anzeige verwendet)

Die Thumbnail-Dateinamen entsprechen den Bildern im Quellordner.

### Hier ist dein JSON mit korrekt formatierten Embed-URLs (für alle bekannten IDs)

{
  "events": [
    {
      "nr": 1,
      "title": "Neustift 2026 - 01 - Vorstellung - CAST News - KlimabotschafterIn - Klimagesetzt",
      "url": "https://peertube.uno/videos/embed/aCkAAGUmJPd8XujxU7gZJq",
      "duration": "37:34",
      "thumbnail": "4dcbad24-2878-48ea-9329-7c8ebac21a6f.jpg"
    },
    {
      "nr": 2,
      "title": "Neustift 2026 - 02 - Digital Independence Day - David Hofmann",
      "url": "https://peertube.uno/videos/embed/1aUyxmxfSy2SKWB71dp5Rq",
      "duration": "12:28",
      "thumbnail": "145646e0-dec8-4744-99a7-629640d23ea3.jpg"
    },
    {
      "nr": 3,
      "title": "Neustift 2026 - 03 - Southtyrolcloud - Nextcloud - Paolo Dongilli",
      "url": "https://peertube.uno/videos/embed/7SByFSmCxDiLZNupvPj9F3",
      "duration": "10:51",
      "thumbnail": "34dd92f7-c6b9-475d-9528-68a7bd53f5ed.jpg"
    },
    {
      "nr": 4,
      "title": "Neustift 2026 - 04 - Knowledgescout - Peter Aichner",
      "url": "https://peertube.uno/videos/embed/sgcasvg5frDC2xuRXUaKY7",
      "duration": "14:08",
      "thumbnail": "a3e73021-4858-4228-98e7-30c86e5e3e26.jpg"
    },
    {
      "nr": 5,
      "title": "Neustift 2026 - 05 - Perspektivenfabrik - Anna Schuierer und Anton Schuh",
      "url": "https://peertube.uno/videos/embed/1CkthCmQzs81HHnXuyBvjC",
      "duration": "7:16",
      "thumbnail": "33330326-21af-41b6-bba7-5f87a6a2a3c1.jpg"
    },
    {
      "nr": 6,
      "title": "Neustift 2026 - 06 - CiviSiO2 - Stefan Plank",
      "url": "https://peertube.uno/videos/embed/ouQxjKAWoWvM6JXauxkvbD",
      "duration": "12:51",
      "thumbnail": "73f550c1-305e-494f-8dda-2d1208d926f1.jpg"
    },
    {
      "nr": 7,
      "title": "Neustift 2026 - 07 - Klimaspiel - OEW - Franziska Blaas",
      "url": "https://peertube.uno/videos/embed/d5w3u1QYcYHK39CQ5VAf77",
      "duration": "13:51",
      "thumbnail": "21cdea65-4991-4f6d-b294-e9c18d024f84.jpg"
    },
    {
      "nr": 8,
      "title": "Neustift 2026 - 08 - Task Force Snow - Ruth Heidingsfelder",
      "url": "https://peertube.uno/videos/embed/5cnkPQGAMWPhA5WNU3hj59",
      "duration": "7:20",
      "thumbnail": "0eabfc51-1db2-49cd-9dac-20e5b46cee72.jpg"
    },
    {
      "nr": 9,
      "title": "Neustift 2026 - 09 - Unser Wald - Anna Maria Ramoser",
      "url": "https://peertube.uno/videos/embed/oyL6GbWhWBGsKS2WwzxUH2",
      "duration": "4:38",
      "thumbnail": "f311228e-41e9-4ebc-93b4-858c3bccfa51.jpg"
    },
    {
      "nr": 10,
      "title": "Neustift 2026 - 10 - Klimaplan und Bettenstoppetition - Thomas Benedikter",
      "url": "https://peertube.uno/videos/embed/oue6z6HH5bBr7YWh1v981x",
      "duration": "11:25",
      "thumbnail": "f46b93ee-7f46-49b6-a5e7-f8246f022d61.jpg"
    },
    {
      "nr": 11,
      "title": "Neustift 2026 - 11 - Plattform Pro Pustertal - Christine Baumgartner",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_11",
      "duration": "2:24",
      "thumbnail": "e2a557d2-3253-4acd-a2ca-4ce89084ca43.jpg"
    },
    {
      "nr": 12,
      "title": "Neustift 2026 - 12 - AVS - Philipp Ferrara",
      "url": "https://peertube.uno/videos/embed/h9ymvcLH19mKf2cQuz4gDo",
      "duration": "5:25",
      "thumbnail": "96f79e2b-864b-4605-9dfa-67e6e69981a6.jpg"
    },
    {
      "nr": 13,
      "title": "Neustift 2026 - 13 - Agitù Preis - Susanne Elsen",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_13",
      "duration": "2:54",
      "thumbnail": "f599e9e1-64df-476c-9d84-666fb56d4c1c.jpg"
    },
    {
      "nr": 14,
      "title": "Neustift 2026 - 14 - Begrünungsprojekt Premstallerhof (Regreen Rentsch) - Reinhard Dallinger",
      "url": "https://peertube.uno/videos/embed/2J2SfhseWGowpWM2pSaafy",
      "duration": "8:55",
      "thumbnail": "39967363-1f6f-4342-88ba-5f3283c1dab4.jpg"
    },
    {
      "nr": 15,
      "title": "Neustift 2026 - 15 - Oldies for Future - Petition Stop Transit - Walli Klapfer",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_15",
      "duration": "3:43",
      "thumbnail": "fae90d09-c80b-4e6a-94c1-cabf9f86be39.jpg"
    },
    {
      "nr": 16,
      "title": "Neustift 2026 - 16 - Gute Arbeit Gutes Klima - Kris Krois",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_16",
      "duration": "8:25",
      "thumbnail": "65ef2ca5-289f-4e29-9713-e12552a12e3b.jpg"
    },
    {
      "nr": 17,
      "title": "Neustift 2026 - 17 - Psychologists For Future South Tyrol - Brigitte Andres und Irmgard Mahlknecht",
      "url": "https://peertube.uno/videos/embed/scf4P5cf9L7euXu6iKstGe",
      "duration": "9:23",
      "thumbnail": "430da716-84f1-46b4-9884-4500a611fb08.jpg"
    },
    {
      "nr": 18,
      "title": "Neustift 2026 - 18 - Allianz der Kultur und Heimatpflegeverband - Florian Trojer",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_18",
      "duration": "9:38",
      "thumbnail": "1691f48b-5dbd-4715-85aa-174ec88ce5c3.png"
    },
    {
      "nr": 19,
      "title": "Neustift 2026 - 19 - Initiative Für Mehr Demokratie - Stephan Lausch",
      "url": "https://peertube.uno/videos/embed/UNKNOWN_19",
      "duration": "13:29",
      "thumbnail": "9f8570b3-a2bd-4e2e-9bb9-410cc43c10e7.png"
    },
    {
      "nr": 20,
      "title": "Neustift 2026 - 20 - The Room That Reconnects - Kolpingjugend - Verena Spilker",
      "url": "https://peertube.uno/videos/embed/q3hKw8TPtD4WLSv8XVE4Kd",
      "duration": "10:00",
      "thumbnail": "37ed482d-5222-4a46-a45a-7bbac159351d.jpg"
    },
    {
      "nr": 21,
      "title": "Neustift 2026 - 21 - Bildungszentrum Neustift - Lukas Neuwirth und Oriana Sturiale",
      "url": "https://peertube.uno/videos/embed/kGa96vR6eGY3r12g29Jyut",
      "duration": "8:54",
      "thumbnail": "a15c9207-b006-4418-a029-c8092568e26a.jpg"
    }
  ]
}