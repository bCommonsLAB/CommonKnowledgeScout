---
name: playlist-erschliessen
overview: "Eine Video-Playlist (YouTube, auch Vimeo/PeerTube, soweit yt-dlp sie kennt) über die Brücke in eine Library bringen: Playlist auflösen, je Video einen Ordner mit Sammeldatei, Tonspur, Cover und vollständigen Metadaten anlegen, Transkription starten — ohne Ingest. Anlass: eine Dialogreihe mit 32 Videos seit 2015, aufbereitet nach dem Muster einer Veranstaltungs-Library (ein Ordner je Einheit, eine Sammeldatei je Einheit, Prüfung durch den Menschen, erst dann Galerie und Startseite)."
vorhaben: []
status: gebaut-abnahme-offen
todos:
  - id: s-secretary
    content: "Welle S Secretary (Repo CommonSecretaryServices, src/api/routes/media_routes.py): Route POST /media/playlist (yt-dlp extract_flat, Kopf mit title, uploader, channel, description, webpage_url, anzahl, anzahl_verfuegbar; entries mit position, id, url, title, duration, verfuegbar, grund) und Block metadata in /media/resolve (id, description, upload_date als ISO oder null, uploader, channel, chapters, tags, thumbnail, webpage_url). noplaylist bleibt für resolve/download. Gebaut und gemergt (#44, 21.10.2026); KnowledgeScout-Parser gegen diese Form getestet."
    status: done
  - id: k1-media-resolve
    content: "Welle K1 KnowledgeScout, src/lib/web-source/: resolvePlaylistViaSecretary (playlist-resolve.ts) und ResolvedMedia.metadata (media-metadata.ts); Fehler laut mit Grund (Secretary ohne Route, leere Playlist, privat). Gebaut 21.10.2026."
    status: done
  - id: k2-metadaten-aus-ytdlp
    content: "Welle K2 webseite-erschliessen.ts und artikel-sammeldatei.ts: Erkennt yt-dlp einen Video-Extractor (youtube, vimeo, peertube) und liefert der Secretary metadata, kommen Titel, Beschreibung (wörtlich, Absätze an Leerzeilen), Datum (upload_date), Kanal und Kapitel aus metadata statt aus dem HTML (metadaten-seite.ts); Cover aus thumbnail. Der HTML-Weg bleibt für Presseseiten. Antwort nennt metadatenQuelle: ytdlp | seite, kapitel, hinweise. Gebaut 21.10.2026."
    status: done
  - id: k3-werkzeug
    content: "Welle K3 neues Brücken-Werkzeug playlist_erschliessen (src/lib/mcp/tools-playlist.ts) mit zwei Modi: vorschau (liest nur, Liste mit vorgeschlagenem Ordnernamen, mitDatum startet einen Lesejob) und anlegen (Auswahl bis 30, je Video Ordner + ein web-source-Job, der den Kern von webseiteErschliessen fährt, als Batch mit batchId). Service src/lib/web-source/playlist-erschliessen.ts für Brücke und spätere UI-Route (ADR 0007); Job-Builder enqueue-web-source.ts, Phase phase-web-source.ts, Zweig in der Start-Route. Gebaut 21.10.2026."
    status: done
  - id: k4-skill-doku
    content: "Welle K4 Skill webseite-erschliessen um Abschnitt Playlist ergänzt (Repo-Kopie; Original im Archiv Organisation/Skills/webseite-erschliessen/SKILL.md nachziehen), Konzept docs/concepts/mcp-library-betrieb.md Nachtrag 2.61.0, TOOLSET_VERSION / TOOL_NAMES / NEU_IN_VERSION in tools-info.ts, Tests unter tests/unit/web-source/ und tests/unit/external-jobs/. Gebaut 21.10.2026."
    status: done
  - id: abnahme-start-klar
    content: "Abnahme an der echten Playlist (braucht Welle S im Secretary): Vorschau 32 Einträge; Pilotvideo mit vollständiger Beschreibung, Datum, Cover und video_url in der Sammeldatei (metadatenQuelle: ytdlp); Stapel der übrigen Videos (zwei Aufrufe) ohne Fehlschlag in batch_bilanz oder mit benanntem Grund je Zeile; nach Freigabe zeigt dokument_lesen den Eintrag mit Video-Embed."
    status: pending
---

# Playlist über die Brücke erschließen

## 1. Anlass und Lücke

Eine Dialogreihe (32 Videos seit 2015) liegt als YouTube-Playlist vor und soll
eine eigene Library mit Webseite werden, gebaut wie eine Veranstaltungs-Library:
ein Ordner je Einheit, eine Sammeldatei je Einheit, Prüfung durch den Menschen,
erst dann Galerie und Startseite. Die Videos sollen auf den Seiten eingebettet
sein. Sprechernamen und Kontext stehen in der Beschreibung der Videoseite und
sollen schon beim Erschließen mitkommen.

Mit dem Werkzeugsatz 2.60.0 ging das nicht:

