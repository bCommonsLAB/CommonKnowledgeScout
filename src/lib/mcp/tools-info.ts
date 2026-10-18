/**
 * @fileoverview Werkzeugsatz-Version der MCP-Bruecke + `bruecke_info` (A2).
 *
 * @description
 * Pilot-Befund A2: Die Desktop-App cached die Toolliste — nach
 * Schema-Aenderungen sieht der Agent alte Werkzeuge, bis der Mensch die
 * Erweiterung aus- und einschaltet. Serverseitig ist der Cache in unserem
 * statuslosen HTTP-Transport nicht invalidierbar (kein Push-Kanal) — aber
 * Drift wird ERKENNBAR: `bruecke_info` nennt Version und Soll-Toolliste des
 * Servers; sieht der Agent etwas anderes, bittet er den Menschen um den
 * Toggle, statt raetselhaft zu scheitern.
 *
 * REGEL: `TOOLSET_VERSION` bei JEDER Werkzeug-/Schema-Aenderung erhoehen
 * (sie erscheint auch als serverInfo.version im initialize-Handshake).
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsonResult } from './tool-shared'

/** Version des Werkzeugsatzes — bei jeder Werkzeug-/Schema-Aenderung erhoehen. */
export const TOOLSET_VERSION = '2.57.0'

/** Soll-Liste der Werkzeuge (Reihenfolge = Registrierung in tools.ts). */
export const TOOL_NAMES = [
  'bibliotheken_auflisten',
  'abdeckung_lesen',
  'abdeckung_scannen',
  'twins_pruefen',
  'twins_synchronisieren',
  'familie_umziehen',
  'quelle_verwerfen',
  // Wunschliste 8, W8-3 — Familie an eine andere Library uebergeben.
  'familie_uebergeben',
  'ordner_erstellen',
  'ordner_umbenennen',
  // Welle ST2 — generische Storage-Schicht (alle Provider, nicht nur OneDrive).
  'ordner_listen',
  'pfad_aufloesen',
  'datei_lesen',
  'stat',
  'datei_schreiben',
  'datei_patchen',
  'datei_anlegen',
  'datei_binaer_lesen',
  'datei_binaer_anlegen',
  'ordner_anlegen',
  'verschieben',
  'kopieren',
  'loeschen',
  'speicher_info',
  'quelle_erschliessen',
  // K4 — Peters Korrekturauftraege (Rueckkanal Mensch → Agent).
  'korrekturen_lesen',
  'korrektur_melden',
  // Wunschliste 7, B1 — Wortlautkorrektur im Transkript, der einzige Schreibweg in den `_`-Ordner.
  'transkript_korrigieren',
  'vorlagen_auflisten',
  'transformation_starten',
  'dokument_publizieren',
  'dokument_depublizieren',
  'dokument_felder_setzen',
  'seite_pruefen',
  'bild_veroeffentlichen',
  'bilder_auflisten',
  'veroeffentlichung_lesen',
  'veroeffentlichung_setzen',
  'job_status',
  'job_liste',
  'jobs_aufraeumen',
  'job_abbrechen',
  // Welle A — Library-Betrieb: Index-Seite und Batches lesen.
  'dokumente_auflisten',
  // Welle K1 — Lesersicht eines Eintrags.
  'dokument_lesen',
  'bestand_pruefen',
  'batch_bilanz',
  // Welle C — Index folgt dem Twin.
  'index_aktualisieren',
  'index_entfernen',
  'batch_neustart',
  // Welle D — Konfiguration ist Vertrag.
  'konfiguration_lesen',
  'konfiguration_setzen',
  // Welle F — Messen vor Aendern.
  'frage_stellen',
  'golden_set_fahren',
  'frage_log_lesen',
  // Welle E — Einheiten bilden, Abhaengige finden.
  'sammeldatei_anlegen',
  'sammeldatei_pruefen',
  'abhaengige_dokumente',
  // Webseite als Quelle (2.49.0): Artikel mit eingebettetem Medium als Sammeldatei.
  'webseite_erschliessen',
  // Welle G — Artefakte ohne Spiegel lesen.
  'artefakt_lesen',
  // Wunschliste 8, W8-2 — Quelle ueber Library-Grenzen finden.
  'quelle_suchen',
  // Handover Library-Anlage (08.10.).
  'bibliothek_anlegen',
  'speicher_pruefen',
  // A3 Speicher-Verbindungen am Konto (Plan speicher-verbindungen-und-library-anlage).
  'speicher_verbindungen_auflisten',
  'speicher_verbindung_testen',
  'speicher_verbindung_zuweisen',
  // C3 Rueckfragen statt halb konfigurierter Libraries.
  'bibliothek_pruefen',
  'vorlage_uebernehmen',
  // Wunschliste 8 (G1) — Adress-Slug je Library.
  'adresse_setzen',
  'sichten_regenerieren',
  'aenderungen_seit',
  'erschliessung_block_schreiben',
  'stand_setzen',
  'themen_setzen',
  'protokoll_lesen',
  'bruecke_info',
] as const

