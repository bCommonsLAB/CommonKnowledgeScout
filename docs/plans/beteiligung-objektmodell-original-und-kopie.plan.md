---
name: beteiligung-objektmodell-original-und-kopie
overview: "Konzeptphase vor jedem Code (Owner 23.09.): Objektmodell der Beteiligungs-Domäne, die Regel „was ist Original, was ist Kopie, was liegt in der Datenbank, was im Storage“ auf Basis der Regeln, die der Bestand schon befolgt; Verzeichnisstruktur für Veranstaltung und Organisation; Zusammenspiel Teilnehmende ↔ Library (beitragen, beauskunften, Organisation als Quellenangabe im Ingest); Liste der Detailkonzepte D0–D11 je Flow mit ihren Schnittstellen zum Bestand."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# Beteiligung: Objektmodell, Original und Kopie, Detailkonzepte

**Stand:** 2026-09-23, geprüft gegen `master` 579f2d7 (v1.2.262).

**Auftrag (Owner, 23.09.):**
- Vor jedem Code kommen Detailkonzepte je Flow. Sie beschreiben die
  Abhängigkeiten zu bestehenden Komponenten, Schnittstellen und Interfaces
  genau.
- Das größte Problem ist die Frage: **Was liegt in der Datenbank, was im
  Storage, was ist Original und was nur Kopie?**
- Jede Organisation bekommt einen Ordner im Storage, in dem sie Dokumente
  ablegen kann.
- Eine Veranstaltung braucht zum Aufsetzen eine Verzeichnisstruktur. Die
  Planung passiert in Dateien, zur Laufzeit stehen die Inhalte in der
  Datenbank. Wo die Inhalte gepflegt werden, ist noch zu klären.
- Beiträge müssen in der Organisation landen, und der Ingest muss die
  Organisation als Quellenangabe tragen. Das gibt es alles schon und ist
  nur kompatibel anzuschließen.

**Stellung:** Dieses Dokument ist **D0**, die Grundlage aller
Detailkonzepte. Es geht den Scheiben G0–G9 aus
[`shf-grundlagen-datenhaltung-kernflows.plan.md`](shf-grundlagen-datenhaltung-kernflows.plan.md)
voraus. Dort bleiben Kernflüsse, Speicherweg B und die Reihenfolge gültig.
Die Collection-Liste dort (Abschnitt 2.4) wird durch Abschnitt 3 dieses
Dokuments präzisiert.

