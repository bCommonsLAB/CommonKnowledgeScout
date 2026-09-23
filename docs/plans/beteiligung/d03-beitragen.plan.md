---
name: d03-beitragen
overview: "Detailkonzept D3: Der Composer (Sprechen und Prüfen in einem Screen, Foto, Anlage) schreibt vom ersten Wort an einen Beitrag in die Inbox. Datenmodell der Anlagen, Job je Anlage (PDF, Audio, Foto → Text), Entwurf und Abgabe, Vertretung durch die Moderation, Widerruf bis zum Tisch-Abschluss. Schnittstellen zu Submissions, Inbox-Blob, Analyse-Job, Live-Diktat und Flow-Entität, mit den Lücken, die der Bestand hat."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D3 · Beitragen

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Klasse **B · Beitrag**: Original bis zum Fensterschluss in der Inbox),
[D2](d02-organisationen-und-personen.plan.md) (Teilnahme, Vereinbarung),
[D4](d04-tisch-laufzeit.plan.md) (offenes Ernte-Fenster). Das
Composer-Konzept
[`erfassungs-composer-s4-s5.plan.md`](../erfassungs-composer-s4-s5.plan.md)
gilt mit den Abweichungen in Abschnitt 9. Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| T-S4.1 Beitragen / E-S4.1 Sprechen und prüfen | Leitfrage oben; Sprechknopf; Textfeld mit Live-Mitschrift, in dem man korrigiert; Foto und Anlage (nur ausführlich); „Beitragen“, „Später weiterschreiben“ |
| T-S4.2 Ihre Anlagen | Zustand je Anlage: fertig, wird ausgewertet, nicht lesbar |
| T-S5.2 / E-S5.2 Beigetragen | Bestätigung mit Zuschreibung |
| T-S11.1 Meine Beiträge | eigene Beiträge mit Zustand; Widerruf bis zum Tisch-Abschluss |
| M-S4.4 + T-S4.1/T-S5.2 (Vertretung) | derselbe Composer „im Namen von …“, Kanal am Beitrag |

## 2. Objekte

| Objekt | Klasse | Ort bis Fensterschluss | danach |
|---|---|---|---|
| Beitrag | B | `wizard_submissions` (erweitert) | Datei im Organisationsordner (D5); Submission = Protokoll |
| Anlage (Foto, PDF, Audio) | B | Blob-Inbox `{lib}/inbox/{user}/{hash}.{ext}` + Eintrag an der Submission | Datei neben dem Beitrag (D5) |
| Text der Anlage | B (maschinell) | an der Anlage in der Submission | Abschnitt im Beitrag bzw. Transkript der Anlage (D5) |

## 3. Datenmodell: Erweiterung der Submission

```ts
// src/types/wizard-submission.ts — neue Felder, bestehende bleiben
attachments?: SubmissionAttachment[]
context?: {                       // Pflicht für docType 'beitrag'
  meetingId: string; tableId: string; passageId: string; windowId: string
}
attribution?: {
  participantId: string           // E-Mail oder 'proxy:<uuid>' (D2)
  displayName: string
  organisationId: string | null
  organisationText?: string
  noOrganisation?: true
  interestGroup: string
  capturedBy?: string             // Vertretung: E-Mail der Moderation
  channel: 'self' | 'proxy' | 'note'   // note = Zettel, von der Moderation fotografiert
}
withdrawn?: { at: string; by: string; reason?: string }
removed?: { at: string; by: string; reason: string }     // Herausnehmen durch die Moderation, Grund Pflicht

interface SubmissionAttachment {
  id: string                      // client-erzeugte ULID, macht Wiederholungen idempotent
  kind: 'image' | 'pdf' | 'audio' | 'document'
  binary: SubmissionBinaryRef     // Bestand: hash, url, fileName, contentType, size, itemId
  state: 'hochgeladen' | 'wird_ausgewertet' | 'fertig' | 'fehlgeschlagen' | 'verworfen'
  jobId?: string
  text?: string                   // Ergebnis der Auswertung
  error?: { code: string; message: string; at: string }
  createdAt: string; updatedAt: string
}
```

- **Der gesprochene und getippte Text ist `markdownBody`.** Er ist keine
  Anlage. Das Composer-Konzept hatte eine Anlage `text`/`dictation`; im
  SHF-Composer ist das Textfeld der Beitrag selbst.
- `binaryRefs` bleibt bestehen und wird aus `attachments` gespiegelt. So
  arbeiten die bestehenden Konsumenten (Promotion, `copyOriginalsToTarget`)
  unverändert.
- `docType: 'beitrag'`; `detailViewType` ist eine bestehende Ansicht
  (D8, Abschnitt 5).
