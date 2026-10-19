# Stand des Repos

> Eine Quelle für die Frage „was ist gemacht, und was ist geplant?".
> Gepflegt von Hand bei jedem neuen Punkt.
> Stand: 2026-10-18 (Durchsicht gegen Code, Pläne und Branches zuletzt 13.10.).
> Die ausführliche Landkarte mit Legende und Motiven aller Wellen liegt in
> Peters Archiv (`24.09 KnowledgeScout/THEMEN.md`), der Verlauf je Vorhaben
> mit allen „Neu dazugekommen"-Einträgen in
> `24.09 KnowledgeScout/STAND-Vorhaben.md` (seit 15.09., Regel „Oeffentliches
> Repo" in `AGENTS.md`); diese Datei ist der Repo-Auszug: je Vorhaben
> Gemacht und Geplant, Vorrat, Erledigt, ADRs.
>
> **Termine und Reihenfolge stehen nicht hier.** Welches Vorhaben gerade
> trägt und in welcher Reihenfolge gebaut wird, entscheidet der Owner
> außerhalb des Repos (Archiv) und nennt es im Auftrag. Diese Datei sagt
> nur, was im Code ist und was gewollt, aber nicht gebaut ist.

## Drei Zustände, kein „offen"

| Zustand | Bedeutung |
|---|---|
| **erledigt** | im Code und durch Nutzung abgenommen; Restpunkte stehen als Notiz dabei |
| **geplant** | gewollt, aber nicht gebaut; niemand arbeitet daran, bis der Owner es aufruft |
| **verworfen** | bewusst nicht weiterverfolgt, mit Grund |

Code, der seit Monaten in Produktion läuft, gilt als abgenommen, auch ohne
Abnahmedokument. Die `status:`-Marker in Plan-Dateien sind unzuverlässig;
maßgeblich ist diese Datei und der Code.

Die Wörter beschreiben **Arbeitspakete im Repo** (Pläne, Wellen, ADRs). Sie
sind Prosa in dieser Datei. Peters Archiv kennt am Vorhaben `status: aktiv |
ruhend | abgeschlossen` und an der Erschließung `bearbeitungsstand:`; sollten
die Wörter je ins Frontmatter, heißt das Feld nicht `status`, sondern
`arbeitsstand`, damit nichts kollidiert.

## Wie gearbeitet wird

Die Einheit der Arbeit ist das **Vorhaben**, ein Anwendungsprojekt, nicht das
Thema und nicht der Plan. Jedes Vorhaben hat drei Sorten Arbeit:

1. **Bekannte Punkte**: was heute schon als nötig erkannt ist.
2. **Mitgenommene alte Themen**: Punkte aus dem Vorrat „geplant", die
   denselben Code berühren. Regel: mitnehmen, was auf dem Weg liegt, nicht,
   was in der Nähe liegt.
3. **Neu dazugekommen**: was erst beim Bauen sichtbar wird. Agenten tragen
   solche Punkte ein, mit Datum, statt sie in Hand-offs zu verstreuen.

Agenten arbeiten am Vorhaben, das der Owner im Auftrag nennt. Was von den
mitgenommenen Themen übrig bleibt, geht mit Notiz zurück in den Vorrat.

Vorhaben 1 AECED (Galerie als einbettbare Komponente) ist erledigt und steht
unten unter „Erledigt", seine Reste im Vorrat. Daneben ist seit 15.09. viel
Arbeit ohne eigenes Vorhaben entstanden (Story-Dreiteilung,
Status-Modalität, Veranstaltung über die Brücke, Wunschliste 8); sie steht im
Vorrat mit ihrem offenen Rest.

## Vorhaben 2 · Klimamaßnahmen Südtirol

- **Was es ist**: ein Auftritt mit der Library „Klimamaßnahmen"; Konzept und
  Anforderungen im Vorhabensordner des Archivs, hier nur die Arbeitsliste.
- **Ziel**: eine Vorführung, die nicht hängen bleibt, und eine Library, die
  zeigt, was der Vortrag verspricht.

**Gemacht:**

1. OneDrive-Anmeldung: durch Teil A des Zwischenschnitts
   „Speicher-Verbindungen und Library-Anlage" erledigt: ein Login je
   Speicher-Verbindung am Konto statt je Library, Tokens verschlüsselt an der
   Verbindung, Migration in Dev und Prod gelaufen. Vorher fiel die Anmeldung
   nach ein bis zwei Wochen aus; Teilfortschritt 27.08. (Netzwerkfehler
   löschen die Anmeldung nicht mehr).
2. Status-Modalität: Code gebaut (#355) nach
   [`plans/story-status-modalitaet.plan.md`](plans/story-status-modalitaet.plan.md)
   — der Story-Modus ignorierte den Status der Maßnahme (`lv_bewertung`) und
   formulierte Abgelehntes wie Beschlossenes; Status wird zur Modalität der
   Antwort — Bedeutungs-Wörterbuch je Facettenwert und Antwortregeln-Text in
   der Library-Konfiguration, kein Code pro Typ (Owner 06.10.); geprüft über
   ein Golden-Set je Library (m0 messen, dann Regeln + Nachprüfung, dann
   Ingest-Kontext).
3. Website-Sektionen S1 bis S3 nach
   [`plans/website-startseite-sektionen.plan.md`](plans/website-startseite-sektionen.plan.md)
   (Owner 27.09.: das bestehende Banner um Fokus-Filter, Titel und Position
   erweitern statt ein neues Raster bauen; Ampel-Skala und dynamische
   Kennzahlen im Vorrat). Der Site-Modus mit Domain-Kopplung existiert seit
   Juli. Abstimmung mit dem Partner und Texte liegen im Vorhabensordner des
   Archivs.
4. Brücke, damit eine Website aus Cowork heraus publiziert werden kann
   (Owner 27.09.):
   [`plans/mcp-bruecke-website-publizieren.plan.md`](plans/mcp-bruecke-website-publizieren.plan.md)
   (B1 publizieren, B2 Felder setzen, B3 Bilder in den Blob, B4
   Veröffentlichung lesen/setzen, B5 Seite prüfen, B6 Skill). Dazu aus
   [`plans/geplant/bruecke-library-betrieb.plan.md`](plans/geplant/bruecke-library-betrieb.plan.md):
   **Welle I Verlässlichkeit** (§3a; Ingest als bewusster Schritt nach der
   Prüfung durch den Menschen, Text-Feed ehrlich, Fehlertexte vollständig,
   Zaun-Abgleich; Werkzeugsatz 2.46.0/2.46.1, #368, #370, live geprüft),
   **Welle J Lesersicht** (§3b; Slides als Liste, Folienbilder über die
   Quellen-Twins, Cover aus der zweiten Folienseite, PDF-Anhänge aus den
   Quellen, Vorlagen ohne Dateinamen; 2.47.0, #372, Nachzüge #374 bis #376:
   Seitenbilder im Filesystem-Modus als Fragmente, Sync-Engine plant sie auch
   neben OCR-Fragmenten, Seitennummer beim Fragment-Upload), **Welle K
   Prüfbarkeit** PR 1 (§3c; K1–K3: `dokument_lesen` zeigt die Lesersicht,
   Ereignisse und Befunde in `job_status`, App-Version in `bruecke_info`;
   2.48.0).
5. Unverändert publizieren: nur der Plan
   [`plans/website-unveraendert-publizieren.plan.md`](plans/website-unveraendert-publizieren.plan.md)
   (Anlass, Owner 06.10.: zwei Seiten bekamen beim Neuschreiben neue
   Kennungen, der Story-Tab kennt nur den Weg über Vorlage und Sprachmodell).
6. Website-Sektion S0 Inhalt: die Website ist live (Owner über die Brücke,
   Stand 18.10.).
7. Fokus aus Sternen nach
   [`plans/galerie-fokus-aus-sternen.plan.md`](plans/galerie-fokus-aus-sternen.plan.md)
   (Owner 16.10.: ein Kriterium, die Sterne; die Fokus-Auswahl ist die Spitze
   der Sterne-Rangliste der Mitglieder, kein Tag mehr): F0 Daten (16.10., die
   36 Fokus-Maßnahmen als Sterne eines Mitglieds-Kontos) und F1 Server
   (18.10., ADR 0012: Schalter `starCountsPublic`, Sterne-Zahl anonym ohne
   Namen, `starred=<k>` und `sort=stars` serverseitig, Brücke 2.57.0) und
   F2 Galerie (19.10.: Knopf „Im Fokus", Sterne-Zahl für Besucher lesend,
   `starred` an den Server statt Filter im Browser; PR #402), F3 Banner
   (19.10.: `banner_sort: stars` am Startseiten-Doc, Link nimmt die
   Rangliste mit, `seite_pruefen` meldet fehlenden Schalter; PR #403, Brücke
   2.58.0) und F4 Inhalt (19.10., über die Brücke: Schalter an, Startseite
   auf der Rangliste, Tag `fokus` an den Quellen entfernt; anonym belegt).
   Offen bleibt nur noch Inhaltsarbeit: Mitglieder einladen, damit aus den
   Sternen eine Rangliste wird.

**Geplant:**

1. Status-Modalität: Golden-Set, Baseline und, nur bei Bedarf, der
   Kontrolldurchlauf (m6); Golden-Set und Baseline sind Arbeit des Owners an
   der Library.
2. Website-Sektionen S4 Fußzeile, S5 Sprachumschalter.
3. Index-Bereinigung der Library (Doppelgänger, Freitext-`lv_bewertung`),
   Doppelgänger zusammenlegen (Sterne wandern mit).
4. Galerie-Profil „geführt" für Bürger nach
   [`plans/galerie-buergeransicht.plan.md`](plans/galerie-buergeransicht.plan.md)
   (Owner 19.10., Figma-Entwurf; kein zweiter Baustein, ein Profil-Schalter
   in `GalleryRoot`: Filter als Lade von rechts, Umschalter Im Fokus/Alle,
   reduzierte Leiste, kompakte Karten; Wellen G1–G3). G1+G2 gebaut 19.10.
   (PR #406), G3 PR #407 (Felder `standardProfil`/`startAnsicht` im
   Formular und in der Brücke, 2.59.0); offen: die Klima-Library über die
   Brücke auf `gefuehrt`/`fokus` schalten, Galerie-Texte für das Band setzen.
   G4 Feinschliff nach Figma gebaut 19.10. (Kopf weg, ruhige Knöpfe, Suche in
   der Leiste, PR #408); Band-Texte der Klima-Library über die Brücke gesetzt.
   G5 Mitreden-Band statt Story-Knopf gebaut 19.10. (Text-Gruppe
   `publicPublishing.mitreden`, Brücke 2.60.0); offen: Band-Texte der
   Klima-Library über die Brücke setzen, Kopfnavigation der Schale je Profil.
4. Brücke: Live-Prüffall von Welle J (Index der fünf Seiten nachziehen,
   Cover ansehen); Welle K PR 2 (K4–K6: Stempel am Meta-Dokument, drei
   Zahlen in `twins_pruefen`).
5. Unverändert publizieren P1 bis P4 (P1 Route auf der B1-Funktion, P2 Knopf
   im Story-Tab, P3 `seite_pruefen` meldet verwaiste Einträge, P4 Doku).

Mitgenommene alte Themen (Kandidaten): Split des OneDrive-Providers (2.294
Zeilen), nur wenn die Anmeldung dort umgebaut wird; Klimamaßnahmen-Reste aus
dem Vorrat (Mapper-Paritätstest, LLM-bereinigte Summe als dritte Zahl), wenn
die Library ohnehin angefasst wird.

Neu dazugekommen: siehe Archiv `STAND-Vorhaben.md` (noch nichts).

## Vorhaben 3 · SHF: Konsensieren-Modul und Begleitfunktionen

- **Was es ist**: digitale Begleitung eines Beratungsgremiums mit
  Arbeitstischen (Steckbrief SHF). Anforderungen und Verfahrensdetails im
  Vorhabensordner des Archivs; im Repo liegen die abgenommenen Konzepte.
- **Bekannte Punkte**: Modul Systemisches Konsensieren (Widerstandswerte,
  Timer, iterative Runden, Auswertung) · geschützter Arbeitsbereich mit
  Rollen · digitaler Check-out der Arbeitsgruppen · Gruppenbeiträge und
  Kommentierung · anonymisierte öffentliche Sicht mit Rate-Limiting.

**Gemacht (Konzepte und Pläne, kein Code für das Modul):**

- Konzepte (12.09., Owner-Entscheidungen 1–8 darin):
  [`plans/erfassungs-architektur-stationen-datenhaltung.plan.md`](plans/erfassungs-architektur-stationen-datenhaltung.plan.md)
  (Regelsatz `capture.*`, Datenhaltung je Station, Verzeichnisstruktur,
  Wellen D0 und E0–E7, Abschnitt 6 Entscheidungen, Abschnitt 7 offen),
  [`plans/erfassungs-composer-s4-s5.plan.md`](plans/erfassungs-composer-s4-s5.plan.md)
  (Composer S4/S5, Scheiben C0–C10, Abnahme an den Figma-Screens),
  [`analysis/erfassungs-flow-wiederverwendung.md`](analysis/erfassungs-flow-wiederverwendung.md),
  [`analysis/erfassungs-flow-bauweisen-vergleich.md`](analysis/erfassungs-flow-bauweisen-vergleich.md),
  [`analysis/dialog-flow-bestand.md`](analysis/dialog-flow-bestand.md) mit
  [`Nachtrag`](analysis/dialog-flow-bestand-nachtrag.md). Auf `master` seit
  #279; der Gast-Zugang zum Testimonial-Recorder (Route + QR-Weiche) ist
  gebaut.
- **Umsetzungsplan in drei Wellen** (23.09.):
  [`plans/shf-umsetzung-wellen.plan.md`](plans/shf-umsetzung-wellen.plan.md)
  (Designstudie, vier Rollen, Zuordnung zur Laufzeit; am Code geprüft gegen
  v1.2.262). Welle 1 Weg der Teilnehmenden und Moderation, Welle 2
  Einwandverfahren A mit Messung als Objekt, Synthese, Tisch-Abschluss,
  Vertretung, Welle 3 Redaktion, Vision, Folgegruppen, Nachschlagen. Löst die
  Reihenfolge E0–E7 und C0–C10 der beiden Konzepte für das SHF ab.
- **Owner 23.09.: erst Grundlagen, dann Oberflächen** —
  [`plans/shf-grundlagen-datenhaltung-kernflows.plan.md`](plans/shf-grundlagen-datenhaltung-kernflows.plan.md):
  Wizard-Stand und -Editor (nur die Flow-Naht), Datenmodell der
  Beteiligungs-Domäne (`meetings`, `meeting_tables`, `table_participations`,
  `measurements`, `assessments`, `syntheses`; Submission mit Anlagen und
  Kontext), Kernflüsse K1–K4 (Erfassen, Verdichten mit Belegspur über den
  Secretary, Messen, Veröffentlichen), Modul `@ks/module-deliberation`,
  Bau-Reihenfolge G0–G9 plus Nebenstrang W „Wizard fertigstellen“.
  **Speicherweg B** (Owner 23.09.): Beiträge liegen während des
  Ernte-Fensters in der Inbox und werden beim Schließen Dateien im Storage;
  die Synthese läuft über das bestehende Sammeltranskript. Landkarte in
  Figma (intern): „KnowledgeScout — Modul-Landkarte“.
- **Owner 23.09.: erst Detailkonzepte, dann Code.** Grundlage:
  [`plans/beteiligung-objektmodell-original-und-kopie.plan.md`](plans/beteiligung-objektmodell-original-und-kopie.plan.md)
  (D0: fünf Klassen Planung · Verfahren · Beitrag · Ergebnis · abgeleitet,
  wo das Original liegt, stabile Kennungen, Verzeichnisstruktur mit
  Organisationsordnern, Liste D1–D11). E1–E6 entschieden (Planung „Datei
  zuerst“). **Detailkonzepte D1–D11** (23.09.):
  [`plans/beteiligung/README.md`](plans/beteiligung/README.md) mit
  Eingriffen in den Bestand, offenen Entscheidungen O1–O9 und
  Bau-Reihenfolge (35–43,5 PT Fundament, Oberflächen zusätzlich).
- **Prüfung 24.09.** ([`plans/beteiligung/pruefbericht-2026-09-24.md`](plans/beteiligung/pruefbericht-2026-09-24.md)):
  Code-Belege, Nahtstellen und Anforderungen unabhängig geprüft. Befund am
  Bestand: `getLibrary` lässt jedes aktive Mitglied durch, sechs Helfer
  nutzen es als Owner-Prüfung (O10, sicherheitsrelevant). Neun
  Anforderungen aus den Primärquellen fehlen (u. a. Vorschlag wird
  eingesprochen, 13 Konfigurationsschalter, Verwaltungsbegleitung, Dissens
  als Ergebnis), dreizehn Widersprüche an den Nähten (u. a.
  Promotion-Zeitpunkt, Identitätsmodell, Feldkatalog). Sachliche
  Korrekturen sind eingearbeitet; die Aufwandszahlen gelten bis zur
  Überarbeitung nicht. Lesefassung für den Owner: Word/PDF „Konzepte in
  einfachen Worten“ (Archiv). Owner-Einwände aus dem Lesedurchgang 24.09.
  eingearbeitet (D1: Prüfen entfällt; O17–O20 offen).
- **Bauweise (Owner 24.09.): parallel nach
  [`plans/beteiligung/parallelisierung.plan.md`](plans/beteiligung/parallelisierung.plan.md)**:
  Welle 0 Verträge (Feldkatalog, Paket `deliberation-contracts`, Fixtures,
  Spikes, Überarbeitung), dann Welle 1 mit sechs und Welle 2 mit vier
  Sessions gleichzeitig, zuletzt Verdrahtung; Start-Prompt je Session im
  Plan. Cloud-Sessions können seit dem SessionStart-Hook Tests, Lint und tsc
  selbst laufen lassen.

**Geplant:**

- Vor dem Code: die Owner-Entscheide O1, O2 und O10–O20 aus
  [`plans/beteiligung/README.md`](plans/beteiligung/README.md).
- Welle 0 nach dem Parallelisierungsplan, dann Wellen 1–3.
- Kostenprüfung der Haltungsänderung am Code (Architektur-Konzept, Abschnitt
  7, Punkt 1; Pflicht vor E0).
- **Die Erfassung wird hier in einem Zug bereinigt** (Owner 09.09.), nicht
  vorab: die beiden Alt-Endpunkte `events/finalize` und `events/publish-final`
  (Phase 6 von generic-finalize-wizard; Befund 11.09.: nur `publish-final`
  wird in `creation-wizard.tsx` noch gerufen, `events/finalize` hat in
  `src/**` keinen Aufrufer mehr), ADR 0003 Wizard/Schema, und die Reste aus
  Welle 3-VI.
- Mehrsprachigkeit DE/IT: Entscheid des Partners steht aus.

Verlauf und „Neu dazugekommen" (Analyse-Befunde, Klickmodell,
Owner-Entscheidungen im Wortlaut, Dialogfall): Archiv
`24.09 KnowledgeScout/STAND-Vorhaben.md`.

## Zwischenschnitt · Speicher-Verbindungen und Library-Anlage — erledigt, A4 in „Zusammenarbeit in Stufen"

- **Was**: Speicher-Zugänge (Nextcloud, OneDrive) gehören der Person und
  werden einmal am Konto gepflegt, verschlüsselt; die Library zeigt nur noch
  auf Verbindung plus Verzeichnis (Teil A). „Erweitert" ist ein aufklappbarer
  Menüpunkt mit sieben Unterseiten (Teil B). Eine neue Library wird
  vollständig angelegt: Entscheidungskatalog, App-Wizard, Rückfragen von
  `bibliothek_anlegen` (Teil C).
- **Plan**: [`plans/speicher-verbindungen-und-library-anlage.plan.md`](plans/speicher-verbindungen-und-library-anlage.plan.md);
  Owner-Entscheide E1–E8 am 13.10. bestätigt.
- **Gebaut und gemergt**:
  - B1 Seitenmenü „Erweitert", Teil-Formulare je Seite (#390)
  - A1 Speicher-Verbindungen als Entität, AES-256-GCM mit
    `CREDENTIALS_ENCRYPTION_KEY`, Konto-Seite (#391)
  - A2 Library auf Verbindung, Migrationsskript
    `scripts/migrate-storage-connections.ts`, Token- und Refresh-Route ohne
    `X-Internal-Request`-Umgehung und nur für den Owner (#392, Build-Fix
    #393)
  - A3 Brücke listet, testet und weist Verbindungen zu (2.54.0), C1
    Entscheidungskatalog mit Standard-Facetten je Inhaltstyp, C2 Anlege-Wizard
    in der App mit „Einrichtung: n von m", C3 `bibliothek_anlegen` fragt mit
    `offeneEntscheidungen` zurück, neues `bibliothek_pruefen` (2.55.0) (#394)
- **Betrieb (Owner 18.10.)**: Migrationsskript in Dev und Prod gelaufen,
  `CREDENTIALS_ENCRYPTION_KEY` in beiden Umgebungen gesetzt,
  `bibliothek_anlegen` mit Rückfragen über die Brücke live getestet.
- **A4 Mitglieder mit eigener Verbindung**: angehalten. Co-Creators
  arbeiten bewusst und sichtbar mit dem Speicherzugang des Owners; A4 geht in
  [ADR 0011](adr/0011-zusammenarbeit-in-stufen.md) und
  [`plans/geplant/zusammenarbeit-in-stufen.plan.md`](plans/geplant/zusammenarbeit-in-stufen.plan.md)
  auf (Wellen Z1 Urheberschaft, Z2 Voreinstellung und Prüfstelle, Z3
  geliehener Speicherzugang sichtbar, Z4 Commons).
- **Rest im Vorrat**: Umschlüsselungs-Skript für einen Wechsel von
  `CREDENTIALS_ENCRYPTION_KEY` (nicht gebaut; ohne es macht ein neuer
  Schlüssel gespeicherte Geheimnisse unlesbar). Das Klartext-Backup der
  Migration unter `backups/` nach der Prüfung löschen.

## Zwischenschnitt · Twin-Fingerabdruck — erledigt (Stufe 1), Stufe 2 entfällt

**Stand 13.10.**: Messung in Prod am 10.09. (75 Quellen, Teilbaum des
Archivs): zweiter Lauf mit Tor liest null Dateien und braucht 29 s, der
Lauf ohne Tor läuft über das 60-Sekunden-Limit. Die Zusage des Briefs ist
damit belegt. Stufe 2 spart im warmen Fall nichts und im kalten Fall rund
45 % der Lesezeit; für den kalten Fall ist der Job-Modus aus dem Vorrat das
passende Werkzeug. **Stufe 2 wird nicht gebaut.** Die Messung liegt als
nie gemergter Commit auf `origin/claude/twin-fingerabdruck-messung` und ist
hier übernommen; der Branch kann weg.

- **Was**: Der Sync-Engine-Check liest heute bei jedem `abdeckung_scannen` jede
  Markdown-Datei jeder Twin-Familie (~330 ms je Datei, zwei Anfragen). Ein
  Fingerabdruck aus dem Ordner-Listing plus Mongo-`updatedAt` soll das Lesen
  auf geänderte Quellen beschränken; ein zweiter Lauf über ein unverändertes
  Archiv macht null `getBinary`-Aufrufe.
- **Warum**: beschleunigt die tägliche Archivarbeit mit Cowork und
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
  Anfrage statt zwei im OneDrive-Provider) entfällt nach der Messung vom
  10.09. (siehe oben).
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

Ohne Reihenfolge. Vorhaben bedienen sich hier, wenn ein Punkt auf ihrem Weg liegt.

- **Reste aus Vorhaben 1 AECED**: Live-Nachweis des
  Story-Modus in App und fremder App (`view="story"`, D6b/D6c); D6d toten
  App-Chat (`ChatPanel` ohne Montagepunkt) entfernen; D0 Abnahme des
  Klickmodells in Figma (Plan
  [`story-dreiteilung-fragenchronik`](plans/story-dreiteilung-fragenchronik.plan.md));
  der Galerie-Loader könnte fehlende PDF-Transkripte selbst anstoßen
  (Job-Kette); Manifest der fremden App zur Laufzeit aus der öffentlichen
  Dokument-API (eigenes Vorhaben mit Brief, wenn der Partner es aufruft)
- **Von Menschen geprüfte Veranstaltung** (Plan
  [`von-menschen-gepruefte-veranstaltung`](plans/von-menschen-gepruefte-veranstaltung.plan.md);
  die Marker im Plan sind veraltet): P3a Kontext im Datei-Weg und P3b
  Reiter „Korrektur" sind gebaut und gemergt. P4 Vorlage wartet
  auf den Prüffall mit dem lokalen Secretary (Plan-Stand liegt ungemergt auf
  `claude/p4-vorlage-abnahme`); P5 Wizard-Schritt und P6 Optionen im Dialog
  „Aufbereiten & Publizieren" sind nicht begonnen
- **Prompt-Inspektion der Transformation** (Plan
  [`prompt-inspektion-transformation`](plans/prompt-inspektion-transformation.plan.md)):
  Prompt-Protokoll je Transformation, Vorschau ohne Modellaufruf,
  Anzeige in der Datei-Vorschau, Brücken-Werkzeug. Nichts gebaut; I1 und I1b
  liegen im Secretary-Repo
- **Branches aufgeräumt** (13.10., Owner-Auftrag): 22 Remote-Branches
  gelöscht (überholte und solche, deren Inhalt vollständig in master liegt)
  und 221 lokale (168 in master, die überholten aus der Durchsicht, 47 aus
  der Zeit vor der Bereinigung vom 09.09. ohne Remote, der gemergte Branch
  von #385). Alle sind beim Owner gesichert im ignorierten Ordner
  `backups/` als `branches-geloescht-2026-10-13.bundle` mit Kopfliste; ein
  Branch kommt mit `git fetch <bundle> <ref>:<ref>` zurück. Branches, die in
  einem Worktree ausgecheckt sind, blieben stehen (darunter
  `claude/umzug-1-chat-vokabular`). Remote bleiben vier, zu entscheiden:
  `claude/lucid-planck-b9i6gj` (Grundlage für Teil A des Speicher-Plans,
  bleibt bis A1), `claude/handover-bruecke-library-setup-7fdbb4`
  (App-Passwort direkt nachtragen, fertig, wird von Teil A überholt) und
  die beiden Vorlagen-Branches der Partner-Library vom 14.09. und 18.09.
- **Wunschliste 8 „Dateien über Library-Grenzen nachvollziehen"** (Stand
  13.10.: W8-4 #382, W8-1 #383 und W8-2 #384 gemergt, Werkzeugsatz 2.50.0;
  W8-3 `familie_uebergeben` gemergt (#387, Werkzeugsatz 2.52.0), Live-Prüfung
  mit zwei Libraries steht aus; die Skill-Patches liegen beim Archiv) (Cowork,
  2026-10-13, im Archiv unter `24.09 KnowledgeScout/2026-10-13 Wunschliste 8 -
  …md`; Programmiersicht und PR-Schnitt in
  [`plans/dateien-ueber-library-grenzen.plan.md`](plans/dateien-ueber-library-grenzen.plan.md),
  geprüft gegen den Code am 13.10.). Vier PRs in dieser Reihenfolge: W8-4
  `libraries:` im Bericht + Befund `library_ohne_vorhaben`; W8-1 Quellkennung
  am Twin (`sourceContentHash`, nicht `source_hash`, weil
  `binaryFragments[].sourceHash` schon belegt ist); W8-2 `quelle_suchen` über
  alle eigenen Libraries + `moeglicherweiseIn` an `quelle_verschwunden`; W8-3
  `familie_uebergeben` mit Verweis-Datei, nie löschen, Vektoren nie kopieren.
  **Vor PR 4 acht Owner-Entscheide** (Abschnitt 4 des Plans). Abschnitt 6
  legt die Grundlage für Adressen über Library- und Instanz-Grenzen fest
  (`[[@<slug>/<pfad>]]`, Slug je Library, Verzeichnis mit Heimat lokal/fremd,
  Auflöser mit drei Antworten); gebaut wird davon jetzt nur Slug, Parser und
  Verweis-Erkennung, der Klick und die Föderation sind reserviert (ADR 0009).
  Die Skill-Patches bleiben im Archiv.
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
- **Zusammenarbeit in Stufen** (ADR 0011, Owner 16.10.):
  [`plans/geplant/zusammenarbeit-in-stufen.plan.md`](plans/geplant/zusammenarbeit-in-stufen.plan.md),
  Wellen Z1–Z4; nimmt A4 des Speicher-Zwischenschnitts auf und löst ADR 0005
  als Normalfall ab
- Umschlüsselungs-Skript für `CREDENTIALS_ENCRYPTION_KEY` (Rest aus dem
  Speicher-Zwischenschnitt); die Verschlüsselung selbst ist seit A1 gebaut,
  der Branch `origin/claude/lucid-planck-b9i6gj` (Commit 63a64bb9) wird nicht
  mehr gebraucht
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

Seit 15.09.: **Vorhaben 1 AECED** (M4f–M4i, M5, `@ks/embed`; Brief
[`AGENT-BRIEF-M5.md`](refactor/modularisierung/AGENT-BRIEF-M5.md),
Verlauf im Archiv) · Twin-Fingerabdruck Stufe 1 · Story-Dreiteilung D1–D7
und Layout-Wellen D8–D12 · Status-Modalität Code (#355) · Brücke Wellen A,
C, D, F (2.38–2.41), I (2.46), J (2.47 mit Nachzügen), K PR 1 (2.48) ·
Transkript-Verlässlichkeit (#364 bis #366) · Reiter „Korrektur" am
Audio-Transkript (P3b) · Wunschliste 6 Code (2.30) · Webseite als Quelle
(`webseite_erschliessen`, #385, 2.49.0) · Wunschliste 8 W8-4, W8-1, W8-2,
W8-3 (2.50, 2.52; Live-Prüfung von W8-3 offen) · Zwischenschnitt
Speicher-Verbindungen und Library-Anlage B1, A1–A3, C1–C3 (#390–#394,
2.54/2.55; Migration in Dev und Prod gelaufen).

## Die ADRs

| ADR | Entscheidung in einem Satz | Zustand |
|---|---|---|
| 0001 | Event-Jobs und External-Jobs sind getrennte Domänen | akzeptiert |
| 0002 | Galerie-Sterne kommen aus MongoDB, nicht aus Clerk | akzeptiert |
| 0003 | Wizard (Ablauf) und Schema-Template (Datenmodell) trennen | geplant, reserviert für Vorhaben 3 |
| 0004 | Erfassen schreibt in eine Inbox, Veröffentlichen ist ein eigener Schritt | akzeptiert 2026-09-09 (gebaut seit Juni) |
| 0005 | Co-Creator nutzen eigene Storage-Zugangsdaten | als Normalfall abgelöst durch 0011 |
| 0006 | Maschinenarbeit gilt als angenommen, der Mensch markiert nur Fehler | akzeptiert |
| 0007 | Monorepo mit Schale, Modul-Paketen und geteilten Bibliotheken | akzeptiert 2026-09-09 (M1–M4e gebaut) |
| 0008 | Ein Deployment, viele Sites; Embed liefert nur Öffentliches | akzeptiert 2026-09-09 |
| 0009 | Mehrere Libraries pro Site, Brücken dazwischen | geplant (nur Typfeld `federated?`) |
| 0010 | Retrieval-Profil je Library: Zugang, Strategie, Sprachen | geplant |
| 0011 | Zusammenarbeit in Stufen: Co-Creators arbeiten sichtbar mit dem Speicherzugang des Owners, Urheberschaft am Artefakt | akzeptiert 2026-10-16, Umsetzung geplant (Z1–Z4) |

## Pflege

- Neuer Punkt beim Bauen ⇒ Zeile mit Datum unter „Neu dazugekommen" des
  laufenden Vorhabens in `24.09 KnowledgeScout/STAND-Vorhaben.md` im Archiv
  (MCP-Brücke, `datei_patchen`); hier nur, wenn sich Gemacht oder Geplant
  ändert. Ohne Archivzugang: in den Hand-off, der Owner trägt nach.
- Vorhaben fertig ⇒ Abschnitt nach „Erledigt" kürzen, Reste in den Vorrat.
- Termine, Reihenfolge und Priorität ⇒ nicht hier, sondern im Archiv beim Owner.
- Plan-Dateien: aktiv unter `docs/plans/`, wartend unter `docs/plans/geplant/`, fertig unter `docs/plans/archiv/`.
