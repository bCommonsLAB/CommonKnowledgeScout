---
name: shf-umsetzung-wellen
overview: "Umsetzungsplan für das SHF in drei Wellen: Welle 1 (Zugang am 05.10., ein Teil live), Welle 2 (Einwandverfahren A, Synthese, Tisch-Abschluss, Vertretung), Welle 3 (Redaktion, Vision, Folgegruppen, Nachschlagen). Je Welle Einstufung am Code belegt, PT, PR-Schnitt in Tagesscheiben, Abnahme an den Figma-Screens der Designstudie, blockierende Entscheidungen. Handover von Cowork vom 23.09.2026; geprüft gegen master 579f2d7 (v1.2.262)."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# SHF-Umsetzung in drei Wellen

> **Nachtrag 23.09. (Owner):** Die Reihenfolge dieses Plans gilt nicht mehr.
> Gebaut wird zuerst die Grundlage, also Datenhaltung und Kernflüsse
> (G0–G8 in
> [`shf-grundlagen-datenhaltung-kernflows.plan.md`](shf-grundlagen-datenhaltung-kernflows.plan.md)),
> danach die Oberflächen. Der 05.10. ist kein Schnittkriterium; zur Not wird
> dort das Klickmodell gezeigt. Dieser Plan bleibt gültig als Liste der
> Screens, ihrer Einstufung und der Abnahme an Figma (Abschnitte 1, 3–5)
> und für die offenen Punkte mit Varianten (Abschnitt 4).

**Stand:** 2026-09-23, geprüft gegen `master` 579f2d7 (v1.2.262).
**Auftrag:** Handover von Cowork vom 23.09. (Archiv, `24.09 KnowledgeScout`).
Die Spezifikation ist „Anwendungsflows SHF – Screens erklärt“ (21.09.), die
Designstudie liegt in der Figma-Datei „KnowledgeScout — SHF Layout“
(`siGqtrwvbsKb1Er1lkuynA`). Der Plan löst den Implementierungsteil aus
[`erfassungs-architektur-stationen-datenhaltung.plan.md`](erfassungs-architektur-stationen-datenhaltung.plan.md)
(Abschnitt 5, Wellen E0–E7) und die Scheiben aus
[`erfassungs-composer-s4-s5.plan.md`](erfassungs-composer-s4-s5.plan.md)
(C0–C10) für das SHF ab. Beide Konzepte bleiben gültig, ihre Reihenfolge
nicht: Sie waren auf 20 Teilnehmenden-Screens mit Einwilligungsleiter
geschnitten. Seit 21.09. gibt es vier Rollen, die Zuordnung passiert zur
Laufzeit, und der Composer ist ein einziger Screen.

**Leitplanken:** ADR 0003 (die Flow-Entität ist die Naht), ADR 0004 (nie
direkt ins Ziel schreiben), ADR 0006 (Widerstand zählen, Werkbank bleibt
Werkbank). Außerdem keine stillen Fallbacks und Storage nur über den
Provider. Das Frontmatter bleibt flach. Nicht angefasst werden `events/*`,
die Varianten B/C und O3. Entwicklernotizen gehören nicht auf Screens.

**Öffentliches Repo:** Personen erscheinen hier als Rolle (Redaktion,
Moderation, Fachbegleitung, Verfahrensverantwortung). Inhalte des
Grundsatzdokuments stehen nicht im Repo. Sie liegen in der Library und
kommen per Seed dorthin, nicht in den Code.

## 0. Das Ergebnis in acht Sätzen

1. Welle 1 in vollem Umfang, also mit Moderation, kostet **11,5–17 PT**.
   Bis zum 05.10. sind es sieben Arbeitstage, und der Vortrag am 30.09.
   liegt dazwischen. Die Zusage „alles aus Welle 1 live“ hält nicht.
2. **Empfehlung (Owner-Regel aus dem Handover):** Am 05.10. läuft der Weg
   der Teilnehmenden live, mit **7–10 PT** (Mindestschnitt 5,5–6,5 PT): Tisch-QR, Code, Platz,
   Tischvereinbarung, Composer, Beigetragen, Meine Beiträge. Die Moderation
   ist am 05.10. Klickmodell und geht bis 09.10. live (Welle 1b).
3. Der Composer ist billiger als am 11.09. geschätzt. „Sprechen ins
   Textfeld, dort korrigieren“ gibt es schon als `LiveDictationTextarea`,
   und der Composer ist seit 19.09. ein einziger Screen ohne Prüfschritt.
4. Das eigentliche Neuland in Welle 1 ist die **Tisch-Laufzeit**: Treffen,
   Tisch, Thema, Agenda, Timer und Ernte-Fenster als Zustand am Server,
   den Moderation und Teilnehmende teilen. Keine der Analysen vom 11./12.09.
   hatte das, weil Zuordnung und Runde damals Konfiguration waren.
5. Welle 2 (**17,5–25,5 PT**) passt nicht zwischen den 05.10. und den Freeze
   am 09.10. Das ist die dringendste Entscheidung (W2-E1, Abschnitt 6).
6. Die Messung wird als eigenes Objekt gebaut (Konzept 13.09.). A ist B mit
   einer Option, die Passivlösung steckt immer im Modell. Die Mehrkosten
   gegenüber „ein Feld am Vorschlag“ sind klein, Rückbaukosten entfallen.
7. Welle 3 (**14,5–20 PT**) ist überwiegend Oberfläche über Daten, die
   Welle 1 und 2 schon anlegen. Die Redaktion ist eine Konfigurations-
   oberfläche über Seeds, die bis dahin per Skript laufen.
8. Summe **44–63 PT** für 24.09. bis 13.11. (rund 36 Arbeitstage). Das
   trägt nur, wenn Welle 1 die Tisch-Laufzeit richtig anlegt; alles
   Spätere hängt daran.

## 1. Was am Code seit dem 11./12.09. gilt (Prüfung gegen master)

