# Erfassungs-Flow: wiederverwenden, erweitern, portieren oder neu bauen

**Stand:** 2026-09-11, geprüft gegen `master` 6114f46 (v1.2.247) sowie
`nextjs-nature-scout` und `CommonBetterWriter` im selben Stand.
**Auftrag:** Handover aus dem Archiv
(`24.09 KnowledgeScout/2026-09-10 Konzept Erfassungs-Flow generisch und mobil/2026-09-11 Handover an Claude Code - Erfassungs-Flow.md`),
Teil 2. Grundlage sind die Flow-Landkarte (dreizehn Stationen S0 bis S11) und
das Konzept vom 10.09. Beide sind erzeugte Synthesen; **wo Konzept und Code
sich widersprechen, gilt der Code** — die Widersprüche stehen in Abschnitt 4.

Der Vergleich der drei Bauweisen (in KnowledgeScout, eigenständige App gegen
die API, eigenständige App mit React-Paketen) steht getrennt in
[`erfassungs-flow-bauweisen-vergleich.md`](erfassungs-flow-bauweisen-vergleich.md).

**Ablage-Hinweis:** Der Handover nennt `docs/analyse/`. Im Repo gibt es bereits
`docs/analysis/` mit über zwanzig Analysen; dort liegt diese Datei, ein dritter
Analyse-Ordner wird nicht eröffnet.

## 1. Das Raster

Je Station genau eine Einstufung:

| Einstufung | Bedeutung |
|---|---|
| **konfigurieren** | es fehlt ein Feld, ein Schalter, eine Facette — kein Modellwechsel |
| **erweitern** | das Modell muss wachsen (neue Entität, neues Feld mit Semantik, neue Regel) |
| **portieren** | existiert in NatureScout oder BetterWriter und wird übernommen — als Lib (Code), als Muster (Struktur nachbauen) oder als Copy (mit Anpassung) |
| **neu** | gibt es in keinem der drei Repos |

Aufwand in Personentagen (PT), grob, ohne Puffer, nur die Plattform-Seite.
SHF-spezifische Bauteile (Einwandstufen, Timer, Auswertung) stehen gesondert.

## 2. Einstufung je Station

