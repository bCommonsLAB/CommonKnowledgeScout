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
export const TOOLSET_VERSION = '2.49.0'

/** Soll-Liste der Werkzeuge (Reihenfolge = Registrierung in tools.ts). */
export const TOOL_NAMES = [
  'bibliotheken_auflisten',
  'abdeckung_lesen',
  'abdeckung_scannen',
  'twins_pruefen',
  'twins_synchronisieren',
  'familie_umziehen',
  'quelle_verwerfen',
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
  // Handover Library-Anlage (08.10.).
  'bibliothek_anlegen',
  'speicher_pruefen',
  'vorlage_uebernehmen',
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
  '2.49.0: Webseite als Quelle (Owner 13.10.). webseite_erschliessen legt aus einer Artikelseite eine Sammeldatei im Ordner an: Seite OHNE Sprachmodell gelesen (Titel, Quelle, Datum, Autor, Absaetze woertlich; Metadaten aus Open Graph und JSON-LD), eingebettetes Audio/Video ueber den Secretary (POST /api/media/resolve, yt-dlp — Rai News, YouTube, Vimeo, PeerTube …) aufgeloest und als <Basis>.mp3 neben die Sammeldatei geladen, Coverbild der Seite als <Basis>.cover.jpg, Transkription des Mediums gestartet (nur Transkript, kein Ingest). Sammeldatei: kind composite-transcript, _include_self, _source_files [Medium], _media_files [Medium, Cover]. AUDIO UND COVER RECHNET DIE PIPELINE: _media_files registriert jetzt auch Audio/Video als Fragment (vorher nur Bild/PDF); der Ingest setzt audio_url aus dem Audio-Fragment am eigenen Twin (Trace-Ereignis audio_source) und das Cover aus einem Fragment <Basis>.cover.* oder cover.* am eigenen Twin (cover_source: own_fragment) vor dem Folien-/Flyer-Weg. Neue Vorlage artikel-de (Ereignis-Ansicht, docType artikel, Facetten wie vortrag-session-de): Artikel woertlich, Zusammenfassung extraktiv, Zitate aus dem Interview-Transkript. Kein Medium oder kein Cover steht mit Grund in der Antwort. Derselbe Weg fuer die Oberflaeche: POST /api/library/[id]/web-source',
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
