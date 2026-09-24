# Beteiligung: Detailkonzepte D1–D11

Konzeptphase vor jedem Code (Owner 23.09.2026). Grundlage aller
Detailkonzepte ist **D0**
[`../beteiligung-objektmodell-original-und-kopie.plan.md`](../beteiligung-objektmodell-original-und-kopie.plan.md):
fünf Klassen (Planung · Verfahren · Beitrag · Ergebnis · abgeleitet), drei
Übergänge (① Treffen freigeben, ② Fensterschluss, ③ Tisch-Abschluss bzw.
Redaktions-Freigabe), stabile Kennungen, Entscheidungen E1–E6.
Alle Konzepte sind geprüft gegen `master` 579f2d7 (v1.2.262).

| # | Detailkonzept | Kern | PT (Fundament) |
|---|---|---|---|
| D1 | [Veranstaltung aufsetzen](d01-veranstaltung-aufsetzen.plan.md) | Planungsdateien, Prüfen und Freigeben als Snapshot | 4–5 |
| D2 | [Organisationen und Personen](d02-organisationen-und-personen.plan.md) | Organisationsordner, Einladungen, Tisch-QR, Teilnahme | 4–4,5 |
| D3 | [Beitragen](d03-beitragen.plan.md) | Composer in die Inbox, Anlagen, Job je Anlage | 4,5–5,5 |
| D4 | [Tisch-Laufzeit](d04-tisch-laufzeit.plan.md) | Lauf, Fenster, Stille Runde, Polling mit Serverzeit | 2,5–3,5 |
| D5 | [Fensterschluss: Beiträge werden Dateien](d05-fensterschluss-beitraege-werden-dateien.plan.md) | Stapel-Promotion ohne Index | 2,5–3,5 |
| D6 | [Verdichten](d06-verdichten.plan.md) | Sammelreferenz, Vorlage mit Belegen, Belegprüfung, Fassungskette | 3,5–5,5 |
| D7 | [Messen](d07-messen.plan.md) | Messung als Objekt, Auswertung, Abbruchhinweis | 3 |
| D8 | [Ergebnis und Ingest](d08-ergebnis-und-ingest.plan.md) | Tisch-Abschluss, Redaktions-Freigabe, Facetten, Quellenangabe | 3–3,5 |
| D9 | [Beauskunften](d09-beauskunften.plan.md) | Chat für Teilnehmende, Eingrenzung aufs Thema | 2,5–3 |
| D10 | [Nächstes Treffen und Historie](d10-naechstes-treffen-und-historie.plan.md) | gültige Fassung, Vision, Folgegruppen, Druck | 3,5–4 |
| D11 | [Rechte und Sichtbarkeit](d11-rechte-und-sichtbarkeit.plan.md) | Rollen über den Library-Rollen, Stille Runde, V1–V3 | 2–2,5 |
| | **Summe** | | **35–43,5** |

**Einordnung des Aufwands:** Der Grundlagen-Plan
([`../shf-grundlagen-datenhaltung-kernflows.plan.md`](../shf-grundlagen-datenhaltung-kernflows.plan.md))
schätzte das Fundament auf 15,5–22,5 PT. Die Detailkonzepte decken mehr
ab:
- Planung in Dateien mit Prüfen und Freigeben (D1);
- Organisationen mit Ordnern und vorläufigen Organisationen (D2);
- Beauskunften (D9);
- Vision und Folgegruppen (D10);
- das Gerüst der Moderations- und Beamer-Seiten.

Die Zahl der Detailkonzepte ist deshalb die belastbarere. Die
Oberflächen der Teilnehmenden, der Moderation und der Redaktion kommen
**zusätzlich** (Wellen-Plan, Abnahme an Figma), geschätzt auf 15–20 PT,
weil die Logik dann steht.

## Abhängigkeiten

```
D11 Rechte ──────────────────────────────┐ (gilt für alle Routen)
D1 Veranstaltung ──► D2 Organisationen, Personen ──► D3 Beitragen ──► D5 Fensterschluss ──► D6 Verdichten ──► D8 Ergebnis ──► D10 Nächstes Treffen
        └──────────► D4 Tisch-Laufzeit ─────────┘            ▲                     └──► D7 Messen ──┘
                                                              └─ D4 close_window
D8 Facetten ──► D9 Beauskunften
```