Seit #279 hat sich im Erfassungscode nichts geändert (`git diff 6d19133..HEAD`
auf `src/lib/submissions`, `src/components/creation-wizard`,
`src/app/api/submissions`, `src/middleware.ts` und den Mitgliedern: leer).
Die Zwischen-PRs #282–#294 betreffen Galerie, Sammel-Markdowns, MCP-Brücke
und Pipeline. Die Einstufungen der Analysen bestätigen sich. Einige Belege
waren falsch, und einiges ist neu hinzugekommen:

| Befund | Beleg | Wirkung auf den Plan |
|---|---|---|
| **Neu:** Live-Diktat ins Textfeld gibt es als Komponente | `src/components/shared/dictation-textarea.tsx:22-40` (`mode="live"` → `LiveDictationTextarea`); einziger Nutzer `collect-source-step.tsx:1071` | Der Composer (E-S4.1, T-S4.1) wird **erweitert**, nicht neu gebaut: statt 8–12 PT jetzt 2–2,5 PT für den Kern |
| Die Submission trägt ein Ergebnis und `binaryRefs` ohne Zustand, es gibt kein `attachments` | `src/types/wizard-submission.ts:44-61`, `:119-125` | Welle 1 kommt mit `binaryRefs` aus (Foto und Anlage liegen bei). Das Anlagen-Modell C1/C2 mit Zustand je Anlage kommt erst mit T-S4.2 in Welle 2 |
| Die Erfassung legt immer `pending` an | `submission-capture.ts:151` | „Später weiterschreiben“ braucht `draft` als Initialstatus (erlaubt nach `submission-status.ts:41-44`) |
| **Abweichend:** `resolveWizardFlow` hat keinen Aufrufer | `src/lib/creation/wizard-flow-entity.ts:120-127` | Die Flow-Entität ist heute Modell, nicht Laufzeit. Welle 1 baut den SHF-Composer als festen Ablauf, verdrahtet wird in Welle 3 (C8). ADR 0003 ist *vorgeschlagen*, nicht aktiv; die Abweichung steht in W1-E6 |
| `publish` fehlt in der Registry, `creation-wizard.tsx` hat 3.302 Zeilen | `engine/step-registry.tsx:34-46`, `creation-wizard.tsx:2454` | Nicht auf dem kritischen Pfad; C8 wandert nach Welle 3 |
| **Abweichend:** Bilder sind in Submissions nicht auswertbar | `submission-media.ts:22`, `:39-48` (nur PDF und Audio); der Hilfetext verspricht „Bild“ (`wizard-flow-entity.ts:76`) | Foto → Text muss verdrahtet werden. Bild-OCR/Vision gibt es anderswo: `src/lib/secretary/image-analyzer.ts`, `job_type === 'image'` in `external-jobs/start/route.ts:1343` |
| „Meine Beiträge“ existiert, aber ohne Link in der Navigation | `src/app/library/my-submissions/my-submissions-client.tsx` (178 Z.), `GET /api/submissions?mine=true` (`route.ts:148-163`) | **konfigurieren + erweitern**: Filter nach Tisch, mobile Darstellung, Zustände |
| Die Inbox lädt ungefiltert und ruft nie `promote` | `src/app/library/inbox/inbox-client.tsx:50`; der Ablehnungsgrund ist optional (`submission-review-panel.tsx:73-85`) | „Beiträge am Tisch“ ist eine neue, gefilterte Sicht. Die Veröffentlichung ins Storage geschieht erst beim Tisch-Abschluss (ADR 0004) |
| Rollen `owner \| moderator \| co-creator \| contributor`, Status `pending \| active \| declined`; zwei Einladungssysteme (Mitglied, Lesezugang) ohne Ablauf und ohne Kontext | `src/types/library-members.ts:21`, `:24`, `:31-67`; `src/types/library-access.ts:16-52` | Der Tisch-QR ist ein **dritter** Weg: Selbstbeitritt als `contributor` beim Scan. Das ist sicherheitsrelevant und steht deshalb in W1-E3 |
| Kein Profil am Mitglied (Organisation, Interessengruppe) | `library-members.ts:31-67` | Das Profil gehört an die **Tisch-Teilnahme**, nicht an die Mitgliedschaft (Zuordnung je Treffen) |
| Anmeldung ist ein nacktes `<SignIn />`; ob der E-Mail-Code aktiv ist, entscheidet das Clerk-Dashboard | `src/app/sign-in/[[...sign-in]]/page.tsx`; kein `emailCode` im Code | Keine Code-Arbeit, aber eine Dashboard-Einstellung, die **alle** Libraries betrifft (W1-E2) |
| Öffentliche Routen | `src/middleware.ts:39-56` | `/t(.*)` für die QR-Landeseite kommt neu dazu, die Aktion selbst verlangt eine Session |
| Das Testimonial-QR (`react-qr-code`) ist nur in der Session-Ansicht, der Gast-Weg schreibt direkt ins Storage | `session-detail.tsx:681`, `api/public/testimonials/route.ts:241-254` | Der QR-Druck ist wiederverwendbar (**konfigurieren**). Der Gast-Weg ist nicht das Muster für das SHF (ADR 0004, Anmeldung Pflicht) |
| Echtzeit nur als SSE an der Session, Bus prozesslokal | `api/external/jobs/stream/route.ts:13-14`, `src/lib/events/job-event-bus.ts:62-67` | Tisch-Zustand per **Polling** (TanStack `refetchInterval`, 2–5 s), kein SSE. Das ist robust im Messe-WLAN und läuft mit mehreren Instanzen |
| Chat mit Quellen läuft auch anonym für öffentliche Libraries; `contributor` fehlt im Loader | `api/chat/[libraryId]/stream/route.ts:156`, `src/lib/chat/loader.ts:~297-328` | Nachschlagen (T-S9.1) braucht eine Loader-Freigabe für Contributors (Welle 3) |
| Sammel-Transformation über mehrere Quellen mit `<source file index>`-Blöcken existiert | `src/lib/creation/composite-transcript.ts:719-803`; MCP `transformation_starten` (`tools-erschliessen.ts:148-160`) | Die **Synthese mit Belegspur ist Vorlage + Verdrahtung**, kein Neubau (Welle 2) |
| Kein `requestFullscreen`, keine Präsentationsroute | — | Die Beamer-Ansicht ist neu, aber klein |
| Theme: shadcn mit CSS-Variablen in `src/styles/globals.css:6-34`, UI in `packages/ui` (`@ks/ui`); keine Code-Connect-Dateien, kein PWA-Manifest | `components.json`, `tailwind.config.ts` | Die Figma-Variablen kommen als eigener CSS-Variablen-Satz dazu (Abschnitt 5). Code Connect ist ein Planvorbehalt (W3-E5) |
| Kein Messmodell, keine Fenster, keine Runden, keine `consents` | grep `assessment`, `Einwand`, `consents`: 0 Treffer | Welle 2 ist in S6 wirklich **neu** |
| Per-Library-Konfiguration hat `captureWizards` (Kuratierung der Erfassungs-Wizards), kein `capture`, kein `konsens` | `src/types/library.ts:239` | `capture.*` aus dem Architektur-Konzept kommt als **Seed am Treffen**, nicht als Library-Feld. Das spart das Settings-Formular in Welle 1 (Begründung 2.2) |

