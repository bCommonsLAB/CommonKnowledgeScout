---
title: Prüfbericht zu den Detailkonzepten D0–D11
date: 2026-09-24
status: abgeschlossen, Korrekturen teils eingearbeitet, Rest wartet auf Entscheidungen
---

# Prüfbericht zu den Detailkonzepten D0–D11 (24.09.2026)

Die Detailkonzepte D0–D11 sind am 23.09. in einem Zug entstanden. Vor dem
Bau wurden sie auf drei Wegen geprüft, jeweils unabhängig vom Verfasser:

1. **Code-Belege:** Ein frischer Agent hat rund 150 `pfad:zeile`-Angaben
   und alle „gibt es nicht“-Behauptungen direkt am Code (HEAD `35b4fe9`)
   nachgeschlagen.
2. **Nahtstellen:** Ein zweiter frischer Agent hat D0–D11 nur als Entwurf
   gelesen und auf Widersprüche, Lücken, Überkomplexität und stille
   Fallbacks geprüft.
3. **Anforderungen:** Der Nachmittag wurde anhand der drei Primärquellen
   im Archiv (Drehbuch der Sacharbeitssitzung, Konzept der Stakeholder-App,
   „Anforderungen nach dem Protokoll“ Fassung 4) gegen D1, D3, D4, D7, D8
   und D11 durchgespielt.

Ergebnis in einem Satz: **Die Konzepte sind im Datenmodell und in den
Code-Verweisen überwiegend richtig, hängen aber an der Bildschirm-
Beschreibung statt an den Anforderungen, haben an den Nähten echte
Widersprüche und bauen an einer Stelle auf einer falschen Annahme über
den Bestand auf.** Gebaut werden darf erst nach den Entscheidungen in
Abschnitt 6.

## 1. Befund am Bestand: `getLibrary` ist keine Owner-Prüfung

`LibraryService.getLibrary(email, id)`
(`src/lib/services/library-service.ts:193-213`) liefert die Library nicht
nur dem Owner, sondern über `hasSharedAccess` (`:224-248`) **jedem aktiven
Mitglied jeder Rolle** und jedem genehmigten Lesezugang. Mehrere Helfer
nutzen `getLibrary(...) !== null` als Owner-Prüfung und lassen damit jedes
Mitglied durch:

| Helfer | Stelle | Wirkung heute |
|---|---|---|
| `isModeratorOrOwner` | `library-members-repo.ts:388-393` | Contributor gilt als Moderator |
| `isCoCreatorOrOwner` | `library-members-repo.ts:497-500` | Moderator, Contributor und Lesezugang gelten als Co-Creator |
| `resolveCaptureRole` | `capture-access.ts:28` | jedes aktive Mitglied bekommt Erfasser-Rolle `owner` |
| `getServerProvider` (Fallback) | `server-provider.ts:76` | Moderator und Contributor bekommen einen Storage-Provider |
| `canSeeDrafts` | `publication-filter.ts:59-64` | Contributor sieht Entwürfe |
| Chat-Loader | `loader.ts:298` | Contributor darf chatten |

Die einzige strikte Owner-Prüfung ist `LibraryService.isOwner` (`:260`),
die die Mitglieder-Routen nutzen. Die Unit-Tests mocken die Helfer, kein
Test deckt die Wirkung ab.

**Folgen:** Die Rechte-Tabelle in D11 §1 beschreibt die *beabsichtigten*
Rollen, nicht die *wirksamen*. Vier Konzepte planten Änderungen für Dinge,
die heute schon gehen, teils unbeabsichtigt (Moderation ohne Storage,
Contributor ohne Chat, Moderation kann nicht erfassen, Bildweg schlägt für
Contributor mit `library_not_found` fehl). Ob das ein Fehler oder ein
Sicherheitsproblem ist, entscheidet der Owner; die Konzepte dürfen darauf
weder bauen noch es stillschweigend zementieren. **Vorschlag:** Eine
strikte Prüfung je Rolle (`getActiveMemberRole`) in den sechs Helfern,
mit Test, als eigener kleiner PR vor Stufe 1. Sicherheitsrelevant, darum
nur mit Auftrag.

Zweiter Bestandsbefund: Nirgends im Code werden MongoDB-Transaktionen
benutzt (`startSession`, `withTransaction`). Die „eine Transaktion“ in D1
§5 wäre die erste und setzt ein Replica Set voraus. D1 wählt deshalb den
zweiten Weg (neue `release.version`, Umschalten am Ende).

