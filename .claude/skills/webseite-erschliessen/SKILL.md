---
name: webseite-erschliessen
description: Einen Artikel im Netz (Presseseite mit eingebettetem Audio oder Video, YouTube-, Vimeo- oder PeerTube-Seite) über die KnowledgeScout-MCP-Brücke als Dokument in die Galerie bringen — Seite ohne Sprachmodell lesen, Medium holen und transkribieren, Sammeldatei anlegen, mit der Vorlage artikel-de extraktiv transformieren, bewusst ingestieren und die Lesersicht prüfen. Diesen Skill verwenden, sobald von einer Webseite, einem Link, einem Online-Artikel, einem Interview im Netz, einem Rai-Beitrag, einem YouTube-/Vimeo-/PeerTube-Video oder davon die Rede ist, eine Seite „zu erfassen", „zu scrapen", „zu übernehmen" oder „als Dokument abzulegen".
---

# Webseite als Quelle erschließen

Stand 13.10.2026, Werkzeugsatz 2.49.0. Ein Artikel mit eingebettetem Medium
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
- `<Basis> - Audio.mp3` (oder m4a) — das Medium, bevorzugt die reine Tonspur.
- `<Basis> - Cover.jpg` — das Bild der Seite.

Nach Transformation und Ingest: ein Eintrag der Ereignis-Ansicht (Dokumentart
`artikel`) mit Cover, Audio-Player, Video-Embed (YouTube, Vimeo, PeerTube),
Originaltitel, Teaser, Facetten wie bei den Vorträgen; das Transkript liegt als
Anhang in der Suche.

## Ablauf über die Brücke

1. **Ordner und Dateiname festlegen.** Der Mensch nennt beides; Dateinamen
   folgen dem Ordner (z. B. `05 Rai Beitrag Britsko.md` neben den Vorträgen).
   Nie `<Basis>.mp3` neben `<Basis>.md` anlegen — das gilt im Twin-System als
   Transkript des Mediums (Geschwister-Regel); das Werkzeug benennt deshalb
   `… - Audio` und `… - Cover`.
2. **`webseite_erschliessen`** mit `url`, `ordner` (oder `ordnerId`),
   `dateiname`, optional `kontext` und `begriffe` (Namen, Fachwörter — helfen
   der Transkription), `sprecherErkennung` (Interview mit zwei Stimmen: true).
   Die Antwort nennt `seite.bloecke` (Zahl der übernommenen Textblöcke),
   `medium` mit `jobId` und `weg` (`secretary` = direkte Datei, KS lädt;
   `secretary-download` = Stream, der Secretary lädt mit ffmpeg; `seite` = ohne
   yt-dlp), `videoEmbedUrl`, `cover`. Steht `mediumGrund` oder `coverGrund`,
   fehlt etwas — dem Menschen nennen, nicht still weitermachen.
3. **`job_status`** mit der `jobId` des Mediums abwarten (`completed`,
   Schritt `extract_audio` nicht übersprungen). Transkript von Hand prüfen,
   wenn Namen oder Zahlen wichtig sind (`artefakt_lesen`, `transkript_korrigieren`).
4. **`transformation_starten`** auf die Sammeldatei (`sourceId` aus Schritt 2)
   mit `template: artikel-de`, `zielsprache: de`, `ingest: true`
   (bewusst — ohne `ingest` kein Galerie-Eintrag). Die Vorlage muss in der
   Library liegen (`vorlagen_auflisten`; sonst `vorlage_uebernehmen` aus
   `templates/artikel-de.md` oder einer anderen Library).
5. **Lesersicht prüfen:** `job_status` (Ereignisse `audio_source`,
   `cover_source: own_fragment`, `befunde` leer) und `dokument_lesen` auf die
   Sammeldatei (Cover, Titel, Galerie-Adresse). Dem Menschen die
   Galerie-Adresse nennen.

Ohne Medium (reiner Artikel): `medienHolen: false` oder einfach laufen lassen —
die Antwort nennt den Grund, Schritt 3 entfällt.

## Wenn etwas fehlt

- **Seite ohne Artikeltext** („keine Absätze"): die Seite ist ein reiner
  Player oder rendert nur per JavaScript — Text von Hand als Markdown anlegen,
  Medium per `webseite_erschliessen` mit `medienHolen: true` an eine
  Hilfs-Sammeldatei hängen, oder den Menschen fragen.
- **Kein Medium aufgelöst**: yt-dlp kennt die Seite nicht (Grund in der
  Antwort). Direkte Medienadresse der Seite wird als dritter Weg probiert.
  Sonst Medium von Hand holen und als Quelle neben die Sammeldatei legen.
- **Video ohne Embed** (z. B. Rai-Videos): Das Medium wird geladen und
  transkribiert, im Eintrag erscheint der Audio-Player, kein Video-Embed —
  der Player kennt nur YouTube, Vimeo und PeerTube.
- **Transkription übersprungen** (`shadow_twin_exists`): es liegt schon ein
  Twin für das Medium vor — `erzwingen: true` bei `quelle_erschliessen` auf das
  Medium, oder den fremden Twin prüfen.

## Grenzen

- 500 MB je Medium, Seitenabruf 30 s, Download bis 10 min (Secretary-Download 15 min).
- Zugriffsgeschützte Seiten (Login, Paywall) werden nicht gelesen.
- Die Vorlage übernimmt den Artikel wörtlich; wer eine andere Darstellung will,
  nimmt eine andere Vorlage, nicht eine andere Sammeldatei.