## 2. Das tragende Stück: die Tisch-Laufzeit

### 2.1 Warum ein eigenes Objekt

Seit 21.09. entsteht die Zuordnung zur Laufzeit. Der QR trägt Tisch und
Handlungsfeld, die Moderation steuert die Runde nach Agenda mit Timer,
das Ernte-Fenster öffnet und schließt, und alles muss **unterbrechbar**
sein (Entscheidung 10). Dafür reicht weder die Mitgliedschaft (sie gilt
je Library und nicht je Treffen) noch die Submission (sie ist ein Beitrag
und keine Runde). Die Analysen vom 11./12.09. legten Tisch und Kontext als
Token-Attribut ab. Das trägt nicht mehr, sobald die Moderation Zustand
setzt, den Teilnehmende sehen.

### 2.2 Modell (MongoDB, Verfahren; nichts davon ins Frontmatter)

```
treffen        (libraryId, treffenId, titel, datum, modus: praesenz|online|zwischenraum,
                reihe, zustand: vorbereitet|laeuft|angehalten|beendet,
                vereinbarung[] (die vier Sätze als Text), einstellungen {kuratierung: notbremse, …})
tische         (treffenId, tischId, nummer, handlungsfeld, gruppe (1, 2, … je Handlungsfeld),
                qrToken, qrGueltigBis, moderation[] (E-Mail), themen[] (fileIds, Reihenfolge),
                agenda[] {punkt, art: ankommen|vision|besprechen|ernte|messung|abschluss, dauerSek, themaId?},
                lauf {punktIndex, gestartetAm, verlaengertSek, angehaltenAm?},
                fenster[] {fensterId, art: ernte|messung, themaId, offenVon, offenBis?, geschlossenAm?})
teilnahmen     (treffenId, tischId, userEmail, angekommenAm, anzeigename, organisation, gruppe,
                vereinbarungGelesenAm, rolle: teilnehmend|moderation|fachbegleitung)
```

- Die **Themen sind Dokumente** in der Library (`docType: thema`) mit den
  flachen Feldern `handlungsfeld`, `abschnitt_art: vision|vortext|ziel|indikator`,
  `kapitel`, `reihenfolge`. Das ist Entscheidung 7, Textstelle für
  Textstelle. Der Text kommt per Seed aus dem Grundsatzdokument in die
  Library, nicht ins Repo.
- Die **Submission bekommt den Kontext flach**: `kontext.treffenId`,
  `kontext.tischId`, `kontext.themaId`, `kontext.fensterId`, dazu
  `attribution {anzeigename, organisation, gruppe, erfasstVon?, kanal?}`.
  Beides ist Verfahren und bleibt in MongoDB. Ins Frontmatter kommt bei
  der Promotion nur die Zuschreibungsstufe (Gruppe), siehe V1–V3.
- Die Einstellungen `capture.*` und `konsens.*` werden in Welle 1 und 2
  als **Seed am Treffen** gehalten, nicht als Library-Feld. Grund: Die
  Redaktion stellt sie ohnehin je Treffen ein (R-S0.3), und das
  Settings-Formular nach `library-config-field.md` kostet 1–1,5 PT, die bis
  Welle 3 niemand braucht. In Welle 3 entscheidet sich, ob Library-Vorgaben
  dazukommen.
- **Unterbrechbar:** Jeder Zustand steht am Server (`lauf`, `fenster`,
  `treffen.zustand`). Ein Neuladen, ein Gerätewechsel der Moderation oder
  eine Pause über Nacht verlieren nichts.
- **Stille Runde (Entscheidung 4)** ist eine Server-Regel und keine
  UI-Regel. Solange ein Ernte-Fenster offen ist, liefert die API der
  Moderation für dieses Thema nur `{userEmail, anzeigename, abgegebenAm}`,
  den Teilnehmenden nur den eigenen Beitrag. Der Test prüft die
  API-Antwort, nicht das Rendern.

Ablage im Code: `src/lib/tisch/**` (Typen, Repos nach
`mongodb-repository-pattern.md`, reine Zustandsfunktionen), Routen unter
`src/app/api/tisch/**`, Seiten unter `src/app/t/[token]` (Teilnehmende)
und `src/app/moderation/[tischId]`. Kein neues Paket in Welle 1. Wenn
Welle 3 die Redaktion baut, wandert das Ganze nach `@ks/module-tisch`
(ADR 0007). Vorschlag: ein **ADR 0011 „Tisch-Laufzeit und Messung als
Objekt“** mit Welle 1 anlegen (Status vorgeschlagen), damit die Naht vor
Welle 2 feststeht.

## 3. Die Wellen

Einstufung nach dem Raster der Analysen: **konfigurieren** (Seed, Schalter),
**erweitern** (Bestand wächst), **portieren**, **neu**. PT ohne Puffer.
Jede Scheibe ist eine PR von etwa einem Tag, für sich lauffähig, mit
`pnpm test`, `pnpm lint` und dem vollständigen `tsc`-Vergleich aus
`AGENTS.md`. Vor dem Merge einer Welle läuft `pnpm build` lokal.

### Welle 1 · Zugang am 05.10. (1a live) und Moderation bis 09.10. (1b)