## 2. Befund an den Anforderungen: was die Konzepte nicht abbilden

Die Primärquellen enthalten Vorgaben, die in D1–D11 fehlen oder ihnen
widersprechen. Sortiert nach Gewicht.

| # | Anforderung (Quelle) | Stand in den Konzepten | Folge |
|---|---|---|---|
| A1 | **Der Vorschlag wird von der Moderation eingesprochen** (Transkript, korrigierbar); die KI bündelt nur die Bedenken (Anforderungen, Stories 1, 6, 12) | D6: KI erzeugt, Moderation übernimmt | D6 braucht den eingesprochenen Vorschlag als Hauptweg (Live-Diktat, `live-transkription.md`), die KI-Synthese als zweiten Weg |
| A2 | **13 Konfigurationsschalter je Treffen** (Statements vor/nach Diskussion, Sichtbarkeit „nach eigener Abgabe“, Zuschreibung im Konsens- und Dissensteil getrennt, Countdown an/aus mit Voreinstellung *aus*, Nachbearbeiten bis Fensterschluss, Runden je Punkt …) und die Regel **„Die Konfiguration gehört ins Ergebnis“** | D1: zwei Schalter; D8 schreibt keine Einstellungen ins Ergebnis | D1 §3.3 bekommt einen Block `einstellungen` mit allen Schaltern; D8 kopiert die geltenden Werte in das Ergebnis-Frontmatter |
| A3 | **Sichtbarkeit:** „Rückmeldungen der anderen sichtbar, wenn so eingestellt“; „Moderation sieht alles laufend mit Zuschreibung“ (Anforderungen); Drehbuch 20–28 min: Teilnehmende lesen alle Beiträge nach Interessengruppe | Designstudie 19.09.: Moderation sieht *wer*, nicht *was*; D11 V1: Teilnehmende sehen fremde Beiträge nicht | **Echte Entscheidung** (E-Entscheid, siehe §6). Beide Fassungen sind abgenommen. Vorschlag: Stille Runde bleibt Voreinstellung, Schalter je Treffen |
| A4 | **Verwaltungsbegleitung** als eigene Rolle: Lesezugriff auf interne Planungsdokumente, die Teilnehmende nicht sehen; erfasst Zettel nach (Story 16, Drehbuch-Rollen) | D2/D11: keine Rolle; D9: alle Unterlagen für alle sichtbar | D2 bekommt die Rolle `begleitung`; D1 eine Sichtbarkeitsstufe je Planungsdokument (`sichtbar_fuer: [teilnehmende, begleitung, moderation]`); D9 filtert danach |
| A5 | **Dissens ist ein Ergebnis:** ungelöster Einwand wandert mit Ursprungsformulierung und Begründung ins Dissenspapier (Story 8) | D8: nur eine Konsens-Stufe | D8 bekommt `ergebnis_art: konsens | dissens`, Dissens-Ergebnisse tragen die Einwände als Belege |
| A6 | **Zuschreibung „für mich“ oder „für meine Organisation“** je Beitrag | D3 `attribution` kennt nur Person/Vertretung | D3 bekommt `attribution.scope: person \| organisation`; D5 schreibt es ins Frontmatter |
| A7 | Kennenlernbereich mit **Zuversichtsfrage**, **Verfahrensfeedback** getrennt vom Inhalt, **Kompromissfragen** (Konzept Stakeholder-App; Drehbuch 83–90) | fehlen | D7 kennt Messungen ohne Textstelle (`kind: zuversicht`, `verfahren`); Verfahrensfeedback wird nie ins Ergebnis kopiert |
| A8 | **Testmodus für die Generalprobe** (Story 17) | fehlt | D1: `_treffen.md` mit `modus: probe`; Probe-Treffen schreiben in einen Probe-Ordner und werden nie ingestiert |
| A9 | Gesamtpapier aus sechs Handlungsfeldpapieren (Story 19); Offline-Betrieb, Eskalation, Querschnittsthemen (P2) | fehlen | D10 erwähnt es als späteren Schritt; P2 bleibt außerhalb |

Was die Konzepte richtig treffen: Phasen-Gating durch die Moderation,
keine Zwischenstände während des Fensters, Zettel und Bilder fotografieren
mit Erklärung, Vertretung, Nachbearbeiten bis Fensterschluss, Rohschicht
nur für Moderation und Redaktion (im Rahmen der Entscheidung A3).