## Eingriffe in den Bestand (an einer Stelle)

Hier liegt das Risiko. Jeder Eingriff bekommt vorher einen Freeze-Test,
und ohne die neue Option bleibt das heutige Verhalten.

| Eingriff | Ort | Konzept | Contract |
|---|---|---|---|
| `promoteSubmission(… , { ingest: false })` | `src/lib/submissions/promotion.ts:122` | D5 | ADR 0004 |
| `enqueueSourceMarkdownJob({… , ingest: false})` | `src/lib/external-jobs/enqueue-markdown-job.ts:89` | D6 | `contracts-story-pipeline` |
| Bildweg (und PDF-Weg) der Start-Route nutzen `resolveJobLibrary` wie die Callback-Route | `src/app/api/external/jobs/[jobId]/start/route.ts:1343`, `:1651`, `:552`, `:755` | D3 | `contracts-pipeline` |
| Job je Anlage (`attachmentId`), Rückfluss nur in die Anlage | `submission-analysis-job.ts`, `finalize-completion.ts:59` | D3 | `contracts-pipeline` |
| Versionsschutz beim Aktualisieren von Submissions | `wizard-submissions-repo.ts:102`, `:133` | D3 | — |
| Namensbildung der Anlagen-Kopie (Kurz-Id gegen Kollision) | `promotion-transcript.ts:46` | D5 | `media-lifecycle` |
| Strikte Rollenprüfung in `isModeratorOrOwner`, `isCoCreatorOrOwner`, `resolveCaptureRole`, Provider-Fallback, `canSeeDrafts`, Chat-Loader (heute lässt `getLibrary` jedes Mitglied durch) | `library-service.ts:193-248` und Aufrufer | Prüfbericht §1 | **sicherheitsrelevant, Owner-Freigabe (O10)** |
| Erfassen für `moderator` im Kontext der Beteiligung | `submission-capture.ts:34-42` | D11 | — |
| Chat für Mitglieder mit `chat.allowMemberRoles` | `src/lib/chat/loader.ts:262` | D9 | `contracts-ingestion-chat` |
| `DocReference.sourceLabel?`, Einstellung `chat.referenceLabelKeys` | `packages/contracts/src/doc-reference.ts:28`, `orchestrator.ts:477-510` | D8 | `library-config-field` |
| Ausschluss-Filter `not_<metaKey>` (nur bei V2/V3) | `src/lib/chat/common/filters.ts:105` | D9 | `contracts-ingestion-chat` |
| Protokoll-Kanal `'app'` | `aktions-protokoll-repo.ts:50` | D11 | — |
| Selbstbeitritt `joinAsContributor` | `library-members-repo.ts` | D2 | **sicherheitsrelevant, Owner-Freigabe** |
| Öffentliche Route `/t(.*)` | `src/middleware.ts:39-56` | D2 | — |
| Geteilter Tabellen-Parser, Ordner-Helfer | neu in `src/lib/markdown/`, `src/lib/storage/` | D1, D5 | — |
| Beamer-Layout ohne App-Rahmen | `src/app/beamer/**` | D4 | `contracts-ui` |

## Gesammelte offene Entscheidungen