**Visuell:** Figma „KnowledgeScout — Modul-Landkarte“, Seite
„2 · Objektmodell“ (https://www.figma.com/design/lq5lUzASBUkhDfjd7XeTqt):
- drei Speicherorte als Spalten (Storage, Inbox, Datenbank);
- die fünf Klassen als Farben;
- die Übergänge ① Freigabe, ② Fensterschluss und ③ Tisch-Abschluss als
  Pfeile;
- gestrichelt: Synthese und Ingest als abgeleitete Wege.

## 1. Was der Bestand schon regelt

Der Code folgt heute acht Regeln (Belege aus der Prüfung vom 23.09.). Die
Beteiligung erfindet keine neue Regel, sie ordnet sich ein.

| # | Regel im Bestand | Beleg |
|---|---|---|
| R1 | **Handgeschriebenes ist im Storage das Original**: Quelldateien, `BERICHT.md`, `_INDEX.md`. MongoDB hält davon nur abgeleitete, wegwerfbare Sichten | `docs/concepts/twin-datei-contract.md:31-35`, `agent-view-coverage-repo.ts:5-8` |
| R2 | **Maschinell Erzeugtes ist in MongoDB das Original** (Transkripte, Transformationen im Shadow Twin); das Storage hat einen lesbaren Spiegel | `shadow-twin-config.ts:5-9`, `shadow-twin-service.ts:331-350` |
| R3 | **Kein dauerndes Synchronisieren.** Der Rückweg Storage → MongoDB ist ein ausdrücklicher Lauf (Import, Reparatur; dazu der schmale Auto-Sync beim Öffnen) | `sync-plan/allowed-ops.ts:11-22`, `file-preview.tsx:1041-1052` |
| R4 | **Konflikte werden gemeldet, nie still überschrieben.** Erst der Inhalt, dann die Uhr (±5 s), sonst `conflict` | `plan-transformation-sync.ts:7-16` |
| R5 | **Suchindex und Meta sind abgeleitet und neu erzeugbar.** Ingest liest nur aus MongoDB und ersetzt je `fileId` | `ingestion-service.ts:147-148`, `ingest-mongo-only.md` |
| R6 | **Binärdaten liegen inhaltsadressiert im Blob**; im Frontmatter stehen nur Dateinamen | `media-lifecycle.md:9-13` |
| R7 | **Frontmatter schreibt nur der eine Serializer**; unbekannte Felder bleiben erhalten | `frontmatter-single-serializer.md` |
| R8 | **Nach der Promotion ist die Datei im Storage das Original einer Submission**; die Submission wird Protokoll, nichts schreibt zurück | `promotion.ts:157-182`, `submission-status.ts:47` |

Dazu drei Befunde, die für die Beteiligung zählen:

- **Storage-Ids sind nicht stabil.** Auf Nextcloud und im Dateisystem ist
  die Id der kodierte Pfad, Umbenennen ergibt eine neue Id (Werkzeugsatz
  2.30.5). Verweise zwischen Datenbank und Datei dürfen deshalb **nicht nur
  an der `fileId`** hängen. Sie brauchen eine stabile Kennung im
  Frontmatter.
- **Ein Frontmatter-Feld erreicht den Suchindex immer**: Alle Felder landen
  in `docMetaJson`. Als **Facette** (Galerie-Filter, Kontext für das
  Sprachmodell im Chat) wirkt es aber nur, wenn es in
  `config.chat.gallery.facets[]` steht, und zwar **vor** dem Ingest
  (`ingestion-service.ts:278-283`, `vector-builder.ts:53-76`,
  `chat/common/prompt.ts:88-116`).
- **Ein Quellenverweis im Chat trägt keine Metadaten**: `DocReference` hat
  nur `{number, fileId, fileName, description, detailViewType}`
  (`packages/contracts/src/doc-reference.ts:28-35`). „Quelle: Gemeinde X“
  unter einer Chat-Antwort braucht entweder ein neues Feld dort oder die
  Auflösung über `docMetaJson` in der Oberfläche.

## 2. Die Wahrheitsregel für die Beteiligung

Jedes Objekt gehört zu genau einer von fünf Klassen. Die Klasse sagt, wo
das Original liegt, welche Kopien es gibt, in welche Richtung kopiert wird
und wer bei einem Widerspruch gewinnt.

| Klasse | Original | Kopie | Richtung und Auslöser | Bei Widerspruch | Bestandsregel |
|---|---|---|---|---|---|
| **P · Planung** (was die Redaktion vorbereitet) | **Datei im Storage** (Steckbriefe mit flachem Frontmatter, Textstellen) | **Freigegebener Stand in MongoDB** (Snapshot für die Laufzeit) | Storage → MongoDB, nur beim ausdrücklichen **„Treffen freigeben“** bzw. „neu einlesen“; Muster: Import-Preset der Sync-Engine, Agentensicht-Scan | Der Import meldet Abweichungen (Plan zeigen, dann übernehmen). Solange ein Treffen läuft, ändert ein Datei-Edit **nichts** an der Laufzeit | R1, R3, R4 |
| **V · Verfahren** (was am Tag passiert) | **MongoDB** | optional ein lesbares Protokoll im Storage, gerendert, nie zurückgelesen (Muster `AKTUELL.md`) | MongoDB → Storage, beim Schließen oder auf Anforderung | Die Datenbank gewinnt immer; das Protokoll wird neu erzeugt | R2, R5 |
| **B · Beitrag** | **bis zum Fensterschluss: Inbox** (Submission + Blob); **danach: Datei im Storage** | danach: Submission als Protokoll; Anlagen-Transkripte als Shadow Twin der Anlagen | einmalig beim Fensterschluss (Promotion) | vor der Promotion: Inbox; danach: Datei. Ein Edit in der Datei ist gültig und wird **nicht** zurückgeschrieben | R8, R2 |
| **E · Ergebnis** | **Datei im Storage** (bestätigte bzw. freigegebene Fassung) | Suchindex; die Fassungskette in MongoDB ist der **Verlauf**, nicht das Original | MongoDB (Fassung) → Storage beim Tisch-Abschluss bzw. bei der Freigabe | Die Datei gewinnt; eine neue Fassung ist eine neue Datei, nichts wird überschrieben | R8, R5 |
| **A · Abgeleitet** | — (immer neu erzeugbar) | Suchindex, Facetten, berechnete Zustände („Einwand offen“, Historie, „wer fehlt“), der geflachte Sammeltext | aus den Originalen, bei Bedarf | neu erzeugen | R5 |

**Die Kurzform:** Was Menschen vorbereiten oder was bleibt, ist eine
Datei. Was während eines Vorgangs passiert, steht in der Datenbank. Die
Übergänge sind drei benannte Momente: **Freigabe** eines Treffens (Datei →
Datenbank), **Fensterschluss** (Beitrag → Datei), **Tisch-Abschluss** bzw.
**Redaktions-Freigabe** (Fassung → Datei).

**Stabile Kennungen:** Jede Planungsdatei trägt eine Kennung im
Frontmatter (`reihe_id`, `treffen_id`, `tisch_id`, `textstelle_id`,
`organisation_id`), jede Beitragsdatei `beitrag_id` (Submission-Id). Die
Datenbank verweist über diese Kennungen und merkt sich die `fileId` nur als
Zwischenspeicher. Ein Umzug oder Umbenennen bricht damit nichts.

## 3. Das Objektmodell

| Objekt | Klasse | Original | Kopie in MongoDB (Collection) | Kennung | Hängt an |
|---|---|---|---|---|---|
| **Reihe** (SHF 2026) | P | `Veranstaltungen/{Reihe}/_reihe.md` | `series` | `reihe_id` | — |
| **Handlungsfeld** | P | Abschnitt in `_reihe.md` (Liste) | in `series.fieldsOfAction[]` | `handlungsfeld_id` | Reihe |
| **Textstelle** (Thema: Vision, Vortext, Ziel, Indikator) | P | `Veranstaltungen/{Reihe}/Textstellen/{…}.md`, der Text ist der Ausgangstext | `text_passages` (Snapshot bei Freigabe; `validVersion` zeigt auf die gültige Ergebnis-Fassung) | `textstelle_id` | Handlungsfeld |
| **Organisation** | P | `Organisationen/{Name}/_organisation.md` (Name, Kürzel, Interessengruppe, Kontakt als Rolle) | `organisations` | `organisation_id` | — |
| **Interessengruppe** | P | Liste in `_reihe.md` oder eigene Datei `Stammdaten/Interessengruppen.md` | `series.interestGroups[]` | Kürzel | — |
| **Treffen** | P | `Veranstaltungen/{Reihe}/{Datum Treffen n}/_treffen.md` (Datum, Modus, Tischvereinbarung, Verfahren je Textstelle) | `meetings` (+ `state`, Klasse V) | `treffen_id` | Reihe |
| **Tisch** mit Plan | P | Abschnitt je Tisch in `_treffen.md`: Handlungsfeld, Gruppe, Textstellen in Reihenfolge, Agenda mit Zeiten und **Leitfragen**, „baut auf Gruppe …“ | `meeting_tables` (+ `run`, `windows[]`, Klasse V) | `tisch_id` | Treffen, Textstellen |
| **Rolle / Einladung** (Moderation, Fachbegleitung, Redaktion) | P | Abschnitt in `_treffen.md` (Rolle, Tisch; Personen per E-Mail) | `library_members` (Bestand) + `meeting_tables.moderators[]` | E-Mail | Treffen, Tisch |
| **Teilnahme** | V | MongoDB | `table_participations` | (Treffen, Tisch, E-Mail) | Tisch, Organisation |
| **Lauf, Fenster** | V | MongoDB | in `meeting_tables` | `windowId` | Tisch, Textstelle |
| **Beitrag** | B | Inbox → `Organisationen/{Org}/Beiträge/{Reihe}/{Treffen}/{…}.md` | `wizard_submissions` (Bestand, erweitert) | `beitrag_id` | Teilnahme, Fenster, Textstelle, Organisation |
| **Anlage** (Foto, PDF, Audio) | B | Inbox-Blob → Datei neben dem Beitrag | Anlagen-Zustand an der Submission; Transkript als Shadow Twin der Datei | Hash | Beitrag |
| **Sammelreferenz** | A* | `Veranstaltungen/…/{Treffen}/Tisch {n}/{Textstelle}.sammlung.md` (`kind: composite-transcript`) | — | — | Tisch, Textstelle |
| **Synthese-Fassung** | V | MongoDB | `syntheses` | (Tisch, Textstelle, `seq`) | Sammelreferenz |
| **Messung, Stellungnahme** | V | MongoDB | `measurements`, `assessments` | `measurementId` | Tisch, Textstelle, Fassung |
| **Ergebnis** | E | `Veranstaltungen/…/{Treffen}/Ergebnisse/{…}.md` | Suchindex | `ergebnis_id` | Fassung, Textstelle |
| **Organisations-Dokument** (Positionspapier, Unterlage) | Quelle (R1) | `Organisationen/{Org}/Dokumente/…` | Shadow Twin, Suchindex (Bestand) | Datei | Organisation |

\* Die Sammelreferenz ist eine Datei, aber sie ist erzeugt und wird bei
jedem Fensterschluss neu geschrieben. Sie ist kein Original, das jemand
von Hand pflegt.

**Was damit neu in MongoDB entsteht:** `series`, `text_passages`,
`organisations` (Snapshots der Klasse P), `meetings`, `meeting_tables`,
`table_participations`, `measurements`, `assessments`, `syntheses`
(Klasse V). `wizard_submissions` wächst.

## 4. Die Verzeichnisstruktur

```
<Library-Root>/
  Veranstaltungen/
    SHF 2026/
      _reihe.md                    Reihe, Handlungsfelder, Interessengruppen
      Textstellen/                 je Textstelle eine Datei (Ausgangstext)
      2026-11-13 Treffen 1/
        _treffen.md                Datum, Modus, Vereinbarung, Tische mit Plan, Rollen
        Tisch 2/                   Sammelreferenzen, Protokoll (gerendert)
        Ergebnisse/                bestätigte Fassungen, Vision der Gruppe 1
  Organisationen/
    Gemeinde X/
      _organisation.md             Steckbrief
      Dokumente/                   eigene Unterlagen der Organisation (beauskunftbar)
      Beiträge/SHF 2026/2026-11-13 Treffen 1/
    Einzelpersonen/                ausdrücklich konfiguriert, kein stiller Standard
```

Die Regeln aus dem Architektur-Konzept (Abschnitt 3.4) gelten weiter:
- Der Umzug einer Organisation in eine eigene Library ist das Verschieben
  ihres Ordners.
- Die Bezüge stehen flach im Frontmatter.
- Die Pfade sind Vorlagen in der Konfiguration.

Neu ist der Ordner `Dokumente/` je Organisation, und die Planung liegt in
den Steckbriefen.

## 5. Teilnehmende und die Library

| Tätigkeit | Was die Person tut | Was im Bestand schon trägt | Was kompatibel anzuschließen ist |
|---|---|---|---|
| **Beitragen** | spricht, tippt, hängt an | Composer-Bausteine, Inbox, Analyse-Jobs, Promotion | Pfadvorlage in den Organisationsordner; `organisation`, `gruppe`, `thema`, `tisch` flach ins Frontmatter |
| **Dokumente ablegen** (Organisation) | lädt Unterlagen hoch | Upload, Pipeline (Extract → Template → Ingest), Shadow Twin | wer darf in `Organisationen/{Org}/Dokumente/` schreiben (Rolle je Organisation, später ADR 0005); `organisation` im Frontmatter der Transformation |
| **Beauskunften** | stellt eine Frage, bekommt eine Antwort mit Quelle | Chat mit Quellen (`api/chat/[libraryId]/stream`), Retriever, Facetten | `contributor` im Chat-Loader zulassen; Sichtbarkeit: Textstellen, Ergebnisse und Organisations-Dokumente ja, Einzelbeiträge nach V1 nicht im Index |
| **Organisation als Quellenangabe** | sieht „Quelle: Gemeinde X, Positionspapier 2025“ | `docMetaJson` enthält jedes Frontmatter-Feld; Facetten gehen in Chunks und Chat-Kontext | Facette `organisation` in der Library-Konfiguration **vor dem ersten Ingest**; Quellenverweis im Chat um die Organisation erweitern (`DocReference`) oder in der Oberfläche aus `docMetaJson` auflösen |

## 6. Die Detailkonzepte

Jedes Detailkonzept hat dieselbe Gliederung:

1. Zweck und Screens (Kürzel aus „Screens erklärt“).
2. Objekte, die gelesen und geschrieben werden, mit Klasse (P/V/B/E/A).
3. Bestehende Komponenten und Schnittstellen, die genutzt werden
   (Datei:Zeile, Funktion, Route, Contract).
4. Neue Schnittstellen mit Signatur (Route, Funktion, Collection-Feld,
   Frontmatter-Feld).
5. Übergänge zwischen Original und Kopie und das Verhalten bei
   Widerspruch.
6. Fehlerfälle ohne stillen Fallback.
7. Tests.
8. Offene Fragen.

**Stand 23.09.:** D1–D11 sind geschrieben, siehe [`beteiligung/README.md`](beteiligung/README.md)
(Übersicht, Eingriffe in den Bestand, offene Entscheidungen, Bau-Reihenfolge).

| # | Detailkonzept | Kern | Wichtigste Bestandsschnittstellen |
|---|---|---|---|
| **D0** | Objektmodell, Original und Kopie (dieses Dokument) | Klassen, Kennungen, Struktur | alle |
| **[D1](beteiligung/d01-veranstaltung-aufsetzen.plan.md)** | Veranstaltung aufsetzen (Designzeit) | Steckbriefe `_reihe.md`, `_treffen.md`, Textstellen; Zerlegung des Grundsatzdokuments; „Treffen freigeben“ = Import mit Plan und Abweichungsbericht | Sync-Engine (`sync-plan/*`, Import-Preset), Agentensicht-Scan, `transformation_starten`, MCP-Brücke für die Pflege durch Cowork |
| **[D2](beteiligung/d02-organisationen-und-personen.plan.md)** | Organisationen und Personen | `_organisation.md`, Interessengruppen, Rollen und Einladungen je Tisch, Beitritt per Tisch-QR, Profil der Teilnahme | `library_members`, Einladungen, `member-invites/[token]/accept`, Middleware, Clerk |
| **[D3](beteiligung/d03-beitragen.plan.md)** | Beitragen | Composer, Anlagen, Job je Anlage, Foto → Text, Entwurf und Abgabe | `wizard_submissions`, `submission-analysis-job.ts`, `image-analyzer.ts`, `LiveDictationTextarea`, Flow-Entität (`resolveWizardFlow`) |
| **[D4](beteiligung/d04-tisch-laufzeit.plan.md)** | Tisch-Laufzeit | Lauf, Agenda, Timer, Fenster, Stille Runde, Anhalten | Polling über TanStack Query, `api-route-conventions.md` |
| **[D5](beteiligung/d05-fensterschluss-beitraege-werden-dateien.plan.md)** | Fensterschluss: Beiträge werden Dateien | Promotion in den Organisationsordner, Frontmatter, Anlagen, Wiederholung bei Storage-Fehlern, Widerruf und Herausnehmen | `promoteSubmission`, `copyOriginalsToTarget`, `mirrorInboxAssetsToTarget`, `publish-frontmatter.ts`, Serializer |
| **[D6](beteiligung/d06-verdichten.plan.md)** | Verdichten | Sammelreferenz, Vorlage, Transformation, Belegprüfung, Fassungskette | `buildCompositeReference`, `resolveCompositeTranscript`, Text-Job, `callTemplateTransform`, Muster Overlap-Bericht |
| **[D7](beteiligung/d07-messen.plan.md)** | Messen | Messung mit Passivlösung, Stellungnahmen, Auswertung, Beamer | — (neu), Konzept 13.09. |
| **[D8](beteiligung/d08-ergebnis-und-ingest.plan.md)** | Ergebnis veröffentlichen und Ingest mit Quellenangabe | Tisch-Abschluss, Redaktions-Freigabe, Ergebnis-Datei, Facetten, Quellenverweis | Promotion, `IngestionService`, `config.chat.gallery.facets`, `DocReference` |
| **[D9](beteiligung/d09-beauskunften.plan.md)** | Beauskunften | Chat für Teilnehmende und Moderation, was im Index ist und was nicht | Chat-Stream, `loader.ts`, Retriever, `publication-filter.ts` |
| **[D10](beteiligung/d10-naechstes-treffen-und-historie.plan.md)** | Nächstes Treffen und Historie je Gruppe | gültige Fassung je Textstelle, Folgegruppen (passt · passt nicht · ergänzen), Druck | `text_passages.validVersion`, Ergebnis-Dateien |
| **[D11](beteiligung/d11-rechte-und-sichtbarkeit.plan.md)** | Rechte und Sichtbarkeit | wer sieht was wann (V1–V3), Rolle je Tisch und Organisation | Mitglieder-Rollen, Chat-Loader, Middleware |

**Reihenfolge:** Zuerst **D1, D2, D5, D8**. Diese vier legen die Grenzen
zwischen Original und Kopie fest: Planung → Datenbank, Beitrag → Datei,
Ergebnis → Datei → Index. Danach D3, D4, D6, D7, dann D9–D11. Jedes
Detailkonzept wird abgenommen, bevor seine G-Scheibe gebaut wird.

## 7. Entscheidungen

| # | Frage | Empfehlung |
|---|---|---|
| E1 | **Entschieden (Owner 23.09.): „Datei zuerst“.** Wo wird die Planung gepflegt? Variante „Datei zuerst“: Steckbriefe und Textstellen im Storage (von Hand, in Obsidian oder durch Cowork über die Brücke), die App liest sie beim Freigeben ein. Variante „App zuerst“: Die Redaktion pflegt in der App, die Dateien sind nur exportierte Kopien | **Datei zuerst.** Das passt zur Regel R1 und zur heutigen Arbeitsweise (Archiv, Cowork) und braucht bis zur Redaktions-Oberfläche kein eigenes Werkzeug. Die spätere Redaktions-Oberfläche schreibt dieselben Dateien und liest sie wieder ein; es bleibt **ein** Original |
| E2 | **Entschieden (Owner 23.09.).** Ändert ein Datei-Edit ein laufendes Treffen? | Nein. Nur ein ausdrückliches „neu einlesen“ mit Abweichungsbericht, und das nur, solange das Treffen nicht läuft |
| E3 | **Entschieden (Owner 23.09.).** Stabile Kennungen im Frontmatter (`*_id`) statt `fileId` als Verweis | ja |
| E4 | **Entschieden (Owner 23.09.).** Facette `organisation` (und `gruppe`, `thema`) vor dem ersten Ingest konfigurieren | ja; in D8 festhalten |
| E5 | **Entschieden (Owner 23.09.): in D8/D9 zu klären.** Quellenverweis im Chat: `DocReference` um `organisation` erweitern oder in der Oberfläche auflösen | in D8/D9 entscheiden; Erweiterung ist ein Contract-Eingriff in `@ks/contracts` |
| E6 | **Entschieden (Owner 23.09.).** Wer darf in `Organisationen/{Org}/Dokumente/` ablegen? | vorerst die Redaktion für die Organisation; eigene Konten je Organisation mit ADR 0005 |

## Verweise

- Kernflüsse, Speicherweg B, Bau-Reihenfolge: [`shf-grundlagen-datenhaltung-kernflows.plan.md`](shf-grundlagen-datenhaltung-kernflows.plan.md)
- Screens und Abnahme: [`shf-umsetzung-wellen.plan.md`](shf-umsetzung-wellen.plan.md)
- Verzeichnisstruktur (Owner 12.09.): [`erfassungs-architektur-stationen-datenhaltung.plan.md`](erfassungs-architektur-stationen-datenhaltung.plan.md), Abschnitt 3.4
- Bestandsregeln: `docs/concepts/twin-datei-contract.md`, `docs/contracts/shadow-twin-architecture.md`, `shadow-twin-contracts.md`, `media-lifecycle.md`, `ingest-mongo-only.md`, `frontmatter-single-serializer.md`
- Figma-Landkarte (intern): https://www.figma.com/design/lq5lUzASBUkhDfjd7XeTqt