**1a · Teilnehmende live am 05.10.** Pflichtweg:
T-S1.1 → T-S1.1b → T-S2.1 → T-S2.2 → T-S4.1 → T-S5.2 → T-S11.1, dazu die
Schnell-Fassung E-S4.1 → E-S5.2 als Modus desselben Composers.

| # | Stück | Screens | Einstufung (Beleg) | PT |
|---|---|---|---|---|
| 1a.1 | Treffen/Tisch/Teilnahme als Modell und Repo, Seed-Skript für ein Probe-Treffen mit Themen als `docType: thema` | — | **neu** (Abschnitt 2) | 1–1,5 |
| 1a.2 | QR-Landeseite `/t/[token]` (öffentlich), Clerk-Anmeldung mit E-Mail-Code, Rückkehr, Selbstbeitritt als `contributor` und Teilnahme `angekommen`, QR-Druck mit `react-qr-code` | T-S1.1, T-S1.1b | **erweitern** (`middleware.ts:39-56`, `library-members-repo.ts`, `session-detail.tsx:681`) | 1,5–2 |
| 1a.3 | Ihr Platz am Tisch (Name, Organisation, Gruppe als Chips; Tisch nur Anzeige), Tischvereinbarung mit „Verstanden“ | T-S2.1, T-S2.2 | **neu** (klein; `teilnahmen`) | 0,5–1 |
| 1a.4 | Composer: Leitfrage, Sprechknopf, Textfeld mit Live-Mitschrift, Foto, Anlage; „Beitragen“ und „Später weiterschreiben“ (`draft`); Schnell-Modus ohne Foto/Anlage | T-S4.1, E-S4.1 | **erweitern** (`dictation-textarea.tsx:22-40`, `POST /api/submissions` mit `binaryRefs`, `status: draft`) | 2–2,5 |
| 1a.5 | Beigetragen, Meine Beiträge je Tisch mit Zustand | T-S5.2, E-S5.2, T-S11.1 | **konfigurieren + erweitern** (`my-submissions-client.tsx`, `?mine=true`) | 0,5–1 |
| 1a.6 | SHF-Schale (Kopf, Stationsanzeige, Knopf, Hinweisbox, Karte, Status-Chip, Sprechknopf, Personenzeile) mit Tokens aus Figma | alle | **neu** (Abschnitt 5) | 1–1,5 |
| 1a.7 | Handy-Test (iOS Safari, Android Chrome), Deploy, Zugang für die Redaktion einrichten | — | — | 0,5 |
| | **Summe 1a** | | | **7–10** |

Mindestschnitt für den 05.10., falls es eng wird (**5,5–6,5 PT**): 1a.1 nur
Seed ohne Moderationsfelder, 1a.3 ohne Gruppen-Chips, 1a.4 ohne Anlage, nur
Foto; 1a.6 ohne Personenzeile und Umschalter; das Foto liegt bei und wird noch
nicht ausgewertet. Der Composer sagt das dann offen („Foto liegt bei, Text
daraus folgt“), kein stilles Weglassen. Die Foto-Auswertung (1b.5) folgt
bis 09.10.

**1b · Moderation live bis 09.10.**

| # | Stück | Screens | Einstufung (Beleg) | PT |
|---|---|---|---|---|
| 1b.1 | Mein Tisch heute (wer ist da), Ihre Rolle heute | M-S1.2, M-S2.1 | **neu** (liest `teilnahmen`) | 0,5–1 |
| 1b.2 | Runde steuern: Agenda mit Zeiten, laufender Punkt, Timer, +5 Min, Anhalten und Fortsetzen; Teilnehmende sehen den Punkt | M-S3.2 | **neu** (`tische.lauf`, Polling) | 1,5–2 |
| 1b.3 | Ernte-Fenster öffnen und schließen, Stille Runde als Server-Regel | M-S3.2 („Zur Ernte einladen“), M-S6.3 als Ernte-Variante | **neu** (`tische.fenster`) | 1–1,5 |
| 1b.4 | Beiträge am Tisch (Zähler, Filter Thema/Kanal/Gruppe), Beitrag ansehen (Original, Transkript, Wortlaut korrigieren) | M-S8.1, M-S8.2 | **erweitern** (Inbox-Bausteine `src/components/submissions/**`, `GET /api/submissions` + Kontextfilter) | 1–1,5 |
| 1b.5 | Foto → Text für Submissions (`image` in `resolveAnalyzableMedia`, Vision-Job) | T-S4.1 (Zettel fotografieren) | **erweitern** (`submission-media.ts:39-48`, `image-analyzer.ts`) | 0,5–1 |
| | **Summe 1b** | | | **4,5–7** |

„Herausnehmen · Grund für alle sichtbar“ auf M-S8.2 kommt in Welle 2 (2.8),
weil es einen neuen Status braucht.

**Was die Redaktion am 05.10. sieht:** Sie bekommt einen Zugang zu einer
**Probe-Library** mit einem Probe-Treffen (zwei Tische, Beispielthemen,
kein vertraulicher Text) und zwei QR-Karten. Live sind der Weg der
Teilnehmenden (1a) und, als Stretch, die Liste der Beiträge am Tisch aus
1b.4. Alles andere ist der Play-Modus der Figma-Datei. Die App verweist an
diesen Stellen **sichtbar** darauf: Ein Knopf „Moderation (Vorschau) ›“
öffnet den Prototyp-Link, statt still ins Leere zu führen. In der
Stationsanzeige steht ein Chip „Vorschau“. Es gibt keine halbfertigen
Screens mit Blindtext.

**Abnahme Welle 1** (Figma, Seite „SHF — Klickmodell“):