| # | Station | Einstufung | Was da ist (Beleg) | Was fehlt | PT | Hängt ab von |
|---|---|---|---|---|---|---|
| S0 | Einrichten | **erweitern** | Mitgliedschaft ist bereits eine eigene Entität pro Library mit vier Rollen `owner \| moderator \| co-creator \| contributor` (`src/types/library-members.ts:21`, `:31-67`), eigene Collection mit Indizes (`src/lib/repositories/library-members-repo.ts:47`), Einladung per Token mit `pending → active`, Resend, Entzug (`library-members-repo.ts:66-108`, `:137-169`, `:286-303`; `src/app/api/libraries/[id]/members/route.ts:120`, `:287`); zweiter Pfad über Access-Requests mit Genehmigung (`src/types/library-access.ts:16-52`) | Organisation und Interessengruppe als Entität (nicht gefunden in `src/types`, `src/lib`); Rolle je Kontext (Tisch); Token-Ablauf, Erinnerung, Zustellstatus (nicht gefunden in beiden Repos); Einwilligung als Modell (nur Checkbox `website-contact-form.tsx:28`); Verwaltungs-UI dafür | 4–6 | Entscheidung 1 (Anmeldeweg) |
| S1 | Ankommen | **erweitern + portieren (Muster)** | Öffentlich/geschützt sauber in der Middleware (`src/middleware.ts:39-52`, dynamische Ausnahmen `:156-249`); `/invite(.*)` öffentlich (`:39-52`), Einlösung `src/app/api/libraries/invites/[token]/accept/route.ts:24`; kontoloser Zugang existiert **nur** für Testimonials über `testimonialWriteKey` (`src/lib/public/testimonial-write-access.ts:71-109`), genutzt von `api/public/testimonials`, `api/public/secretary/process-audio`, `api/public/secretary/realtime-session` | Generalisierter Write-Key für Submissions: am Typ vorgesehen (`src/types/wizard-submission.ts:110-111`), von `POST /api/submissions` nie gelesen (`route.ts:10`, 401 bei `:111-112`); Kontingent (in ADR 0004 nicht gefunden); persistentes Rate-Limit (nur drei prozesslokale Limiter: `src/lib/secretary/realtime-rate-limit.ts:24`, Kontaktformular `:11-20`, Access-Check-Cache); Login-Code ohne Passwort | 3–5 | Entscheidung 1 und 3; Login-Code aus NatureScout (`src/lib/services/login-code-service.ts`, 192 Z., NextAuth-frei) |
| S2 | Zuordnen | **erweitern** | Zuschreibung = normalisierte E-Mail + Rolle zur Erfassungszeit + Audit-Trail (`src/types/wizard-submission.ts:38`, `:107-111`, `:83-95`; gesetzt in `src/app/api/submissions/route.ts:55`, `:104`); E-Mail ist durchgängig der fachliche Schlüssel (`src/lib/auth/user-email.ts:4-11`) | Klarname, Organisation, Interessengruppe, „in Vertretung von", Anonym-Option — alle nicht gefunden an Submission und `publish-frontmatter.ts`; Einwilligung mit Zeitstempel, Widerruf, Bezug (Person/Beitrag/Zitat) | 2–3 | S0 |
| S3 | Orientieren | **konfigurieren + erweitern** | Galerie liegt im Paket: `packages/module-explorer/src/gallery/**`, 120 Dateien, 17.455 Z.; Facetten generisch `GalleryFilters = Record<string,string[]>` (`packages/contracts/src/gallery-filters.ts:26`), serverseitig gefiltert (`gallery-root.tsx:275`); `publicationStatus`-Chip (`publish-status-chips.tsx:22`) | Zustandsfeld je Eintrag als Facette (kein Filter auf `publicationStatus`; `twin_status`/`bearbeitungsstand` nur archivseitig); „von dir offen" braucht S11-Daten; Muster Punktleiste aus BetterWriter (`cockpit/components/PipelineIndicator.tsx`, 84 Z., Copy) | 2–3 | S11 |
| S4 | Beitragen | **neu** (mit wiederverwendeten Bausteinen) | Standard-Flow `Welcome → collectSource → selectSchemaType → editDraft → publish` (`src/lib/creation/wizard-flow-entity.ts:69-111`), Schritt-Filterung (`wizard-flow.ts:27-41`); Eingabearten Text/Diktat, Datei, URL, Audio-Job (`collect-source-step.tsx:1067`, `:1136`, `:624`, `:903`); Live-Diktat komplett (`src/lib/live-transcription/**`, 14 Dateien, 1.898 Z.); Job-Stream (`creation-wizard.tsx:918`) | Composer als Bühne mit Karten; **Anlagen mit eigenem Zustand** — `binaryRefs` ist eine reine Referenzliste ohne Status je Anlage (`src/types/wizard-submission.ts:44-61`, `:123`), ein Status für alles; Kamera/Mikro direkt (`capture=` 0 Treffer in `src/` und `packages/`); Mobil (1 bzw. 2 Breakpoints in 3.302 bzw. 1.192 Z.); **Wiederaufnahme nach Abbruch** — die Outbox ist ein RAM-Ringpuffer von 120 s (`outbox.ts:26`, `:35`), IndexedDB nur für den Mitschnitt (`recording-store.ts:60`), kein persistenter Beitragsentwurf; Standard-Flow kennt nur Quellart `file` (`wizard-flow-entity.ts:70-78`) | 8–12 | Entscheidung 3 (Zugang ohne Konto) für den öffentlichen Pfad |
| S5 | Prüfen & Abgeben | **erweitern** | Submission mit Confidence je Feld (`wizard-submission.ts:124`), Statusmaschine `draft → pending → ready → publishing → published` + `rejected` (`src/lib/submissions/submission-status.ts:57-66`); generische Bindung an `kind=content` in ADR 0003 entschieden (Nachtrag 02.06.) | `edit-draft-step.tsx` trägt laut ADR 0003 noch hartkodierte Labels und Namens-Heuristiken; `publish` fehlt in der Step-Registry (`engine/step-registry.tsx:34-46`, elf Presets, Legacy-Switch `:57-63`); Publish-Weiche an Template-Namen (`creation-wizard.tsx:2462-2465`); Sichtbarkeitsleiter und Zuschreibung am Prüfen-Schirm (S2/S7) | 4–6 | S2, S7 |
| S6 | Mitentscheiden | **neu (Modell) + konfigurieren (Sicht)** | Stimme pro `(library, file, user)` mit Voter-Namen ohne Clerk-Lesepfad (ADR 0002; `packages/contracts/src/source-user-state.ts:29-45`; Unique-Index `source-user-states-repo.ts:48-51`); Kommentare mit Revisionen (`source-comments-repo.ts:272`) | **Die Skala ist binär**: `'favorite' \| 'not_important'` (`source-user-state.ts:26`), kein `value`, keine Begründung an der Stimme. „Person × Objekt × Wert (+ Begründung)" gilt heute nur mit Wert = ja/nein. Einwandstufen, Skala 0–10, Bewertungsart je Thema: neu. Fenster, Countdown, Runden, Auswertung mit Streuung: neu (SHF) | 2–3 (Skala) + 6–10 (SHF) | Angebot v2.5: Widerstandswerte O3 nicht beauftragt |
| S7 | Sehen dürfen | **erweitern + portieren (Muster)** | Zweistufig: Library (`isPublic`, `requiresAuth`, `showOnHomepage`, `siteEnabled` in `src/types/library.ts:298-364`) und Dokument (`publication.status !== 'draft'`, zentraler Filter `src/lib/chat/publication-filter.ts:43-45`, `canSeeDrafts :51-53`); Draft-Regel in allen Lese-Endpunkten einheitlich; Domain-Kopplung (`middleware.ts:76-93`) | Regelsatz je Library „wer · wann · was": „erst nach eigener Abgabe", „nicht während der Messung", Anonymisierung je Feld — kein `visibility`-/`anonymous`-Feld an Dokument oder Submission. Muster: NatureScout `src/app/api/habitat/public/route.ts:504-556` (anonym ⇒ immer leer, eingeloggt ⇒ nur bei Freigabe oder gleicher Organisation, E-Mail immer entfernt `:556`) | 3–4 | S0 (Organisation), S6 (Messfenster) |
| S8 | Kuratieren | **erweitern** | Wartekorb mit Routen `approve`/`reject`/`promote`/`analyze` (`src/app/api/submissions/[id]/*`), Logik `review-actions.ts:75`, `promote-actions.ts:56`; Inbox-UI `src/app/library/inbox/inbox-client.tsx` (180 Z.) + Bausteine `src/components/submissions/**` (397 Z.) | Unter Last: Filter nur nach `status` (`route.ts:156`), kein Bulk, kein „Original neben Transkript". **Die Werkbank ist nicht wiederverwendbar**: sie arbeitet auf `TwinFamilySummary` (`src/lib/agent-view/werkbank-baum.ts:32`) und liest Aufträge aus dem `shadow-twin-repo` (`korrekturen.ts:23`); Submissions kommen dort nicht vor. Übernehmbar ist nur das Prinzip aus ADR 0006 (Widerstand zählen statt Zustimmung, `abnahme.ts:8-12`) | 3–5 | S7 |
| S8b | Verdichten | **neu + portieren (Lib)** | Overlap-Bericht (`src/lib/external-jobs/phase-overlap-report.ts`, 321 Z.) mit Belegspur — aber intern-referentiell (`ref`/`ueberlapptMit`, `overlap-report-build.ts:16-18`) und klimaspezifisch hartkodiert (`overlap-report-prompt.ts:20-27`, `overlap-report-template.ts:35`) | Fassungen: **keine Dokument-Snapshots im Repo** (in `src/lib/shadow-twin` nicht gefunden; `WizardSubmission.version` ist ein Änderungszähler `:135`). Portierbar als Lib: BetterWriter `cockpit/lib/history/snapshots.ts` (228 Z.) + `restore.ts` (126 Z.) — unveränderliche Snapshots mit `seq`, Zeiger `{current, latest}`, Restore als neuer Snapshot mit `restoredFrom` (`:106-109`); hängt am `ScopedFileStore`-Interface, muss auf ein Mongo-Repo umgehängt werden. Synthese mit Belegspur auf Quellstellen: neu | 6–10 | Angebot SHF (Umfang Fassungskette); Dialogformate als ruhiger Erstkonsument |
| S9 | Wiederfinden | **konfigurieren + erweitern** | Ingestion und Vektor-Repo (`src/lib/repositories/vector-repo.ts:614`, `:702`); „Meine Beiträge" existiert (`src/app/library/my-submissions/my-submissions-client.tsx`, 178 Z.; API-Filter `mine` in `src/app/api/submissions/route.ts:150`, `:162`) | Submissions werden **nicht** indexiert (0 Treffer `submission` in `src/lib/ingestion`, `src/lib/chat`); der Index entsteht erst bei der Promotion (`promote-actions.ts:98`). Ein Beitrag im Wartekorb ist nicht auffindbar. Nötig: `upsertMarkdown` beim Anlegen mit Status-Flag und Erweiterung des `publicationVisibilityFilter` | 2–3 | S7 |
| S10 | Zeigen | **konfigurieren** | `@ks/embed` existiert (v0.1.0, `packages/embed/src/index.ts:9-10`, nur Galerie, nur öffentliche Libraries `embed-galerie.tsx:42-50`); M5 auf `master` und deployt (STAND 11.09.) | Beamer-Ansicht (SHF, neu, klein); Zuschreibungsstufen kommen aus S7; `src/utils/document-navigation.ts:29-56` weiter fest auf `/explore/*` und `/library/gallery` verdrahtet (Debug-`console.log` `:80`, `:96`, `:112`, `:123`) | 1–2 | S7 |
| S11 | Nachverfolgen | **konfigurieren + erweitern** | „Meine Beiträge" mit Zustand, Analyse anstoßen, Bearbeiten (`my-submissions-client.tsx:50`, `:129`, `:160`); Audit-Trail je Submission (`wizard-submission.ts:83-95`) | Rückkehr ohne Konto über den eigenen Link (`createdBy` als Write-Key-Kennung ist vorgesehen `:107-108`, aber ungenutzt); „wer fehlt noch" je Tisch (Moderation) braucht S0; BetterWriter-Beitragsliste ist als Copy denkbar (`ArticleListItem.tsx` 107 Z.), aber ihr Teilen kennt weder Token noch Ablauf noch Widerruf (`shares/types.ts:20`: nur `pending \| accepted`) | 2–3 | S1 (Write-Key), S0 |

