/**
 * @fileoverview Wiederkehrende Fehlschlaege deuten, statt sie durchzureichen (W11, I3).
 *
 * @description
 * Cowork-Befund 02.09.2026: **Sieben Bildschirmaufnahmen** scheiterten
 * reproduzierbar an der Ton-Extraktion — sie haben schlicht keine Tonspur.
 * `job_status` reichte die Meldung des Dienstes durch (seit ST7 immerhin
 * die echte), aber niemand las daraus die Konsequenz: Ein erneuter Versuch
 * scheitert wieder, an derselben Stelle, aus demselben Grund. Der Scan
 * meldete die Quellen weiter als `source_without_twin` — behebbar —, und so
 * wurden sie wieder gestartet.
 *
 * **Der schwerwiegendere Teil desselben Befunds:** Bei zwei dieser Dateien
 * hat eine FRUEHERE Transkription nicht gescheitert, sondern **halluziniert**
 * — chinesische Phantomsaetze, die fuer jeden Scan gueltig aussehen. Ein
 * Transkript ohne Tonquelle ist kein Transkript, aber nichts am Artefakt
 * verraet das. Deshalb sagt die Deutung es ausdruecklich: Wo diese Quelle
 * schon ein Transkript hat, gehoert es angesehen, nicht geglaubt.
 *
 * **Welle I3 (Live-Pruefall 08.–11.10.2026):** vier weitere Lagen, die im
 * Pruefall jeweils falsch gelesen wurden — „aborted" nach zwei Minuten als
 * Vorlagenfehler (es war der Secretary), `TEMPLATE_TRANSFORMATION_ERROR` mit
 * null LLM-Aufrufen als Vorlagenfehler (es war die Secretary-Konfiguration),
 * ein Text-Feed-Fehler als Jobfehler (der Job war fertig), „Abschluss
 * verweigert" als neuer Fehler (es war die Folge des Text-Feeds).
 *
 * **Was hier NICHT steht.** Die eigentliche Vorpruefung (`ffprobe` vor der
 * Extraktion, zwei Sekunden statt eines Jobs) gehoert in den Secretary
 * Service — dieses Repository fuehrt weder ffmpeg noch ffprobe aus.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module mcp
 */

export type FehlerArt =
  | 'quelle_ohne_ton'
  | 'abschluss_verweigert'
  | 'text_feed_failed'
  | 'kein_llm_aufruf'
  | 'secretary_abbruch'
  | 'youtube_anmeldung'

/** Was der Fehlschlag bedeutet und was daraus folgt. */
export interface FehlerDeutung {
  /** Kurzname der erkannten Lage — dieselbe Sprache wie die Coverage-Befunde. */
  art: FehlerArt
  /** Klartext: was los ist. */
  deutung: string
  /** Was zu tun ist — und was ausdruecklich NICHT. */
  empfehlung: string
  /** false = ein erneuter Versuch scheitert wieder. */
  wiederholenSinnvoll: boolean
}

/**
 * Signaturen einer fehlenden Tonspur.
 *
 * Bewusst eng und woertlich: Ein zu breites Muster wuerde fremde Fehlschlaege
 * mit einer falschen Diagnose versehen, und eine falsche Diagnose ist
 * schlimmer als gar keine — sie beendet die Suche.
 */
const OHNE_TON: readonly RegExp[] = [
  /does not contain any stream/i,
  /matches no streams/i,
  /\bno audio stream(s)? (found|detected|present)\b/i,
  /\bkeine? (audio|ton)spur\b/i,
  /stream map .*matches no streams/i,
]

/** Folge eines von Hand oder vom Text-Feed beendeten Jobs (finalize-completion). */
const ABSCHLUSS_VERWEIGERT: readonly RegExp[] = [/Abschluss verweigert/i]

/** Der Feed der Bruecke an die Callback-Route — nicht die Verarbeitung selbst. */
const TEXT_FEED: readonly RegExp[] = [/\btext_feed_failed\b/, /\btext_feed_timeout\b/, /Text-Feed (schlug fehl|nicht zustellbar|ohne Antwort)/i]

