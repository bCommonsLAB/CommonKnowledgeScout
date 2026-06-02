# Umsetzungsplan: Abnahme / Inbox (ADR-0004) — kein Code, zum Abnehmen

> Operationalisiert [ADR-0004](../adr/0004-capture-publish-entkopplung-inbox-modell.md)
> für den Flow [Upload→Analyse→Abnahme→Publikation](dokument-upload-analyse-publizieren.md).
> Grundlage: [Bestandsaufnahme](dokument-upload-analyse-publizieren-bestandsaufnahme.md).
> Stand 2026-06-02 — **Entwurf zur Abnahme**.

## In einfacher Sprache

Heute schreibt das System Dokumente direkt ans Ziel — das geht schief, wenn der
Speicher offline ist oder Rechte fehlen. Der Plan: Hochgeladenes/Analysiertes
landet zuerst in einer **internen Inbox** (immer verfügbar). Dort **nimmt** eine
berechtigte Person es **ab** (prüft die inhaltlichen Pflichtfelder, korrigiert,
unsichere Felder sind markiert). Erst die **Freigabe** stößt die Veröffentlichung
an — als wiederholbarer Job, der bei Speicher-/Token-Problemen **nicht abstürzt**,
sondern es später erneut versucht.

## Leitplanken (aus ADR-0004)

- **Invariante:** Erfassung schreibt **nie** ins Ziel — nur in die Inbox
  (MongoDB-Dokument + Azure Blob für Binärdaten). Keine Binärdaten in MongoDB.
- **Publikation** = idempotenter, **rechte-gateter** Job (eigene Job-Domäne,
  ADR-0001 beachten).
- **Preview** kommt aus dem Staging (nur Markdown + Metadaten nötig).

## Datenmodell — Submission (neue Collection `wizard_submissions`)

| Feld | Inhalt |
|---|---|
| `_id`, `libraryId` | Ziel-Library |
| `status` | `draft│pending│ready│publishing│published│rejected` |
| `createdBy`, `createdByRole`, `writeKey?` | Erfasser (Login **oder** kontolos) |
| `wizardId`, `docType`, `detailViewType` | Ergebnis-Typ (für Renderer + Pflichtfelder) |
| `metadata`, `markdownBody` | das erfasste/analysierte Ergebnis |
| `binaryRefs[]` | Azure-Blob-Referenzen (Hash/URL), **keine** Binärdaten in Mongo |
| `confidence` | `Record<feldname, 0..1>` aus der Analyse (für Hervorhebung) |
| `target` | `{ folderId?, slug? }` |
| `review` | `{ reviewedBy?, reviewedAt?, note? }` |
| `events[]` | Audit-Trail (Status-Wechsel, wer/wann) |
| `createdAt`, `updatedAt`, `version` | Standard |

## Rollen & Rechte

- **Erfassen** (Submission anlegen): neue Rolle **`contributor`**, dazu
  `co-creator`, `owner` — **plus** kontolos per **Write-Key/QR**.
- **Abnehmen + Publizieren**: `co-creator`, `owner` (Reviewer-Recht).
- **Co-Autor-Pfad:** hat der Erfasser bereits Publish-Recht → kann im selben
  Flow freigeben.
- **Zustandsübergänge** (wer darf):
  `draft→pending` (Erfasser) · `pending→ready` (Reviewer gibt frei) ·
  `ready→publishing→published` (Promotion-Job) · `*→rejected` (Reviewer).

## Bausteine (Reihenfolge)

- **B6 — Inhaltliche Pflichtfelder (Vorarbeit, klein):** reine Funktion
  `contentRequiredFields(viewType)` = `requiredFields` − technische Felder
  (`language`, `targetLanguage`, `slug`, `docType`, …; zentrale Liste).
  + Unit-Tests. *Voraussetzung für die Abnahme-Ansicht.*
- **W1 — Submission-Modell + Repo:** Typen, MongoDB-Repo (CRUD +
  Status-Übergänge als Funktionen), Azure-Blob-Inbox-Bereich. Tests, keine UI.
