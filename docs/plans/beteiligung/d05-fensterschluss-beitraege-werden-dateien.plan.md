---
name: d05-fensterschluss-beitraege-werden-dateien
overview: "Detailkonzept D5: Beim Schließen eines Ernte-Fensters werden alle abgegebenen Beiträge des Themas als Markdown-Dateien mit flachem Frontmatter in den Ordner ihrer Organisation geschrieben, Anlagen daneben, ohne Suchindex. Stapel-Promotion auf der bestehenden Einzel-Promotion, eindeutige Dateinamen, Wiederholung bei Storage-Fehlern, vorläufige Organisationen, Widerruf nach dem Schließen."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D5 · Fensterschluss: Beiträge werden Dateien

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Übergang ②, Klasse **B**: vor der Promotion ist die Inbox das Original,
danach die Datei), [D2](d02-organisationen-und-personen.plan.md)
(Organisationsordner, vorläufige Organisation),
[D3](d03-beitragen.plan.md) (Beitrag mit Anlagen),
[D4](d04-tisch-laufzeit.plan.md) (`close_window`). Geprüft gegen `master`
579f2d7.

## 1. Zweck

Die Moderation schließt das Ernte-Fenster. Ab jetzt sind die Beiträge
Wissen der Library:
- lesbar im Archiv;
- in Obsidian sichtbar;
- Quelle der Synthese (D6).

Die Moderation drückt keinen eigenen Speichern-Knopf.

## 2. Was geschrieben wird

**Welche Beiträge:** alle Submissions mit `context.windowId` dieses
Fensters, `status: pending`, ohne `withdrawn`. Herausgenommene
(`removed`) werden **auch** geschrieben, mit `beitrag_status:
herausgenommen`. Nichts verschwindet; die Synthese lässt sie aus (D6).
Entwürfe (`draft`) werden nicht geschrieben (D3, 4.1).

**Wohin:** Die Pfadvorlage `Organisationen/{organisation}/Beiträge/{reihe}/{treffen}/`
(Architektur-Konzept 3.4, Owner 12.09.) wird so aufgelöst:
- `{organisation}` ist der Ordnername der Organisation aus dem Katalog
  (`organisations.folderPath`, D2).
- Bei unbekannter Organisation legt `ensureProvisionalOrganisation`
  zuerst Ordner und `_organisation.md` mit `status: vorlaeufig` an (D2,
  3.3).
- Bei „keine Organisation“ ist es `Einzelpersonen`. Das ist eine
  ausdrückliche Auswahl, kein stiller Standard.
- `{reihe}` und `{treffen}` sind die Ordnernamen der Planung (D1, aus
  `provenance.path`).
- Fehlende Ordner werden angelegt (find-or-create).

**Dateiname:** `{Datum} Tisch {n} {Textstelle-Kürzel} {Kurzname} {kurzId}.md`,
zum Beispiel `2026-11-13 Tisch 2 hf2-ziel-01 Kastelbell 7Q3K.md`.
- `kurzId` sind die letzten vier Zeichen der Submission-Id.
- Die Promotion leitet den Namen heute aus `metadata.title` ab
  (`buildDocumentSlugFallback`, `promotion.ts:62`). SHF-Beiträge haben
  keinen Titel. Außerdem wird eine Datei gleichen Namens **nicht** neu
  geschrieben (`promotion.ts:169-177`).
- Der Name muss deshalb **je Beitrag eindeutig und stabil** sein. Er
  kommt über `target.slug` herein.

**Datei:**

```markdown
---
docType: beitrag
detailViewType: testimonial
beitrag_id: 01JB7Q…
reihe_id: shf-2026
treffen_id: shf-2026-t1
tisch_id: shf-2026-t1-tisch2
textstelle_id: hf2-ziel-01
fenster_id: 01JB7P…
organisation_id: gemeinde-kastelbell
organisation: Gemeinde Kastelbell
gruppe: gem
kanal: self
beitrag_status: im_ergebnis
abgegeben_am: 2026-11-13T15:12:04Z
anlagen: ["zettel-01.jpg", "positionspapier.pdf"]
---

(Der gesprochene bzw. getippte Text.)

## Aus den Anlagen

### zettel-01.jpg

(Text aus dem Foto)

### positionspapier.pdf

(Text aus der PDF, bis zur Schwelle; darüber nur ein Verweis, siehe 4)
```

- `beitrag_status` ist `im_ergebnis | zurueckgezogen | herausgenommen`.
  Bei `herausgenommen` kommt `herausnahme_grund` dazu.
- **Kein Name der Person im Frontmatter**, bis der Vertrauensraum
  entschieden ist (Vorschlag V1, D0 und D11). Bei V2/V3 kommt
  `anzeigename` dazu.
- Der Name steht an der Submission (`attribution.displayName`) in
  MongoDB.
- `detailViewType: testimonial` ist eine bestehende Ansicht für kurze
  Stimmen (`packages/contracts/src/detail-view-type.ts:29-39`); ein neuer
  Typ ist nicht nötig.
