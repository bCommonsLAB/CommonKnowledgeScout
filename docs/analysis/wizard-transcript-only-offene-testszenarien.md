# Offene Testszenarien: transcript-only / Promotion / B2d

Status: lebende Checkliste. Branch: `claude/confident-maxwell-9sz7cq`.
Bezug: `wizard-b2d-test-befunde.md`, `wizard-transcript-only-assets-mirror.md`,
`b2d-mikroentscheidungen.md`, ADR-0004.

Zweck: festhalten, was beim Test des transcript-only-Flows bereits **verifiziert**
ist und welche Kombinationen (Target-Typen, Rollen, Storage-Backends) noch
**ungetestet** sind — damit vor Merge / in der nächsten Session nichts übersehen
wird.

## Bereits live verifiziert (Owner, OneDrive-Mongo)

- Flow: „Inhalte erfassen" → `blog-writer-pilot.pdf` → **„Nur importieren und
  transkribieren"** (`docType=transcript`).
- Rolle: **Owner** (sofort approve → promote).
- Library: **OneDrive Test** (Mongo-primary, „Dot-Folder: nein").
- Ergebnis: Befunde 1–3 aus `wizard-b2d-test-befunde.md` behoben und bestätigt
  (Zähler „Bilder/Assets", fremde Bilder via `sourceId`-präziser Lese-Route,
  Zielordner-Name, Text-Tab-Hinweis).

## Noch NICHT getestet (offen)

### A) Andere Target-/Doc-Typen (nur transcript-only getestet)

Der Promote-Pfad verzweigt in `promoteSubmission` nach `submission.docType`:
- `transcript` → `promoteTranscriptOnly` (Original + Transkript-Twin + **B2d-
  Asset-Spiegelung**, kein Standalone-MD, kein RAG-Ingest).
- **alles andere** → Normalpfad (Standalone-Markdown + RAG-Ingest), KEINE
  Asset-Spiegelung.

Offen zu testen:
- [ ] Normaler Dokument-Typ (z.B. `testimonial`/`event`/…): Standalone-MD landet
      im Ziel, RAG-Ingest läuft, Summary korrekt.
- [ ] Doc-Typ mit Bildern im Normalpfad: werden Bilder dort erwartet/aufgelöst?
      (B2d greift hier bewusst NICHT — Verhalten dokumentieren, nicht raten.)
- [ ] Verschiedene `detailViewType` (Renderer/Detail-Ansicht im Archiv/Galerie).

### B) Nicht-Owner-Rolle → Wartekorb (nur Owner getestet)

`performPromotion` ist owner/co-creator-gated; `contributor`/`moderator` legen
nur in den **Wartekorb** (Inbox-Submission, Status `pending`/`ready`) ab. Die
Promotion (inkl. B1/B2a/B2d) passiert ERST später bei Review+Promote durch einen
Reviewer. Dieser Pfad ist komplett ungetestet.

Offen zu testen:
- [ ] Erfassung als **contributor** → Submission landet im Wartekorb (kein
      sofortiges Promote), Summary zeigt „Im Wartekorb — wird geprüft".
- [ ] **Review** durch Owner/Co-Creator → approve → promote: Original-Kopie,
      Transkript-Twin und **B2d-Asset-Spiegelung** laufen jetzt nachgelagert.
- [ ] Ablehnung (reject) → kein Ziel-Schreibvorgang.
- [ ] co-creator-Erfassung (eigene Rechte) vs. moderator (darf nicht promoten).

### C) Storage-Backend (nur OneDrive-Mongo getestet)

Nur Mongo-primary getestet. FS-primary verhält sich bei Shadow-Twin/Bild-
Auflösung anders (Dot-Folder-Dateien statt Mongo-Fragmente; Lese-Route-Pfad).

Offen zu testen:
- [ ] **FS-primary** Library (lokal): transcript-only → Bilder als Dateien im
      Ziel-Dot-Folder, Transkript zeigt sie korrekt (kein library-weites Raten).
- [ ] Idempotenz live: **Re-Promote** dupliziert keine Assets (FS + Mongo).
- [ ] PDF **ohne** Bilder: Mirror liefert leere Liste, Summary „Bilder: 0"
      stimmt dann tatsächlich.
- [ ] Quelle mit mehreren `binaryRefs` (mehrere Originale).

### D) Anzeige-Coverage des `sourceId`-Fixes (Befund 2)

Der `sourceId`-präzise Lese-Pfad ist nur in pdf/audio/video/office-view
verdrahtet. Andere Transkript-Renderer geben `sourceId` noch NICHT mit und
treffen den library-weiten Legacy-Pfad (latente „fremde Bilder"-Gefahr bei
generischen Namen wie `img-0.jpeg`).

Offen zu prüfen/testen:
- [ ] `website-view.tsx` (4× `ArtifactMarkdownPanel`) — `sourceId` nachziehen?
- [ ] `markdown-view.tsx` (2×) — `sourceId` nachziehen?
- [ ] Galerie-/Detail-Ansichten, die Transkripte/Transformationen mit Bildern
      rendern (außerhalb der File-Preview-Views).

## Hinweise zur Priorisierung

- **B/Wartekorb** ist funktional der wichtigste ungetestete Pfad (andere Rolle,
  nachgelagertes Promote) — dort laufen B1/B2a/B2d erst zum Review-Zeitpunkt.
- **C/FS-primary** deckt die zweite Hälfte der Dual-Logik ab (B2d-Kernversprechen
  „FS+Mongo an einer Stelle").
- **D** ist app-weite Härtung des Wurzelfixes (geringeres, aber reales Risiko).
- **A** ist Regressions-Absicherung des unveränderten Normalpfads.
</content>
