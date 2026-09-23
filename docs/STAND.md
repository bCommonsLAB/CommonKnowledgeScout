# Stand des Repos

> Eine Quelle für die Frage „woran wird gerade gearbeitet, und was wartet?".
> Gepflegt von Hand bei jedem Vorhabenswechsel und bei jedem neuen Punkt.
> Stand: 2026-09-15. Die ausführliche Landkarte mit Legende und Motiven aller
> Wellen liegt in Peters Archiv (`24.09 KnowledgeScout/THEMEN.md`), der
> Verlauf je Vorhaben mit allen „Neu dazugekommen"-Einträgen in
> `24.09 KnowledgeScout/STAND-Vorhaben.md` (seit 15.09., Regel „Oeffentliches
> Repo" in `AGENTS.md`); diese Datei ist der Repo-Auszug: Arbeitsliste,
> Vorrat, Erledigt, ADRs.

## Vier Zustände, kein „offen"

| Zustand | Bedeutung |
|---|---|
| **aktiv** | wird jetzt bearbeitet; hat einen Termin oder einen wartenden Konsumenten |
| **geplant** | gewollt, aber ohne Termin; niemand arbeitet daran, bis der Owner es aufruft |
| **erledigt** | im Code und durch Nutzung abgenommen; Restpunkte stehen als Notiz dabei |
| **verworfen** | bewusst nicht weiterverfolgt, mit Grund |

Code, der seit Monaten in Produktion läuft, gilt als abgenommen, auch ohne
Abnahmedokument. Die `status:`-Marker in Plan-Dateien sind unzuverlässig;
maßgeblich ist diese Datei und der Code.

Die vier Wörter beschreiben **Arbeitspakete im Repo** (Pläne, Wellen, ADRs).
Sie sind Prosa in dieser Datei. Peters Archiv kennt am Vorhaben `status:
aktiv | ruhend | abgeschlossen` und an der Erschließung `bearbeitungsstand:`;
sollten die vier Wörter je ins Frontmatter, heißt das Feld nicht `status`,
sondern `arbeitsstand`, damit nichts kollidiert.

## Wie gearbeitet wird: ein Vorhaben nach dem anderen

Die Einheit der Arbeit ist das **Vorhaben**, ein Anwendungsprojekt mit
Termin, nicht das Thema und nicht der Plan. Jedes Vorhaben hat drei Sorten
Arbeit:

1. **Bekannte Punkte**: was heute schon als nötig erkannt ist.
2. **Mitgenommene alte Themen**: Punkte aus dem Vorrat „geplant", die
   denselben Code berühren. Regel: mitnehmen, was auf dem Weg liegt, nicht,
   was in der Nähe liegt.
3. **Neu dazugekommen**: was erst beim Bauen sichtbar wird. Agenten tragen
   solche Punkte hier ein, mit Datum, statt sie in Hand-offs zu verstreuen.

Ein Vorhaben ist fertig, wenn sein Termin bedient ist. Was von den
mitgenommenen Themen übrig bleibt, geht mit Notiz zurück in den Vorrat.

**Reihenfolge: 1 AECED → 2 Klimamaßnahmen/Vortrag 30.09. → 3 SHF.** Agenten arbeiten nur
am Vorhaben, das „jetzt" trägt, es sei denn, der Owner sagt es anders.

## Vorhaben 1 · AECED: Galerie als einbettbare Komponente (M5) — jetzt

- **Termin**: Arbeitstreffen mit dem Partner am 15.09.2026.
- **Ziel**: `<KnowledgeScoutExplorer baseUrl="…" library="…" view="gallery" />`
  läuft in einer fremden Next-Anwendung, liest anonym von der zentralen
  Instanz, zeigt nur öffentliche Inhalte (ADR 0008, Nachtrag 2026-08-29).
  Kein neues Deployment.
- **Arbeitsauftrag**: [`docs/refactor/modularisierung/AGENT-BRIEF-M5.md`](refactor/modularisierung/AGENT-BRIEF-M5.md);
  lokale Sitzung: [`HANDOFF-M5-aeced-lokal.md`](refactor/modularisierung/HANDOFF-M5-aeced-lokal.md).
- **Stand 15.09.**: M4f–M4i (Galerie im Paket) und M5 (Basis-URL,
  Adressierung, Buch-Renderer, CORS, Hülle `@ks/embed`, Nachweis in einer
  fremden Next-16-App) sind gebaut und deployt; der Inhaltsweg über
  Sammel-Markdowns mit Vorlage `book` plus Video, Audio und Anhängen steht
  (#282, #283); die `?doc=`-Links im Embed öffnen das Dokument in der Galerie
  (#286, `gallery/lib/doc-link.ts`), der Nachweis in commoning-methods ist
  dort PR #26 (gemergt; Paket aus `master` 1.2.255 nachgezogen in PR #27).
  Die Partner-Library ist seit 15.09. nachmittags öffentlich; im Nachweis
  live belegt: Galerie mit eigenen Texten und Covern, Buch-Ansicht mit
  Audio-Player und PDF-Anhängen, `?doc=`-Link wechselt das Dokument ohne
  Neuladen der fremden Seite. Offen im Code: der Loader könnte fehlende
  PDF-Transkripte selbst anstoßen (Job-Kette). Alles Weitere ist
  Inhaltsarbeit auf der Instanz (Facetten, restliche Dokumente), nicht Repo.
  **Vorhaben 1 ist damit bedient.** Nächster Schritt mit dem Partner, wenn
  er es aufruft: das Manifest der fremden App zur Laufzeit aus der
  öffentlichen Dokument-API ziehen (eigenes Vorhaben mit Brief; Konzept im
  Archiv, Headless-API P8 bleibt außen vor).
- **Verlauf und „Neu dazugekommen"** (Befunde, Entscheidungen, Lehren seit
  09.09.): Archiv `24.09 KnowledgeScout/STAND-Vorhaben.md`.

Nicht in diesem Vorhaben: M6 bis M8, Headless-API P8, Story und Chat im Embed
vor der Galerie.

## Vorhaben 2 · Klimamaßnahmen Südtirol: Vortrag 30.09. — danach

- **Termin**: 30.09.
- **Was es ist**: ein Auftritt mit der Library „Klimamaßnahmen"; Konzept und
  Anforderungen im Vorhabensordner des Archivs, hier nur die Arbeitsliste.
- **Ziel**: eine Vorführung, die eine Stunde lang nicht hängen bleibt, und
  eine Library, die zeigt, was der Vortrag verspricht.

Bekannte Punkte:

1. OneDrive-Anmeldung stabil neu aufsetzen; sie fällt nach ein bis zwei
   Wochen aus. Teilfortschritt 27.08. (Netzwerkfehler löschen die Anmeldung
   nicht mehr) ist drin.
2. Anpassungen an der Library „Klimamaßnahmen" (Umfang aus dem Konzept im
   Archiv; noch nicht festgelegt).
3. Webseite für den Vortrag bzw. die Klimamaßnahmen (Site-Modus mit
   Domain-Kopplung existiert seit Juli; was darüber hinaus nötig ist, steht
   im Konzept).

Mitgenommene alte Themen (Kandidaten): Split des OneDrive-Providers (2.294
Zeilen), nur wenn die Anmeldung dort umgebaut wird; Klimamaßnahmen-Reste aus
dem Vorrat (Mapper-Paritätstest, LLM-bereinigte Summe als dritte Zahl), wenn
die Library ohnehin angefasst wird; ADR 0005 nur entscheiden.

Neu dazugekommen: siehe Archiv `STAND-Vorhaben.md` (noch nichts).

## Vorhaben 3 · SHF: Konsensieren-Modul und Begleitfunktionen — ab 16.09. vorbereiten

- **Termin**: Feature Freeze 09.10.; Termine des Partners im Archiv.
- **Was es ist**: digitale Begleitung eines Beratungsgremiums mit
  Arbeitstischen (Steckbrief SHF). Anforderungen und Verfahrensdetails im
  Vorhabensordner des Archivs; im Repo liegen die abgenommenen Konzepte.
- **Konzepte im Repo** (Stand 12.09., Owner-Entscheidungen 1–8 darin):
  [`plans/erfassungs-architektur-stationen-datenhaltung.plan.md`](plans/erfassungs-architektur-stationen-datenhaltung.plan.md)
  (Regelsatz `capture.*`, Datenhaltung je Station, Verzeichnisstruktur,
  Wellen D0 und E0–E7, Abschnitt 6 Entscheidungen, Abschnitt 7 offen),
  [`plans/erfassungs-composer-s4-s5.plan.md`](plans/erfassungs-composer-s4-s5.plan.md)
  (Composer S4/S5, Scheiben C0–C10, Abnahme an den Figma-Screens),
  [`analysis/erfassungs-flow-wiederverwendung.md`](analysis/erfassungs-flow-wiederverwendung.md),
  [`analysis/erfassungs-flow-bauweisen-vergleich.md`](analysis/erfassungs-flow-bauweisen-vergleich.md),
  [`analysis/dialog-flow-bestand.md`](analysis/dialog-flow-bestand.md) mit
  [`Nachtrag`](analysis/dialog-flow-bestand-nachtrag.md).

Bekannte Punkte: Modul Systemisches Konsensieren (Widerstandswerte, Timer,
iterative Runden, Auswertung) · geschützter Arbeitsbereich mit Rollen ·
digitaler Check-out der Arbeitsgruppen · Gruppenbeiträge und Kommentierung ·
anonymisierte öffentliche Sicht mit Rate-Limiting.

Mitgenommene alte Themen, vom Owner am 09.09. entschieden: **Die Erfassung
wird hier in einem Zug bereinigt**, nicht vorab. Dazu gehören die beiden
Alt-Endpunkte `events/finalize` und `events/publish-final` (Phase 6 von
generic-finalize-wizard; Befund 11.09.: nur `publish-final` wird in
`creation-wizard.tsx` noch gerufen, `events/finalize` hat in `src/**` keinen
Aufrufer mehr), ADR 0003 Wizard/Schema, und die Reste aus Welle 3-VI.
Mehrsprachigkeit DE/IT: entscheidet das Vorabtreffen.

- **Stand 15.09.**: Analysen und Konzepte sind auf `master` (#279); der
  Gast-Zugang zum Testimonial-Recorder (Route + QR-Weiche) ist gebaut.
  Nächster Schritt im Repo: **Kostenprüfung der Haltungsänderung am Code**
  (Architektur-Konzept, Abschnitt 7, Punkt 1; Pflicht vor E0), danach Welle
  E0 (Regelsatz) und D0 (Dialogfall auf dem Testimonial-Bestand).
- **Stand 23.09.: Umsetzungsplan in drei Wellen** —
  [`plans/shf-umsetzung-wellen.plan.md`](plans/shf-umsetzung-wellen.plan.md)
  (Designstudie 19.–21.09., vier Rollen, Zuordnung zur Laufzeit; am Code
  geprüft gegen v1.2.262). Welle 1 (Zugang 05.10.: Weg der Teilnehmenden
  live, Moderation bis 09.10.), Welle 2 (Einwandverfahren A mit Messung als
  Objekt, Synthese, Tisch-Abschluss, Vertretung), Welle 3 (Redaktion,
  Vision, Folgegruppen, Nachschlagen). Löst die Reihenfolge E0–E7 und C0–C10
  der beiden Konzepte für das SHF ab.
- **Owner 23.09.: erst Grundlagen, dann Oberflächen** —
  [`plans/shf-grundlagen-datenhaltung-kernflows.plan.md`](plans/shf-grundlagen-datenhaltung-kernflows.plan.md):
  Wizard-Stand und -Editor (was das SHF davon braucht: nur die Flow-Naht),
  Datenmodell der Beteiligungs-Domäne (`meetings`, `meeting_tables`,
  `table_participations`, `measurements`, `assessments`, `syntheses`;
  Submission mit Anlagen und Kontext), Kernflüsse K1–K4 (Erfassen,
  Verdichten mit Belegspur über den Secretary, Messen, Veröffentlichen),
  Modul `@ks/module-deliberation`, Bau-Reihenfolge G0–G9 plus Nebenstrang W
  „Wizard fertigstellen“. **Speicherweg B** (Owner 23.09.): Beiträge liegen
  während des Ernte-Fensters in der Inbox und werden beim Schließen Dateien
  im Storage; die Synthese läuft über das bestehende Sammeltranskript. Der 05.10. ist kein Schnittkriterium mehr.
  Landkarte in Figma (intern): „KnowledgeScout — Modul-Landkarte“.
  **Owner 23.09.: erst Detailkonzepte, dann Code.** Grundlage:
  [`plans/beteiligung-objektmodell-original-und-kopie.plan.md`](plans/beteiligung-objektmodell-original-und-kopie.plan.md)
  (D0: fünf Klassen Planung · Verfahren · Beitrag · Ergebnis · abgeleitet,
  wo das Original liegt, stabile Kennungen, Verzeichnisstruktur mit
  Organisationsordnern, Liste D1–D11). E1–E6 entschieden (Planung „Datei
  zuerst“). **Detailkonzepte D1–D11 geschrieben** (23.09.):
  [`plans/beteiligung/README.md`](plans/beteiligung/README.md) mit
  Eingriffen in den Bestand, offenen Entscheidungen O1–O9 und
  Bau-Reihenfolge (35–43,5 PT Fundament, Oberflächen zusätzlich).
  **Nächster Schritt:** Abnahme der Detailkonzepte durch den Owner, vor
  allem O1 (Vertrauensraum) und O2 (Selbstbeitritt per Tisch-QR); dann
  Stufe 1 (D11-Kern, D1).
- **Verlauf und „Neu dazugekommen"** (Analyse-Befunde, Klickmodell,
  Owner-Entscheidungen im Wortlaut, Dialogfall): Archiv
  `24.09 KnowledgeScout/STAND-Vorhaben.md`.

## Zwischenschnitt · Twin-Fingerabdruck — aktiv, Online-Session (Owner 09.09.)

- **Was**: Der Sync-Engine-Check liest heute bei jedem `abdeckung_scannen` jede
  Markdown-Datei jeder Twin-Familie (~330 ms je Datei, zwei Anfragen). Ein
  Fingerabdruck aus dem Ordner-Listing plus Mongo-`updatedAt` soll das Lesen
  auf geänderte Quellen beschränken; ein zweiter Lauf über ein unverändertes
  Archiv macht null `getBinary`-Aufrufe.
- **Warum jetzt**: beschleunigt die tägliche Archivarbeit mit Cowork und
  entschärft das 60-Sekunden-Limit, ohne den Job-Modus vorzuziehen. Kein
  Bezug zu M5, deshalb als Zwischenschnitt neben Vorhaben 1.
- **Brief**: [`docs/refactor/twin-fingerabdruck/AGENT-BRIEF.md`](refactor/twin-fingerabdruck/AGENT-BRIEF.md)
  (Stufe 1 Pflicht, Stufe 2 eigene PR).
- **Stufe 1 gebaut** (2026-09-09): Tor in
  `src/lib/shadow-twin/sync-engine/check-stand.ts`, Ablage im Twin-Dokument als
  `checkStand` (`src/lib/repositories/shadow-twin-check-stand.ts`), Zähler
  `wiederverwendet`/`gelesen` im Report, Schalter `erzwingen` an
  `twins_pruefen` und `abdeckung_scannen`. Sieben Tests mit gezähltem
  `getBinary` in `tests/unit/shadow-twin/check-stand.test.ts`. Stufe 2 (eine
  Anfrage statt zwei im OneDrive-Provider) bleibt offen.
- Neu dazugekommen:
  - **2026-09-09 — `updatedAt` war nicht überall gesetzt.** Der Fingerabdruck
    verlässt sich auf `updatedAt` des Twin-Dokuments; fünf Schreibwege setzten
    es nicht und hätten einen veralteten Plan unsichtbar wiederverwendbar
    gemacht. Nachgezogen in derselben PR: `deleteArtifactsByLanguage` und
    `deleteShadowTwinArtifact` (`shadow-twin-repo.ts`) sowie drei Wege in
    `thumbnail-repair-service.ts` (variant-Patch, sourceHash-Patch und die
    beiden Blöcke, die Artefakt-Markdown patchen).
  - **2026-09-09 — Pfadlänge gehört in die Kennung.** Das Pfad-Budget der
    Namens-Migration (Welle 5c) hängt an der Ordnertiefe, die nur der Scan
    kennt. Sie steht deshalb mit im Fingerabdruck. Folge: ein per-Datei-Check
    aus der Archiv-UI (`sourceIds`-Scope, Tiefe unbekannt) und ein
    Teilbaum-Scan rechnen für dieselbe Quelle verschiedene Stände — beide
    korrekt, aber sie verdrängen einander. Bei Bedarf messen, ob das in der
    Praxis vorkommt.
  - **2026-09-09 — `SYNC_ENGINE_VERSION` will gepflegt werden.** Die Konstante
    steht in `check-stand.ts` (nicht wie im Brief in `run-library-sync.ts` —
    das gäbe einen Import-Zyklus). Wer an `sync-plan/**` oder an dem, was
    `collect-*` einsammelt, etwas ändert, zählt sie hoch; sonst verteilt ein
    Deployment alte Pläne weiter.
  - **2026-09-09 — der `^src/`-Filter in `AGENTS.md` war falsch, `ci-main` 515
    ist daran zerbrochen.** Dort stand, die restlichen `tsc`-Treffer lägen in
    `tests/**` und der Next-Build prüfe sie nicht. Er prüft sie: `tsconfig.json`
    zieht mit `**/*.ts` auch `tests/**` ein. Die zwei neuen Pflichtfelder am
    `LibrarySyncReport` brachen `report-merge.fixtures.ts` — grün bei `pnpm test`,
    `pnpm lint` und `tsc | grep '^src/'`, rot erst im Docker-Build auf `master`.
    Dass ältere `.test.ts`-Fehler den Build passieren lassen, trägt nicht: Next
    meldet den ersten Fehler, den es findet. `AGENTS.md` ist korrigiert und nennt
    jetzt den Vorher/Nachher-Vergleich, der Pflichtfeld-Erweiterungen absichert.
    Zusätzlich ist `CoverageTotals.engineCheck` optional — gespeicherte Reports
    aus Scans vor dem Tor tragen es nicht.

## Vorrat: geplant

Ohne Termin. Vorhaben bedienen sich hier, wenn ein Punkt auf ihrem Weg liegt.

- **Wunschliste 6 „Zustand und Verlauf trennen"** (Cowork, 2026-09-18, Owner-Auftrag
  per Handover; Plan: [`plans/zustand-und-verlauf-repo-bericht.plan.md`](plans/zustand-und-verlauf-repo-bericht.plan.md)).
  Code **erledigt** (Werkzeugsatz 2.30.0): Befunde `bericht_zu_lang`,
  `status_zu_lang`, `bericht_ueberholt`, `verlauf_fehlt`,
  `entwicklung_unberichtet`; Schwellen `agentView.berichtMaxBytes`
  (`{anwendung, plattform}`), `statusMaxZeilen`, `ueberholtNachTagen`;
  `berichtBytes` je Vorhaben; `datei_lesen` mit `bereich: gliederung`;
  Größenhinweis der Schreibwerkzeuge bei `BERICHT.md`;
  `bericht_unvollstaendig` folgt den Verweisen (Tiefe 1); `type: notiz |
  verlauf` im Twin-Contract; `repo_stand_commit` (Alt-Name `repo_stand`
  bleibt lesbar). **Offen:** Live-Messung der Scan-Dauer (der Scan liest jetzt
  die vom Bericht verlinkten Markdown-Dateien des Vorhabens mit, höchstens 40
  je Bericht, 4 parallel); Schwellen in den Library-Einstellungen setzen;
  Skill `repo-bericht` und Archiv-Nachzug (Pakete 2 und 3 des Plans)