| # | Frage | Wo | Vorschlag |
|---|---|---|---|
| O1 | **Vertrauensraum V1–V3** | D11 5.3 | V1 bis zur Klärung; vor dem ersten echten Beitrag festlegen. Owner 24.09.: bewusst noch offen; muss vor der Umsetzung der Rechte (D11) stehen, weil Tischvereinbarung und Zusage an die Teilnehmenden davon abhängen |
| O2 | **Selbstbeitritt per Tisch-QR freigeben** | D2 5.2, D11 | ja, mit Ablauf, Erneuern, Protokoll |
| O3 | Welches A am 13.11. (Text mit 3–5 Formulierungen oder Ernte mit Verdichtung) | D7 9, D6 9 | mit der Redaktion klären; das Modell trägt beides |
| O4 | Schwelle für lange Anlagen im Beitrag | D5 4 | 12.000 Zeichen |
| O5 | Mindestgruppengröße der Auswertung | D7 4 | 3 |
| O6 | Chat-Verläufe am Tisch speichern? | D9 9 | für den Vertrauensraum klären |
| O7 | Mehrsprachigkeit DE/IT der Textstellen | D1 10 | offen, Entscheidung des Auftraggebers |
| O8 | Ergebnis vor der Freigabe im Storage redigieren | D8 9 | ja, an der Entwurfsdatei (Datei zuerst) |
| O9 | Redaktion als eigene Library-Rolle | D11 8 | nein; `co-creator` + `series.editors` |
| O10 | **`getLibrary` lässt jedes Mitglied durch; sechs Helfer nutzen es als Owner-Prüfung** | Prüfbericht §1 | beheben, eigener PR mit Test, vor Stufe 1 |
| O11 | **Sichtbarkeit am Tisch:** Stille Runde fest oder Schalter je Treffen | Prüfbericht A3 | Schalter, Voreinstellung still; Konfiguration ins Ergebnis |
| O12 | **Promotion-Zeitpunkt:** Fensterschluss oder Tisch-Abschluss | Prüfbericht W3/W4, O12 | Tisch-Abschluss; Weg B bleibt |
| O13 | Vorschlag einsprechen als Hauptweg, KI-Synthese als Zweitweg | Prüfbericht A1 | ja |
| O14 | Rolle Verwaltungsbegleitung, Sichtbarkeit je Planungsdokument | Prüfbericht A4 | ja |
| O15 | Fensterschluss mit Owner-Credentials | Prüfbericht W12 | nein, eigene Rolle nach O10 |
| O16 | Identitätsmodell `attribution.kind`, Proxy mit E-Mail, Moderations-Anhebung | Prüfbericht W1/W2/W11 | wie vorgeschlagen |
| O17 | **Fortbestehender Einwand nach Runde 2** | D7 9.3 | Moderation wählt: Runde 3, vertagen oder Dissens festhalten (A5) |
| O18 | **Eingrenzung des Chats auf das Handlungsfeld** starr oder umschaltbar | D9 9 | Voreinstellung mit sichtbarem Umschalter |
| O19 | **„Passt nicht“ bei Folgegruppen** | D10 9 | Begründung Pflicht, Einwand-Beitrag, dann normaler Lauf |
| O20 | Grenze zwischen redaktioneller und inhaltlicher Änderung vor der Freigabe (D8) | Prüfbericht §7 | redaktionell = Rechtschreibung, Form, Verweise; jede Sinnänderung ist eine neue Fassung mit Tisch-Bestätigung (D8 9.3). Als Einwand bestätigt (Owner 24.09.), Entscheidung offen |

## Bau-Reihenfolge

**Stand 24.09.:** Der Owner hat die Lesefassung durchgesehen; seine
Einwände stehen im Prüfbericht §7 (D1: Prüfen entfällt, entschieden;
O17–O20 offen). Die Konzepte wurden geprüft
([`pruefbericht-2026-09-24.md`](pruefbericht-2026-09-24.md)). Vor Stufe 1
stehen die Entscheidungen O10–O16, die Überarbeitung nach Prüfbericht
§6.2 (zuerst der Feldkatalog, dann D1, dann D3/D5/D6 gemeinsam) und zwei
Spikes (§6.3). Die Aufwandszahlen unten und in den Konzepten gelten bis
dahin nicht.

Jede Stufe ist eine PR-Folge mit Tests. Gebaut wird erst, wenn das
Detailkonzept abgenommen ist:

1. **D11-Kern** (`resolveDeliberationRole`, Protokoll-Kanal) und
   **D1** (Planung, Freigabe). Ergebnis: Ein Probe-Treffen aus Dateien
   steht in der Datenbank.
2. **D2** (Organisationen, Beitritt, Teilnahme) und **D4**
   (Laufzeit). Ergebnis: Man kann an einen Tisch kommen und eine Runde
   steuern.
3. **D3** (Beitragen) und **D5** (Fensterschluss). Ergebnis: Beiträge
   liegen als Dateien im Organisationsordner.
4. **D6** (Verdichten) und **D7** (Messen). Ergebnis: Vorschlag mit
   Belegen, Einwandverfahren A.
5. **D8** (Ergebnis, Ingest), **D9** (Beauskunften) und **D10**
   (Nächstes Treffen).

Die Oberflächen (Wellen-Plan) können ab Stufe 2 parallel beginnen.