| Lücke | Wo | Folge |
|---|---|---|
| Playlist nicht auflösbar | Secretary `_ydl_opts` setzt `noplaylist: True`, `_first_entry` nimmt bei mehreren Einträgen den ersten | Die Video-Adressen müssen von Hand beschafft werden; die Playlist-Seite liefert nur Titel, Besitzer und Anzahl, die Liste lädt YouTube per JavaScript. |
| Metadaten verworfen | Secretary `resolve_media_url` gibt nur extractor, title, duration, ext, url, protocol, http_headers, ist_audio zurück | Beschreibung, Datum, Kanal, Kapitel und Thumbnail kennt yt-dlp, sie kommen aber nicht in KnowledgeScout an. |
| Seite ohne Text | `page-extract.ts` liest `og:description` (bei YouTube gekürzt) und `<p>`/`<h2>`-Blöcke aus dem Server-HTML | Keine Absätze; `baueArtikelSammeldatei` wirft „Seite ohne Artikeltext". |
| 32 > 30 | Stapelgrenze der Brücke | Zwei Aufrufe; das Werkzeug muss das sauber sagen, nicht still kürzen. |

## 2. Ziel

Ein Werkzeug, zwei Stufen, derselbe Ablauf wie bei einer Veranstaltung:

- **Vorschau (liest nur).** Playlist auflösen, Liste zeigen: Position, Titel,
  Dauer, Video-Adresse, vorgeschlagener Ordnername. Der Mensch bestätigt
  Auswahl und Ordnernamen. Umbenennen nach dem Erschließen setzt Twin-Familien
  auf `twin_stale` — deshalb wird der Name hier entschieden, nicht später.
- **Anlegen (schreibt).** Je ausgewähltem Video einen Ordner, darin die
  Sammeldatei mit vollständigen Metadaten, `<Basis> - Audio.m4a`,
  `<Basis> - Cover.jpg`, Transkription gestartet. Kein Ingest; weiter mit den
  Stationen 4–7 aus `veranstaltung-aufbereiten`.

## 3. Wellen

### S Secretary (gebaut, CommonSecretaryServices #44)

- `POST /media/playlist` mit `{ url }`: yt-dlp mit `extract_flat: 'in_playlist'`,
  ohne `noplaylist`. Antwort `{ status: 'success', data: { title, uploader,
  description, anzahl, entries: [{ position, id, url, title, duration,
  grund? }] } }`. Private oder gelöschte Einträge stehen mit `grund` in der
  Liste, nicht stillschweigend weg. KnowledgeScout erwartet genau diese Form
  (`parsePlaylistAntwort` in `playlist-resolve.ts`); 404/405 deutet es als
  „Route fehlt".
- `/media/resolve` bekommt einen Block `metadata` mit `description`,
  `upload_date` (YYYYMMDD), `uploader`, `channel`, `chapters`
  (`start_time`, `end_time`, `title`), `tags`, `thumbnail`, `webpage_url`.
  Bestehende Felder bleiben unverändert (rückwärtskompatibel).
- `noplaylist: True` bleibt für resolve und download — ein Video-Link mit
  `&list=` darf nicht die ganze Playlist laden.

### K1 KnowledgeScout: Secretary-Anbindung (gebaut)

`playlist-resolve.ts`: `resolvePlaylistViaSecretary(url)` mit reiner
`parsePlaylistAntwort`. `media-metadata.ts`: `parseMediaMetadata`,
`istVideoExtractor`, `uploadDateZuIso`; `ResolvedMedia.metadata` ist `null`,
wenn der Secretary den Block nicht liefert. Fehler laut mit Grund (Secretary
ohne Route, leere Playlist, Eintrag ohne id/url und ohne Grund).

### K2 Metadaten aus yt-dlp statt aus dem HTML (gebaut)

In `webseiteErschliessen` wird zuerst yt-dlp gefragt (ein Aufruf für Metadaten
und Medienadresse). Meldet resolve einen Video-Extractor (youtube, vimeo,
peertube) und den Metadaten-Block, kommen in die Sammeldatei: `title` aus dem
Resolve, die Beschreibung wörtlich als Body-Blöcke (Absätze an Leerzeilen —
Chronist, nicht Kommentator), `date` aus `upload_date` (ISO), `source` aus dem
Kanal, Kapitel als Liste mit Zeitmarken (`## Kapitel`), Cover aus `thumbnail`,
`video_url` als Embed-Adresse wie bisher (`metadaten-seite.ts`). Der HTML-Weg
bleibt für Presseseiten. Die Antwort nennt `metadatenQuelle: ytdlp | seite`,
`kapitel` und `hinweise`: Datum, das yt-dlp nicht liefert, bleibt leer und wird
genannt; das Upload-Datum ist nicht unbedingt das Datum des Abends — das
bestätigt der Mensch; eine Videoseite ohne Beschreibung ergibt eine
Sammeldatei ohne Artikeltext (das Transkript ist das Material), kein Fehler.
Kennt yt-dlp die Seite, fehlt aber der Block (Welle S noch nicht ausgerollt),
geht es mit Hinweis über das HTML.