- **Wunschliste 5 „Wissen und Zustand auseinanderhalten"** (Cowork, 2026-09-09,
  im Archiv unter `24.09 KnowledgeScout/2026-09-09 Wunschliste 5 - …md`; Belege am
  Code geprüft). Fünf Punkte, zwei Schnitte:
  - Schnitt 1 **erledigt** (Owner-Go 09.09., Werkzeugsatz 2.28.0): A1
    `themen_setzen` weist unbekannte Themen ab (`thema_unbekannt`, Vorschläge,
    Schalter `neuesThemaErlauben`); B1 Befund `sicht_veraltet`
    (`sicht-regel.ts`, nur Library-weiter Scan); C1 Befund `repo_veraltet`
    (`repo-frische.ts`, `repo-regel.ts`) mit Frontmatter `repo_stand_am` +
    optional `repo_stand` und Library-Schwelle `agentView.repoMaxRueckstandTage`.
    **Archiv-Nachzug durch Cowork:** die beiden Felder in
    `Organisation/Aufraeumen/Konventionen.md` aufnehmen und in den vier
    Berichten mit `repo:` setzen; Schwelle in den Library-Einstellungen
    eintragen, sonst bleibt `repo_veraltet` stumm. Nicht gebaut: die
    Repo-Spalte in der Aktuell-Sicht der Werkbank (C1-Wunsch, UI)
  - Schnitt 2 **erledigt** (Werkzeugsatz 2.29.0): B3a `themen_setzen` nimmt
    jeden Ordner unterhalb des Vorhabens und legt mit `indexAnlegen: true`
    eine fehlende `_INDEX.md` nach Vorlage an (bewusst OHNE
    `bearbeitungsstand` — der bleibt `stand_setzen`, und ein geratenes
    `ungesichtet` würde das Gap-Budget alle Befunde des Teilbaums
    zusammenfassen lassen); B3b Stapel über `folderIds` (bis 30 Ordner,
    dieselbe Liste, ein gescheiterter Ordner bricht nichts ab,
    `themen-stapel.ts`); B3c Befund `thema_fehlt` (`thema-regel.ts`, Cowork ·
    warning, ab `bearbeitungsstand: erschlossen`, nur unterhalb eines
    Vorhabens, nur bei gepflegtem `agentView.themen`).
    **Archiv-Nachzug durch Cowork:** Themen an den Ereignisordnern der
    aktiven Vorhaben vergeben — sonst bleibt der Befund nur eine Liste
  - Zurückgestellt: B2 Repo-Verweise prüfen — der Dienst hat keinen Zugriff auf
    `~/projects/`; erst mit lokaler Hülle (M7) sinnvoll. C2 ist keine
    Code-Änderung (Feld `arbeitsstand`, Konventionen-Datei im Archiv)
  - Neu dazugekommen 2026-09-09 (bei B3c gemessen): Ein Ereignisordner ohne
    `_INDEX.md` erklärt keinen Stand und bleibt für `thema_fehlt` stumm; ob
    `index_missing` dort greift, hängt an `indexRequiredMaxDepth`. Wenn die
    Themenvergabe flächig laufen soll, die Tiefe je Library prüfen
  - Neu dazugekommen 2026-09-09: Ein Teilbaum-Scan, dessen Wurzel selbst
    unterhalb des Vorhabens liegt, sieht kein Vorhaben und meldet
    `thema_fehlt` nicht (dieselbe Grenze wie `sicht_veraltet`). Der übliche
    Vorhabens-Scan sieht alles; bei Bedarf messen, ob das in der Praxis stört
  - Themendossiers als erzeugte Sicht (Teil D der Wunschliste) setzen B3 voraus
    und sind damit ab jetzt möglich — kommen in eine spätere Liste
  - Vermerk (09.09.): Beide Schnitte sind gebaut; offen bleibt nur der
    Archiv-Nachzug durch Cowork. Der gehört vor Vorhaben 3 SHF, sonst ist der
    Drift bis dahin wieder da