/**
 * Was sich mit dieser Version an BESTEHENDEN Werkzeugen geaendert hat. Die
 * Soll-Toolliste zeigt nur neue Namen; ein neuer Parameter oder ein neues
 * Antwortfeld bliebe sonst unsichtbar (Wunschliste 6 brachte kein neues
 * Werkzeug, aber vier Schema-Aenderungen).
 */
export const NEU_IN_VERSION: readonly string[] = [
  '2.57.0: Fokus aus Sternen, Welle F1 (Plan galerie-fokus-aus-sternen, ADR 0012, Owner 16.10.). Neuer Library-Schalter publicPublishing.starCountsPublic (Vorgabe false): veroeffentlichung_setzen nimmt starCountsPublic: boolean, veroeffentlichung_lesen und konfiguration_lesen (bereich veroeffentlichung) zeigen ihn. Ist er an, liefern die Galerie-Routen (GET docs, facets, docs/ids) die ZAHL der Sterne (favoriteCount) auch anonym — nie die Namen der Bewertenden, kein isFavorite —, sort=stars ist oeffentlich (Tie-Break: prioritaets_index, dann juengste Aenderung) und der Filter starred=<k> (mindestens k Sterne, ganze Zahl >= 1) laeuft serverseitig in allen drei Routen, damit Liste, total und Facetten-Zahlen uebereinstimmen. Ohne Schalter bleibt alles wie bisher; Gaeste bekommen fuer sort=stars und starred 403, ungueltiges starred 400. Bewerten bleibt Mitgliedern vorbehalten. F2 (Knopf „Im Fokus", Zahl auf den Karten) und F3 (banner_sort: stars) folgen',
  '2.56.0: Story-Texte ueber die Bruecke (Befund 16.10.). veroeffentlichung_setzen nimmt story als Text-Gruppe wie gallery, feldweise: headline (Titel der Erklaerung im Story-Kopf), intro (Erklaerungstext im Story-Kopf), topicsTitle und topicsIntro (Texte ueber den Themenkarten), subtitle (gespeichert, derzeit nicht angezeigt); weggelassen = unveraendert, leerer String = Standardtext, unbekannte Felder werden abgewiesen. veroeffentlichung_lesen und konfiguration_lesen (bereich veroeffentlichung) zeigen story (null = keine Texte); geaendert nennt story als Ganzes. Merge und Pruefung liegen in public-publishing-validation.ts; die Route PUT /api/libraries/[id]/public nimmt story ebenso und weist jetzt auch gallery/story mit unbekannten Feldern oder Nicht-Text-Werten mit 400 ab',
  '2.55.0: Vollstaendige Library-Anlage (Plan speicher-verbindungen-und-library-anlage, C3; Katalog C1 in src/lib/library-setup/). bibliothek_anlegen RUECKFRAGEN: fehlen Pflicht- (name, inhaltstyp, speicher) oder empfohlene Entscheidungen (vorlageVon wenn eine Library gleichen Typs existiert, facetten, graph, aufnahmeSprachen + bekannteNamen nur wenn Audio erwartet, antwortsprache, antwortregeln, erfassenWizards bei Typen mit Wizards), legt es NICHTS an und antwortet angelegt: false mit einrichtung „n von m" und offeneEntscheidungen (schluessel, gewicht, frage, optionen, vorgabe, antwortweg). Neue Parameter: entscheidungen { schluessel: wert } (facetten: "standard" = Standard-Facetten des Inhaltstyps, graph: boolean, aufnahmeSprachen: ISO-Codes, bekannteNamen: string[], antwortsprache, antwortregeln mit Platzhalter-Pruefung), ueberspringen [schluessel] (nur empfohlene) und audioErwartet. vorlageVon beantwortet, was die Vorlage traegt. Eine nextcloud-/onedrive-Library ohne speicherVerbindung wird nicht mehr „ausstehend" angelegt — speicher ist Pflicht. Erfolgsantwort: angelegt: true, einrichtung, uebersprungen, spaeterInDenSettings. NEU bibliothek_pruefen (libraryId, optional audioErwartet; liest nur): dieselbe Liste fuer bestehende Libraries',
  '2.54.0: Speicher-Verbindungen ueber die Bruecke (Plan speicher-verbindungen-und-library-anlage, A3). NEU: speicher_verbindungen_auflisten (Id, Bezeichnung, Typ, letzter Test, Nextcloud-URL/-Benutzer, Geheimnis hinterlegt ja/nein, OneDrive angemeldet, Libraries darauf — nie Werte), speicher_verbindung_testen (verbindung = Id oder Bezeichnung; speichert nur das Testergebnis), speicher_verbindung_zuweisen (libraryId, verbindung, optional verzeichnis; nur Owner, Typ muss passen; nennt vorher/nachher). Anlegen einer Verbindung bleibt in der Oberflaeche (Geheimnis). SCHEMA-AENDERUNG bibliothek_anlegen: webdavUrl und benutzer entfallen; stattdessen speicherVerbindung (Id oder Bezeichnung, der Typ folgt aus ihr) + verzeichnis; speicherTyp ist nur noch ohne Verbindung noetig (local mit absolutem Pfad, oder nextcloud/onedrive als ausstehend — naechsterSchritt nennt dann speicher_verbindung_zuweisen). Das Antwortfeld geheimnisFehlt entfaellt (verbindung "ausstehend" sagt dasselbe). speicher_pruefen nennt an der Verbindung zusaetzlich id und zuletztGeprueft',
  '2.53.1: Speicher-Verbindungen am Konto (Plan speicher-verbindungen-und-library-anlage, A2). Zugangsdaten liegen nicht mehr in der Library-Config, sondern verschluesselt an der Speicher-Verbindung der Person; die Library zeigt mit storageConnectionId darauf. bibliothek_anlegen (Schema unveraendert) haengt eine Nextcloud-Library an die Verbindung mit gleicher WebDAV-URL und gleichem Benutzer und nennt sie als speicherVerbindung { id, bezeichnung }; ohne passende Verbindung (und immer bei OneDrive) bleibt verbindung "ausstehend", naechsterSchritt nennt Konto-Seite und Archive · 1 Quelle. speicher_pruefen nennt statt webdavUrl/benutzer/geheimnisHinterlegt jetzt speicherVerbindung { bezeichnung, webdavUrl, benutzer, geheimnisHinterlegt, angemeldet (OneDrive) } oder { fehler } (nicht umgehaengte Library: Verweis auf das Migrationsskript). Eigene Werkzeuge fuer Verbindungen folgen mit A3',
  '2.53.0: Webseite als Quelle — Befunde aus dem Cowork-Test 13.10. (Rai-Videoseite mit medienEinbetten: false). TONSPUR BEI VIDEOS: webseite_erschliessen laedt Videos und Streams ueber den Secretary als reine Tonspur (POST /api/media/download mit nur_audio, Vorgabe true, ffmpeg → m4a; vorher kam die mp4 mit Bild). Die Datei heisst „<Basis> - Audio.m4a"; sprecherErkennung, kontext und begriffe gelten damit auch fuer Videoseiten. Nur wenn keine Tonspur extrahierbar war (Datei „<Basis> - Video.*"), weist das Werkzeug diese Optionen ab — und zwar BEVOR etwas geschrieben wird. AUFRAEUMEN: Scheitert ein Aufruf nach dem Hochladen, entfernt das Werkzeug die schon geschriebenen Dateien wieder und nennt in der Fehlermeldung, was gegebenenfalls von Hand zu loeschen ist; der Transkriptionsjob startet erst, wenn Medium, Cover und Sammeldatei liegen. DATUM: seite.datePublished kommt jetzt auch aus einem VideoObject/AudioObject im JSON-LD-@graph (Rangfolge nach Typ statt Reihenfolge — die WebPage stand davor und trug kein Datum), aus video:release_date und aus <time datetime>. job_status: cover_source own_fragment ist eine gueltige Herkunft (kein Befund „unbekannte Herkunft" mehr). Voraussetzung: Secretary mit nur_audio (CommonSecretaryServices #36)',
  '2.52.0: Wunschliste 8, W8-3 — familie_uebergeben gibt eine Quelle MIT Twin-Familie (Transkript, Transformationen, Transkript-Segmente, Quellkennung) von vonLibraryId in einen Ordner von nachLibraryId (nachOrdnerId | nachOrdnerPfad; Quelle per sourceId | quellPfad) und schreibt in den Herkunftsordner „Verweis – <Quellname>.md" (type: verweis, uebergeben_nach_library, uebergeben_nach_pfad, uebergeben_nach_adresse @<slug>/<pfad>, source_content_hash, generated_by/at; Link [[@<slug>/<pfad>]]). herkunft Pflicht ohne Vorgabe: behalten (Datei bleibt neben dem Verweis) | verwerfen (Quelle samt Familie nach „zu klären", derselbe Weg wie quelle_verwerfen). Nie geloescht; Vektoren und Seitenbilder werden nicht kopiert (danach index_aktualisieren in B). Antwort: plan, schritte (import_herkunft, quelle_kopiert, twin_angelegt, segmente_kopiert, export_ziel, kennung_herkunft, verweis_geschrieben, herkunft; je ok | uebersprungen | fehler), neueSourceId, offen. Scheitert twin_angelegt, wird die Kopie in B entfernt und A bleibt unveraendert. vorschau: true zeigt nur den Plan. Nur Owner beider Libraries; Grenze 250 MB. type: verweis gehoert zu den Begleittypen mit Pflichtstempel generated_by/generated_at (wie notiz, verlauf)',
  '2.51.0: Webseite als Quelle (Owner 13.10.). webseite_erschliessen legt aus einer Artikelseite eine Sammeldatei im Ordner an: Seite OHNE Sprachmodell gelesen (Titel, Quelle, Datum, Autor, Absaetze woertlich; Metadaten aus Open Graph und JSON-LD), eingebettetes Audio/Video ueber den Secretary (POST /api/media/resolve, yt-dlp — Rai News, YouTube, Vimeo, PeerTube …) aufgeloest und als „<Basis> - Audio.mp3" neben die Sammeldatei geladen, Coverbild der Seite als „<Basis> - Cover.jpg" (nicht <Basis>.mp3: eine <Basis>.md daneben gilt sonst als Transkript des Mediums), Transkription des Mediums gestartet (nur Transkript, kein Ingest). Sammeldatei: kind composite-transcript, _include_self, _source_files [Medium], _media_files [Medium, Cover]. AUDIO UND COVER RECHNET DIE PIPELINE: _media_files registriert jetzt auch Audio/Video als Fragment (vorher nur Bild/PDF); der Ingest setzt audio_url aus dem Audio-Fragment am eigenen Twin (Trace-Ereignis audio_source) und das Cover aus einem Fragment „<Basis> - Cover.*", <Basis>.cover.* oder cover.* am eigenen Twin (cover_source: own_fragment) vor dem Folien-/Flyer-Weg. Neue Vorlage artikel-de (Ereignis-Ansicht, docType artikel, Facetten wie vortrag-session-de): Artikel woertlich, Zusammenfassung extraktiv, Zitate aus dem Interview-Transkript. Kein Medium oder kein Cover steht mit Grund in der Antwort. VIDEOSEITEN: Streams (HLS/DASH, z. B. Rai-Videos) holt der Secretary ueber POST /api/media/download mit ffmpeg (Antwort weg: secretary-download), direkte Dateien laedt KS selbst (weg: secretary); YouTube-, Vimeo- und PeerTube-Seiten ergeben eine Embed-Adresse (Antwort videoEmbedUrl, Zeile „Video:" in der Sammeldatei, Feld video_url in artikel-de) — andere Videos erscheinen als Audio-Player ohne Embed. medienEinbetten: false (Owner 13.10., rechtliche Vorgabe) laedt und transkribiert das Medium, bettet es aber NICHT ein: kein Blob, kein Player, kein Embed — im Eintrag nur Vorschaubild und der Link zur Originalseite (artikel-de setzt ihn ueber den Artikel). Skill webseite-erschliessen beschreibt den Ablauf. Derselbe Weg fuer die Oberflaeche: POST /api/library/[id]/web-source',
  '2.50.0: Wunschliste 8, W8-2 — quelle_suchen findet eine Quelle in ALLEN eigenen Libraries (Eingabe genau eine von: hash | dateiname + groesse | vonLibraryId + sourceId aus einem Befund), Rangfolge uebereinstimmung hash > name_groesse > name, je Treffer libraryName, slug, adresse @<slug>/<pfad>, pfad, imSpeicher, erschliessung; inhaltVerschieden nennt gleichen Namen mit belegt anderem Inhalt; nachrechnen: true (begruendung Pflicht) rechnet die Quellkennung der gesuchten Quelle und von bis zu 5 Treffern (je bis 50 MB) und schreibt sie ans Twin-Dokument. quelle_verschwunden traegt moeglicherweiseIn (bis 5 Orte: libraryId, libraryName, bibliothek @<slug>, sourceId, uebereinstimmung; [] = gesucht, nichts gefunden; fehlt = nicht gesucht) und moeglicherweiseInGesamt, gesucht nur in MongoDB; abdeckung_lesen zeigt beides. GRUNDLAGE ADRESSEN (Plan Abschnitt 6): Verweise [[@<slug>/<pfad>]] in andere Libraries; bibliotheken_auflisten nennt slug, slugHerkunft (gesetzt | veroeffentlicht | abgeleitet), slugKonflikt, frueherSlugs; neues Werkzeug adresse_setzen (instanzweit eindeutig, alter Slug wird gemerkt, nur Owner); das Verweis-Audit prueft @-Adressen nur gegen die bekannten Slugs (unbekannt oder unlesbar = verweis_tot), ohne Library-Liste bleiben sie ungeprueft. Grenze: eine verschwundene Quelle von vor 2.49.1 traegt weder Kennung noch Groesse — fuer sie bleibt es bei name',
  '2.49.1: Wunschliste 8, W8-1 — Quellkennung am Twin-Dokument: sourceContentHash (SHA-256 ueber den Inhalt der Quelldatei), sourceSize, sourceHashedAt. Gerechnet in der Start-Route aus dem Blob, der zum Secretary geht (kein zweites Lesen), am Job gemerkt (quellkennung) und beim Abschluss ans Twin-Dokument geschrieben (Job-Log quellkennung_gesetzt | quellkennung_ohne_twin | quellkennung_fehler). Wiedererkennung ueber Library-Grenzen, kein Schluessel: Identitaet bleibt die Provider-Id. artefakt_lesen nennt quellkennung (null = seit 2.49.1 nicht neu erschlossen). Kein Migrationslauf: Bestand bekommt die Kennung bei der naechsten Erschliessung oder ueber quelle_suchen nachrechnen (W8-2, folgt). NICHT sourceHash — der Name ist an binaryFragments[].sourceHash vergeben. Index { libraryId, sourceContentHash }',
  '2.49.0: Wunschliste 8, W8-4 — Libraries gehoeren zu Vorhaben. BERICHT.md nimmt das Feld libraries: (Flow-Form wie repo:, Werte sind Library-Ids oder -Namen). Zwei neue Befunde im Library-weiten Scan einer Archivpflege-Library (abdeckung_scannen ohne pfad): library_ohne_vorhaben (eine eigene Library des Users, die kein Bericht nennt; Library-Ebene, Akteur Cowork, info; targetId = libraryId) und library_unbekannt (ein Wert unter libraries:, der weder Id noch Name einer eigenen Library ist; je Bericht ein Sammelbefund). Teilbaum-Scans und Libraries ohne Archivpflege melden beides nicht. abdeckung_lesen nennt je Vorhaben libraries (roh; null = Report vor 2.49.0)',
  '2.48.1: Website-Sektionen image-left/image-right nehmen zwei neue Marker-Attribute: image_width=1/3 (ein Drittel Bild, zwei Drittel Text; Vorgabe 1/2) und image_align=top (Bild obenbuendig; Vorgabe center), z. B. <!-- section layout=image-left bg=light image_width=1/3 image_align=top -->. Ungueltige Werte und Bild-Attribute an Layouts ohne Bildspalte weist der Parser ab (seite_pruefen und dokument_publizieren melden es). seite_pruefen nennt je Sektion bildBreite und bildAusrichtung, wenn gesetzt. Andere unbekannte Marker-Attribute ignoriert der Parser weiterhin stumm (Bestandsschutz). hero_layout: none rendert KEINEN Kopf (kein Titel, kein Abstand ueber der ersten Sektion) — fuer Seiten, deren erste Sektion das Bild traegt; dokument_publizieren warnt bei unbekanntem hero_layout und bei none mit hero_image',
  '2.48.0: Welle K Pruefbarkeit (K1–K3, Owner 12.10.). DIE BRUECKE ZEIGT, WAS DER LESER SIEHT: dokument_lesen liest EIN Meta-Dokument des Index (sourceId oder pfad) als Lesersicht — Titel, Typ, Veroeffentlichungs-Stand, coverImageUrl/coverThumbnailUrl, anhaenge als Paare (name, url), folien { anzahl, mitAdresse, ohneAdresse: [Seitenzahlen] }, galerieBilder, upsertedAt, galerieAdresse (/explore/<slug>?doc=…) oder null mit Grund; nicht deutbare Formen (slides als Text) stehen in hinweise. dokumente_auflisten mit lesersicht: true nennt je Zeile cover, anhaenge, folienMitAdresse, folienAnzahl. job_status nennt ereignisse (feste Liste des Ingest-Spans: slide_images_resolved/unresolved, cover_source, attachments_source, attachments_links_rewritten, extract_only_page_images_registered/skipped/error, frontmatter_json_list_invalid — Name, Zeitpunkt, Attribute; Log-Phasen derselben Liste, wenn kein Trace-Ereignis) und befunde: string[] aus Schrittdetails und Ereignissen (Folien N von M ohne Adresse mit Namen, Cover keine Quelle mit Grund, Anhaenge keine PDF-Quelle, Transformation/alles uebersprungen, Seitenbilder nicht registriert, Frontmatter-Listenfeld nicht lesbar); leere Liste = nichts zu melden, der Status bleibt completed. batch_bilanz nennt zeilen je Job (coverQuelle, folien, befunde) und mitBefund. index_aktualisieren und transformation_starten verweisen im hinweis auf befunde und dokument_lesen. K4–K6 (App-Version in bruecke_info, Stempel ingestedWith/generated_with, drei Zahlen in twins_pruefen) folgen in PR 2',
  '2.47.0: Welle J Lesersicht (Owner 11.10.). BILDER RECHNET DIE PIPELINE, NICHT DAS MODELL: Der Ingest liest slides aus dem flachen Twin-Frontmatter auch als JSON-Text, loest Folienbilder ueber die Seitenbilder der Quellen-Twins (compositeSources, Vorrang Folien-PDF) auf, rechnet ein fehlendes Cover aus der zweiten Folienseite (sonst Flyer) und traegt fehlende PDF-Anhaenge aus den PDF-Quellen ein (Blob-Adresse, Markdown-Links im Body umgeschrieben). job_status zeigt am Schritt ingest_rag bilder: { aufgeloest, unaufgeloest }; Trace-Events slide_images_resolved/unresolved, cover_source, attachments_source. Vorlagen vortrag-session-de und veranstaltung-einleitung-de nennen nur noch Seitenzahlen, keine Dateinamen. Voraussetzung: die Sammeldatei wurde seit 2.43.0 einmal transformiert (compositeSources am Twin)',
  '2.46.1: Welle I (I3 + I4) Fehlertexte vollstaendig, Zaun abgeglichen. job_status und batch_bilanz: Fehlermeldungen des Secretary ungekuerzt (keine 600-Zeichen-Grenze mehr beim Schreiben, 1500 beim Lesen), Antwort-Vorschau ohne das request-Echo, die JUENGSTEN fuenf Fehlerereignisse in zeitlicher Reihenfolge, step_failed mit error-Objekt lesbar ([code] message Details), Netzfehler mit Ursache (fetch failed (ECONNREFUSED …)), error.code des Secretary bleibt erhalten. fehlerDeutung kennt vier neue Arten: secretary_abbruch (aborted, fetch failed, Zeitlimit → Secretary oder Anbieter, nicht die Vorlage; wiederholenSinnvoll true), kein_llm_aufruf (TEMPLATE_TRANSFORMATION_ERROR mit 0 LLM-Aufrufen → Secretary-Konfiguration oder Modell), text_feed_failed, abschluss_verweigert; job_status deutet auch job.error, batch_bilanz die ungekuerzte Meldung samt Code. bestand_pruefen nutzt den Zaun aus batch-zaun.ts (kennt tests/); der Ordnerweg von index_aktualisieren und bestand_pruefen weist einen Startordner ab, der selbst Twin- oder Testordner ist',
  '2.46.0: Welle I Verlaesslichkeit der Bruecke (I1 + I2, Owner 11.10.). INGEST IST EIN BEWUSSTER SCHRITT: transformation_starten, quelle_erschliessen (nur mit Vorlage) und sammeldatei_anlegen (mit transformieren) nehmen ingest (boolean); weglassen = false, die Antwort nennt ingest mit herkunft (aufruf | vorgabe) und naechsterSchritt. Ohne ingest: true liegt die Transformation am Twin, kein Galerie-Eintrag — der Mensch prueft in der KS-Oberflaeche, dann index_aktualisieren mit den geprueften sourceIds. Kein Sonderfall fuer test/. job_status zeigt ingest_rag bei abgeschaltetem Ingest als uebersprungen mit Grund „abgeschaltet (ingest: false)". TEXT-FEED EHRLICH: der Template-auf-Text-Job (Transkript aus MongoDB) ist waehrend des Feeds nicht vom Worker claimbar (running ab Anlage, mit Schritten), failed nur noch, wenn die Callback-Route den Job nie angefasst hat (setFailedIfUntouched), sonst Trace-Ereignis text_feed_fehler_nach_arbeit; Zeitgrenze = EXTERNAL_TEMPLATE_TIMEOUT_MS + 10 min Ingest-Zugabe ueber node:http statt der stillen 300-s-Grenze von fetch, Ablauf als Trace-Ereignis text_feed_timeout mit Deutung. Skill veranstaltung-aufbereiten: Stationen 5 Transformieren (ingest: false), 6 Pruefen (Haltepunkt), 7 Freigabe = index_aktualisieren',
  '2.45.0: Handover Library-Anlage — bibliothek_anlegen (name, inhaltstyp, Speicher ohne Geheimnis; vorlageVon uebernimmt Chat, Verarbeitung und Ingest-Schalter, vorlagenKopieren die Vorlagen; geheimnisFehlt + verbindung "ausstehend"), speicher_pruefen (Verbindungstest ohne Testordner, ohne Werte), vorlage_uebernehmen (aus Library oder aus Datei in templates/, ueberschreiben explizit), kopieren (Datei/Ordner, Twin-Ordner nie, nurQuellen ohne test/ und erzeugte Seiten, vorschau). index_aktualisieren: nurPublizierte (Vorgabe TRUE, T9) und vorlage, Zeilen mit Pfad, uebersprungen mit Grund. dokumente_auflisten und bestand_pruefen: ordner. frage_stellen: targetLanguage, character, accessPerspective, socialContext, genderInclusive, answerLength; Query-Log und Cache-Suche tragen dieselbe Perspektive (T6: zweiter Aufruf traf nie), Antwort nennt perspektive. vorlagen_auflisten: datei (Stand der gleichnamigen Datei in templates/, neuerAlsMongo), nurAlsDatei. bestand_pruefen: unbekanntes kennungsfeld wird genannt (T2). ordner_anlegen legt den Blattordner ohne elternAnlegen an (T0). artefakt_lesen kuerzt lange Frontmatter-Felder (frontmatterGekuerzt, T5)',
  '2.44.0: Welle G — artefakt_lesen liefert Transkript oder Transformation (sprache, optional vorlage; ohne vorlage die juengste der Sprache, benannt) einer Quelle aus MongoDB ohne Spiegel, Body ohne Frontmatter per Vorgabe, auf maxZeichen gekuerzt (gekuerzt: true), mit Uebersicht der vorhandenen Artefakte; ein Fehlgriff nennt, was es stattdessen gibt',
  '2.43.0: Welle E Einheiten — sammeldatei_anlegen (Referenz-Markdown wie der Knopf Sammel-Transkript: prueft Existenz und Transkript jeder Quelle, ueberschreibt nichts, optional title/_include_self/_media_files und direkt transformieren), sammeldatei_pruefen (fehlende Quellen mit Namen, Abhaengigkeit vermerkt?, Transformationen), abhaengige_dokumente (Sammeldateien mit dieser Quelle samt ueberholt — eine Mongo-Abfrage ueber das neue Twin-Feld compositeSources, das der Transformations-Job beim Aufloesen schreibt; Owner 08.10.). transkript_korrigieren, der Reiter Korrektur und seine Route nennen jetzt die abhaengigen Sammeldateien (abhaengigeSammeldateien)',
  '2.42.0: Welle B Optionen durchreichen — quelle_erschliessen nimmt fuer Audio sprecherErkennung (true = Sprecher-Modell, false = ohne, danach manuell im Reiter Korrektur pruefen; weglassen = Library-Voreinstellung), kontext und begriffe (P3a) und nennt je Quelle den Weg mit Herkunft und naechstem Schritt (jobs[].transkription, wege); quelle_erschliessen und transformation_starten nehmen folienAlsTabelle und anhangInSuche (P6), nur explizite Booleans landen im Job. job_status zeigt bei Audio-Jobs den Audio-Kontext (audioKontext). Die Job-Bauer der Bruecke (enqueue-secretary-job, enqueue-markdown-job, enqueue-document-job) kennen die Optionen jetzt wie die Pipeline-Route',
  '2.41.0: Welle F Messen vor Aendern — frage_stellen (eine Frage auf dem Weg der Stream-Route: Antwort, nummerierte Dokumente mit Facettenwerten, zitierte Nummern, nachpruefung, queryId; ohneCache und baseline), golden_set_fahren (Golden-Set-JSON aus der Library als JOB: Fortschritt je Frage in job_status, Bericht als Markdown neben der Set-Datei und als job_status.ergebnis; baseline, richterModel, nur), frage_log_lesen (Query-Log mit Cache-Parametern und Nachpruefung, mitPrompt optional). job_status zeigt bei Golden-Set-Jobs das Ergebnis',
  '2.40.0: Welle D Konfiguration ist Vertrag — konfiguration_lesen (Bereiche facetten | antwortregeln | chat | galerie | veroeffentlichung; ohne bereich alle), konfiguration_setzen (facetten ersetzt gallery.facets in der JSON-Form des Editor-Exports, antwortregeln als Text mit Platzhalter-Querpruefung, chat und galerie als Teil-Update; Embeddings/Vektor-Store/Modelle nur lesbar; nur Owner). Pruefung mit demselben Schema wie das Formular (chat-config-validation.ts) — die PATCH-Route /api/libraries/[id] prueft config.chat jetzt ebenfalls und antwortet 400 statt eine ungueltige Konfiguration zu speichern',
  '2.39.0: Welle C Index folgt dem Twin — index_aktualisieren (nur Phase 3: vorhandene Transformation neu in den Index, sourceIds bis 30 ODER ordner/ordnerId + rekursiv bis 200, liefert batchId; Twin-Ordner _… und test/ werden hinter demselben Zaun wie im Batch-Dialog uebersprungen und genannt), index_entfernen (Stapel-Form von dokument_depublizieren, bis 30), batch_neustart (gescheiterte Jobs eines Batches oder eine jobIds-Liste zurueck in die Warteschlange, laufende ausgelassen — wie der Knopf im Job-Monitor). dokument_felder_setzen zieht die geaenderten Felder jetzt auch an den Chunks nach (zeilen[].chunks). Der Batch-Dialog „Verzeichnis verarbeiten" laeuft hinter demselben Zaun und zeigt ausgelassene Ordner',
  '2.38.0: Welle A Library-Betrieb — dokumente_auflisten (Galerie-Eintraege als Feldzeilen mit demselben Filter wie die Galerie-Route: Typ, Facettenwerte, Suche, Seiten), bestand_pruefen (Befundliste mit sourceIds: doppelte Kennung per kennungsfeld, Werte ausserhalb des Facetten-Woerterbuchs, fehlende Pflichtfelder des Typs, Eintraege aus Twin-/test-Ordnern; nennt uebersprungene Regeln), batch_bilanz (Zaehler je Batch, gescheiterte Jobs nach letzter Fehlerursache gruppiert mit Deutung, jobIds und Quellen). Alle drei lesen nur',
  '2.37.0: transkript_korrigieren — Hoerfehler im Transkript-Body per Ersetzungen (alt muss genau einmal vorkommen, sonst nicht_eindeutig; alle: true fuer wiederkehrende), adressiert ueber die QUELLE (sourceId/pfad), ifVersion des Spiegels Pflicht, nurVorschau fuer den Diff; setzt revised_by/revised_at/revision_note, laesst generated_* stehen, schreibt MongoDB zuerst und exportiert nur diese Familie versioniert in den Spiegel; Spiegel ≠ MongoDB oder veraltetes ifVersion → konflikt ohne Schreiben. transformation_stale und die Abnahme (verified_at) rechnen jetzt mit max(generated_at, revised_at). Die _-Sperre von datei_patchen/datei_schreiben bleibt',
  '2.36.0: siteTheme in veroeffentlichung_setzen als explizites Objekt-Schema (vorher anyOf mit null, das der Client nicht anzeigte und als Text schickte); loeschen jetzt ueber siteThemeLoeschen: true',
  '2.35.0: veroeffentlichung_setzen nimmt siteTheme, das Design-Profil der Website (Welle S2): Schriften per Name (geist, newsreader, plus-jakarta), Akzent, Buttonform und Farben je Flaeche als #rrggbb; geprueft in site-theme.ts, null loescht; veroeffentlichung_lesen zeigt es. Ohne Profil rendert die Vorlage unveraendert',
  '2.34.0: veroeffentlichung_lesen zeigt publicPublishing der Library (Slug, isPublic, siteEnabled, Logo, Galerie-Texte; API-Schluessel nur als gesetzt/nicht gesetzt) samt Adresse /explore/<slug>; veroeffentlichung_setzen aendert nur genannte Felder mit derselben Validierung und demselben Merge wie das Formular (public-publishing-validation.ts, jetzt von Route UND Bruecke genutzt), prueft Slug-Eindeutigkeit, nur Owner, nie den API-Schluessel; isPublic: true wird als Aktion mit Aussenwirkung benannt',
  '2.33.0: bild_veroeffentlichen kopiert Bilder aus dem Library-Storage (Vorgabe web/images/, oder quellPfad/ordnerPfad) in den oeffentlichen Blob <libraryId>/website/images/ und liefert die anonymen URLs fuer hero_image und Sektions-Bilder — ersetzt das lokale Spiegelskript; Nicht-Bilder werden laut uebersprungen, vorhandene Blobs nur mit ueberschreiben ersetzt. bilder_auflisten listet die Blob-Bilder der Library',
  '2.32.0: Website aus der Bruecke publizieren — dokument_publizieren macht eine Markdown-Quelle UNVERAENDERT (ohne Sprachmodell) zum Galerie-Eintrag (Vorlage website-page bzw. markdown-page am Twin, dann Ingest; Pruefung von detailViewType, Pflichtfeldern, Sektions-Markern, Bild-URLs; Warnungen blockieren bis trotzWarnungen), dokument_depublizieren nimmt den Eintrag zurueck, dokument_felder_setzen setzt flache Felder/Tags an Twin UND Meta-Dokument (bis 30 Quellen; prioritaets_index und Pflichtfelder gesperrt), seite_pruefen liefert Menue, Footer und je Seite Sektionen mit Befunden plus Veroeffentlichungs-Stand',
  '2.31.0: bibliotheken_auflisten liefert je Library archivpflege (= Agentensicht aktiviert). stand_setzen, themen_setzen, erschliessung_block_schreiben und sichten_regenerieren sind bei archivpflege=false GESPERRT (Fehler statt _INDEX.md/BERICHT.md-Struktur in einer fremd gebauten Library); alle uebrigen Werkzeuge bleiben generisch nutzbar',
  '2.30.5: familie_umziehen/quelle_verwerfen: result.newSourceId, sourceIdChanged, vectorsRekeyed — auf pfadbasierten Providern (Nextcloud) aendert Umbenennen/Verschieben die Storage-Id; Twin-Dokument wird umgeschluesselt, der Schaufenster-Eintrag (docs/doc-meta) auf die neue Id umgeschrieben, Export laeuft mit der neuen Id. Bei Id-Wechsel steht die neue Id im hinweis',
  '2.30.4: transformation_starten: jobs[].hinweis, wenn am Twin schon eine ANDERE Vorlage haengt als die gestartete (ohne template gilt die Library-Vorgabe, nicht die Vorlage des Twins). job_abbrechen wirkt jetzt: ein beendeter Job schreibt weder Transformation noch Schaufenster-Eintrag und wird nicht mehr completed',
  '2.30.3: transformation_starten kennt erzwingen — automatisch bei juengerer Vorlage, juengerem Transkript oder nur anderer Vorlage am Twin (jobs[].erzwungen nennt den Grund); eine AKTUELLE Transformation wird ohne Job abgesagt statt still uebersprungen. job_status: Hinweis, wenn transform_template uebersprungen wurde, obwohl andere Schritte liefen',
  '2.30.2: transformation_starten nimmt Markdown-Quellen und Sammeldateien (kind: composite-transcript) OHNE Transkript — Job-Form wie im KS-UI; nicht aufloesbare _source_files kommen als Fehler mit Dateinamen vor dem Job-Start',
  '2.30.1: bericht_ueberholt liest kein Datum mehr aus Linkzielen ([[2026-09-08 … — Notiz]]); verweis_tot meldet im TEILBAUM-Scan nur noch Verweise, deren Ziel im Teilbaum liegen muesste — blosse Namen und Pfade nach aussen beurteilt der Voll-Scan',
  'datei_lesen: bereich {art: "gliederung"} — Ueberschriften mit Zeilenbereich, Bytes, offenen Punkten; kein Body',
  'datei_patchen/datei_schreiben/datei_anlegen: bei BERICHT.md groesseNachher, schwelle, schwelleUeberschritten (+ hinweis bei neuem ##-Abschnitt)',
  'abdeckung_lesen: Block "berichte" (berichtBytes je Vorhaben); conventions um berichtMaxBytes, statusMaxZeilen, ueberholtNachTagen',
  'neue Befunde: bericht_zu_lang, status_zu_lang, bericht_ueberholt, verlauf_fehlt, entwicklung_unberichtet',
]

/** Registriert `bruecke_info` (siehe Datei-Kommentar). */
export function registerInfoTool(server: McpServer): void {
  server.registerTool(
    'bruecke_info',
    {
      title: 'Bruecken-Version + Soll-Toolliste',
      description:
        'Nennt Werkzeugsatz-Version und Soll-Toolliste des Servers. Weicht die eigene Sicht ab ' +
        '(fehlende/andere Werkzeuge), ist die Toolliste der Desktop-App veraltet — den Menschen ' +
        'bitten, die Erweiterung aus- und wieder einzuschalten. Liest nur.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      return jsonResult({
        toolsetVersion: TOOLSET_VERSION,
        werkzeuge: TOOL_NAMES,
        neuInDieserVersion: NEU_IN_VERSION,
        hinweis:
          'Fehlt hier gelistetes Werkzeug in deiner Sicht: Toolliste der Desktop-App ist veraltet — ' +
          'Erweiterung aus-/einschalten (Einstellungen → Erweiterungen).',
      })
    },
  )
}