## 3. Befund an den Nahtstellen (Agent 2)

Dreizehn Widersprüche zwischen den Konzepten, die wichtigsten:

| # | Widerspruch | Betroffen | Auflösung |
|---|---|---|---|
| W1 | Drei `participantId`-Formate (E-Mail, `proxy:<uuid>`, `tisch:<tableId>`), nur zwei definiert; „Tisch“ bricht Gruppenzählung, Pfad und Teilnahme-Pflicht | D2, D3, D5, D6, D7, D10 | eigenes Feld `attribution.kind: person \| proxy \| table`, Sonderpfad und Gruppenausschluss explizit |
| W2 | Vertretungs-Beiträge sollen unter „Meine Beiträge“ erscheinen, die Proxy-Id ist aber ohne E-Mail nicht rückführbar | D2 §6, D3 §4.3 | Proxy-Teilnahme mit optionaler E-Mail und späterem `mergedInto`, oder Anspruch streichen |
| W3 | `withdrawn`/`removed` einmal als Markierung an `pending`, einmal an `published`; Widerruf vor und nach Fensterschluss hinterlässt verschiedene Spuren | D3 §3, D5 §5 | **eine** Regel, hängt an E-Entscheid „Promotion-Zeitpunkt“ |
| W4 | Synthese kann über eine unvollständige Sammlung laufen (`promotion.state = teilweise`); `next_item {closeWindow}` startet Promotion als Nebenwirkung | D4, D5, D6 | Synthese-Route prüft `promotion.state = fertig`; `next_item` schließt nie implizit |
| W5 | Messfenster wird zweimal geschlossen (D4 `close_window` und D7 `close_measurement`); `open_window` kennt keine `measurementId` | D4, D7 | nur D4 schließt; `open_window` trägt `measurementId` |
| W6 | Drei Verweisschemata: `*_id`, `fileId` (D5, D6, D8) und Wiki-Link über Dateinamen (`gueltige_fassung`) | D0, D1, D5, D6, D8, D10 | `gueltige_fassung` = `ergebnis_id`; jede `fileId`-Nutzung mit Re-Resolve über die Kennung |
| W7 | D0 kennt kein `_tisch.md` und nennt die Sammelreferenz anders als D6 | D0, D1, D6 | D0 nachziehen |
| W8 | Facetten- und Feldnamen driften (`organisation`/`organisationen`, `gruppe`/`gruppen`, `titel`/`thema`); Facetten sind vor dem ersten Ingest festzulegen, also **irreversibel** | D0, D5, D8, D11 | **Feldkatalog** als Anhang zu D0, ein Name je Bedeutung |
| W9 | Textstellen einmal „nie ingestiert“ (Klasse P), einmal „normale Pipeline“; der Transformationsweg erzeugt einen Twin an der Planungsdatei | D1, D9 | Textstellen wie Ergebnisse direkt ingestieren (`upsertMarkdown`), Pflichtfelder in D1 §3.2 |
| W10 | Aufgelöste Leitfrage und Verfahren werden berechnet, aber nicht im Snapshot gespeichert | D1, D3, D4 | Snapshot speichert je Agendapunkt die aufgelöste Leitfrage und das Verfahren |
| W11 | Moderation, die die Einladungs-Mail nicht angenommen hat, kommt über den QR als `contributor` an und wird von D11 abgewiesen | D2, D11 | `join` erkennt `roles[]` im Snapshot und hebt auf `moderator` (protokolliert) |
| W12 | Fensterschluss schreibt „im Namen des Owners“: Rechteausweitung ohne Owner-Entscheid; README markiert es nicht als sicherheitsrelevant | D5 §3.3, D11 §4 | als Owner-Entscheidung führen (§6), Storage-Audit zeigt Owner, Protokoll die Moderation |
| W13 | „Tisch-Abschluss“ ist kein Zustand: je Tisch oder je Textstelle? `widerruf_bis: tisch_abschluss` ist nicht auswertbar | D1, D3, D4, D5, D8 | Zustand `table.closedAt` je Tisch **und** `syntheses.confirmedByTable` je Textstelle; D4 bekommt `close_table` |

