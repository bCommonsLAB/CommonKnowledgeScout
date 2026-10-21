---
name: webseite-erschliessen
description: Einen Artikel im Netz (Presseseite mit eingebettetem Audio oder Video, YouTube-, Vimeo- oder PeerTube-Seite) oder eine ganze Video-Playlist über die KnowledgeScout-MCP-Brücke als Dokumente in die Galerie bringen — Seite ohne Sprachmodell lesen (bei Videoseiten Metadaten aus yt-dlp), Medium holen und transkribieren, Sammeldatei anlegen, mit der Vorlage artikel-de extraktiv transformieren, bewusst ingestieren und die Lesersicht prüfen; Playlists in zwei Stufen (Vorschau mit Ordnernamen, Anlegen als Stapel). Diesen Skill verwenden, sobald von einer Webseite, einem Link, einem Online-Artikel, einem Interview im Netz, einem Rai-Beitrag, einem YouTube-/Vimeo-/PeerTube-Video, einer Playlist, einer Videoreihe oder davon die Rede ist, eine Seite „zu erfassen", „zu scrapen", „zu übernehmen" oder „als Dokument abzulegen".
---

# Webseite als Quelle erschließen

Stand 21.10.2026, Werkzeugsatz 2.62.0. Original im Archiv unter
`Organisation/Skills/webseite-erschliessen/SKILL.md`; in den
Claude-Einstellungen die Ableitung, im Repo die Kopie. Ein Artikel mit eingebettetem Medium
wird zur Sammeldatei nach demselben Muster wie ein Vortrag einer
Veranstaltung (siehe Skill `veranstaltung-aufbereiten`): Artikel wörtlich,
Zusammenfassung nur aus wörtlichen Sätzen, Zitate aus dem Transkript, Cover
und Audio rechnet die Pipeline. Nichts wird interpretiert.

## Was entsteht

Im Zielordner drei Dateien, nebeneinander:

- `<Basis>.md` — die Sammeldatei (`kind: composite-transcript`, `_include_self`,
  `_source_files`, `_media_files`): Titel, Quelle, Datum, Autor, Link, der
  Artikeltext wörtlich (Absätze, Zwischenüberschriften, Zitate), Verweis auf
  Medium und Cover, bei einbettbaren Videos die Zeile `Video: <Embed-Adresse>`.
  Bei YouTube-, Vimeo- und PeerTube-Seiten kommen Titel, Beschreibung, Datum,
  Kanal, Kapitel und Cover aus yt-dlp (siehe „Playlist" unten).
- `<Basis> - Audio.mp3` (oder m4a) — das Medium als Tonspur. Auch bei
  Videoseiten zieht der Secretary nur den Ton heraus; ein `… - Video.mp4`
  entsteht nur, wenn keine Tonspur extrahierbar war.
- `<Basis> - Cover.jpg` — das Bild der Seite.

Nach Transformation und Ingest: ein Eintrag der Ereignis-Ansicht (Dokumentart
`artikel`) mit Cover, Audio-Player, Video-Embed (YouTube, Vimeo, PeerTube),
Originaltitel, Teaser, Facetten wie bei den Vorträgen; das Transkript liegt als
Anhang in der Suche.

## Ablauf über die Brücke

1. **Ordner und Dateiname festlegen.** Der Mensch nennt beides; Dateinamen
   folgen dem Ordner (z. B. `05 Presseartikel Interview.md` neben den Vorträgen).
   Nie `<Basis>.mp3` neben `<Basis>.md` anlegen — das gilt im Twin-System als
   Transkript des Mediums (Geschwister-Regel); das Werkzeug benennt deshalb
   `… - Audio` und `… - Cover`.
2. **`webseite_erschliessen`** mit `url`, `ordner` (oder `ordnerId`),
   `dateiname`, optional `kontext` und `begriffe` (Namen, Fachwörter — helfen
   der Transkription), `sprecherErkennung` (Interview mit zwei Stimmen: true).
   Diese drei gehen auch bei Videoseiten, weil das Medium als Tonspur kommt.
   Nur wenn keine Tonspur extrahierbar war, weist das Werkzeug sie ab — dann
   ohne sie wiederholen; der abgewiesene Aufruf hat nichts geschrieben.
   Die Antwort nennt `seite.bloecke` (Zahl der übernommenen Textblöcke),
   `medium` mit `jobId` und `weg` (`secretary` = direkte Datei, KS lädt;
   `secretary-download` = Stream oder Video, der Secretary lädt mit ffmpeg nur
   den Ton; `seite` = ohne
   yt-dlp), `videoEmbedUrl`, `cover`. Steht `mediumGrund` oder `coverGrund`,
   fehlt etwas — dem Menschen nennen, nicht still weitermachen. Bricht ein
   Aufruf nach dem Hochladen ab, entfernt das Werkzeug die schon geschriebenen
   Dateien wieder; die Fehlermeldung nennt, was gegebenenfalls von Hand zu
   löschen ist.
   `seite.datePublished` leer heißt: die Seite nennt kein Datum (Open Graph,
   JSON-LD, `<time>`) — nicht raten, den Menschen fragen und mit
   `dokument_felder_setzen` nachtragen.
3. **`job_status`** mit der `jobId` des Mediums abwarten (`completed`,
   Schritt `extract_audio` nicht übersprungen). Transkript von Hand prüfen,
   wenn Namen oder Zahlen wichtig sind (`artefakt_lesen`, `transkript_korrigieren`).
4. **`transformation_starten`** auf die Sammeldatei (`sourceId` aus Schritt 2)
   mit `template: artikel-de`, `zielsprache: de`, `ingest: true`
   (bewusst — ohne `ingest` kein Galerie-Eintrag). Die Vorlage muss in der
   Library liegen (`vorlagen_auflisten`; sonst `vorlage_uebernehmen` aus
   `templates/artikel-de.md` oder einer anderen Library).
5. **Lesersicht prüfen:** `job_status` (Ereignisse `cover_source: own_fragment`,
   `audio_source` nur mit Einbetten; `befunde` leer — „Anhaenge: keine
   PDF-Quelle" ist bei Artikeln ohne PDF normal) und `dokument_lesen` auf die
   Sammeldatei (Cover, Titel, Galerie-Adresse). Dem Menschen die
   Galerie-Adresse nennen.

Ohne Medium (reiner Artikel): `medienHolen: false` oder einfach laufen lassen —
die Antwort nennt den Grund, Schritt 3 entfällt.

**Fremdes Video nicht einbetten** (rechtliche Vorgabe, z. B. Beiträge von
Rundfunkanstalten): `medienEinbetten: false`. Das Medium wird geladen und
transkribiert, bleibt aber reine Quelle im Ordner — kein Player, kein Embed,
keine öffentliche Blob-Adresse. Im Eintrag stehen nur das Vorschaubild der
Seite und der Link „Original auf der Seite der Quelle ansehen". Im Zweifel den
Menschen fragen, ob eingebettet werden darf.

## Wenn etwas fehlt

- **Seite ohne Artikeltext** („keine Absätze"): die Seite ist ein reiner
  Player oder rendert nur per JavaScript — Text von Hand als Markdown anlegen,
  Medium per `webseite_erschliessen` mit `medienHolen: true` an eine
  Hilfs-Sammeldatei hängen, oder den Menschen fragen.
- **Kein Medium aufgelöst**: yt-dlp kennt die Seite nicht (Grund in der
  Antwort). Direkte Medienadresse der Seite wird als dritter Weg probiert.
  Sonst Medium von Hand holen und als Quelle neben die Sammeldatei legen.
- **Video ohne Embed** (z. B. Rai-Videos): Die Tonspur wird geladen und
  transkribiert, im Eintrag erscheint der Audio-Player, kein Video-Embed —
  der Player kennt nur YouTube, Vimeo und PeerTube.
- **Namen und Bild prüfen**: Das Cover ist das Bild, das die Seite nennt — oft
  ein Archivbild, kein Foto des Anlasses. Namen kommen aus der Seite oder dem
  Transkript; wo sie nicht zu bekannten Begriffen passen, dem Menschen zur
  Prüfung nennen.
- **Transkription übersprungen** (`shadow_twin_exists`): es liegt schon ein
  Twin für das Medium vor — `erzwingen: true` bei `quelle_erschliessen` auf das
  Medium, oder den fremden Twin prüfen.

## Playlist (Werkzeugsatz 2.61.0)

Eine Video-Playlist (YouTube, Vimeo, PeerTube — was yt-dlp kennt) wird wie
eine Veranstaltung aufbereitet: ein Ordner je Video, darin die Sammeldatei,
`<Ordner> - Audio.m4a` und `<Ordner> - Cover.jpg`, Transkription gestartet,
kein Ingest. Werkzeug `playlist_erschliessen`, zwei Stufen:

1. **Vorschau** (`modus: vorschau`, Vorgabe, liest nur): nennt je Eintrag
   Position, Titel, Dauer, Adresse und den Ordnervorschlag `NN Titel`.
   Nicht abrufbare Einträge (privat, gelöscht) stehen mit `grund` in der Liste
   — dem Menschen nennen. Soll der Ordner das Datum tragen
   (`JJJJ-MM-TT Titel`): `mitDatum: true` mit `ordner` startet einen Lesejob;
   `job_status` liefert unter `ergebnis.playlist.eintraege` je Video Datum und
   Vorschlag. Das Datum ist das Upload-Datum, nicht unbedingt das Datum des
   Abends.
2. **Rückfrage**: Auswahl (Positionen oder Video-Ids) und Ordnernamen mit dem
   Menschen bestätigen. Ordnernamen werden HIER entschieden — ein Umbenennen
   nach dem Erschließen setzt die Twin-Familien auf `twin_stale`.
3. **Anlegen** (`modus: anlegen`, schreibt, nur nach Bestätigung): `ordner`
   (Wurzel), `auswahl` (bis 30 je Aufruf; bei 32 Videos zwei Aufrufe — das
   Werkzeug sagt das, es kürzt nicht), optional `ordnernamen`
   (Position als Text → Name), dazu `sprecherErkennung` (Dialoge: true),
   `kontext`, `begriffe`, `medienEinbetten` wie bei `webseite_erschliessen`,
   gültig für alle Videos. Antwort sofort: `batchId` und je Zeile Ordner,
   `ordnerId`, `jobId` oder `befund` (Ordner gibt es schon — nicht
   überschrieben; nicht abrufbar; Position nicht in der Playlist).
4. **Abwarten**: `batch_bilanz` mit der `batchId` — je Video ein
   `web-source`-Job (Metadaten, Tonspur, Cover, Sammeldatei) und ein
   Transkriptions-Job mit derselben `batchId`. Gescheiterte Zeilen mit
   `batch_neustart` wiederholen (der Ordner bleibt; die Sammeldatei wird nicht
   überschrieben — Reste vorher prüfen). `job_status` eines `web-source`-Jobs
   zeigt unter `ergebnis` die Antwort von `webseite_erschliessen`
   (`metadatenQuelle`, `hinweise`, `mediumGrund`, `coverGrund`).
5. Weiter mit den Stationen 4–7 aus `veranstaltung-aufbereiten`: Transkripte
   prüfen, `transformation_starten` je Sammeldatei (Vorlage nach
   Owner-Entscheid, z. B. `artikel-de`), Rahmen, Publikation.

**Metadaten aus yt-dlp** (gilt auch für `webseite_erschliessen` auf eine
einzelne YouTube-/Vimeo-/PeerTube-Seite): Titel, Beschreibung wörtlich
(Absätze an Leerzeilen — dort stehen Gäste und Thema), Datum (`upload_date`),
Kanal (`source`), Kapitel (`## Kapitel` mit Zeitmarken) und Cover (Thumbnail)
kommen aus yt-dlp, nicht aus dem HTML. Die Antwort nennt
`metadatenQuelle: ytdlp | seite` und `hinweise`. Steht dort „Secretary liefert
keinen metadata-Block", fehlt Welle S im Secretary — Seitenbild kam aus dem
HTML, dem Menschen sagen. Eine Videoseite ohne Beschreibung ergibt eine
Sammeldatei ohne Artikeltext; das Transkript ist dann das Material.

## Video-Anmeldung (YouTube-Bot-Sperre)

YouTube weist Abrufe von Server-Adressen ab („Sign in to confirm you're not a
bot"); die Playlist-Liste kommt oft noch durch, jeder Einzelabruf nicht. Die
Lösung liegt bei der Person, nicht beim Server: unter `Einstellungen → Mein
Zugang → Video-Anmeldung` die im Browser exportierte `cookies.txt` hinterlegen
(eigenes YouTube-Konto, Erweiterung „Get cookies.txt LOCALLY"). Sie wird bei
`webseite_erschliessen` und `playlist_erschliessen` automatisch mitgegeben.
Vor einem Playlist-Lauf `video_anmeldung_lesen` aufrufen: `hinterlegt: false`
oder `abgelaufen: true` dem Menschen nennen, bevor ein Stapel ins Leere läuft.
Die Fehlerdeutung `youtube_anmeldung` in `job_status`/`batch_bilanz` heißt:
Anmeldung hinterlegen oder erneuern, dann `batch_neustart`; ein Neustart ohne
Anmeldung ist zwecklos.

## Grenzen

- 500 MB je Medium, Seitenabruf 30 s, Download bis 10 min (Secretary-Download 15 min).
- Zugriffsgeschützte Seiten (Login, Paywall) werden nicht gelesen.
- Playlist: 30 Videos je `anlegen`-Aufruf; die Vorschau holt nur die flache
  Liste (keine Dauer, wenn yt-dlp sie dort nicht nennt). Braucht im Secretary
  `POST /api/media/playlist` (Welle S) — fehlt sie, sagt das Werkzeug das.
- Die Vorlage übernimmt den Artikel wörtlich; wer eine andere Darstellung will,
  nimmt eine andere Vorlage, nicht eine andere Sammeldatei.