**Summe Plattform-Seite: rund 45 bis 65 PT** (ohne SHF-Bauteile, ohne Puffer).
Das Entwicklungsfenster 17.09. bis 09.10. hat siebzehn Arbeitstage. Die
Reihenfolge in Abschnitt 5 nennt, was für den SHF-Termin zwingend ist.

## 3. Die drei Listen

### 3.1 Neu zu bauen (und warum)

| Bauteil | Station | Warum neu |
|---|---|---|
| **Composer** — Bühne mit Karten, ein Eingabefeld, Mikro und Plus | S4 | In keinem der drei Repos. `collect-source-step.tsx` sammelt genau eine Quelle pro Durchlauf; BetterWriters Wizard leitet Schritte ab, hat aber keinen Mehrquellen-Sammelschirm |
| **Anlagen-Modell** — je Anlage Art, Rohdatei, Ergebnis, Job-Id, Zustand, Fehlergrund | S4/S5 | `binaryRefs` trägt nur hash/url/fileName/contentType/size/itemId (`wizard-submission.ts:44-61`); Zustand gibt es nur am Beitrag |
| **Persistenter Beitragsentwurf** (Wiederaufnahme nach Abbruch, Wackelnetz) | S4 | Outbox ist RAM, 120 s (`outbox.ts:26`); IndexedDB nur für Mitschnitt; kein Entwurf im Browser, kein Sync beim Wiederkommen |
| **Bewertungsart je Thema** — Stimme mit Skala, Stufe, Begründung | S6 | Stimme heute binär (`source-user-state.ts:26`); NatureScout und BetterWriter haben keine Bewertung |
| **Regelsatz Sichtbarkeit** „wer · wann · was" je Library | S7 | Heute nur `isPublic`/`requiresAuth` + Draft-Filter; Gating nach eigener Abgabe oder während einer Messung gibt es nirgends |
| **Synthese mit Belegspur auf Quellstellen** | S8b | Overlap-Bericht verweist nur auf Katalogzeilen, nicht auf Seiten/Chunks; klimaspezifisch |
| **Organisation / Interessengruppe** als Entität mit Rolle je Kontext | S0/S2 | NatureScout hat Organisation, aber Rolle global und Zugehörigkeit dreifach kopiert (`user-service.ts:12-14`); KnowledgeScout hat Rolle je Library, aber keine Organisation. Keins von beiden trägt „Rolle je Tisch" |
| **Einwilligung** mit Zeitstempel, Widerruf, Bezug | S2 | NatureScout: drei Booleans ohne Zeitstempel, Gate nur im Client (`specs/regeln/datenschutz-und-consent.md:42-44`); KnowledgeScout: nur eine Checkbox |
| SHF-Bauteile: Einwandstufen, Fenster/Countdown, Runden, Auswertung mit Streuung, Beamer-Ansicht | S6/S10 | Anwendungsspezifisch, nach Landkarte in `@shf/deliberation` |