Lücken ohne Konzept: zwei Fenster zur selben Textstelle (Vereinigung oder
letztes?), Tischwechsel ohne Route, Ersatz-Moderation zur Laufzeit,
WLAN-Abriss bei `close_window` (409 muss als Erfolg gelten), Anlage noch
`wird_ausgewertet` beim Schließen (Text fehlt dann dauerhaft in der Datei),
widerrufener Beitrag schon in einer Fassung zitiert, dieselbe Textstelle
an zwei Tischen, Online-Modus ohne physischen QR, DE/IT fest auf `de`,
`end_meeting` bei offener Promotion, `mirror_source` fehlt in D4.

Überkomplex: die Promotion im Hot-Path der Ernte (D5: Job, Wiederholer,
`teilweise`, vorläufige Organisationsordner, Status-Patches, `sourcesHash`),
nur damit D6 den Text, der schon in `wizard_submissions` liegt, über
Wiki-Links wieder einliest. Die Passivlösung als verborgene Option (D7),
`widerruf_bis` mit einem Wert, die Flow-Entität für den Composer (D3 §6),
`DocReference.sourceLabel` als Contract-Eingriff für eine Zeile, `binaryRefs`
gespiegelt aus `attachments`.

Stille Fallbacks: D8 §7 „Facette fehlt → Warnung“ (Dauerschaden, muss
Fehler sein); D9 §7 ignorierter Filter (muss 400 sein); D5 §2 „Datei
gleichen Namens wird übersprungen“ und Submission trotzdem `published`;
D2 §6 Vorbelegung eines Pflichtfelds aus der letzten Teilnahme; D2 §6
Tri-State ohne definierten Fall `null`; D10 §5 „überwiegend“ ohne Schwelle.

## 4. Befund an den Code-Belegen (Agent 1)

Von rund 150 Angaben stimmen etwa 130 (Abweichungen bis drei Zeilen
mitgezählt). Sachlich falsch oder irreführend waren:

| Konzept | Angabe | Richtig |
|---|---|---|
| README, D3 | Bildweg: `getLibrary` „gelingt nur für Owner, Teilnehmerin bekäme `library_not_found`“ | falsch, siehe §1; `library_not_found` nur für Nicht-Mitglieder. Das Inbox-`null`-Problem am Shadow-Twin ist echt. Der PDF-Weg der Start-Route nutzt `resolveJobLibrary` ebenfalls **nicht** (`:552`, `:755`); nur die Callback-Route |
| README, D11 | Moderator kann nicht erfassen, hat keinen Storage | falsch in der Wirkung (§1); richtig nur für die Zuordnung in `resolveCreatorRole` |
| D9, D11 | Contributor kann nicht chatten, sieht keine Entwürfe | falsch in der Wirkung (§1) |
| D9 | Kontext-Cache 10 s (`loader.ts:54`) | 5 min (`CACHE_TTL_MS`, `loader.ts:49`) |
| D9 | `requiresAuth` lässt Moderator/Lesezugang zu (`:320-330`) | Zweig läuft nur für eigene Libraries, für Nicht-Owner nie |
| D5 | `revertToReady` in `promotion-errors.ts:43` | `promote-actions.ts:43`, nicht exportiert |
| D5 | Dateiname heute aus `metadata.title` | `resolvePublishFileName`: `target.slug` → Titel → Id, scheitert nicht |
| D5 | Promotion ingestiert immer | Ausnahme `docType === 'transcript'` (`promoteTranscriptOnly`, ohne Ingest); ein Schalter fehlt trotzdem |
| D1 | `runLibrarySync` nur für Owner, weil `getLibrary` | Begründung falsch; das Werkzeug bleibt trotzdem das falsche (Sync statt Lesen) |
| D1 | `tools-ordner.ts:22-29` | `src/lib/mcp/tools-ordner.ts` (nicht `mcp/storage/`) |
| D4 | `formatDuration` wiederverwenden | nicht exportiert, erst herauslösen |
| D6 | Ingest fest an `enqueue-markdown-job.ts:78-79` | `:81-82` |
| D7 | `$setOnInsert` `:157`, normalisierte E-Mail `:174-181` | `:178` bzw. `:151` |
| D8 | Pflichtfelder `title, date, authors, language, source` | dazu **`tags`** (`base-fields.ts:31-38`) |
| D8 | Facetten nur bei Index-Anlage | stimmt; Ergänzung: `DELETE api/chat/[libraryId]/index` löscht den Index, Neuaufbau durch Re-Ingest |