- Galerie-Rolle fuer angemeldete Fremde (Befund M5, 2026-09-10): `useLibraryRole`
  nimmt `accessRole ?? 'owner'`, und `ExplorerRoot` legt die angezeigte
  oeffentliche Library ohne `accessRole` in den Libraries-Atom. Ein angemeldeter
  Fremder sieht auf `/explore/{slug}` deshalb Verwaltungs-Bedienelemente; der
  Server lehnt die Aktionen ab. Fuer das anonyme Embed ohne Wirkung. Beleg:
  `refactor/modularisierung/03-audit-embed-fetches.md`
- Audio-Namensraum und Diarisierung: `docs/plans/geplant/audio-namensraum-und-diarisierung_c4f81a37.plan.md`
- Mehrsprachigkeit DE/IT/EN (Naturmuseum): ADR 0010 Retrieval-Profile plus
  der stille Sprach-Rückfall A1 aus `docs/refactor/shadow-twin-deterministic/`
- Erfassung (reserviert für Vorhaben 3): ADR 0003, Welle 3-VI, Alt-Endpunkte, Roadmap Plan 2a
- Tamera: generische PDF-Upload-Strecke abnehmen, ein Tag
- Shadow Twin: deterministic B1 (Bilder-Registrierung), B2 (Provider-Cache-Key,
  Provider wird ~43× pro Verzeichnis gebaut), sync-konsolidierung (ein Schreibpfad statt vier)