### 3.2 Portieren (mit Bruchstellen)

| Baustein | Quelle | Als | Bruchstelle |
|---|---|---|---|
| Login-Code (6-stellig, 15 min, 3/5 min je E-Mail) | NatureScout `src/lib/services/login-code-service.ts` (192 Z.) | **Lib** — Service ist NextAuth-frei | Rate-Limit über `countDocuments` (`:185`); Versand ruft Mailjet direkt (`:158`); Provider-Anbindung in `src/lib/auth.ts:34-80` ist NextAuth, in KnowledgeScout müsste Clerk den Code-Login tragen (Clerk-eigenes E-Mail-OTP prüfen, bevor man portiert) |
| Einladungs-Lebenszyklus (30 Tage, Erinnerung 24 h/72 h, Widerruf, Archiv, Wiederversand, Zustellstatus) | NatureScout `user-service.ts:30-55`, `:398-716`; Routen `auth/invite/*`, `admin/invitations` | **Muster** (Feldmodell + Zustände) | Einlösung sitzt im NextAuth-Callback (`src/lib/auth.ts:81-126`), nicht im Service; Frist in der Route hartkodiert (`invite/route.ts:85`); Mail-HTML inline (`mailjet-service.ts:64`, `:135`, `:208`, `:301`, `:343`, `:378`); Mailjet-Webhook ohne Signaturprüfung; kein Kontingent |
| Anonymisierung in der öffentlichen Route | NatureScout `src/app/api/habitat/public/route.ts:504-556` | **Muster** | Regel hängt an `organizationId` am User; Umstellen auf Referenzen ändert die Regel mit |
| Fassungs-Snapshots (seq, Zeiger, Restore ohne Löschen) | BetterWriter `cockpit/lib/history/snapshots.ts` (228), `restore.ts` (126), `historyStore.ts` (88) | **Lib** | Hängt am `ScopedFileStore` (`types.ts:70-86`); parallele Alt-Spur `06_draft_vN.md` noch aktiv |
| Zugriffsauflösung Besitzer/Handelnder mit Rollenrang | BetterWriter `cockpit/lib/storage/resolveArticleAccess.ts` (95 Z.), `shares/*` | **Lib** (Kern) + **Muster** (Route-Wrapper `apiContext.ts:96-169`) | Rollen `owner/editor/viewer`, Share nur `pending/accepted` — kein Token, kein Ablauf, kein Widerruf; `?owner=`-Adressierung durchdringt 49 Routen |
| Zustandsloser Wizard (Schritte aus dem Beitrag abgeleitet) | BetterWriter `cockpit/lib/wizard/state.ts:304-347` | **Muster** | Kennt die Stage-IDs von `blogwriter-mono`; die Ableitung selbst ist pur und übertragbar |
| Fortschritts-Punktleiste | BetterWriter `PipelineIndicator.tsx` (84 Z.) | **Copy** | Braucht `StageStatus[]`; für Submissions aus der Statusmaschine ableiten |
| Flow-Registry (Flows + Phasen als validierte Konfiguration, Prompts als Markdown) | BetterWriter `cockpit/lib/flows/registry.ts` (457 Z.) | **Lib** — nur `node:fs`, `node:path`, `zod` | `repoRoot()` erzwingt `BLOGWRITER_REPO_PATH` (`paths.ts:12-17`); prozessweiter Cache ohne Invalidierung (`:398`). Für KnowledgeScout ist das eine Alternative zur Flow-Entität in MongoDB (`wizard-flow-entity.ts`), nicht deren Ergänzung — Entscheidung nötig, ob Flows als Dateien oder als Dokumente leben |