| Screen | Node | Kriterium |
|---|---|---|
| T-S1.1 Willkommen | 2033:403 | Der QR öffnet ohne Anmeldung die Willkommensseite mit Tisch und Handlungsfeld aus dem Token. Ein ungültiger oder abgelaufener Token zeigt eine klare Meldung, keinen Fallback auf „irgendeinen Tisch“ |
| T-S1.1b Code eingeben | 2033:435 | Anmeldung per E-Mail-Code, danach zurück an denselben Tisch, ohne zweiten Scan |
| T-S2.1 Ihr Platz am Tisch | 2033:471 | Der Tisch ist nur Anzeige; Name, Organisation und Gruppe sind vorbelegt, wenn bekannt. „Passt so“ legt die Teilnahme `angekommen` an |
| T-S2.2 Was am Tisch gilt | 2034:444 | Die vier Sätze aus `treffen.vereinbarung`. „Verstanden“ setzt `vereinbarungGelesenAm`; danach wird im Composer nicht mehr gefragt |
| T-S4.1 Beitragen | 2034:556 | Die Leitfrage kommt aus dem aktiven Thema. Halten und Sprechen schreibt live ins Textfeld, Tippen korrigiert. „Beitragen“ legt eine Submission `pending` mit Kontext an, „Später weiterschreiben“ eine `draft` |
| E-S4.1 Sprechen und prüfen | 2028:300 | Derselbe Composer ohne Foto und Anlage, Knöpfe 64 px; „Ausführlich ›“ wechselt den Modus ohne Verlust |
| T-S5.2 / E-S5.2 | 2035:586 / 2029:306 | Häkchen, der Beitrag als Karte mit Zuschreibung, „Weiteres beitragen“ |
| T-S11.1 Meine Beiträge | 2037:740 | Eigene Beiträge dieses Tisches mit Zustand (Entwurf, abgegeben). Nur der eigene Beitrag ist sichtbar, auch über die API |
| M-S1.2, M-S2.1 | 2071:1037, 2050:839 | Die Moderation sieht, wer angekommen ist |
| M-S3.2 Runde steuern | 2071:1098 | Agenda mit Zeiten und Timer; Neuladen und Gerätewechsel verlieren den Stand nicht; Anhalten und Fortsetzen geht |
| M-S8.1, M-S8.2 | 2023:82, 2023:144 | Solange das Fenster offen ist: nur wer, nicht was (API-Test). Danach alle Beiträge, nichts wartet auf Freigabe |

**PR-Schnitt Welle 1** (Tagesscheiben):

| PR | Inhalt | Tag |
|---|---|---|
| W1-1 | Modell + Repos + Seed-Skript + Freeze-Tests (C0 aus dem Composer-Konzept, soweit berührt) + ADR 0011 (vorgeschlagen) | 24.–25.09. |
| W1-2 | Tokens + SHF-Schale (Bausteine) | 25.09. |
| W1-3 | QR-Landeseite, Anmeldung, Selbstbeitritt, Platz, Tischvereinbarung | 28.–29.09. |
| W1-4 | Composer (ausführlich + schnell), Beigetragen, Meine Beiträge | 01.–02.10. |
| W1-5 | Probe-Library, Deploy, Handy-Test, „Vorschau“-Verweise | 02.10. |
| W1-6 | Mein Tisch, Rolle, Runde steuern | 05.–06.10. |
| W1-7 | Ernte-Fenster, Stille Runde, Beiträge am Tisch, Foto → Text | 07.–08.10. |

Der 30.09. (Vortrag, Vorhaben 2) ist frei gehalten.

### Welle 2 · Einwandverfahren A, Synthese, Tisch-Abschluss, Vertretung

| # | Stück | Screens | Einstufung (Beleg) | PT |
|---|---|---|---|---|
| 2.1 | **Messung als Objekt**: `messungen` (Bezug Thema, Variante A, Skala `stufen3`, Optionen[] mit Passivlösung immer im Modell und in A verborgen, Fenster[], Runden, Zustand inkl. `angehalten`), `assessments` je (Messung, Option, Person, Runde) | — | **neu** (0 Treffer für `assessment`; Modell nach Konzept 13.09., Abschnitt 4) | 3–4 |
| 2.2 | Stellung nehmen: vier Stufen, Begründung Pflicht bei „schwerwiegend“, Restzeit; Schnell: vier große Felder | T-S6.1, E-S6.1 | **neu** | 1,5–2 |
| 2.3 | Messung läuft (Uhr, 6 von 8, die Offenen, +2:00, Schließen), Auswertung (Balken, Verteilung nach Gruppe, Mindestgruppe 3, Delta ab Runde 2), Abbruchhinweis „keine Änderung nach Runde 2 → abschließen“ | M-S6.3, M-S6.4 | **neu** | 2–3 |
| 2.4 | Beamer 16:9, eigene Route ohne Bedienelemente, Tipp geht weiter; zeigt Auswertung und Ergebnis auf Gruppenebene | M-S10.2 | **neu** (klein; kein Präsentationsmodus im Bestand) | 1–1,5 |
| 2.5 | Synthese-Vorlage `shf-synthese-de` (drei Abschnitte nach `GRUNDSAETZE.md` §5: alle Stimmen, Fokus, zur Messung; jede Aussage mit Beleg auf die Submission) + Auslöser aus der Moderation über die Sammel-Transformation | M-S8b.1 | **erweitern** (`composite-transcript.ts:719-803`, Vorlagen-Syntax `template-samples/`) + Vorlage schreiben | 2–3 + Vorlage 1–2 |
| 2.6 | `syntheses` mit Fassungskette (unveränderliche Snapshots, Zeiger), „Als Entwurf übernehmen“, „Neu erzeugen“; Aussage ohne Beleg orange | M-S8b.1 | **neu + portieren** (Muster BetterWriter `history/snapshots.ts`, laut Analyse 11.09.) | 1,5–2 |
| 2.7 | Tisch-Abschluss (ein Bestätigen für den Tisch, „alle n Beiträge eingeflossen, herausgenommen: k“) und Ihre Sätze im Ergebnis (Rückwärts-Index Beleg → eigene Submission) | T-S8b.2, T-S8b.1 | **neu** | 1,5–2,5 |
| 2.8 | Herausnehmen mit Grund (für alle sichtbar), Widerruf durch die Person bis zum Tisch-Abschluss; neuer Status neben `published`/`rejected` | M-S8.2, T-S11.1 | **erweitern** (`submission-status.ts:57-66`, Übergangstabelle) | 1–1,5 |
| 2.9 | Vertretung: Für wen erfassen Sie?, derselbe Composer „im Namen von“, Kanal am Beitrag | M-S4.4, T-S4.1/5.2 (Vertretung) | **erweitern** (Composer aus 1a.4, `attribution.erfasstVon`, `kanal`) | 1–1,5 |
| 2.10 | Wer hat noch nicht beigetragen (nur ob, nicht was) | M-S11.2 | **konfigurieren** (liest `teilnahmen` × Submissions) | 0,5 |
| 2.11 | Anlagen-Modell schlank (Zustand je Anlage, Job je Anlage, „Ihre Anlagen“) | T-S4.2 | **erweitern** (C1/C2 aus dem Composer-Konzept, ohne Backfill) | 1,5–2 |
| | **Summe Welle 2** | | | **17,5–25,5** (inkl. Vorlage) |