- Das Frontmatter schreibt nur `createMarkdownWithFrontmatter`
  (`src/lib/markdown/compose.ts:3`). Die Liste `anlagen` wird dabei als
  JSON geschrieben und ist wieder lesbar.

**Anlagen:** Die Originale werden aus der Inbox in denselben Ordner
kopiert, mit `copyOriginalsToTarget` (`promotion-transcript.ts:46`). Eine
Datei gleichen Namens wird übersprungen. Damit zwei Beiträge mit
`IMG_0001.jpg` sich nicht überschreiben, wird der Dateiname um die
`kurzId` ergänzt (`IMG_0001 7Q3K.jpg`). Das ist eine Änderung an der
Namensbildung der Anlagen-Kopie.

## 3. Stapel über der Einzel-Promotion

Die Promotion gibt es heute nur je Submission (`performPromotion(id)`,
`promote-actions.ts:56`), mit Freigabe durch Owner oder Co-Creator und
immer mit Ingest (`:97`; einen Schalter gibt es nicht). Neu ist:

1. **`promoteSubmission`** (`promotion.ts:122`) bekommt die Option
   `ingest: false`. `upsertMarkdown` wird dann nicht gerufen. Die
   Promotion mit Ingest bleibt für die bestehenden Flows unverändert
   (Freeze-Test vorher).
2. **`promoteWindow(libraryId, windowId, actor)`** in
   `src/lib/deliberation/window-close/` erledigt den Stapel:
   - Beiträge laden; je Beitrag Organisation auflösen, bei Bedarf eine
     vorläufige anlegen;
   - `target.folderId` und `target.slug` setzen;
   - Status `pending → ready → publishing → published` über
     `transitionSubmission`. Die Freigabe übernimmt hier das System, als
     Folge von `close_window` (`kuratierung: notbremse`, Owner 12.09.).
     Der `actor` ist die Moderation, die geschlossen hat.
   - `promoteSubmission(…, { ingest: false })`.
3. **Rechte:** Die Moderation hat heute keinen Storage-Zugang
   (`server-provider.ts:78` prüft Co-Creator). Der Stapel läuft deshalb
   mit einem **Server-Provider der Library im Namen der Redaktion bzw.
   des Owners** (`getServerProvider(ownerEmail, libraryId)`). Das Recht
   dazu leitet sich aus der Rolle „Moderation dieses Tisches“ ab (D11).
   Im Protokoll steht die Moderation.
4. **Ablauf in Stufen, jede für sich wiederholbar:**
   - (a) Ordner sicherstellen;
   - (b) je Beitrag Originale kopieren, dann die `.md` schreiben;
   - (c) Status `published` mit `target.fileId` an der Submission;
   - (d) Sammelreferenz für D6 schreiben.

   Scheitert (b) an einem Beitrag, bleiben die übrigen gültig. Der
   gescheiterte geht zurück auf `ready` (Bestand: `revertToReady`,
   `promotion-errors.ts:43`) und wird erneut versucht.
5. **Wiederholung:** Das Fenster trägt `promotion {state: ausstehend |
   laeuft | fertig | teilweise, attempts, lastError}`. Bei `teilweise`
   zeigt die Moderation „Übertragung ins Archiv ausstehend (3 von 11)“ mit
   „erneut versuchen“. Ein Hintergrund-Wiederholer versucht es nach 1, 5
   und 15 Minuten erneut. Idempotent ist das durch den eindeutigen
   Dateinamen und das Überspringen vorhandener Originale.
6. **Laufzeit:** Bei 8–12 Beiträgen je Fenster sind es etwa 10–40
   Provider-Aufrufe. Der Stapel läuft **nicht** im Request, sondern als
   Job in der bestehenden Queue: `external_jobs` mit `job_type:
   'window-close'`, nach dem Muster des Sonder-Jobtyps `overlap-report`
   (`start/route.ts:266-288`). `close_window` antwortet sofort.

## 4. Lange PDFs

- Bis zu einer Schwelle (Vorschlag 12.000 Zeichen je Anlage) steht der
  Text der Anlage im Beitrag.
- Darüber steht im Beitrag nur ein Verweis `[[positionspapier.pdf]]`. Das
  PDF bekommt sein Transkript als Shadow Twin: Der Text aus der Inbox wird
  mit `ShadowTwinService.upsertMarkdown({kind: 'transcript'})` an die
  kopierte PDF gehängt, Muster `promoteTranscriptOnly`
  (`promotion-transcript.ts:84`).
- Die Sammelreferenz (D6) führt dann beide als Quellen. Das Transkript
  wird nicht noch einmal gerechnet.

## 5. Widerruf und Herausnehmen nach dem Schließen

Bis zum Tisch-Abschluss (D3, 4.4) schreibt ein Widerruf oder ein
Herausnehmen den neuen `beitrag_status` in die Datei. Das geschieht mit
`ersetzeTextDatei` (`src/lib/storage/update-text-file.ts:33`, versioniert
mit `ifVersion`) und nur für das Frontmatter-Feld. Danach wird die
Sammelreferenz neu geschrieben (D6). Nach dem Tisch-Abschluss sind beide
gesperrt (409).