Die reinen Zeilen- und Sachkorrekturen sind in D1, D3, D4, D5, D6, D7,
D8, D9, D11 und README eingearbeitet (Commit vom 24.09.). Die Wirkungs-
Aussagen zu Rechten sind mit Verweis auf §1 korrigiert, nicht umgedeutet.

## 5. Selbstkritik: warum das passiert ist

- **Reihenfolge:** Die Konzepte gingen von den Bildschirmen der
  Designstudie und der Handover-Notiz aus, nicht von den Anforderungen.
  Die drei Primärquellen wurden erst nach dem Schreiben gelesen.
- **Ein Chat, ein Zug:** Elf Konzepte in einer Sitzung, jedes im Wissen
  um die vorigen, aber ohne Rückschau auf sie. So entstehen W1, W3, W7,
  W8, W13: jedes Konzept traf für sich eine Festlegung, die das nächste
  nicht mehr las.
- **Code-Wissen aus zweiter Hand:** Die Rechte-Aussagen stammten aus
  Funktionsnamen (`isModeratorOrOwner`), nicht aus deren Rumpf.
- **Tiefe nimmt ab:** D1–D5 haben Frontmatter-Beispiele, Routen und Tests,
  D9–D11 nur Tabellen. Die Aufwandsschätzung (35–44 PT) hat dadurch für die
  hinteren Konzepte keine Grundlage.

## 6. Was jetzt zu tun ist

### 6.1 Entscheidungen des Owners (vor dem Bau)

Die bisherigen O1–O9 in README bleiben. Neu, aus dieser Prüfung:

| # | Frage | Vorschlag |
|---|---|---|
| O10 | **`getLibrary` als Owner-Prüfung** (§1): Fehler beheben oder als gewollt bestätigen? | beheben, eigener PR mit Test, vor Stufe 1 |
| O11 | **Sichtbarkeit am Tisch** (A3): Stille Runde fest, oder Schalter je Treffen mit Voreinstellung „still“? | Schalter, Voreinstellung still; „Konfiguration gehört ins Ergebnis“ |
| O12 | **Promotion-Zeitpunkt**: Fensterschluss (D5 heute) oder Tisch-Abschluss (eine Promotion, Synthese liest aus Mongo)? | **Tisch-Abschluss**. Löst W3, W4, Anlagen-Lücke, Wiederholer. Weg B bleibt: Dateien im Organisationsordner, Synthese über Sammeltranskript. Nur der Zeitpunkt wandert |
| O13 | **Vorschlag einsprechen** (A1) als Hauptweg, KI-Synthese als Zweitweg? | ja; Live-Diktat ist Bestand |
| O14 | **Rolle Verwaltungsbegleitung** (A4) und Sichtbarkeit je Planungsdokument? | ja, `begleitung` als Beteiligungsrolle, `sichtbar_fuer` je Datei |
| O15 | **Fensterschluss mit Owner-Credentials** (W12)? | nein: Storage-Provider der Moderation über ihre eigene Rolle, sobald O10 behoben ist; bis dahin kein Bau von D5 |
| O16 | **Identitätsmodell** (W1, W2, W11): `attribution.kind`, Proxy mit optionaler E-Mail, Moderations-Anhebung beim Beitritt | wie in §3 vorgeschlagen |

### 6.2 Überarbeitung der Konzepte (nach 6.1)

1. **D0 Anhang „Feldkatalog“** (W8): ein Name je Bedeutung, Singular/Plural,
   Listen-Syntax, welche Datei über welchen Weg ingestiert wird (W9).
   Irreversibel wegen Facetten, darum zuerst.
2. **D1**: Block `einstellungen` mit den 13 Schaltern (A2), `modus: probe`
   (A8), `sichtbar_fuer` (A4), aufgelöste Leitfrage und Verfahren im
   Snapshot (W10), Tisch-Abschluss als Zustand (W13).
3. **D3 + D5 + D6** gemeinsam neu schneiden nach O12: `attribution.kind`
   und `scope` (W1, A6), eine Widerrufsregel (W3), Promotion am
   Tisch-Abschluss, Synthese-Vorbedingung (W4), eingesprochener Vorschlag
   als Hauptweg (A1).
4. **D4**: `close_table`, `measurementId` in `open_window` (W5),
   `mirror_source`, Verhalten bei 409, `end_meeting`-Vorbedingung.
5. **D7**: Messungen ohne Textstelle (Zuversicht, Verfahrensfeedback, A7).
6. **D8**: `ergebnis_art` konsens/dissens (A5), Einstellungen ins Ergebnis
   (A2), Facette-fehlt = Fehler.
