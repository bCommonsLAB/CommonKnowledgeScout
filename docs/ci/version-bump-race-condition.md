# CI: Version-Bump Race-Condition (VERSION-Rebase-Konflikt)

Analyse und Entscheidung zum wiederkehrenden Fehler im Workflow
`.github/workflows/ci-main.yml`:

```
CONFLICT (content): Merge conflict in VERSION
error: could not apply f91b8106... Bump version to 1.2.107 [skip ci]
Rebase-Konflikt (VERSION evtl. parallel gebumpt) - Abbruch.
```

## Symptom

Der `ci-main`-Job stirbt im Schritt „Push version commit and tag", weil ein
`git rebase origin/master` an der `VERSION`-Datei kollidiert. Die alte Logik
brach bei jedem Rebase-Konflikt hart ab (`exit 1`).

## Eigentliche Ursache (Root Cause)

Die Versionsnummer wird **vor** dem (minutenlangen) Docker-Build festgelegt
und das Image hart mit dieser Nummer getaggt
(`ghcr.io/.../commonkno:1.2.107`). Der Push des Bump-Commits auf `master`
passiert **nach** dem Build. Dadurch ist das Zeitfenster, in dem `master`
weiterlaufen kann (direkter Push, anderer Run), riesig.

Zwei Folgeprobleme:

1. **Docker-Tag und Git-Tag sind hart gekoppelt.** Ist die Version beim Push
   schon belegt, lässt sie sich nicht mehr einfach nachträglich neu bumpen,
   ohne dass das bereits gebaute Image die falsche Nummer trägt.
2. Der `concurrency`-Mechanismus (`group: ci-main-master`,
   `cancel-in-progress: false`) serialisiert zwar `ci-main`-Runs, schützt aber
   nicht vor **direkten Pushes auf `master`** während des Builds.

## Bewertung des ursprünglich vorgeschlagenen Fixes

Der Vorschlag wollte den Konflikt mit `git checkout --ours VERSION` „mit der
lokal gebumpten Version" auflösen. Das ist **fehlerhaft**:

- **`--ours` ist beim Rebase invertiert.** Beim Rebase wird `origin/master`
  zur Basis ausgecheckt und unsere Commits werden obendrauf gespielt. Daher gilt
  während des Rebase:
  - `--ours`   = `origin/master` (die **Remote**-Version)
  - `--theirs` = unser Bump-Commit (die lokal gebumpte Version)
  Der Vorschlag hätte also die **Remote**-Version behalten – das Gegenteil der
  Absicht.
- **Tag-Kollision bleibt.** Selbst mit der richtigen Seite: Steht `master`
  bereits auf `1.2.107` und wir lokal ebenfalls auf `1.2.107`, ergibt jede
  Konflikt-Auflösung `1.2.107`. Der direkt folgende `git tag v1.2.107` schlägt
  fehl, weil der Tag schon existiert. Konflikt „gelöst", Job trotzdem rot.

## Drei Lösungsvarianten

### A – Version VOR dem Docker-Build sperren (gewählt)

Reihenfolge umstellen: Version bestimmen → `VERSION` committen → auf `master`
pushen (mit Retry + Re-Bump bei Ablehnung) → **erst danach** Docker bauen mit
der gesperrten Version → Tag + Release am Ende.

- **Pro:** Beseitigt das Race-Fenster grundlegend (Push ist Sekunden statt
  Minuten). Bei Push-Ablehnung wird `origin/master` neu geladen, hart darauf
  zurückgesetzt und neu gebumpt – **kein Rebase, kein Konflikt** möglich. Das
  Docker-Image trägt garantiert die final gesperrte Version. Tag ist eindeutig.
- **Contra:** Größerer Umbau des Workflows.

### B – Re-Bump im Retry-Loop + Docker-Image nachträglich umtaggen

Aktuelle Reihenfolge behalten, aber bei Konflikt neu bumpen und das bereits
gebaute Image zusätzlich mit der neuen Nummer pushen.

- **Pro:** Reihenfolge bleibt.
- **Contra:** Deutlich komplexer (Image-Re-Tagging über `docker buildx imagetools`
  o. ä.), zusätzliche Fehlerquellen, schwer testbar.

### C – Minimal-Fix (korrigiert)

Wie ursprünglich vorgeschlagen, aber mit `--theirs` statt `--ours` und einer
Tag-Existenzprüfung.

- **Pro:** Kleinster Eingriff.
- **Contra:** Löst nur das Symptom, nicht die Race-Ursache. Das große
  Zeitfenster bleibt; bei kollidierender Version kein sauberer Ausweg.

## Entscheidung

**Variante A.** Sie entfernt die Ursache statt das Symptom zu kaschieren und
hält die harte Kopplung Docker-Tag ↔ Git-Tag konsistent, weil die Version
endgültig feststeht, bevor das Image gebaut wird.

## Umsetzung (Kurz)

In `.github/workflows/ci-main.yml`:

1. Neuer Schritt **„Reserve version on master"** (vor Docker-Login/Build):
   - Basis = `max(VERSION-Datei, neuester v*-Tag)`, Patch +1.
   - `VERSION` schreiben, committen, `git push origin HEAD:master`.
   - Bei Ablehnung: `git fetch --tags --force origin master`,
     `git reset --hard origin/master`, neu bumpen, erneut versuchen (5×).
   - Ausgabe `new_version` für die Folgeschritte.
2. Docker-Build/-Push nutzt `steps.reserve.outputs.new_version`.
3. Neuer Schritt **„Tag and push"** nach erfolgreichem Build: annotierten Tag
   auf den (bereits gepushten) Bump-Commit setzen und pushen.

> Hinweis: Der Tag wird bewusst erst **nach** dem Build erzeugt, damit ein
> fehlgeschlagener Build keinen verwaisten Tag/Release hinterlässt.

## Folge-Race: electron-build vs. spaetes Tagging (PR #109, v1.2.108)

Variante A loest den VERSION-Rebase-Konflikt, erzeugt aber ein neues Fenster:

1. **ci-main Run A** (PR #108) endet erfolgreich → Tag `v1.2.107`, startet
   `electron-build`.
2. **ci-main Run B** (PR #109) reserviert waehrenddessen `1.2.108` auf
   `master` (VERSION-Commit, noch **ohne** Git-Tag).
3. **electron-build** checkt `master` HEAD aus → liest `VERSION=1.2.108`.
4. `electron-builder --publish always` legt Tag `v1.2.108` + Release an.
5. **ci-main Run B** scheitert in „Tag and push": `already exists`.

Symptom im Log:

```
! [rejected] v1.2.108 -> v1.2.108 (already exists)
```

**Fix (zwei Teile):**

1. `electron-build.yml`: Nach `workflow_run` auf den **neuesten v\*-Tag**
   pinnen, nicht auf `master` HEAD.
2. `ci-main.yml` „Tag and push": idempotent — wenn Remote-Tag bereits auf
   HEAD zeigt, Schritt erfolgreich beenden (sonst `--force`).

Der Git-Merge (PR #109) war trotzdem erfolgreich; nur der Post-Merge-CI-Lauf
und der Dokploy-Trigger (`Trigger deployment`) blieben aus.