- **W2 — Erfassung → Inbox:** Analyse-/Wizard-Ergebnis erzeugt
  Submission(`pending`) statt Direkt-Schreiben; Preview aus Staging;
  `wizard-artifact-promotion.ts` von „same-provider move" entkoppeln.
- **W3 — `contributor`-Rolle:** Modell in `src/types/library.ts` + Auth-/
  Membership-Prüfungen (`library-service.ts`, Middleware).
- **W4 — Inbox-UI (Abnahme):** Liste offener Submissions (im Archiv) + Detail:
  zeigt **inhaltliche Pflichtfelder** (B6), **markiert unsichere Felder**
  (Confidence; Muster: `diva-texture-card.tsx`), bearbeiten, **Freigeben/Ablehnen**.
- **W5 — Promotion-Job:** idempotent, rechte-gated; **Token weg** → bleibt
  `ready` + Re-Auth-Aufforderung + Retry; **Storage offline** → Backoff-Retry,
  kein halb-geschriebener Zustand; **Erfolg** → Ziel-Provider + RAG-Index +
  `published`. Nutzt vorhandene Publish-Routen + Job-Infra.
- **W6 — Aufräum-Policy:** `published`/`rejected` Submissions/Blobs nach Frist
  entfernen.

## Geplante API-Routen

- `POST /api/submissions` — anlegen (Login oder Write-Key)
- `GET /api/submissions?libraryId=…` — Inbox-Liste (rechte-gated)
- `GET /api/submissions/[id]` — Detail + Preview
- `PATCH /api/submissions/[id]` — Metadaten korrigieren
- `POST /api/submissions/[id]/approve` · `…/reject`
- `POST /api/submissions/[id]/promote` — Promotion-Job einreihen

## Anbindung an Bestehendes (aus der Bestandsaufnahme)

- **Analyse** (fertig): `phase-template.ts`/`phase-ingest.ts` liefern Metadaten
  **und** Confidence → fließen in die Submission.
- **Publikation** (teils da): `docs/publish`, `publish-site`, `publish-final`
  werden vom Promotion-Job **nach Freigabe** genutzt.
- **Renderer/Pflichtfelder:** `VIEW_TYPE_REGISTRY` (geteilte Quelle, ADR-0003).

## Erfolgskriterien (= ADR-0004 §5.2-Fälle)

- [ ] `contributor` erfasst → Submission `pending`, **Preview sichtbar**, kein Publish.
- [ ] `owner`/`co-creator` erfasst → Co-Autor-Pfad: sofort publizierbar.
- [ ] Write-Key/QR (kontolos) → Submission ohne Login, landet in Inbox.
- [ ] Promotion bei **abgelaufenem Token** → bleibt `ready`, Re-Auth, Retry — **kein Absturz**.
- [ ] Promotion bei **Storage offline** → Backoff-Retry, kein halb-geschriebener Zustand.
- [ ] Reviewer lehnt ab → `rejected`, **kein** Ziel-Schreiben.
- [ ] B6: `contentRequiredFields(viewType)` schließt technische Felder aus (Unit-Test).

## Offene Fragen / Risiken

- Darf `moderator` auch freigeben, oder nur `co-creator`/`owner`?
- **Excel/Markdown-Upload:** eigener Analyse-Pfad nötig (Excel fehlt heute).
- **Write-Key generalisieren** (heute nur `testimonialWriteKey`): Umfang/Sicherheit?
- **Aufbewahrung:** Frist für `published`/`rejected` vor Cleanup?
- Multi-Schema-Submissions (z.B. „Event finalisieren") — wie referenziert?

## Aufwand & Empfehlung

Mehrwöchig, in Scheiben. **Empfohlener Start: B6** (klein, testbar, sofort
nützlich), dann **W1 + W2** (Inbox-Kern), danach W4 (Abnahme-UI) als sichtbarer
Mehrwert; W3/W5/W6 begleitend.