- Die Zustände `withdrawn` und `removed` sind **Markierungen an einem
  `pending`-Beitrag**, keine neuen Status der Maschine. Sie wirken beim
  Fensterschluss (D5, eigener `beitrag_status`) und in der Synthese (D6).
  Grund: Die Statusmaschine (`submission-status.ts:57-66`) ist auf die
  Freigabe gebaut. Ein neuer Status würde die Übergangstabelle für alle
  Libraries ändern.
- **Versionsschutz:** Die Repo-Updates prüfen heute die `version` nicht
  (`wizard-submissions-repo.ts:102`, `:133`). Für den Composer, der alle
  paar Sekunden speichert, kommt eine bedingte Aktualisierung dazu:
  `updateSubmissionMetadata(id, input, { expectedVersion })` mit 409 bei
  einer Abweichung.

## 4. Abläufe

### 4.1 Entwurf und Abgabe

1. **Erstes Zeichen oder erstes Wort:** `POST /api/deliberation/[libraryId]/contributions`
   mit `{tableId, passageId, windowId}`. Der Server prüft:
   - die Teilnahme (D2): angekommen, Vereinbarung gelesen, Gruppe gesetzt;
   - das Fenster ist **offen** (D4);
   - die Rolle darf erfassen (`resolveCaptureRole`, D11).

   Er legt eine Submission mit `status: 'draft'` an. Die Erfassung setzt
   heute immer `pending` (`submission-capture.ts:151`); `draft` ist als
   Anfangsstatus erlaubt (`submission-status.ts:41-44`). Die
   `submissionId` merkt sich der Client je Fenster in `localStorage`, für
   die Wiederaufnahme.
2. **Schreiben:** `PATCH …/contributions/[id]` `{markdownBody, expectedVersion}`,
   entprellt (alle 3 s und beim Verlassen).
3. **„Beitragen“:** `POST …/contributions/[id]/submit`. Voraussetzungen:
   Fenster offen, Text nicht leer **oder** mindestens eine Anlage
   `fertig`. Übergang `draft → pending`.
4. **„Später weiterschreiben“:** Der Beitrag bleibt `draft`. Schließt das
   Fenster, bevor er abgegeben ist, geht er **nicht** in die Synthese.
   Das sagt der Screen ausdrücklich, und der Entwurf bleibt in „Meine
   Beiträge“ sichtbar.
5. **Nach der Abgabe, solange das Fenster offen ist:** Weiteres Tippen ist
   ein **neuer Beitrag** („Weiteres beitragen“). Der abgegebene Text wird
   nicht still geändert.

### 4.2 Anlagen

1. `POST …/contributions/[id]/attachments` (multipart: `file`, `attachmentId`).
   Er nutzt `uploadInboxBinary` (`src/lib/submissions/inbox-upload.ts:33`)
   und die Größengrenzen aus `capture-size-guard.ts` (100 MiB je Datei,
   250 MiB gesamt). Die Anlage wird `hochgeladen`, ein Job startet, sie
   wird `wird_ausgewertet`.
2. **Ein Job je Anlage.** Heute nimmt `pickAnalyzableSource` nur die erste
   Quelle, und nur PDF oder Audio (`submission-analysis-job.ts:50`,
   `submission-media.ts:39-48`). Neu ist
   `buildAttachmentAnalysisJob(submission, attachment)`: gleiche Felder
   wie `buildSubmissionAnalysisJob` (`:134`), dazu
   `correlation.options.attachmentId`, `phases {extract: true, template:
   false, ingest: false}`. Gebraucht wird nur Text, keine Metadaten.
3. **Rückfluss:** `finalizeJobCompletion` (`finalize-completion.ts:59`)
   erkennt `attachmentId`. Er schreibt nur `attachments[i].text` und
   `state`, nie `markdownBody`. Ohne `attachmentId` bleibt das heutige
   Verhalten.
4. **Foto → Text:** Der Bildweg im Job-Start (`start/route.ts:1343`) lädt
   die Library über `LibraryService.getLibrary(job.userEmail, …)` (`:1650`).
   Das gelingt nur für Owner, eine Teilnehmerin bekäme
   `library_not_found`. Außerdem reicht er die Library an den Shadow-Twin-
   Service weiter, der für den Inbox-Bereich `null` erwartet.
   - **Anpassung:** Der Bildweg nutzt `resolveJobLibrary` und
     `resolveShadowTwinLibrary` wie der PDF-Weg (`external-jobs/provider.ts:61`, `:76`).
   - Die Vorlage für Fotos ist eine schlanke Bildbeschreibung mit OCR über
     `callImageAnalyzerTemplate` (`image-analyzer.ts:114`), eine neue
     Vorlage `beitrag-foto-text-de`.
   - Das ist ein Eingriff in `src/app/api/external/jobs/**`. Es gilt
     `contracts-pipeline`, mit Freeze-Test vorher.