### 3.3 Wiederverwenden ohne Portieren (KnowledgeScout selbst)

- Mitgliedschaft mit Rollen und Einladungs-Token (S0) — **die bessere Basis als
  NatureScout**, weil Rolle je Library statt global. Zu erweitern, nicht zu
  ersetzen.
- Live-Diktat komplett: Audio-Aufnahme, Ticket-Client (angemeldet und
  öffentlich), Lückenerkennung, Journal, Mitschnitt in IndexedDB (S4).
- Asynchrone Medienverarbeitung: Job anlegen, Fortschritt über SSE (S4).
- Statusmaschine und Routen des Wartekorbs (S5/S8), „Meine Beiträge" (S11).
- Zentraler Sichtbarkeitsfilter für Drafts (S7), Voter-Namen ohne Clerk (S6).
- Galerie im Paket mit generischen Facetten (S3/S9), `@ks/embed` (S10).
- Rate-Limiter für Realtime-Tickets als Vorlage für einen persistenten Limiter (S1).

## 4. Widersprüche zwischen Konzept und Code

| Nr. | Konzept / Handover sagt | Code sagt | Folge |
|---|---|---|---|
| 1 | `src/components/library/gallery/**` (Handover S3) | Existiert nicht mehr; Galerie liegt in `packages/module-explorer/src/gallery/**` (120 Dateien). In `src/` nur Randstücke (`gallery-detail-renderers.tsx`, `use-gallery-items.ts`) | Pfad im Routing-Index von `CLAUDE.md` veraltet; M5-Umzug ist durch |
| 2 | `src/lib/gallery/**` und `api/library/*/favorites/**` tragen die Sterne (Handover S6, `CLAUDE.md`-Routing-Index) | `src/lib/gallery/**` nicht gefunden; `favorites/route.ts:4-6` sind Ordner-Lesezeichen; die Stimme liegt unter `source-user-states/` | Routing-Index nachziehen |
| 3 | „Sterne, Einwandstufe, Widerstandswert haben dieselbe Datenform *Person × Objekt × Wert (+ Begründung)*" (Landkarte 3c) | Wert ist binär `favorite \| not_important`, keine Begründung an der Stimme (`source-user-state.ts:26`) | S6 ist nicht „konfigurieren", sondern ein neues Bewertungsmodell mit Migration der bestehenden Sterne |
| 4 | `docs/STAND.md`: beide Alt-Endpunkte „werden in `creation-wizard.tsx` noch aktiv gerufen" | `events/publish-final` an zwei Stellen (`:2730`, `:2825`); `events/finalize` hat in `src/**` **keinen** Aufrufer, nur die Route selbst (`events/finalize/route.ts:32`) | STAND korrigiert (11.09.); `events/finalize` kann in Phase 6 ohne Ersatz fallen |
| 5 | Handover: `docs/STAND.md:251-254` | Vorhaben 3 beginnt bei Zeile 280, die Erfassungs-Reservierung steht bei 410 | nur Zeilenangabe |
| 6 | S0 „○ fehlt", „portieren aus NatureScout" (Landkarte 2, Synergie-Bilanz) | Mitgliedschaft als Entität mit vier Rollen und Einladungs-Token existiert; NatureScout hat die Rolle global und die Organisation dreifach kopiert | S0 ist ◐ und **erweitern**; aus NatureScout kommt nur der Einladungs-Lebenszyklus als Muster |
| 7 | „Werkbank nimmt den Wartekorb auf (ADR 0006)" (Landkarte 3c, S8) | Werkbank arbeitet auf Twin-Familien und liest aus `shadow-twin-repo` (`werkbank-baum.ts:32`, `korrekturen.ts:23`); keine Abstraktion über Arbeitsgegenstände | S8 wird am Wartekorb erweitert, nicht in die Werkbank verlegt. Übertragbar ist das Prinzip (Widerstand zählen), nicht der Code |
| 8 | „Die Bausteine dafür (Outbox, Journal, Lückenerkennung) sind im Live-Diktat schon vorhanden und gehören auf den ganzen Beitrag ausgeweitet" (Konzept 4.3) | Outbox ist ein RAM-Ringpuffer von 120 s, nichts wird persistiert (`outbox.ts:26`, `:35`); nur der Mitschnitt geht nach IndexedDB | Wiederaufnahme nach Abbruch ist neu zu bauen; die Live-Diktat-Bausteine helfen für die Aufnahme, nicht für den Entwurf |
| 9 | „Öffentliche Gegenstücke für die Verarbeitung existieren bereits" (Konzept 4.4) | Existieren, sind aber an `libraryId + eventFileId + testimonialWriteKey` gebunden (`testimonial-write-access.ts:71-109`). Nachtrag 12.09.: nur **per API** — die Gast-Seite `/public/testimonial` fehlt in `isPublicRoute` (`src/middleware.ts:39-52`), über den Browser erreicht heute kein Gast den Flow | Für einen generischen Write-Key sind die öffentlichen Secretary-Routen zu generalisieren, nicht nur die Abgabe; die Seite ist eine Middleware-Zeile |
| 10 | „`@ks/embed` geplant" (Landkarte 6) | Existiert, v0.1.0, M5 deployt (STAND 11.09.) | S10 ist konfigurieren |
| 11 | BetterWriter „Teilen mit Rollen (Eigentümer · Bearbeiter · Leser), eingeladen/angenommen" als Fundament für S11 und S0 | Rollen `owner/editor/viewer`; Einladung ohne Token, Ablauf, Widerruf, Versand (`shares/types.ts:18-33`) | Für S0 trägt es nichts, was KnowledgeScout nicht schon hat; für S11 nur die Liste als Copy |
| 12 | „Overlap-Bericht (gebaut)" als S8b-Beleg für Klimamaßnahmen | Belegspur nur auf Katalogzeilen, Felder `co2`/`kosten`/`massnahme_nr` hartkodiert | Kein Fundament für eine generische Synthese |
| 13 | Konzept 2.3: Live-Diktat liefert „Outbox" als Bausteine für Wackelnetz | siehe 8 | — |
| 14 | ADR 0004 nennt eine Rolle `reader` | Im Code nicht vorhanden (`library-members.ts:21`) | ADR-Text passt nicht zur Rollenliste; kein Handlungsbedarf für die Erfassung |
| 15 | S4 „neu" (diese Analyse, Abschnitt 2 — am Composer mit Anlagen gemessen) | Für den Ein-Quellen-Fall trägt der Testimonial-Recorder den Pfad Diktat → Transkript → Speichern seit Januar (`src/components/public/testimonial-recorder.tsx`, `api/public/testimonials`), ohne Leitfragen und Vorschau (Nachtrag Dialog-Flow 12.09.) | „Neu" bleibt für Anlagen mit Zustand und Wiederaufnahme; Composer-Scheiben C3/C4 minus 2–3 PT; der Dialogfall läuft als Welle D0 auf dem Bestand |

