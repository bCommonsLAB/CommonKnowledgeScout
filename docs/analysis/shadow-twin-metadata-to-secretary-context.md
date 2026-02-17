# Shadow-Twin-Metadaten im Secretary-Kontext

## Überblick

Metadaten aus den Shadow-Twin-Artefakten (Frontmatter von Transkripten und Transformationen) werden in den Kontext des Secretary Service übernommen. So kann der LLM z. B. `attachments_url` oder `attachment_links` für Event-Templates nutzen, auch wenn diese Informationen nur im Frontmatter der Quelldateien stehen.

## Ablauf (Datenfluss)

```
1. Folder-Discovery (API)
   └─ Lädt Artefakte aus Verzeichnis (MongoDB oder Filesystem)
   └─ Parst Frontmatter jeder Shadow-Twin-Datei
   └─ Extrahiert relevante Felder → WizardSource.sourceMetadata

2. Creation Wizard (Client)
   └─ Ruft discoverFolderArtifactsViaApi() auf
   └─ Erhält WizardSource[] mit sourceMetadata

3. buildCorpusText() (corpus.ts)
   └─ Baut Korpus-Text aus allen Quellen
   └─ Für Datei-Quellen mit sourceMetadata: fügt Block ein:
      "Metadaten aus Shadow-Twin:
       attachments_url: https://...
       attachment_links: [Link](https://...)
       url: https://...

       ...extrahierter Text..."

4. Secretary Service
   └─ Erhält Korpus als "text" (FormData)
   └─ LLM sieht Metadaten + Text im Kontext
   └─ Kann attachments_url, attachment_links etc. für Template nutzen
```

## Welche Felder werden übernommen?

Die Whitelist steht in `folder-discovery/route.ts` unter `METADATA_KEYS_FOR_CONTEXT`:

| Feld | Beschreibung |
|------|--------------|
| `attachments_url` | Link zum PDF (z. B. öffentliche Nextcloud-Freigabe) |
| `attachment_links` | Markdown-Links (z. B. `[LUGBZ](https://...)`) |
| `url` | URL zur Original-Webseite |
| `video_url` | Embed-URL für Video (Vimeo, YouTube, Peertube) |
| `coverImageUrl` | Dateiname/URL des Thumbnails |
| `title` | Titel der Quelle |
| `slug` | URL-Slug |
| `organisation` | Organisation/Verein |
| `event` | Event-Name |
| `track` | Track/Seminar |

Nur diese Felder werden aus dem Shadow-Twin-Frontmatter extrahiert. Interne Felder (provenance, confidence, job_id, …) werden nicht übernommen.

## Woher kommen die Metadaten?

- **Transkript** (Audio/Video → Text): Enthält meist wenig Frontmatter.
- **Transformation** (PDF-Extraktion, z. B. `extract_method_from_PDF`): Enthält oft strukturierte Metadaten (title, attachments_url, …).
- **Bereits transformierte Event-Dateien**: Haben vollständiges Frontmatter (attachments_url, url, video_url, …).

Wenn eine Quelle (z. B. PDF) eine Transformation mit `attachments_url` im Frontmatter hat, wird dieser Wert in den Kontext geschrieben und steht dem Secretary für die Event-Erstellung zur Verfügung.

## Console-Logging

Zum Debuggen wird geloggt:

- **Folder-Discovery** (API, Server): `[folder-discovery] Shadow-Twin-Metadaten für <dateiname>: { ... }`
- **Creation Wizard** (Client): `[corpus] Shadow-Twin-Metadaten im Kontext für <dateiname>: { ... }` sowie `[corpus] Korpus an Secretary (Länge, Quellen mit Metadaten)`
