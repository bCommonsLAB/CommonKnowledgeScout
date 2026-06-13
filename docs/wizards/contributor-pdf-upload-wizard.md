# Contributor-PDF-Upload-Wizard — Erfassung in die Quarantäne

- **Art:** Erfassungs-Wizard für Anwender **ohne Archiv-(Storage-)Zugang** (Rolle `contributor`, auch co-creator/owner)
- **Status:** 🟡 Entwurf — Stufe A (Upload) in Umsetzung (2026-06-04)
- **Verwandt:** [ADR-0004](../adr/0004-capture-publish-entkopplung-inbox-modell.md) (Inbox/Quarantäne + Nachtrag „Erfassungs-Einstieg nach Rechten"),
  [Flow Upload→Analyse→Abnahme→Publikation](dokument-upload-analyse-publizieren.md),
  [`test-library/templates/pdfanalyse.md`](../../test-library/templates/pdfanalyse.md) (Analyse-Schema)

## Zweck (Sinn des Wizards)

Anwender **ohne Archiv-Zugang** sollen Inhalte beitragen, ohne den Owner zu
belasten. Der Wizard ist **nicht nur ein Upload** — der Contributor soll die
**eigentliche Fleißarbeit dem Owner abnehmen**:

> PDF hochladen → transkribieren → transformieren → das Ergebnis (**Metadaten,
> Body, Kapitelstruktur**) **selbst prüfen und korrigieren** → speichern.

Erst das **geprüfte** Ergebnis landet als `pending`-Submission im **Wartekorb**.
Die **finale Freigabe/Publikation** bleibt beim **Reviewer** (owner/co-creator).

**Invariante (ADR-0004):** Der gesamte Wizard läuft **storage-unabhängig** — nur
**MongoDB + Azure Blob** („Quarantäne"), **nie** der Ziel-Provider. Das ist die
zentrale Herausforderung (siehe Stufe B).

## Rollen

- **Contributor / co-creator / owner:** dürfen erfassen (Wizard bedienen).
- **Reviewer (co-creator / owner):** nimmt im Wartekorb ab. Der Contributor
  nimmt **nicht** final ab — er bereitet auf (prüft die Metadaten).

## Einstieg

Rechte-gateter Button **„Inhalte erfassen"** in der **Galerie/Erkunden**-Ansicht
(MongoDB-Welt, kein Storage nötig) — NICHT über das „+" im Archiv (Storage).
Siehe ADR-0004-Nachtrag.

## Zwei-Stufen-Rollout

### Stufe A — NUR Upload (jetzt) ✅ im Bau
- Contributor wählt PDF → Upload in den **Blob-Inbox-Bereich** → `pending`-
  Submission (docType `pdfanalyse`, detailViewType `book`, `binaryRefs`=[PDF],
  Titel = Dateiname, **noch keine Analyse**).
- Erscheint im **Wartekorb**. Beweist den Erfasser→Quarantäne→Wartekorb-Pfad
  **ohne jeden Storage-Zugriff**.
- **Im Wizard sichtbar vermerkt:** „Schritt 2 — Metadaten prüfen & korrigieren
  folgt." Damit ist der volle Zweck dokumentiert, auch wenn er noch nicht läuft.

### Stufe B — Transkript + Transform + Prüfen (nächster Schritt) 🔴
- **Transkript + Transform** über den **Secretary-Service**, aber
  **storage-unabhängig** (das ist die große Herausforderung, s.u.).
- Wizard zeigt das Ergebnis; Contributor **prüft/korrigiert** Metadaten, Body,
  Kapitelstruktur (Confidence hebt Unsicheres hervor) → speichert.
- **Bilder** aus dem PDF werden — wie heute — im **Blob** abgelegt (content-
  addressed), referenziert über `binaryRefs`.

## Die storage-unabhängige Herausforderung (Stufe B)

Der Secretary-Service erledigt OCR/Transkript/Transform automatisch — **aber der
heutige external-Job-Flow ist storage-gebunden** (liest das PDF aus dem Provider,
schreibt Artefakte in den Provider). Off-target zu lösen heißt, **eine** dieser
Optionen zu wählen (Entscheidung bei Stufe B, mit Code-Prüfung):
- **(X)** external-Job **off-target umbauen:** Input = Blob-PDF, Output = in die
  Submission/den Blob.
- **(Y)** storage-frei: `process-text` (Transform ohne Job) + Transkript separat
  (z.B. Secretary-Sync-Extract).

## Abhängigkeiten der Transformation

- **Template:** `pdfanalyse` (an den docType gebunden; bestimmt die extrahierten
  Felder). Off-target-Verhalten via `process-text` **noch zu verifizieren**.
- **LLM:** wird vom **Secretary-Service** gewählt (Konfig: Settings →
  Secretary-Service / Default). Der Wizard wählt keine LLM pro Lauf.
- **Themen-Vokabular pro Library:** wird heute nur im external-Job injiziert →
  bei `process-text` (Weg Y) ginge es verloren (Qualitätslücke, später schließen).

## Bewusst NICHT (vorerst)

- **Publizieren (W5)** — außerhalb dieses Scopes.
- **Excel** — spätere Scheibe; Start mit PDF.
- Kein OCR-Code in KnowledgeScout — das macht der Secretary-Service.

## Erfolgskriterien

- [ ] `UI` Stufe A: Contributor (ohne Storage) lädt PDF hoch → `pending`-
  Submission erscheint im Wartekorb; **kein** Provider-Schreibzugriff.
- [ ] `UI` Einstieg „Inhalte erfassen" nur sichtbar für contributor/co-creator/owner.
- [ ] `auto` Submission trägt `binaryRefs` (Blob-URL/Hash) + docType/detailViewType.
- [ ] *(Stufe B)* Transkript/Transform off-target; Contributor prüft/korrigiert
  Metadaten/Body/Kapitel; Bilder im Blob.
- [ ] *(Stufe B)* Reviewer nimmt im Wartekorb ab (bereits gebaut).

## Architektur-Update 2026-06-04 — gelöst über dünnen Inbox-Provider

Die „storage-unabhängige Herausforderung" (oben) wird **vereint** gelöst (siehe
[ADR-0004 Nachtrag II](../adr/0004-capture-publish-entkopplung-inbox-modell.md)):
Der Inbox-Bereich wird ein **dünner Blob-`StorageProvider`** (NUR Inbox,
content-addressed, kein move/rename). Damit läuft die **bestehende Pipeline
unverändert** über den Provider (kein Doppel-Code), ohne das Owner-Archiv zu
berühren. Der Upload aus Stufe A geht **bereits über diesen Provider** (kein
Wegwerf-Endpoint). Wellen-Reihenfolge: **I** Provider → **II** Stufe A → **III**
Stufe B → **IV** Owner-Sichten → **V** Promote. Detail:
[abnahme-inbox-plan.md](abnahme-inbox-plan.md).