## 5. Was für den SHF-Termin zwingend ist

Reihenfolge nach Abhängigkeit und nach dem, was in fünf von acht Rollenspalten
wörtlich gleich ist. PT aus Abschnitt 2.

1. **S4 Composer + Anlagen-Modell** (8–12) — ohne ihn gibt es keinen Beitrag.
2. **S5 generischer Prüfen-Schirm + `publish` in die Registry** (4–6) — ADR 0003
   Nachtrag O1 ist die Vorgabe.
3. **S2 Zuschreibung** (2–3) — Person, Organisation, Interessengruppe am Beitrag.
4. **S1 Einladung einlösen ohne Passwort** (3–5) — hängt an Entscheidung 1;
   der Write-Key nur, wenn Entscheidung 3 „für alle" lautet.
5. **S7 Regelsatz** (3–4) — „erst nach eigener Abgabe" ist verfahrenskritisch.
6. **S6 Bewertungsmodell + Einwandstufen** (2–3 + 6–10) — die beauftragte
   Variante; Widerstandswerte nur als austauschbare Karte mitgedacht.
7. **S8 Wartekorb unter Last** (3–5).

Summe der Pflicht: **31 bis 48 PT** für siebzehn Arbeitstage. Das geht nur mit
zwei Personen oder mit einem Schnitt: S8 auf das Nötigste (Filter, Original
neben Transkript), S0 als Datenmodell ohne Verwaltungs-UI (Tische und
Einladungen per Skript), S8b, S9, S11 ins Vorhaben danach.