Die Veröffentlichung ins Storage (ADR 0004) geschieht **beim
Tisch-Abschluss**. Die bestätigte Fassung wird als Dokument
`docType: ergebnis` promotet, flach mit `treffen`, `tisch`, `thema`,
`gruppe`, `fassung`. Die Belege bleiben in MongoDB. Einzelbeiträge werden
nur promotet, wenn V2 oder V3 gilt (Abschnitt 4).

**Abnahme Welle 2:** T-S6.1 (2035:618), E-S6.1 (2029:330), M-S6.3 (2020:65),
M-S6.4 (2021:65), M-S10.2 (2023:291), M-S8b.1 (2023:190), T-S8b.1
(2036:649), T-S8b.2 (2036:686), M-S4.4 (2020:2), T-S4.1/5.2 Vertretung
(2031:419, 2031:473), M-S11.2 (2024:217), T-S4.2 (2035:542). Dazu drei
Prüfungen, die kein Screen zeigt:
(1) Die Passivlösung steckt in jeder A-Messung als Option und ist unsichtbar.
(2) Eine angehaltene Messung lässt sich am nächsten Tag fortsetzen, die
Werte bleiben.
(3) Jede Aussage der Synthese hat mindestens einen Beleg, oder sie ist
markiert; die Prüffrage 1 aus `GRUNDSAETZE.md` („kommt jede Stimme vor?“)
ist als Zähler sichtbar.

**PR-Schnitt Welle 2:** W2-1 Messmodell und Tests · W2-2 Stellung nehmen
(ausführlich und schnell) · W2-3 Messung läuft und Auswertung · W2-4
Beamer · W2-5 Synthese-Vorlage und Auslöser · W2-6 Fassungskette ·
W2-7 Tisch-Abschluss und eigene Sätze · W2-8 Herausnehmen, Widerruf,
Wer fehlt · W2-9 Vertretung · W2-10 Anlagen-Modell. Das sind zehn PRs von
je 1–2 Tagen. Die Reihenfolge nach Abhängigkeit: W2-1 vor W2-2/3/4, W2-5
vor W2-6 vor W2-7.

### Welle 3 · Redaktion, Vision, Folgegruppen, Nachschlagen (vor 13.11.)

| # | Stück | Screens | Einstufung (Beleg) | PT |
|---|---|---|---|---|
| 3.1 | Treffen anlegen (Termin, Modus, Tische mit Stand) | R-S0.1 | **erweitern** (Oberfläche über `treffen`/`tische`, bisher Seed) | 1–1,5 |
| 3.2 | Inhalte je Handlungsfeld: Grundsatzdokument in Themen zerlegen (Vision, Vortext, Ziele, Indikatoren; fehlende Indikatoren markiert) | R-S0.2 | **erweitern** (Themen-Dokumente; Zerlegung über eine Transformationsvorlage + Handkorrektur) | 1,5–2 |
| 3.3 | Verfahren je Thema (A, B als Ausnahme; B bleibt aus, bis beauftragt) | R-S0.3 | **konfigurieren** | 0,5 |
| 3.4 | Moderation und Begleitung einladen, Tisch-QR drucken | R-S0.4 | **erweitern** (Mitglieder-Einladung + Bindung an Tisch, QR-Druck aus 1a.2) | 1–1,5 |
| 3.5 | Fassung freigeben (Kette v1 → v2 → v3, nichts wird gelöscht) | R-S8b | **erweitern** (`syntheses` aus 2.6) | 1,5–2 |
| 3.6 | Nächstes Treffen vorbereiten: Historie je Gruppe, Vision der Gruppe 1, PDF je Gruppe | R-S12 | **neu** (Sicht + Druck) | 2–3 |
| 3.7 | Vision erfassen: Foto des Flipcharts → KI-Text (bearbeitbar) → Abgleich mit der Vision des Grundsatzdokuments → „als Stimme des Tisches“ | M-S4.0 | **erweitern** (Foto → Text aus 1b.5, Composer „im Namen des Tisches“) | 1,5–2,5 |
| 3.8 | Folgegruppen: Zustand je Thema auf T-S3.1, Vision und Ergebnisse der Vorgruppen, Antwort passt · passt nicht · ergänzen | T-S3.1, E-S3.1 | **erweitern** (Messung mit drei festen Optionen; Historie aus 3.6) | 1,5–2 |
| 3.9 | Nachschlagen mit Quellenangabe für Teilnehmende und Moderation, „Quelle auf Beamer“ | T-S9.1, M-S9.2 | **konfigurieren + erweitern** (Chat-Stream, `loader.ts` um `contributor`) | 1,5–2 |
| 3.10 | Ergebnis auf Gruppenebene, Das ist herausgekommen | T-S10.1, E-S10.1 | **erweitern** (liest `ergebnis`-Dokumente) | 1 |
| 3.11 | Aufräumen: `resolveWizardFlow` verdrahten, `publish` in die Registry (C8), Tisch-Laufzeit nach `@ks/module-tisch`, Library-Vorgaben für `capture`/`konsens` falls gewünscht | — | **erweitern** | 1,5–2 |
| | **Summe Welle 3** | | | **14,5–20** |

**Abnahme Welle 3:** R-S0.1 (2068:881), R-S0.2 (2068:936), R-S0.3 (2068:997),
R-S0.4 (2069:970), R-S8b (2023:240), R-S12 (2069:1040), M-S4.0 (2071:1159),
T-S3.1 (2034:493), E-S3.1 (2028:264), T-S9.1 (2037:647), M-S9.2 (2024:169),
T-S10.1 (2037:696), E-S10.1 (2029:357). Dazu: Ein neues Treffen lässt
sich ohne Skript anlegen, und die Folgegruppe sieht die Historie der
Vorgruppe, nicht deren Änderungskaskade.