### K3 Werkzeug `playlist_erschliessen` (gebaut)

| Feld | Bedeutung |
|---|---|
| `libraryId`, `url` | Library, Playlist-Adresse |
| `modus` | `vorschau` (Vorgabe) oder `anlegen` |
| `ordner` / `ordnerId` | Wurzel, unter der je Video ein Ordner entsteht |
| `auswahl` | nur bei `anlegen`: Positionen (Zahl) oder Video-Ids (Text), bis 30 |
| `ordnernamen` | optional: Position (als Text) → Name, sonst Vorschlag aus der Vorschau |
| `mitDatum` | nur bei `vorschau`: Lesejob für `JJJJ-MM-TT Titel` (braucht `ordner`) |
| `sprecherErkennung`, `kontext`, `begriffe`, `zielsprache`, `medienEinbetten` | wie `webseite_erschliessen`, gelten für alle Videos |
| `begruendung` | Pflicht, ins Protokoll |

Vorschau bleibt unter dem 60-Sekunden-Limit, weil sie nur die flache Liste
holt. Ordnervorschlag `NN Titel` (Position zweistellig). Mit `mitDatum: true`
startet sie einen Lesejob (`job_type web-source`, `operation playlist-lesen`),
der je Video die Metadaten holt und `JJJJ-MM-TT Titel` vorschlägt; Ergebnis
über `job_status` (`ergebnis.playlist.eintraege`).

Anlegen läuft als Batch, weil jeder Download bis 15 Minuten dauern kann:
je Video ein Ordner unter der Wurzel und EIN Job (`job_type web-source`,
`operation erschliessen`), den der Worker über `/start` anstößt; die
Start-Route verzweigt in `phase-web-source` (ADR 0001, wie golden-set) und
antwortet 202. Die Phase fährt `webseiteErschliessen` im Ordner des Videos;
der Transkriptions-Job, den sie startet, erbt dieselbe `batchId`. Antwort
sofort mit `batchId` und Liste der angelegten Ordner; Fortschritt mit
`batch_bilanz`, Wiederholung mit `batch_neustart`, Ergebnis je Job in
`job_status` (`ergebnis` = Antwort von `webseiteErschliessen`). Vorhandene
Ordner werden nicht überschrieben, sondern je Zeile als Befund gemeldet
(`playlist-auswahl.ts`, rein). Fehler einer Zeile brechen den Stapel nicht ab.
Mehr als 30 ausgewählt: Absage mit Hinweis auf zwei Aufrufe.

### K4 Skill, Doku, Tests (gebaut)

Skill `webseite-erschliessen`: Abschnitt „Playlist" (Repo-Kopie; das Original
im Archiv ist nachzuziehen und dann zu importieren).
`docs/concepts/mcp-library-betrieb.md`: Nachtrag 2.61.0. `tools-info.ts`:
Version 2.61.0, `TOOL_NAMES`, `NEU_IN_VERSION`. Tests: Sammeldatei aus
yt-dlp-Metadaten, Playlist-Antwort mit privatem Eintrag, Stapelgrenze, kein
Überschreiben, Job-Builder mit Batch.

## 4. Entscheidungen beim Owner

- Ordnerschema: `NN Titel` nach Position oder `JJJJ-MM-TT Titel` nach Datum
  (braucht `mitDatum`), optional Jahresordner darüber.
- Vorlage für die Transformation: `cast-event-creation-de` (Felder `video_url`,
  `speakers`, `speakers_url`, `speakers_image_url`, `event`, `coverImageUrl`),
  `artikel-de` oder eine eigene `dialog-video-de`. Entscheidung nach dem
  Pilot-Transkript.
- Einbetten: Video eingebettet (Vorgabe `true`) — Einverständnis des
  Urhebers der Reihe einholen.
- Sprechererkennung für Dialoge mit zwei bis drei Stimmen: an.

## 5. Abnahme

An der echten Playlist (nach dem Deploy des Secretary mit #44):

- Vorschau nennt 32 Einträge mit Titel und Dauer.
- Pilotvideo: Sammeldatei mit vollständiger Beschreibung, Datum, Cover und
  `video_url`; `metadatenQuelle: ytdlp`.
- Übrige Videos im Stapel (zwei Aufrufe): `batch_bilanz` ohne Fehlschlag oder
  mit benanntem Grund je Zeile.
- Nach Freigabe (Station 7): `dokument_lesen` zeigt Cover, Galerie-Adresse und
  den eingebetteten Player.

## 6. Querschnitt

Wie in `bruecke-library-betrieb`: dieselbe Service-Funktion für Brücke und
spätere UI-Route (ADR 0007), schreibende Modi nur nach Bestätigung mit
Protokoll-Eintrag, Stapelgrenze 30, Fehler je Zeile statt Abbruch, neue
Funktionen in eigene Module.
