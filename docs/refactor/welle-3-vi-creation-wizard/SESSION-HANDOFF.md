# Session-Handoff — Wizard/Template-Neuordnung (Welle 3-VI)

> Stand: 2026-05-31. Zusammenfassung der Konzept-Session + Fahrplan für die
> Offline-Fortsetzung. Branch: `claude/knowledge-scout-wizard-ux-yjOwS`.
>
> Diese Session war **reine Architektur-/Konzeptarbeit** (nur Doku, kein
> Produktivcode). Ergebnis: ein vollständig dokumentiertes, in sich
> konsistentes Fundament für die Umsetzung.

## 1. Was wir besprochen & produziert haben

Ausgangspunkt: Der Creation-Wizard sollte einfachen Anwendern das Erfassen von
Stories/Daten ermöglichen — war aber instabil und UX-schwach. Wir sind von der
Symptom-Analyse bis zu den Architektur-Entscheidungen durchgegangen.

### Fünf committete Artefakte

| Commit | Datei | Inhalt |
|---|---|---|
| `0dda854` | `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md` | Schwachstellen-Analyse: architektonische + UI/UX-Mängel mit file:line-Belegen |
| `03b0646` | `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md` + `docs/creation-wizard/ux-anforderungen.md` | Refactor-Plan (Sub-Wellen, Diff-Budget, Stop-Gates) + UX-Anforderungs-Skelett |
| `92746f5` | `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md` | Inventur aller 26 template-samples (Drift, Familien, Vokabular) |
| `678f88b` | `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md` | ADR-0004: Inbox-/Submission-Modell |
| `74d8994` | `docs/adr/0003-wizard-schema-template-trennen.md` | ADR-0003: Wizard/Schema trennen |

## 2. Die zentralen Erkenntnisse

1. **Symptom**: `creation-wizard.tsx` = 4.219 Zeilen (Regel: 200), ~24 Hooks,
   14+ `if (templateId === …)`-Sonderfälle, 0 Tests, Silent Fallbacks,
   Storage-Branch in der UI, `window`-Hack, 3 konkurrierende Speicherpfade.
2. **Wurzel A — Verschmelzung**: Eine Template-Entität bündelt 5 Belange
   (Datenmodell + Flow + Renderer + Extractor + sogar Lauf-Daten). Aber:
   **17 von 26** Vorlagen leben schon als reines Schema; das Flow-Vokabular ist
   klein (9 Presets, 5 Quellen). Die Trennung ist zu ⅔ schon Realität.
3. **Wurzel B — Direkt-Persistenz**: Der Wizard schreibt bei Erfassung direkt
   in einen Storage, der offline / Token-abgelaufen sein kann und für den
   Erfasser evtl. gar nicht schreibbar ist → die Hauptquelle der Instabilität.

## 3. Die getroffenen Architektur-Entscheidungen

### ADR-0003 — Wizard und Schema trennen
- **Schema** (`docType`): Felder + **Renderer** (`detailViewType`) + **Extractor**
  (`systemprompt`) — von Wizard **und** JobWorker konsumiert.
- **Wizard** (Flow): Steps/Presets/Quellen — generisch, Community-fähig.
- **Run-Input**: konkrete Daten → Eingabe einer Submission, nicht in der Vorlage.
- Laufzeit: **Merge** Wizard ⊕ Schema + Kompatibilitätsprüfung; Renderer aus dem
  bestehenden `VIEW_TYPE_REGISTRY`.
- **Offen**: Feld-Bindungsmodell (generisch vs. rollenbasiert) — Entscheidung
  nach der Test-Library.

### ADR-0004 — Capture-Publish entkoppeln (Inbox)
- **Invariante**: Der Wizard schreibt bei Erfassung **nie** in den Ziel-Provider.
- **Staging**: MongoDB (Submission-Dokument) + Azure Blob (Binärquellen,
  content-addressed wie Bilder). **Keine Binaries in MongoDB.**
- **Rechte**: neue Rolle `contributor` **und** generalisierter Write-Key/QR.
- **Publikation**: rechte-gateter (`owner`/`co-creator`), idempotenter,
  token-bewusster **Promotion-Job**. Erfasser mit Recht publiziert sofort
  (Co-Autor); sonst wartet die Submission in der Inbox.