**PR-Schnitt Welle 3:** W3-1 Treffen und Tische · W3-2 Inhalte je
Handlungsfeld · W3-3 Verfahren und Einladungen · W3-4 Fassung freigeben ·
W3-5 Historie und Druck · W3-6 Vision · W3-7 Folgegruppen · W3-8
Nachschlagen · W3-9 Ergebnis · W3-10 Aufräumen.

## 4. Offene Punkte mit benannten Varianten

### 4.1 Vertrauensraum im Nachhinein (V1–V3)

Welle 1 und 2 sind für alle drei Varianten gleich. Der Unterschied liegt
in der Sichtbarkeitsregel der API, in der Promotion und im Export.

| Variante | Was gebaut wird | Mehr-PT | Tischvereinbarung |
|---|---|---|---|
| **V1** nur die Moderation des Tisches sieht Einzelstatements, kein Export | Basisfall dieses Plans: Moderation liest je Tisch, promotet wird nur das `ergebnis` auf Gruppenebene | 0 | Satz 3 unverändert |
| **V2** zusätzlich die Redaktion, für das Positionspapier | Rolle Redaktion liest über alle Tische; Export mit Namen nur für die Redaktion, jeder Export steht im Aktions-Protokoll | +1–1,5 | Satz 3 ergänzen („… und die Redaktion für das Positionspapier“) |
| **V3** Verbände sehen die Statements ihrer Gruppe | Gruppe wird Zugriffseinheit: Konto je Verband (Rolle Leser mit `gruppe`), Filter `attribution.gruppe`, eigene Sicht; Einzelbeiträge werden als Dokumente promotet | +2–3 | Satz 3 neu fassen, ausdrücklich vor der ersten Abgabe |

Das Risiko ist nicht technisch. Die Tischvereinbarung muss **vor** dem
ersten echten Beitrag feststehen (spätestens Generalprobe). Ein Wechsel
von V1 auf V3 danach würde für bereits Gesagtes eine neue Zustimmung
brauchen.

### 4.2 Strategische Ziele je Gruppe: aufbauend oder von 0

Gebaut wird **aufbauend**: Die Folgegruppe sieht die Historie je Gruppe
(3.6, 3.8). „Von 0“ kostet **+0,5 PT** (Schalter am Treffen, der die
Historie auf T-S3.1 und R-S12 ausblendet; die Daten bleiben). Beides hält
das Modell. Die Entscheidung kann bis Welle 3 warten.

### 4.3 Welches A am 13.11.

| | A1 · vorliegender Text mit 3–5 Formulierungsvarianten (Kurzdrehbuch) | A2 · Ernte mit Verdichtung (Klickmodell) |
|---|---|---|
| Gegenstand der Messung | 3–5 Optionen, von der Moderation wortgleich eingegeben | eine Fassung aus der Synthese |
| Mehrarbeit | Optionen anlegen (Moderation) + Stellung nehmen je Option: **+1,5–2,5 PT** in Welle 2 | keine über Welle 2 hinaus |
| Kritischer Pfad bis zur Generalprobe | die Synthese (2.5/2.6) wird nachgelagert (Redaktion), nicht am Tisch | die Synthese muss **am Tisch** laufen, also 2.5–2.7 vor der Generalprobe |
| Modell | trägt (n Optionen) | trägt (n = 1) |

Beide tragen mit der Messung als Objekt. Die Entscheidung legt fest,
welche Stücke von Welle 2 vor der Generalprobe fertig sein müssen.

### 4.4 Synthese: maschinell oder zu Fuß

Die **Vorlage wird in Welle 2 in jedem Fall geschrieben** (2.5). Zu Fuß
heißt: Die Redaktion lässt sie außerhalb laufen und fügt das Ergebnis als
Fassung ein. Dann entfallen der Auslöser aus der Moderation und die
Belegspur-Prüfung in der App (**−1,5–2 PT**). Die Fassungskette (2.6) und
der Tisch-Abschluss (2.7) bleiben. Die Empfehlung ist maschinell, weil nur
dann Prüffrage 1 („kommt jede Stimme vor?“) als Zähler prüfbar ist.

## 5. Design-Tokens aus Figma (Entscheidung 11)

Die Variablen der Sammlungen `SHF Farben` und `SHF Maße` tragen schon
CSS-Namen (`var(--farbe-primaer)` `#003444`, `var(--farbe-hintergrund)`
`#faf9f8`, `var(--abstand-l)` 16, `var(--radius-l)` 12, …). Umsetzung:

- Ein **CSS-Variablen-Satz** `packages/ui/src/themes/shf.css`, der unter
  `[data-theme="shf"]` die Figma-Namen 1:1 setzt und die shadcn-Variablen
  (`--primary`, `--background`, `--radius`, …) darauf abbildet. Die übrige
  App bleibt unberührt. Die Textstile (`SHF/Titel` 28/36 bold usw.) werden
  Tailwind-Klassen im selben Satz. Die Schrift ist Inter.
- Die elf **Bausteine** (Kopf, Stationsanzeige, Status-Chip, Karte,
  Hinweisbox, Knopf, Personenzeile, Umschalter, Sprechknopf, Auswahlfeld,
  Composer) werden React-Komponenten in `packages/capture/src/react/bausteine/`.
  Jede mappt 1:1 auf die Figma-Komponente (Node-IDs `2015:37` … `2031:357`)
  und hat dieselben Eigenschaften.
- **Code Connect** bindet die Figma-Komponenten an diese Dateien. Vorbehalt:
  Code Connect setzt einen Organization- oder Enterprise-Plan voraus. Ist
  das Team-Konto kleiner, ersetzt eine Zuordnungstabelle im Paket-README
  die Bindung (W3-E5).
- Das Icon-Set ist in Figma noch offen. Bis dahin nimmt der Code
  `lucide-react` (Bestand), keine gezeichneten Platzhalter.

## 6. Blockierende Entscheidungen je Welle