- `docs/refactor/cover-image-deterministic-flow/`, 11 Schritte, keiner gebaut
- Klimamaßnahmen: Mapper-Paritätstest (Welle-4-Backlog); LLM-bereinigte Summe
  als dritte Zahl in Fußzeile und Graph-Panel (Stufe 3d des Summen-Plans)
- DIVA-Texturen Stufen 4 bis 7 (Galerie-Verifikation, Korrektur-Lauf, Persistenz, Migration)
- Storage über MCP, Rest aus ST1–ST4: Coverage-Nachführung nach Ordner-Umzug;
  Job-Modus für Scans über dem 60-Sekunden-Limit (Q7) — der Twin-Fingerabdruck (Zwischenschnitt) nimmt den meisten Läufen den Grund; danach neu messen
- Modularisierung: M6 Oldies-SiteConfig, M7 `@ks/module-agent-view`, M8
  Föderation (ADR 0009) + Retrieval-Profile (ADR 0010), `apps/`-Ebene
- ADR 0005 Co-Creator mit eigener Storage-Auth
- Verschlüsselung der gespeicherten Storage-Zugangsdaten (Encryption-at-rest):
  liegt fertig als ein Commit auf `origin/claude/lucid-planck-b9i6gj`
  (63a64bb9, 2026-06-22, 12 Dateien), nie gemergt; im Code gibt es heute keine
  Verschlüsselung. Der einzige verbliebene Alt-Branch (Bereinigung 2026-09-09:
  176 Branches gelöscht, alle in master oder per PR gemergt)