/** Transformer hat kein Modell aufgerufen — Konfiguration oder Modell-Id. */
const KEIN_LLM_AUFRUF: readonly RegExp[] = [/\b0 LLM[- ]?(Aufrufe?|calls?)\b/i, /\bllm_calls["']?\s*[:=]\s*0\b/i, /\bkein(e)? LLM[- ]?Aufruf/i]
const TEMPLATE_FEHLER_CODE = /TEMPLATE_TRANSFORMATION_ERROR/

/** Verbindung zum Secretary oder seinem Anbieter abgerissen — Zeitlimit, nicht Inhalt. */
const SECRETARY_ABBRUCH: readonly RegExp[] = [
  /\baborted\b/i,
  /\bfetch failed\b/i,
  /\bRequest timed out\b/i,
  /\bTimeoutError\b/,
  /\bUND_ERR_(HEADERS|BODY)_TIMEOUT\b/,
  /\bZeitlimit\b/i,
]

/** YouTube weist den Secretary als Bot ab (Cowork-Test 21.10.2026): Server-IP, nicht die Quelle — ein Neustart aendert nichts. */
const YOUTUBE_ANMELDUNG: readonly RegExp[] = [/confirm you.?re not a bot/i, /cookies .*(no longer valid|are not valid)/i, /Use --cookies(-from-browser)?/i]

function trifft(muster: readonly RegExp[], text: string): boolean {
  return muster.some((m) => m.test(text))
}

/**
 * Deutet die gesammelten Fehlermeldungen eines Jobs (Meldungen, Antwort-
 * Auszuege, `job.error.code` und `job.error.message` — alles, was es gibt).
 *
 * `null` heisst „nicht erkannt" — dann bleibt es bei den Rohdetails aus dem
 * Trace. Es wird nichts geraten: Lieber keine Deutung als eine, die in die
 * falsche Richtung schickt. Die Reihenfolge geht vom Speziellen zum
 * Allgemeinen: ein Text-Feed-Fehler enthaelt „fetch failed", ist aber kein
 * Secretary-Abbruch.
 */
export function deuteFehler(meldungen: readonly (string | null | undefined)[]): FehlerDeutung | null {
  const text = meldungen.filter((meldung): meldung is string => typeof meldung === 'string').join('\n')
  if (text === '') return null

  if (trifft(OHNE_TON, text)) {
    return {
      art: 'quelle_ohne_ton',
      deutung:
        'Die Datei enthaelt keine Tonspur — die Ton-Extraktion findet nichts zum Transkribieren. ' +
        'Typisch fuer Bildschirmaufnahmen, die ohne Mikrofon aufgezeichnet wurden.',
      empfehlung:
        'NICHT erneut erschliessen: Der Job scheitert wieder an derselben Stelle. Entweder die ' +
        'Aufnahme mit Ton ersetzen, oder die Quelle mit quelle_verwerfen aus dem Bestand nehmen. ' +
        'WICHTIG: Falls diese Quelle bereits ein Transkript hat, ist es verdaechtig — eine ' +
        'Transkription ohne Tonquelle liefert erfundenen Text, der fuer jeden Scan gueltig ' +
        'aussieht. Vor dem Weiterverwenden ansehen.',
      wiederholenSinnvoll: false,
    }
  }

  if (trifft(ABSCHLUSS_VERWEIGERT, text)) {
    return {
      art: 'abschluss_verweigert',
      deutung:
        'Die Verarbeitung war fertig, aber der Job stand schon auf failed — von Hand beendet oder ' +
        '(vor 2.46.0) vom Text-Feed der Bruecke ueberschrieben. Die Artefakte sind meist geschrieben.',
      empfehlung:
        'Am Twin nachsehen (artefakt_lesen, abdeckung_lesen), ob Transformation und Galerie-Eintrag da ' +
        'sind. Wenn ja: nichts neu starten. Wenn der Abbruch von Hand kam (von_hand_abgebrochen), war er gewollt.',
      wiederholenSinnvoll: false,
    }
  }

  if (trifft(TEXT_FEED, text)) {
    return {
      art: 'text_feed_failed',
      deutung:
        'Der Text-Feed der Bruecke (Transkript an die Callback-Route) ist gescheitert oder abgelaufen — ' +
        'das sagt nichts ueber die Vorlage. Seit 2.46.0 setzt der Feed failed nur, wenn die Route den ' +
        'Job nie angefasst hat; sonst ist es ein Trace-Ereignis.',
      empfehlung:
        'Stand des Jobs pruefen (job_status, Schritte): Ist transform_template completed, ist nichts ' +
        'verloren. Sonst transformation_starten einmal neu; bleibt der Feed unzustellbar, ist die ' +
        'App-URL (NEXT_PUBLIC_APP_URL) oder der interne Token das Problem, nicht die Quelle.',
      wiederholenSinnvoll: true,
    }
  }

  if (TEMPLATE_FEHLER_CODE.test(text) && trifft(KEIN_LLM_AUFRUF, text)) {
    return {
      art: 'kein_llm_aufruf',
      deutung:
        'Der Transformer hat kein Sprachmodell aufgerufen (0 LLM-Aufrufe) — die Vorlage kam nie an ein ' +
        'Modell. Ursache ist die Secretary-Konfiguration oder das Modell (ungueltige Modell-Id, ' +
        'fehlender Anbieter-Schluessel, Use-Case nicht zugeordnet), nicht der Inhalt der Vorlage.',
      empfehlung:
        'NICHT die Vorlage aendern. llmModel der Library pruefen (konfiguration_lesen) und die ' +
        'Modell-Zuordnung im Secretary; dann denselben Job neu starten (batch_neustart oder transformation_starten).',
      wiederholenSinnvoll: false,
    }
  }

  if (trifft(YOUTUBE_ANMELDUNG, text)) {
    return {
      art: 'youtube_anmeldung',
      deutung:
        'YouTube verlangt eine Anmeldung (Sign in to confirm you are not a bot) — die Adresse des Secretary-Servers ' +
        'gilt dort als Rechenzentrum. Die Playlist-Liste kommt oft noch durch, jeder Einzelabruf nicht. Weder Quelle noch Vorlage sind das Problem.',
      empfehlung:
        'Am Secretary-Server eine Cookie-Datei (Netscape-Format, eigenes YouTube-Konto) hinterlegen, YTDLP_COOKIES_FILE darauf zeigen ' +
        'lassen, yt-dlp aktualisieren, Dienst neu starten; dauerhaft ein PO-Token-Plugin. Neustart ohne diese Aenderung ist zwecklos.',
      wiederholenSinnvoll: false,
    }
  }

  if (trifft(SECRETARY_ABBRUCH, text)) {
    return {
      art: 'secretary_abbruch',
      deutung:
        'Die Verbindung zum Secretary oder zu seinem Anbieter ist abgerissen (aborted, fetch failed, ' +
        'Zeitlimit) — meist ein Zeitlimit bei langen Stuecken, nicht die Vorlage und nicht die Quelle.',
      empfehlung:
        'Einmal neu starten (batch_neustart). Scheitert es wieder an derselben Stelle: Stueck ist zu ' +
        'lang fuer das Zeitlimit des Secretary oder das Modell ist nicht erreichbar — das ist ein Fall ' +
        'fuer den Secretary (Heartbeat, Zeitlimit), nicht fuer eine andere Vorlage.',
      wiederholenSinnvoll: true,
    }
  }

  return null
}