5. **Gescheitert:** Die Anlage bleibt als Datei am Beitrag (`fehlgeschlagen`,
   `error`), mit „erneut auswerten“ und „entfernen“ (`verworfen`). Der
   Beitrag bleibt abgebbar. Späte Ergebnisse nach der Abgabe schreiben nur
   in die Anlage (Composer-Konzept §2.2).

### 4.3 Vertretung

Die Moderation wählt eine Teilnahme (D2), auch eine ohne Konto. Die
Submission bekommt:
- `createdBy` = E-Mail der Moderation (Bestand);
- `attribution.participantId` = die vertretene Person;
- `capturedBy`, `channel: 'proxy'` bzw. `'note'`.

In „Meine Beiträge“ erscheint der Beitrag bei der vertretenen Person, wenn
sie ein Konto hat (Filter über `attribution.participantId`, nicht nur über
`createdBy`).

### 4.4 Widerruf und Herausnehmen

- **Widerruf** durch die Person selbst oder durch die Moderation bei einer
  Teilnahme ohne Konto, bis zum Tisch-Abschluss (`widerruf_bis` aus
  `_treffen.md`): `POST …/contributions/[id]/withdraw` setzt `withdrawn`.
  Nach dem Fensterschluss wird zusätzlich der `beitrag_status` der Datei
  nachgezogen (D5).
- **Herausnehmen** durch die Moderation (Notbremse), Grund Pflicht, für
  alle am Tisch sichtbar: `POST …/contributions/[id]/remove` setzt
  `removed`.

## 5. Stille Runde beim Lesen

`GET …/contributions?tableId&passageId` liefert:
- **Teilnehmenden** nur die eigenen Beiträge (und die vertretenen);
- **der Moderation des Tisches**, solange das Fenster offen ist, nur
  `{participantId, displayName, submittedAt}` (wer, nicht was);
- nach dem Schließen alles.

Die Regel steht im Server (D4, D11), nicht in der Oberfläche.

## 6. Die Flow-Naht (ADR 0003)

Der Composer hat keine Felder, keinen Prüfschritt und keine Typwahl. Er
braucht die Schritt-Maschine des Wizards nicht. Er hängt dennoch an der
Flow-Entität, damit ADR 0003 die Naht bleibt:
- Ein Flow-Dokument `kind: 'wizard'`, `name: 'beitrag'`, als Seed nach dem
  Muster `seedStandardCaptureFlowForLibrary` (`flow-seed.ts:67`).
- Es hat die Quellen `spoken`, `text` und `file` und die Ausgabe
  `docType: beitrag`.
- `resolveWizardFlow` (`wizard-flow-entity.ts:120`, heute ohne Aufrufer)
  wird hier zum ersten Mal zur Laufzeit gerufen und liefert Quellenarten
  und Hilfetexte für den Composer. Leitfrage und Kontext kommen aus dem
  Tisch (D4), nicht aus dem Flow.

## 7. Schnittstellen

### 7.1 Bestand

| Zweck | Bestand |
|---|---|
| Submission anlegen, lesen, aktualisieren | `createSubmission` `:51`, `getSubmissionById` `:72`, `listSubmissions` `:88`, `updateSubmissionMetadata` `:102`, `changeSubmissionStatus` `:133`, `addSubmissionBinaryRef` `:164` (`wizard-submissions-repo.ts`) |
| Statusmaschine | `assertTransition`, `transitionSubmission` (`submission-status.ts:107`, `:143`) |
| Inbox-Upload | `uploadInboxBinary` (`inbox-upload.ts:33`), `getInboxProvider` (`inbox-provider-entry.ts:52`), Pfad `buildRootPrefix` (`inbox-path.ts:33`) |
| Größengrenzen | `checkDeclaredTotalSize`, `checkParsedFileSizes` (`capture-size-guard.ts:72`, `:103`) |
| Analyse-Job | `buildSubmissionAnalysisJob` (`submission-analysis-job.ts:134`), `finalizeJobCompletion` (`finalize-completion.ts:59`), `applyAnalysisResult` (`submission-analysis.ts:48`) |
| Foto → Text | `callImageAnalyzerTemplate` (`image-analyzer.ts:114`), Bildweg `start/route.ts:1343` |
| Live-Diktat | `DictationTextarea mode="live"` (`src/components/shared/dictation-textarea.tsx:19`, Props `:46`), Tickets `POST /api/secretary/realtime-session` (Clerk, Rate-Limit) |
| Flow | `resolveWizardFlow`, `seedStandardCaptureFlowForLibrary` |