Hat jemand die Datei inzwischen von Hand geändert, gewinnt die Datei
(D0, Klasse B). Der Statuswechsel wird trotzdem nur auf das eine Feld
angewandt. Scheitert die Versionsprüfung, wird neu gelesen und erneut
gepatcht.

## 6. Schnittstellen

### 6.1 Bestand

| Zweck | Bestand |
|---|---|
| Einzel-Promotion | `promoteSubmission(args): PromotionResult` (`promotion.ts:122`), Args `promotion-types.ts:91` |
| Originale kopieren | `copyOriginalsToTarget` (`promotion-transcript.ts:46`); `loadOriginal` über `getBinary(ref.itemId)` (`promote-injections.ts:55`) |
| Frontmatter | `buildPublishFrontmatter` (`publish-frontmatter.ts:38`), `createMarkdownWithFrontmatter` (`compose.ts:3`) |
| Fehler und Rücksetzen | `classifyPromotionError`, `revertToReady` (`promotion-errors.ts:63`, `:43`) |
| Statusmaschine | `transitionSubmission` (`submission-status.ts:143`) |
| Ordner finden oder anlegen | heute viermal lokal kopiert (`ensureChildFolderId`, z. B. `api/public/testimonials/route.ts:26`) bzw. `ordnerSicherstellen` (`src/lib/mcp/storage/pfad-helfer.ts:17`) |
| Transkript an eine kopierte Datei | `ShadowTwinService.upsertMarkdown`, Muster `promoteTranscriptOnly` |
| Datei-Feld versioniert ändern | `ersetzeTextDatei` (`update-text-file.ts:33`), `StorageVersionConflictError` |
| Job-Queue | `external_jobs`, Sonder-Jobtyp-Muster `overlap-report` |

### 6.2 Neu

| Baustein | Signatur |
|---|---|
| Option `ingest` | `promoteSubmission(args & { ingest?: boolean })` (Vorgabe `true`, also Verhalten wie heute) |
| Ordner-Helfer (geteilt) | `ensureFolderPath(provider, rootId, segments: string[]): Promise<string>` in `src/lib/storage/` (ersetzt die lokalen Kopien bei nächster Berührung) |
| Dateiname | `buildContributionFileName(ctx): string` (rein, getestet) |
| Beitrags-Markdown | `buildContributionMarkdown(submission, ctx, { attachmentTextLimit })` (rein) |
| Stapel | `promoteWindow(libraryId, windowId, actor): Promise<WindowPromotionReport>` |
| Job | `job_type: 'window-close'`; `enqueueWindowClose(windowId)`; Wiederholer |
| Status-Patch | `setContributionFileStatus(provider, fileId, status, reason?)` |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Storage-Anmeldung abgelaufen | Stapel `teilweise` bzw. `ausstehend`, `needsReauth` (Bestand); Redaktion/Owner bekommt Hinweis; Beiträge bleiben in der Inbox gültig |
| Organisation unbekannt, Anlegen scheitert | dieser Beitrag bleibt `ready`, Meldung; die übrigen laufen |
| Anlage in der Inbox fehlt (Blob gelöscht) | Fehler an diesem Beitrag, **nicht** still ohne Anlage schreiben |
| Doppelter Aufruf `close_window` | idempotent (Fenster schon geschlossen → 409; Job läuft nur einmal je `windowId`) |

## 8. Tests

- `buildContributionFileName`: Eindeutigkeit, Umlaute, Längengrenze.
- `buildContributionMarkdown`: mit und ohne Anlagen, Schwelle für lange
  PDFs, `herausgenommen` mit Grund, kein Name bei V1.
- `promoteSubmission` mit `ingest: false`: `upsertMarkdown` wird nicht
  gerufen. Freeze-Test: Ohne die Option ist alles wie heute.
- `promoteWindow` mit gemocktem Provider: Teilausfall, Wiederholung ohne
  Dubletten, vorläufige Organisation, Namenskollision der Anlagen.
- Status-Patch: Versionskonflikt → neu lesen und erneut patchen.

## 9. Offene Fragen

1. Die Schwelle für lange Anlagen (Vorschlag 12.000 Zeichen).
2. Ob die Beiträge je Tisch zusätzlich unter der Veranstaltung verlinkt
   werden sollen (Übersichtsdatei). Vorschlag: Das leistet die
   Sammelreferenz (D6).

## 10. Aufwand

| Teil | PT |
|---|---|
| `ingest`-Option mit Freeze-Test, Ordner-Helfer, Dateiname, Markdown-Aufbau | 1 |
| Stapel als Job mit Stufen, Wiederholung, Bericht | 1–1,5 |
| Lange PDFs als Transkript, Status-Patch | 0,5–1 |
| **Summe D5** | **2,5–3,5** |