## 6. Leitplanken, die diese Analyse nicht anfasst

- `events/finalize` und `events/publish-final` bleiben, bis Phase 6 entschieden ist.
- Widerstandsmessung (Option O3) wird nicht gebaut, nur als Karte im Rahmen mitgedacht.
- Ohne Entscheidung 1 (Anmeldeweg) und 3 (Zugang ohne Konto) wird das
  Detailkonzept mit benannten Varianten geschrieben, nicht mit einer Annahme.

## 7. Nachtrag — Owner-Entscheidungen vom 11.09.

Nach Vorlage dieser Analyse hat der Owner drei Punkte entschieden, die die
Einstufung an zwei Stellen verschieben:

- **Nur Clerk.** Kein SPID/CIE, kein eigenes Konto-System. Entscheidung 1 ist
  damit beantwortet; S1 verliert die Unsicherheit, nicht den Aufwand.
- **Kein Zugang ohne Konto.** Ein Write-Key gibt es nur für Angemeldete, als
  Einladungs-Token an Library und Zieltyp gebunden. In S1 entfällt der
  generalisierte Write-Key mit Kontingent für Anonyme (1–2 PT weniger); die
  öffentlichen Secretary-Routen bleiben, wie sie sind.
- **Zielbild: eine Library je Organisation.** Ob in der ersten Ausbaustufe,
  ist offen. Trifft es zu, wird in S0 „Organisation als Entität" zu
  „Library-Mitgliedschaft" — also konfigurieren statt erweitern; offen bleiben
  Interessengruppe, Rolle je Tisch und Einwilligung.