### 7.2 Neu

| Baustein | Signatur |
|---|---|
| Typ-Erweiterung | `SubmissionAttachment`, `context`, `attribution`, `withdrawn`, `removed` (3) |
| Versionsschutz | `updateSubmissionMetadata(id, input, { expectedVersion? })` → `SubmissionVersionConflictError` |
| Anlage-Statusmaschine (rein) | `assertAttachmentTransition(from, to)` |
| Job je Anlage | `buildAttachmentAnalysisJob(submission, attachment): ExternalJob`; `extractAttachmentIdFromJob(job)` |
| Routen (`src/app/api/deliberation/[libraryId]/contributions/**`) | `POST /` (Entwurf) · `PATCH /[id]` · `POST /[id]/submit` · `POST /[id]/attachments` · `POST /[id]/attachments/[attId]/retry` · `DELETE /[id]/attachments/[attId]` · `POST /[id]/withdraw` · `POST /[id]/remove` · `GET /?tableId&passageId` (Stille Runde) |
| Flow-Seed | `seedContributionFlowForLibrary(libraryId, email)` |
| Vorlage | `beitrag-foto-text-de` (Bild → Text, OCR und Beschreibung) |

## 8. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Fenster geschlossen beim Abgeben | 409 „Die Ernte ist geschlossen“; der Entwurf bleibt, „Meine Beiträge“ zeigt ihn |
| Keine Teilnahme oder Vereinbarung nicht gelesen | 403 mit Hinweis auf T-S2.2 |
| Doppeltes Hochladen (Netz wackelt) | idempotent über `attachmentId` |
| Versionskonflikt beim Speichern | 409; der Client lädt neu und führt zusammen (Text ist Eigentum der Person, kein Überschreiben fremder Stände) |
| Live-Verbindung bricht ab | Bestand der Live-Transkription: Puffer und Nachtranskription; die Lücke wird angezeigt |
| Anlage zu groß | 413 mit Grenze |

## 9. Abweichungen vom Composer-Konzept (11.09.)

- Der Text ist der Beitrag selbst, keine Anlage. Es gibt keinen
  `proposal` und keinen Prüfschritt (Designstudie 19.09.).
- Kein eigenes Paket `@ks/capture` (Owner 23.09.).
- `withdrawn`/`removed` als Markierung statt als neuer Status.
- Wiederaufnahme nur über `submissionId` in `localStorage`. Die
  IndexedDB-Warteschlange für noch nicht hochgeladene Dateien (Composer
  C6, Schicht 2) ist zurückgestellt.
- Der Audio-Mitschnitt der Live-Diktate wird nicht hochgeladen. Der
  Bestand bietet dafür keinen Weg (`LiveDictationTextarea` hat keinen
  Audio-Callback, `recording-store.ts` wird nach dem Stopp gelöscht). Die
  Designstudie verlangt nur den Text („Rohaufnahmen bleiben am Tisch“).

## 10. Tests

- Anlage-Statusmaschine: jeder erlaubte und jeder verbotene Übergang.
- Routen mit gemocktem Repo:
  - Entwurf nur bei offenem Fenster und gültiger Teilnahme;
  - `submit` 409 bei geschlossenem Fenster;
  - `submit` bei leerem Text ohne fertige Anlage wird abgelehnt;
  - Versionskonflikt ergibt 409;
  - Stille Runde: Die Moderation sieht bei offenem Fenster keinen Text.
- Rückfluss mit `attachmentId` schreibt nur in die Anlage; ohne
  `attachmentId` bleibt das Verhalten wie heute (Freeze-Test vorher).
- Bildweg: Eine Contributor-Submission im Inbox-Bereich läuft ohne
  `library_not_found` durch.

## 11. Offene Fragen

1. Soll ein Audio-Mitschnitt je Beitrag möglich sein, etwa für die
   Moderation zur Kontrolle? Heute bewusst nein.
2. Wie viele Beiträge je Person und Fenster sind erlaubt? Vorschlag:
   beliebig viele, jeder mit eigener Zuschreibung.

## 12. Aufwand

| Teil | PT |
|---|---|
| Typen, Anlage-Statusmaschine, Versionsschutz, Repo | 1 |
| Routen Entwurf, Abgabe, Anlagen, Widerruf, Herausnehmen, Stille Runde | 1,5–2 |
| Job je Anlage, Rückfluss, Bildweg korrigieren, Foto-Vorlage | 1,5–2 |
| Flow-Seed, `resolveWizardFlow` anbinden | 0,5 |
| **Summe D3 (ohne Oberfläche)** | **4,5–5,5** |
