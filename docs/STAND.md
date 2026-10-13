# Stand des Repos

> Eine Quelle für die Frage „woran wird gerade gearbeitet, und was wartet?".
> Gepflegt von Hand bei jedem Vorhabenswechsel und bei jedem neuen Punkt.
> Stand: 2026-10-13 (Durchsicht gegen Code, Pläne und offene Branches). Die ausführliche Landkarte mit Legende und Motiven aller
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

**Durchsicht 13.10.2026.** Vorhaben 1 ist am 15.09. bedient und steht jetzt
unter „Erledigt", seine Reste im Vorrat. Vorhaben 2 und 3 haben ihren Termin
hinter sich (30.09. und 09.10.); beide tragen Reste weiter, die je Vorhaben
unter „Stand 13.10." stehen. Nach der Pflege-Regel steht Vorhaben 2 auf
„jetzt", bis der Owner ein anderes Vorhaben aufruft oder die Reste in den
Vorrat schiebt. Daneben ist in den Wochen seit dem 15.09. viel Arbeit ohne
eigenes Vorhaben entstanden (Story-Dreiteilung, Status-Modalität,
Veranstaltung über die Brücke, Wunschliste 8); sie steht im Vorrat mit ihrem
offenen Rest.

## Vorhaben 2 · Klimamaßnahmen Südtirol: Vortrag 30.09. — jetzt (Termin vorbei, Reste)

- **Termin**: 30.09.
- **Was es ist**: ein Auftritt mit der Library „Klimamaßnahmen"; Konzept und
  Anforderungen im Vorhabensordner des Archivs, hier nur die Arbeitsliste.
- **Ziel**: eine Vorführung, die eine Stunde lang nicht hängen bleibt, und
  eine Library, die zeigt, was der Vortrag verspricht.