- Settings-UX-Folgeplan: Start-Flow, automatisierte Oberflächentests
- Dateigrößen-Reste der Refactor-Wellen: `onedrive-provider.ts` 2.294,
  `job-report-tab.tsx` 2.262, `phase-template.ts` 2.037, `file-list.tsx` 1.761,
  `ingestion-service.ts` 1.474, `client.ts` 1.191; 78 leere Catch-Blöcke in `external-jobs/`
- Drift-Plan-Reste: Backend-Cleanup-Folgewelle (2026-04-28 bewusst übersprungen)
- Juni-Roadmap `docs/roadmap-formatunabhaengige-library-und-onboarding.md`:
  Plan 1 bis auf A4-Feinschliff erledigt, Plan 2 Onboarding-Flow

## Verworfen

- Welle 3-V Job- und Event-Monitor: nur die Vorbereitung 3-V-a lief; bei Bedarf neu aufsetzen
- `p-32874b76` Pinecone-Status-Cache: Pinecone kommt im Code nicht mehr vor
- Nachträgliche Abnahmedokumente für die Refactor-Wellen 1.2 bis 3-IV

## Erledigt (Kurzliste, Details in der Landkarte)

Refactor-Wellen 1.1 bis 3-IV und Welle 4 · Shadow Twin Mongo-only, Wellen
5a–5d · ADR 0004 Inbox-Modell · Pipeline v3, Composite, PDF-Split ·
Live-Diktat (PR #244, #246) · Klimamaßnahmen-Pläne, SDG generisch · DIVA
Stufen 0–3 · Agentensicht W0–W5, Werkbank W1–W8, A1–A7b, ADR 0006, MCP
2.27.0 · Storage über MCP ST1–ST4 (11 von 14) · Modularisierung M1–M4e,
Galerie-Vertrag, -Eine-Quelle, -Betrachter, Umzugs-Messung · Landingpage
und Site-Modus · Favoriten und Kommentare · Settings-UX.

## Die ADRs

| ADR | Entscheidung in einem Satz | Zustand |
|---|---|---|
| 0001 | Event-Jobs und External-Jobs sind getrennte Domänen | akzeptiert |
| 0002 | Galerie-Sterne kommen aus MongoDB, nicht aus Clerk | akzeptiert |
| 0003 | Wizard (Ablauf) und Schema-Template (Datenmodell) trennen | geplant, reserviert für Vorhaben 3 |
| 0004 | Erfassen schreibt in eine Inbox, Veröffentlichen ist ein eigener Schritt | akzeptiert 2026-09-09 (gebaut seit Juni) |
| 0005 | Co-Creator nutzen eigene Storage-Zugangsdaten | zurückgestellt |
| 0006 | Maschinenarbeit gilt als angenommen, der Mensch markiert nur Fehler | akzeptiert |
| 0007 | Monorepo mit Schale, Modul-Paketen und geteilten Bibliotheken | akzeptiert 2026-09-09 (M1–M4e gebaut) |
| 0008 | Ein Deployment, viele Sites; Embed liefert nur Öffentliches | akzeptiert 2026-09-09 |
| 0009 | Mehrere Libraries pro Site, Brücken dazwischen | geplant (nur Typfeld `federated?`) |
| 0010 | Retrieval-Profil je Library: Zugang, Strategie, Sprachen | geplant |

## Pflege

- Neuer Punkt beim Bauen ⇒ Zeile mit Datum unter „Neu dazugekommen" des
  laufenden Vorhabens in `24.09 KnowledgeScout/STAND-Vorhaben.md` im Archiv
  (MCP-Brücke, `datei_patchen`); hier nur, wenn sich die Arbeitsliste oder
  der nächste Schritt ändert. Ohne Archivzugang: in den Hand-off, der Owner
  trägt nach.
- Vorhaben fertig ⇒ Abschnitt nach „Erledigt" kürzen, Reste in den Vorrat, nächstes Vorhaben auf „jetzt".
- Plan-Dateien: aktiv unter `docs/plans/`, wartend unter `docs/plans/geplant/`, fertig unter `docs/plans/archiv/`.
