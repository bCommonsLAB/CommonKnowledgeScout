# RUNBOOK — Test-Library lokal in Betrieb nehmen

> Diese Schritte brauchen eine **laufende MongoDB** und werden **lokal**
> ausgeführt (nicht in der Cloud-Session). Die Cloud-Session hat nur die
> Definition-Schicht erzeugt + die Parse-Absicherung (`pnpm test`).

## 0. Voraussetzungen

- `.env` mit gültiger `MONGODB_URI` (lokale oder Dev-DB — **keine** Prod-DB).
- `pnpm install` ausgeführt.
- Branch `claude/knowledge-scout-wizard-ux-yjOwS` ausgecheckt und gepullt.

## 1. Parse-Absicherung (DB-frei, schnell)

```bash
pnpm vitest run tests/unit/templates/test-library-fixtures.test.ts
```

Erwartung: alle Fixtures parsen fehlerfrei (in der Cloud bereits grün, 19/19).

## 2. Templates in MongoDB seeden

```bash
TEST_LIBRARY_ID=test-kitchen-sink \
TEST_LIBRARY_USER=peter.aichner@crystal-design.com \
  pnpm tsx scripts/seed-test-library.ts
```

Idempotent: erneutes Ausführen aktualisiert die Templates, ohne zu duplizieren.
Ergebnis: 6 Templates unter `libraryId=test-kitchen-sink` in der Collection
`templates`.

## 3. Library im UI anlegen / verknüpfen

Die Templates hängen an `libraryId=test-kitchen-sink`. Damit der Wizard sie
zeigt, muss eine Library mit **genau dieser ID** existieren und dem Seed-User
zugeordnet sein.

**Achtung:** Neue Libraries bekommen im UI eine zufällige **UUID** als ID
(`uuidv4()` in `use-library-form.ts`) — die ID lässt sich dort **nicht** auf
`test-kitchen-sink` setzen. Praktischer Weg:

1. Library im UI anlegen (Settings → Libraries), Typ **local** genügt.
2. Echte ID herausfinden:
   ```bash
   TEST_LIBRARY_USER=peter.aichner@crystal-design.com pnpm tsx scripts/list-libraries.ts
   ```
3. Templates auf diese ID neu seeden:
   ```bash
   TEST_LIBRARY_ID=<echte-uuid> \
   TEST_LIBRARY_USER=peter.aichner@crystal-design.com \
     pnpm tsx scripts/seed-test-library.ts
   ```

Die Creation-Typen-Liste des Wizards kommt aus den Templates (gefiltert nach
`libraryId`, gemerged mit Built-ins) — Seeden genügt, keine separate
`config.creation.types`-Pflege nötig.

## 4. Wizard manuell durchklicken (Smoke-Test)

| Use-Case | erwartetes Verhalten |
|---|---|
| `event` (Story aus Ordner) | Schritte inkl. „Artefakte auswählen", Quelltypen Text/URL/Ordner |
| `testimonial` | Diktat-Quelle, kurzer Flow, Bild-Upload für `author_image_url` |
| `dialograum` | „Testimonials zuordnen"-Schritt erscheint, Datei+Text |
| `pc-steckbrief` | Vorschau rendert `refurbedDevice` → **Renderer-Drift beobachten** |
| `pdfanalyse` | erscheint NICHT im Wizard (schema-only, JobWorker) |
| `event-final` | 🎯 lädt heute nur als generisches Template (`extends` ohne Wirkung) |

## 5. Charakter-Tests schreiben (§5.3, Sicherheitsnetz)

Gegen diese Library, **bevor** die generische Runtime (Phase 3a) gebaut wird:

- Flow-Steuerung: Step-Filter, `canProceed` je Preset, Navigation.
- Kompatibilität: Wizard-Feld fehlt im Schema → klarer Fehler.
- Renderer: jeder `detailViewType` rendert (Preview + Galerie).
- (Nach Inbox-Modell, ADR-0004) Submission-Lebenszyklus + Promotion-Retry.

## 6. Noch NICHT enthalten (bewusst)

| Thema | Warum | Wann |
|---|---|---|
| Inbox-/Submission-Seed (ADR-0004 §5.2) | Inbox-Modell noch nicht implementiert | nach Phase 3 / wenn Submission-Repo existiert |
| `extends`-Auflösung (R1) | Runtime konsumiert `extends` noch nicht | Phase 3a |
| `topicsVocabulary`-Injektion (R2) | Schema-Config-Mechanik noch nicht gebaut | Phase 3a |

## 7. O1 entscheiden (Feld-Bindung)

Mit den realen Fällen dieser Library (event `$all`-artig, event-final gemischt,
pdfanalyse schema-only ohne Wizard) ist jetzt entscheidbar, ob das
Feld-Bindungsmodell generisch oder rollenbasiert wird → Ergebnis in ADR-0003
nachtragen (O1 schließen).