7. **D9**: Sichtbarkeitsstufe (A4), ignorierter Filter = 400.
8. **D11**: Tabelle §1 auf die wirksamen Rechte, Rolle `begleitung`.
9. **README**: Aufwand neu schätzen, erst nach den zwei Spikes.

### 6.3 Zwei Spikes vor der Schätzung

- **Spike 1, ein halber Tag:** Promotion am Tisch-Abschluss als Job
  (`window-close` wird zu `table-close`): Kosten eines neuen Job-Typs in
  `external-jobs`, Provider-Aufrufe je Beitrag, Verhalten bei Abbruch.
- **Spike 2, ein halber Tag:** Bildweg der Start-Route mit Inbox-Library
  (Shadow-Twin `null`) für eine Contributor-Submission, nach Behebung von
  O10.

### 6.4 Was nicht mehr geplant wird

- Der Wellen-Plan (`shf-umsetzung-wellen.plan.md`) bleibt Bildschirm-
  Referenz; seine Reihenfolge gilt weiterhin nicht.
- Offline-Betrieb, Eskalation, Querschnittsthemen (P2) bleiben außerhalb
  von D1–D11, bis der Owner sie holt.

## 7. Einwände des Owners aus dem Lesedurchgang (24.09.)

Der Owner hat die Lesefassung „Konzepte in einfachen Worten“ durchgesehen
und sieben Punkte festgehalten.

| Kapitel | Einwand | Folge |
|---|---|---|
| 2 (D1) | Ein eigener Prüfschritt wird nicht gebraucht; Freigeben bleibt | **Entschieden.** D1 §4: Prüfen, Route `check`, `treffen_pruefen` und `berichtHash` entfallen; Freigeben liest und scheitert laut. Aufwand D1 sinkt |
| 8 (D7) | Was passiert, wenn nach Runde 2 ein schwerwiegender Einwand bleibt oder neu kommt? Darf nicht ungeregelt bleiben | **O17.** Vorschlag in D7 §9.3: Moderation wählt Runde 3, vertagen oder Dissens festhalten (hängt an A5) |
| 10 (D9) | Starre Eingrenzung auf das Handlungsfeld kann relevante Quellen ausschließen | **O18.** Vorschlag in D9 §9: Voreinstellung mit sichtbarem Umschalter, Herkunft der Quelle in der Antwort |
| 11 (D10) | Für „passt nicht“ fehlt der weitere Ablauf | **O19.** Vorschlag in D10 §9: Begründung Pflicht, Einwand-Beitrag, dann normaler Lauf mit neuer Fassung |
| 12 (D11) | Rechte der Redaktion an namentlichen Beiträgen hängen am Vertrauensraum; muss vor der Umsetzung feststehen, betrifft auch die Zusage an die Teilnehmenden | **O1** bleibt offen, Reihenfolge festgehalten: erst O1, dann D11 bauen |
| 15 | Vertrauensraum V1–V3 nicht vorwegnehmen, aber vor dem ersten realen Einsatz entscheiden | wie O1 |
| 9 (D8), Vorschlag | Grenze zwischen redaktioneller Bearbeitung und inhaltlicher Änderung der vom Tisch bestätigten Fassung | **O20**, vom Owner am 24.09. als Einwand bestätigt; Entscheidung offen. Vorschlag in D8 §9.3: redaktionell sind Rechtschreibung, Form, Verweise und Frontmatter; jede Änderung am Sinn ist eine neue Fassung, die der Tisch (oder beim nächsten Treffen die Folgegruppe) bestätigt; D8 hält `redigiert_von` und einen Diff-Hinweis fest |

Nicht aufgenommen wurden Punkte, die im Gespräch nicht ausdrücklich als
festzuhalten markiert waren.

## Quellen

- Konzepte: `docs/plans/beteiligung-objektmodell-original-und-kopie.plan.md`
  (D0), `docs/plans/beteiligung/d01…d11`, README
- Bestand: HEAD `35b4fe9`, Dateien wie in §1 und §4 genannt
- Anforderungen: Archiv der KnowledgeScout-Library, Ordner der
  Nachhaltigkeits-Reihe (Drehbuch der zweiten Sacharbeitssitzung, Konzept
  der Stakeholder-App, Anforderungen nach dem Protokoll Fassung 4)