- **Stand 13.10.**, Rest je Punkt der Liste unten:
  1. OneDrive-Anmeldung: nicht begonnen. Wird vom Plan
     [`speicher-verbindungen-und-library-anlage`](plans/speicher-verbindungen-und-library-anlage.plan.md)
     Teil A abgelöst (ein Login je Verbindung statt je Library).
  2. Status-Modalität: Code gebaut (#355). Offen sind Golden-Set,
     Baseline und, nur bei Bedarf, der Kontrolldurchlauf (m6); Golden-Set
     und Baseline sind Arbeit des Owners an der Library.
  3. Website-Sektionen: S1 bis S3 gebaut; offen S0 Inhalt, S4 Fußzeile,
     S5 Sprachumschalter.
  4. Brücke: Wellen I und J gebaut und gemergt (Nachzüge #374 bis #376);
     offen ist der Live-Prüffall von J (Index der fünf Seiten nachziehen,
     Cover ansehen). Welle K: PR 1 (K1 bis K3, 2.48.0) gemergt, PR 2 (K4
     bis K6) nicht begonnen.
  5. Unverändert publizieren: P1 bis P4 offen, nichts gebaut.

Bekannte Punkte:

1. OneDrive-Anmeldung stabil neu aufsetzen; sie fällt nach ein bis zwei
   Wochen aus. Teilfortschritt 27.08. (Netzwerkfehler löschen die Anmeldung
   nicht mehr) ist drin.
2. Anpassungen an der Library „Klimamaßnahmen" (Umfang aus dem Konzept im
   Archiv; noch nicht festgelegt). **Plan seit 06.10.:**
   [`plans/story-status-modalitaet.plan.md`](plans/story-status-modalitaet.plan.md)
   — der Story-Modus ignoriert den Status der Maßnahme (`lv_bewertung`) und
   formuliert Abgelehntes wie Beschlossenes; Status wird zur Modalität der
   Antwort — Bedeutungs-Wörterbuch je Facettenwert und Antwortregeln-Text
   in der Library-Konfiguration, kein Code pro Typ (Owner 06.10.); geprüft
   über ein Golden-Set je Library (m0 messen, dann Regeln + Nachprüfung,
   dann Ingest-Kontext).
3. Webseite für den Vortrag bzw. die Klimamaßnahmen (Site-Modus mit
   Domain-Kopplung existiert seit Juli; was darüber hinaus nötig ist, steht
   im Konzept). **Bau-Plan seit 26.09.:**
   [`plans/website-startseite-sektionen.plan.md`](plans/website-startseite-sektionen.plan.md)
   (Owner 27.09.: das bestehende Banner um Fokus-Filter, Titel und
   Position erweitern statt ein neues Raster bauen; Wellen S0 Inhalt ohne
   Code, S1 Banner, S2 Hero, S3 Kacheln nur gelayoutet, S4 Fußzeile, S5
   Sprache; Ampel-Skala und dynamische Kennzahlen im Vorrat); die
   Abstimmung mit dem Partner und die Texte liegen im Vorhabensordner des
   Archivs.
4. Brücke erweitern, damit eine Website aus Cowork heraus publiziert
   werden kann (Owner 27.09.):
   [`plans/mcp-bruecke-website-publizieren.plan.md`](plans/mcp-bruecke-website-publizieren.plan.md)
   (B1 publizieren, B2 Felder setzen, B3 Bilder in den Blob, B4
   Veröffentlichung lesen/setzen, B5 Seite prüfen, B6 Skill).
   **Seit 11.10.: Welle I Verlässlichkeit der Brücke** in
   [`plans/geplant/bruecke-library-betrieb.plan.md`](plans/geplant/bruecke-library-betrieb.plan.md)
   §3a, aus dem Live-Prüffall der Veranstaltung über die Brücke (Handover
   im Archiv): Ingest als bewusster Schritt nach der Prüfung durch den
   Menschen (`ingest: false` als sichtbare Vorgabe, dann
   `index_aktualisieren`; kein Sonderfall für `test/`, weil Ingest nie
   automatisch passiert), Text-Feed ehrlich, Fehlertexte vollständig,
   Zaun-Abgleich. PR 1 (I1 + I2, Werkzeugsatz 2.46.0, #368) und PR 2 (I3 + I4,
   2.46.1, #370) am 11.10. gemergt und live geprüft; Welle I abgeschlossen.
   **Welle J Lesersicht** (Folienbilder, Cover, PDF-Anhänge) ist seit 11.10.
   als §3b angelegt; PR 1 (J1 Slides als Liste lesen, J2 Folienbilder über
   die Quellen-Twins, Viewer rät keinen Wurzel-Pfad mehr) und PR 2 (J3 Cover
   aus der zweiten Folienseite, J4 PDF-Anhänge aus den Quellen in den Blob,
   J5 Vorlagen ohne Dateinamen, Skill-Prüfpunkte, Werkzeugsatz 2.47.0) am
   11.10. gebaut und gemergt (#372). Live-Prüffall 11.10. abends: 0 von 58
   Folien aufgelöst, weil die PDF-Twins im Filesystem-Modus keine
   Seitenbilder als Fragmente tragen (Befund und Nachzug in §3b: extract-only
   registriert sie jetzt nach, Variante `preview` gilt als Vorschau; #374);
   zweiter Nachzug: die Sync-Engine plante die Nachregistrierung nie, wenn
   der Twin schon OCR-Fragmente hatte (#375). Neu-Extraktion der drei PDFs
   am 11.10. spät: Folien 58/58 und 22/22, Anhänge und Flyer-Link stehen;
   Cover fehlte, weil `uploadBinaryFragment` die Seitennummer nie speicherte
   (dritter Nachzug #376: durchreichen plus Ableitung aus dem Namen). Danach
   `index_aktualisieren` für die fünf Seiten und Sichtprüfung des Covers
   beim Owner offen. **Welle K Prüfbarkeit** (Owner 12.10., §3c): die
   Brücke zeigt, was der Leser sieht (`dokument_lesen`, Ereignisse und
   Befunde in `job_status`, App-Version in `bruecke_info`, Stempel am
   Meta-Dokument, drei Zahlen in `twins_pruefen`); K1–K3 gebaut (PR 1,
   Werkzeugsatz 2.48.0, 12.10.), K4–K6 folgen in PR 2.
5. Website-Seiten aus dem Archiv heraus unverändert publizieren (Owner
   06.10., Anlass: zwei Seiten bekamen beim Neuschreiben neue Kennungen,
   der Story-Tab kennt nur den Weg über Vorlage und Sprachmodell):
   [`plans/website-unveraendert-publizieren.plan.md`](plans/website-unveraendert-publizieren.plan.md)
   (P1 Route auf der B1-Funktion, P2 Knopf im Story-Tab, P3 `seite_pruefen`
   meldet verwaiste Einträge, P4 Doku).

Mitgenommene alte Themen (Kandidaten): Split des OneDrive-Providers (2.294
Zeilen), nur wenn die Anmeldung dort umgebaut wird; Klimamaßnahmen-Reste aus
dem Vorrat (Mapper-Paritätstest, LLM-bereinigte Summe als dritte Zahl), wenn
die Library ohnehin angefasst wird; ADR 0005 nur entscheiden.

Neu dazugekommen: siehe Archiv `STAND-Vorhaben.md` (noch nichts).

## Vorhaben 3 · SHF: Konsensieren-Modul und Begleitfunktionen — Freeze vorbei, ohne Code

- **Termin**: Feature Freeze 09.10.; Termine des Partners im Archiv.
- **Stand 13.10.**: Der Freeze ist verstrichen, ohne dass Code für das
  Modul entstanden ist. Es liegen nur Konzepte vor (Abschnitte unten). Der
  nächste Schritt ist unverändert eine Owner-Sache: die Entscheide O1, O2
  und O10 bis O20 aus [`plans/beteiligung/README.md`](plans/beteiligung/README.md),
  dann Welle 0 nach dem Parallelisierungsplan. Ob und mit welchem neuen
  Termin das Vorhaben weiterläuft, entscheidet der Owner.
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
  **Prüfung 24.09.** ([`plans/beteiligung/pruefbericht-2026-09-24.md`](plans/beteiligung/pruefbericht-2026-09-24.md)):
  Code-Belege, Nahtstellen und Anforderungen unabhängig geprüft. Befund am
  Bestand: `getLibrary` lässt jedes aktive Mitglied durch, sechs Helfer
  nutzen es als Owner-Prüfung (O10, sicherheitsrelevant). Neun
  Anforderungen aus den Primärquellen fehlen (u. a. Vorschlag wird
  eingesprochen, 13 Konfigurationsschalter, Verwaltungsbegleitung,
  Dissens als Ergebnis), dreizehn Widersprüche an den Nähten (u. a.
  Promotion-Zeitpunkt, Identitätsmodell, Feldkatalog). Sachliche
  Korrekturen sind eingearbeitet; die Aufwandszahlen gelten bis zur
  Überarbeitung nicht. Lesefassung für den Owner: Word/PDF „Konzepte in
  einfachen Worten“ (Archiv, Ordner der Nachhaltigkeits-Reihe).
  Owner-Einwände aus dem Lesedurchgang 24.09. eingearbeitet (D1: Prüfen
  entfällt; O17–O20 offen). **Bauweise (Owner 24.09.): parallel nach
  [`plans/beteiligung/parallelisierung.plan.md`](plans/beteiligung/parallelisierung.plan.md)**:
  Welle 0 Verträge (Feldkatalog, Paket `deliberation-contracts`, Fixtures,
  Spikes, Überarbeitung), dann Welle 1 mit sechs und Welle 2 mit vier
  Sessions gleichzeitig, zuletzt Verdrahtung; Start-Prompt je Session im
  Plan. Cloud-Sessions können seit dem SessionStart-Hook Tests, Lint und
  tsc selbst laufen lassen.
  **Nächster Schritt:** Entscheidungen O1, O2 und O10–O20 durch den
  Owner (README); dann Welle 0 mit dem Start-Prompt aus dem
  Parallelisierungsplan.
- **Verlauf und „Neu dazugekommen"** (Analyse-Befunde, Klickmodell,
  Owner-Entscheidungen im Wortlaut, Dialogfall): Archiv
  `24.09 KnowledgeScout/STAND-Vorhaben.md`.

## Zwischenschnitt · Speicher-Verbindungen und Library-Anlage — aktiv (Owner 13.10.)

- **Was**: Speicher-Zugänge (Nextcloud, OneDrive) gehören der Person und
  werden einmal am Konto gepflegt, verschlüsselt; die Library zeigt nur
  noch auf Verbindung plus Verzeichnis (Teil A, bündelt ADR 0005 und die
  Verschlüsselung). „Erweitert" wird ein aufklappbarer Menüpunkt mit
  sieben Unterseiten (Teil B). Eine neue Library wird vollständig angelegt:
  Entscheidungskatalog, App-Wizard, Rückfragen von `bibliothek_anlegen`
  (Teil C).
- **Warum jetzt**: beim Arbeiten über die Brücke beobachtet (13.10.):
  redundante Pflege delikater Zugangsdaten je Library, und jede über die
  Brücke angelegte Library muss in den Settings nachkonfiguriert werden.
  Teil A ersetzt zugleich Punkt 1 von Vorhaben 2 (OneDrive-Anmeldung).
- **Plan**: [`plans/speicher-verbindungen-und-library-anlage.plan.md`](plans/speicher-verbindungen-und-library-anlage.plan.md);
  die acht Owner-Entscheide (§6) sind am 13.10. wie empfohlen bestätigt.
  Start-Prompts je Schritt in §9.
- **Reihenfolge**: B1 Seitenmenü (an nichts gebunden, Cloud-Session) →
  A1 Verbindungen + Konto-Seite → A2 Library auf Verbindung + Migration
  (Prod-Lauf beim Owner) → A3 Brücke; C1 Entscheidungskatalog parallel
  möglich, C2 nach A2, C3 nach C1; A4 Mitglieder zuletzt.
- **Stand 13.10.**: Plan auf `master` seit #386; die Aktivierung und die
  Start-Prompts in §9 kommen mit dem Folge-PR, der vor dem Start von B1
  gemergt sein muss. B1 startet als erste Cloud-Session.
- **Stand 13.10. abends, B1 gebaut** (Branch
  `claude/speicher-b1-seitenmenue-erweitert`, PR offen): Seitenmenü mit
  zweiter Ebene, „Erweitert" hat sieben Unterseiten, die alte Route leitet
  auf „Suche & KI" weiter; das Library-Formular ist in Teil-Formulare je
  Seite zerlegt (jede schickt per PATCH nur ihre Schlüssel), „Inhalte
  erfassen" liegt als Schritt 4 auf der Archive-Seite. Live-Prüfung im
  Browser und `pnpm build` beim Owner vor dem Merge. Nächster Schritt: A1
  Verbindungen + Konto-Seite (Start-Prompt im Hand-off der B1-PR).

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

Ohne Termin. Vorhaben bedienen sich hier, wenn ein Punkt auf ihrem Weg liegt.

- **Reste aus Vorhaben 1 AECED** (bedient 15.09.): Live-Nachweis des
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
  Reiter „Korrektur" sind gebaut und gemergt (bis 10.10.). P4 Vorlage wartet
  auf den Prüffall mit dem lokalen Secretary (Plan-Stand liegt ungemergt auf
  `claude/p4-vorlage-abnahme`); P5 Wizard-Schritt und P6 Optionen im Dialog
  „Aufbereiten & Publizieren" sind nicht begonnen
- **Prompt-Inspektion der Transformation** (Plan
  [`prompt-inspektion-transformation`](plans/prompt-inspektion-transformation.plan.md),
  06.10.): Prompt-Protokoll je Transformation, Vorschau ohne Modellaufruf,
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
- ADR 0005 Co-Creator mit eigener Storage-Auth und die Verschlüsselung der
  Storage-Zugangsdaten (Commit 63a64bb9 auf `origin/claude/lucid-planck-b9i6gj`,
  nie gemergt, der Branch bleibt als Grundlage stehen): seit 13.10. Teil A
  des Zwischenschnitts „Speicher-Verbindungen und Library-Anlage" (oben)
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

Seit 15.09.: **Vorhaben 1 AECED** (M4f–M4i, M5, `@ks/embed`, bedient
15.09.; Brief [`AGENT-BRIEF-M5.md`](refactor/modularisierung/AGENT-BRIEF-M5.md),
Verlauf im Archiv) · Twin-Fingerabdruck Stufe 1 · Story-Dreiteilung D1–D7
und Layout-Wellen D8–D12 · Status-Modalität Code (#355) · Brücke Wellen A,
C, D, F (2.38–2.41), I (2.46), J (2.47 mit Nachzügen), K PR 1 (2.48) ·
Transkript-Verlässlichkeit (#364 bis #366) · Reiter „Korrektur" am
Audio-Transkript (P3b) · Wunschliste 6 Code (2.30) · Webseite als Quelle
(`webseite_erschliessen`, #385, 2.49.0) · Wunschliste 8 W8-4, W8-1, W8-2,
W8-3 (2.50, 2.52; Live-Prüfung von W8-3 offen).

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