Abschnitt 6, dritter Punkt, ist damit gegenstandslos; das Composer-Konzept
ist ohne Varianten geschrieben.

## 8. Nachtrag — 12.09.

- **Eine Library für das SHF**, Library je Organisation später. Damit der
  Umzug dann ein Verschieben ist, sind Organisationen und Veranstaltungen im
  Storage eigene Verzeichnisse (Architektur-Konzept, Abschnitt 3.4). Für S0
  heißt das: erweitern (Token-Felder, Profil, Verzeichnisbaum), nicht nur
  konfigurieren.
- **„Kein Zugang ohne Konto" gilt für das SHF** — präzisiert durch den
  Tisch-QR: der QR trägt Tisch, Rolle und Organisation, die Anmeldung bleibt.
  Für den **Dialogfall** (Kolping) ist ein Gast-Zugang je Library eine offene
  Owner-Entscheidung; der Mechanismus existiert (Testimonial-Write-Key), nur
  die Seite davor ist nicht öffentlich (Widerspruch 9, 15).
- **Haltung „vorauseilendes Vertrauen"** (Archiv, 12.09.): Tischvereinbarung
  statt Einwilligungsleiter, keine Sichtbarkeitswahl je Beitrag, Kuratieren als
  Notbremse (Option 2, offen). Die Einstufung von S2, S5, S7 und S8 wird
  dadurch eher billiger; die Kostenprüfung am Code steht aus
  (Architektur-Konzept, Abschnitt 7).

## Verweise

- Handover, Konzept und Flow-Landkarte: Archiv `24.09 KnowledgeScout/2026-09-10 Konzept Erfassungs-Flow generisch und mobil/`
- ADR 0003 (Wizard/Schema), ADR 0004 (Inbox), ADR 0006 (Beweislast), ADR 0008 (Deployment-Ziele)
- `docs/STAND.md`, Vorhaben 3
- Bauweisen-Vergleich: [`erfassungs-flow-bauweisen-vergleich.md`](erfassungs-flow-bauweisen-vergleich.md)
