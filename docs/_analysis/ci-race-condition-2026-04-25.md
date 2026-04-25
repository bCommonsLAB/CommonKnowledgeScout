# CI Race-Condition vom 25.04.2026 - Analyse und Behebung

## Kurzfassung

Am 25.04.2026 wurden 6 Pilot-PRs (#13-#18) der External-Jobs-Refaktorierung
**innerhalb von 6 Minuten** sequenziell auf `master` gemergt. Der
`ci-main`-Workflow startete dadurch 6 parallele Runs. Nur **einer** (PR #18)
endete grün; die anderen scheiterten beim finalen `git push --follow-tags`
mit `! [rejected] master -> master (fetch first)`.

## Ursache

Der `ci-main`-Workflow hatte vor diesem Vorfall **keinen `concurrency:`-Block**.
Bei mehreren parallelen Runs:

1. Jeder Run liest die `VERSION`, bumpt sie lokal, baut das Docker-Image,
   pusht das Image nach `ghcr.io`, erstellt einen Bump-Commit + Tag und
   pusht `master`.
2. Der **erste** Push gewinnt. Alle weiteren Runs scheitern, weil ihr
   Lokalstand inzwischen veraltet ist (`fetch first`-Reject).
3. **Aber**: Die **Tag-Pushes** gehen trotzdem durch, weil Tag-Refs eine
   eigene Validierung haben - es entstehen verwaiste Tags.

## Folgen (Stand nach Vorfall)

| Artefakt | Zustand |
|---|---|
| `master` HEAD | `2eff4af` "Bump version to 1.2.16" - sauber, vom finalen ✓ Run #289 |
| `VERSION`-Datei | `1.2.16` - sauber |
| Tag `v1.2.16` | zeigt auf `2eff4af` (auf master) - sauber |
| Tag `v1.2.15` | **ORPHAN** - zeigt auf `294a6ac`, der auf KEINEM Branch existiert |
| Docker-Image `ghcr.io/.../commonkno:1.2.16` | existiert, von Run #289 - sauber |
| Docker-Image `ghcr.io/.../commonkno:1.2.15` | existiert, aber zugehoeriger Code-Stand ist nur als orphan-Commit erhalten |
| Production-Deployment | von Run #289 (= 1.2.16) getriggert |

## Behebung

Commit `96c982f` ergaenzt `ci-main.yml` um:

```yaml
concurrency:
  group: ci-main-master
  cancel-in-progress: false
```

- **`group: ci-main-master`**: Alle Runs auf `master` teilen sich denselben
  Slot.
- **`cancel-in-progress: false`**: Laufende Runs werden NICHT abgebrochen
  (sonst koennte ein bereits halb gepushtes Docker-Image verwaisen).
  Neue Runs warten brav, bis der vorige fertig ist.

Damit ist die Race-Condition fuer kuenftige Multi-Merge-Szenarien beseitigt.

## Entscheidung zum Orphan-Tag `v1.2.15`

**Lassen wie es ist.** Begruendung:

- Das Docker-Image `:1.2.15` existiert auf `ghcr.io` und ist funktional.
- Tag-Manipulation auf production-relevanten Tags ist riskant
  (potenzielle Auswirkung auf Deploy-Pipelines, Release-Notes, Audit-Trail).
- Mit dem Concurrency-Fix tritt die Situation nicht wieder auf.
- Der orphan-Commit `294a6ac` ist im `git log --all` weiterhin auffindbar -
  die Code-Historie ist also nicht verloren, nur nicht mehr Teil von
  `master`.

## Lessons Learned (fuer kuenftige Refaktorierungen)

1. **Vor dem ersten Merge** den jeweiligen CI-Workflow auf Concurrency-Schutz
   pruefen.
2. **Mehrere PRs nicht in Sekundenabstand mergen**, wenn der Master-Workflow
   pro Push automatisch Bumps + Tags + Deployments produziert.
3. **Alternativen bei mehreren parallelen PRs**:
   - Alle PRs in einem einzigen Merge-Commit zusammenfassen
   - Zwischen Merges 6+ Minuten warten (Build-Dauer abwarten)
   - **ODER**: Concurrency-Schutz vorher einbauen (jetzt erledigt).