- **Preview**: immer aus dem Staging — unabhängig vom Publish-Status.

## 4. Offene Entscheidungen (vor/in der Umsetzung)

| # | Entscheidung | Wann |
|---|---|---|
| O1 | Feld-Bindung Wizard↔Schema (generisch vs. rollenbasiert) | nach Test-Library (Phase 2) |
| O2 | Aufräum-Policy für `published`/`rejected` Submissions | Inbox-Design |
| O3 | UX-Anforderungen abnehmen (`docs/creation-wizard/ux-anforderungen.md`) | vor Phase 3 (UX-First) |
| O4 | Reicht ein generischer Wizard, oder wie viele „Community-Wizards"? | Phase 2/4 |

## 5. Branching-Strategie (Owner-Entscheidung 2026-05-31)

**Bewusste Abweichung von „1 PR pro Welle"**: Alle Wellen werden in **einem
langlebigen Integrationsbranch** umgesetzt und **erst nach Abschluss** mit
`master` zusammengeführt.

- **Integrationsbranch**: `feature/wizard-neuordnung` (von `master` abzweigen).
  Der aktuelle Doku-Branch `claude/knowledge-scout-wizard-ux-yjOwS` kann dort
  hineingemergt werden oder direkt als Integrationsbranch dienen.
- **Sub-Wellen** als Commits/Feature-Branches **in** den Integrationsbranch.
- **Trade-off bewusst akzeptiert**: großer Merge am Ende, längere Review-Phase.
  Gegenmaßnahmen: regelmäßig `master` in den Branch rebasen/mergen (Drift klein
  halten), Tests pro Sub-Welle grün halten, Sub-Wellen-Commits sauber trennen.
- **Querschnitt-Regeln gelten weiter**: keine Silent Fallbacks, UI kennt kein
  Storage-Backend, ADR-0001 (Job-Domänen getrennt), Char-Tests vor Code.

## 6. Konkreter Fahrplan (nächste Schritte, geordnet)

```
P0  UX-Anforderungen abnehmen (O3)               ← User, vor Code
P1  ✅ Use-Case-Inventur (erledigt)
    → Beispiel-Zerlegung event-creation-de in {Schema | Wizard | Run-Input}
      (legt Migrationspfad für ~30 Vorlagen fest, validiert ADR-0003)
P2  Test-Library ("Kitchen-Sink") aufbauen
    → je 1 Exemplar pro Use-Case + Inbox-Fälle (kein Publish-Recht,
      Promotion bei abgelaufenem Token) → reproduzierbarer Prüfstand
    → Characterization-Tests gegen diese Library (Sicherheitsnetz, 0 Tests heute)
P3a Generische Merge-Runtime (Strangler-Fig)
    → Step-Engine datengetrieben, preset-/Renderer-Registry, Sonderfälle ersetzen
P3b Inbox-/Persistenz-Schicht (ADR-0004)
    → Submission-Collection + Azure-Blob-Staging + Promotion-Job + contributor-Rolle
P4  Editoren: Schema-Editor + Wizard-Editor (erst nach stabiler Runtime)
P5  End-to-End-Abnahme in der Test-Library → dann Merge nach master
```

**Empfohlener unmittelbarer Start offline**: **Beispiel-Zerlegung
`event-creation-de`** — am konkretesten, macht ADR-0003 greifbar und liefert
die Migrations-Schablone. Parallel kann der User O3 (UX-Anforderungen) abnehmen.

## 7. Modell-/Agent-Empfehlung für die Umsetzung

- **Konzept/Architektur** (Zerlegung, Modell-Design): Opus, hohes Thinking.
- **Mechanische Migration** (Vorlagen zerlegen, Tests schreiben): Sonnet reicht,
  spart Kosten.
- **Pro Sub-Welle neuer Agent** mit dem jeweiligen Phasen-Abschnitt als Brief;
  diese Datei + die beiden ADRs als Pflichtlektüre verlinken.

## 8. Pflichtlektüre für die Fortsetzung
1. `docs/adr/0003-wizard-schema-template-trennen.md`
2. `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`
3. `docs/refactor/welle-3-vi-creation-wizard/phase-1-use-case-inventur.md`
4. `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`
5. `docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`