**Welle 1** (bis 24.09. abends, sonst verschiebt sich W1-1):

| # | Frage | Empfehlung |
|---|---|---|
| W1-E1 | Schnitt für den 05.10. | Live 1a (Weg der Teilnehmenden), Moderation als Klickmodell mit sichtbarem Verweis; 1b bis 09.10. |
| W1-E2 | E-Mail-Code im Clerk-Dashboard einschalten: Er gilt für **alle** Libraries der Instanz | ja, als zusätzliche Methode neben den bestehenden |
| W1-E3 | Selbstbeitritt über den Tisch-QR als `contributor` (neuer, sicherheitsrelevanter Zugangsweg) | ja, mit `qrGueltigBis` = Ende des Treffens, Token je Tisch widerrufbar, Beitritt im Aktions-Protokoll |
| W1-E4 | Instanz und Library für den Zugang am 05.10. | eigene Probe-Library auf der Produktivinstanz, ohne vertraulichen Text; die Redaktion bekommt `moderator` |
| W1-E5 | Braucht die Schnell-Fassung eine eigene Anmeldung? | ja (Entscheidung 1: jeder Beitrag zuordenbar). Wer keinen Code eingeben will, bekommt die Vertretung durch die Moderation (Welle 2, 2.9). Mit der Redaktion bestätigen |
| W1-E6 | SHF-Composer in Welle 1 als fester Ablauf statt über `resolveWizardFlow` (heute ohne Aufrufer) | ja; Verdrahtung in 3.11 |

**Welle 2** (bis 02.10.):

| # | Frage | Empfehlung |
|---|---|---|
| W2-E1 | **Freeze 09.10.**: Welle 2 (17,5–25,5 PT) passt nicht davor | den Freeze teilen: 09.10. Freeze für Welle 1 (Schulung 14.10.), **19.10.** Freeze für Welle 2 (Generalprobe 20./22.10.); oder Welle 2 auf den Pfad aus 4.3 kürzen |
| W2-E2 | Welches A gilt am 13.11. (4.3) | mit der Redaktion klären; bestimmt den kritischen Pfad |
| W2-E3 | Vertrauensraum V1–V3 (4.1) | vor der Generalprobe; bis dahin V1 |
| W2-E4 | Abbruchregel: Was ist „keine Änderung nach Runde 2“? | kein neuer schwerwiegender Einwand **und** die Fassung unverändert; die App schlägt vor, die Moderation entscheidet |
| W2-E5 | Synthese maschinell oder zu Fuß (4.4) | maschinell |

**Welle 3** (bis 16.10.):

| # | Frage | Empfehlung |
|---|---|---|
| W3-E1 | Ziele je Gruppe aufbauend oder von 0 (4.2) | aufbauend |
| W3-E2 | Vision-Abgleich: Wie wird „gegen das Grundsatzdokument abgeglichen“ dargestellt (Nebeneinander oder Unterschiede markiert)? | Nebeneinander, ohne Diff |
| W3-E3 | Druck je Gruppe: PDF aus der App oder Export nach Word | PDF aus der App |
| W3-E4 | Nachschlagen: welche Unterlagen liegen in der Library (die Wiki-Frage ist ein eigenes Vorhaben)? | nur die vom Land freigegebenen Planungsdokumente |
| W3-E5 | Code Connect: Plan des Figma-Kontos | prüfen; sonst Zuordnungstabelle |

## 7. Kalender und Kapazität

```
24.09.–02.10.  Welle 1a (7 Arbeitstage, 30.09. frei für Vorhaben 2)
05.10.         Zugang für die Redaktion: 1a live, Moderation Vorschau
05.–08.10.     Welle 1b
09.10.         Freeze Welle 1 (W2-E1)
09.–19.10.     Welle 2 (bei 17,5–25,5 PT nur mit zwei parallelen Strängen
               oder mit dem gekürzten Pfad aus 4.3)
14.10.         Schulung Moderation auf Welle 1
20./22.10.     Generalprobe (Welle 1 + kritischer Pfad Welle 2)
23.10.–06.11.  Welle 3 und Nachzug aus der Generalprobe
13.11.         erstes Treffen
```

Die PT sind Personentage ohne Puffer, gemessen wie in den Analysen vom
11.09. Mit Agenten sinkt der Anteil Schreibarbeit, nicht der Anteil
Abnahme am Gerät. Der Engpass ist die Abnahme am Handy und am Tablet,
nicht der Code.

## 8. Nicht in diesem Plan

B/C und Widerstandswerte (O3; das Modell hält sie offen), eine Library je
Organisation (Wiki-Wunsch, eigenes Vorhaben), Export für die Presse
(Vertrauensraum), PWA und Offline, Mehrsprachigkeit DE/IT,
`events/finalize` und `events/publish-final` (Phase 6), der Wizard-Editor
(ADR 0003 Phase 4) und der Dialogfall D0.

## Verweise

- Konzepte: [`erfassungs-architektur-stationen-datenhaltung.plan.md`](erfassungs-architektur-stationen-datenhaltung.plan.md),
  [`erfassungs-composer-s4-s5.plan.md`](erfassungs-composer-s4-s5.plan.md)
- Analysen: [`../analysis/erfassungs-flow-wiederverwendung.md`](../analysis/erfassungs-flow-wiederverwendung.md),
  [`../analysis/erfassungs-flow-bauweisen-vergleich.md`](../analysis/erfassungs-flow-bauweisen-vergleich.md)
- Muster: [`../architecture/mongodb-repository-pattern.md`](../architecture/mongodb-repository-pattern.md),
  [`../architecture/api-route-conventions.md`](../architecture/api-route-conventions.md),
  [`../architecture/live-transkription.md`](../architecture/live-transkription.md)
- ADRs: 0003, 0004, 0006, 0007
- Figma: https://www.figma.com/design/siGqtrwvbsKb1Er1lkuynA (Seiten „SHF — Klickmodell“ und „SHF — Bausteine“)
- Archiv (nicht im Repo): Handover 23.09., „Screens erklärt“ 21.09., Designstudie 19./21.09., Verfahrensvarianten 13.09., `GRUNDSAETZE.md`
