# GitHub Branch Protection Setup - Schritt-für-Schritt Anleitung

Diese Anleitung erklärt, wie du Branch Protection Rules für den `master`-Branch einrichtest, sodass nur du direkt committen kannst, während GitHub Actions weiterhin automatisch pushen können.

---

## Voraussetzungen

- ✅ Repository auf GitHub erstellt
- ✅ Repository als **öffentlich** gesetzt
- ✅ Lokales Repository mit GitHub verbunden
- ✅ Du bist Repository-Owner oder hast Admin-Rechte

---

## Schritt 1: Repository auf GitHub veröffentlichen

### 1.1 Repository erstellen (falls noch nicht vorhanden)

1. Gehe zu [GitHub](https://github.com)
2. Klicke auf **"+"** (oben rechts) → **"New repository"**
3. Repository-Name: `CommonKnowledgeScout`
4. Owner: `bCommonsLAB`
5. Beschreibung: "Common Knowledge Scout - Modern Document Management System"
6. **Wichtig:** Wähle **"Public"** aus
7. **NICHT** "Initialize with README" aktivieren (du hast bereits ein lokales Repo)
8. Klicke auf **"Create repository"**

### 1.2 Lokales Repository mit GitHub verbinden

Falls noch nicht geschehen, führe im Terminal aus:

```bash
# Prüfe, ob remote bereits existiert
git remote -v

# Falls nicht vorhanden, füge GitHub-Repository hinzu
git remote add origin https://github.com/bCommonsLAB/CommonKnowledgeScout.git

# Oder falls bereits vorhanden, aktualisiere die URL
git remote set-url origin https://github.com/bCommonsLAB/CommonKnowledgeScout.git

# Pushe alle Branches und Tags
git push -u origin --all
git push -u origin --tags
```

---

## Schritt 2: Branch Protection Rules einrichten

### 2.1 Navigation zu den Branch Settings

1. Gehe zu deinem Repository auf GitHub: `https://github.com/bCommonsLAB/CommonKnowledgeScout`
2. Klicke auf **"Settings"** (oben im Repository-Menü)
3. Im linken Menü: **"Branches"** (unter "Code and automation")

### 2.2 Branch Protection Rule erstellen

1. Unter **"Branch protection rules"** findest du einen Button **"Add rule"** → Klicke darauf
2. Im Feld **"Branch name pattern"** gib ein: `master`
3. Es erscheint eine Vorschau: "This rule will apply to: 1 branch"

### 2.3 Wichtige Einstellungen konfigurieren

#### ✅ Option 1: "Restrict who can push to matching branches"

**Das ist die Hauptregel für deinen Anwendungsfall!**

1. Aktiviere das Kontrollkästchen: **"Restrict who can push to matching branches"**
2. Klicke auf **"Select people and teams"**
3. Suche nach deinem GitHub-Username (z. B. `peter-aichner` oder wie auch immer dein GitHub-Username lautet)
4. Wähle dich selbst aus
5. Klicke auf **"Save changes"**

**Ergebnis:** Nur du kannst jetzt direkt auf `master` pushen.

#### ✅ Option 2: GitHub Actions Bypass einrichten

**Wichtig:** Dein Workflow (`ci-main.yml`) pusht automatisch auf `master`. Damit das weiterhin funktioniert:

1. Scrolle nach unten zu **"Rules applied to everyone including administrators"**
2. Aktiviere: **"Allow specified actors to bypass required pull requests"**
3. Klicke auf **"Select actors"**
4. Suche nach: `github-actions[bot]`
5. Wähle `github-actions[bot]` aus
6. Klicke auf **"Save changes"**

**Alternative:** Falls die Option oben nicht verfügbar ist:
- Aktiviere: **"Allow force pushes"** → **"Specify who can force push"** → `github-actions[bot]`
- Aktiviere: **"Allow deletions"** → **"Specify who can delete"** → `github-actions[bot]`

#### ✅ Option 3: "Do not allow bypassing the above settings"

**Sehr wichtig für maximale Sicherheit:**

1. Aktiviere: **"Do not allow bypassing the above settings"**
2. **Wichtig:** Stelle sicher, dass `github-actions[bot]` in den Bypass-Regeln enthalten ist, sonst funktionieren deine Workflows nicht mehr!

---

## Schritt 3: Optionale, aber empfohlene Einstellungen

### 3.1 Pull Request Requirements

Falls du in Zukunft auch Pull Requests nutzen möchtest:

1. Aktiviere: **"Require a pull request before merging"**
   - **"Require approvals"**: `1`
   - **"Dismiss stale pull request approvals when new commits are pushed"**: ✅
   - **"Require review from Code Owners"**: Optional

### 3.2 Status Checks

Falls du automatische Checks einrichten möchtest:

1. Aktiviere: **"Require status checks to pass before merging"**
   - **"Require branches to be up to date before merging"**: ✅
   - Wähle die Checks aus, die durchlaufen müssen (z. B. `lint-check`)

### 3.3 Weitere Optionen

- **"Require conversation resolution before merging"**: ✅ (empfohlen)
- **"Require linear history"**: Optional
- **"Require signed commits"**: Optional (erfordert GPG-Setup)

---

## Schritt 4: Regel speichern

1. Scrolle nach oben oder unten
2. Klicke auf **"Create"** (oder **"Save changes"** falls du eine bestehende Regel bearbeitest)
3. Die Regel ist jetzt aktiv!

---

## Schritt 5: Testen der Konfiguration

### 5.1 Test: Direkter Push (sollte funktionieren)

```bash
# Erstelle einen Test-Commit
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "Test: Branch Protection"
git push origin master
```

**Erwartetes Ergebnis:** ✅ Push sollte erfolgreich sein (du bist der erlaubte User)

### 5.2 Test: GitHub Actions (sollte funktionieren)

1. Gehe zu **"Actions"** im Repository
2. Führe den Workflow `ci-master` manuell aus (falls `workflow_dispatch` aktiviert ist)
3. Oder pushe einen Commit, der den Workflow triggert

**Erwartetes Ergebnis:** ✅ Workflow sollte erfolgreich pushen können (dank Bypass-Regel)

### 5.3 Test: Anderer User (sollte fehlschlagen)

Falls du einen zweiten GitHub-Account hast oder jemand anderes testet:

```bash
# Als anderer User versuchen zu pushen
git push origin master
```

**Erwartetes Ergebnis:** ❌ Push sollte mit Fehler fehlschlagen:
```
remote: error: GH006: Protected branch update failed for refs/heads/master.
remote: error: You are not allowed to push code to master in this repository
```

---

## Schritt 6: Workflow-Berechtigungen prüfen

Dein Workflow (`ci-main.yml`) hat bereits die richtigen Berechtigungen:

```yaml
permissions:
  contents: write  # ✅ Erlaubt das Pushen
```

**Das ist korrekt!** Keine Änderungen nötig.

---

## Zusammenfassung der finalen Konfiguration

```
Branch: master

✅ Restrict who can push to matching branches
   → Nur: [Dein GitHub-Username]

✅ Allow specified actors to bypass required pull requests
   → github-actions[bot]

✅ Do not allow bypassing the above settings
   → Aktiviert

Optional:
✅ Require a pull request before merging
✅ Require status checks to pass before merging
✅ Require conversation resolution before merging
```

---

## Troubleshooting

### Problem: GitHub Actions können nicht pushen

**Lösung:**
1. Gehe zu Settings → Branches
2. Öffne die `master`-Regel
3. Prüfe, ob `github-actions[bot]` in den Bypass-Regeln enthalten ist
4. Falls nicht, füge es hinzu

### Problem: "Do not allow bypassing" blockiert GitHub Actions

**Lösung:**
- Stelle sicher, dass `github-actions[bot]` **vor** dem Aktivieren von "Do not allow bypassing" hinzugefügt wurde
- Die Bypass-Regel muss **explizit** `github-actions[bot]` enthalten

### Problem: Ich kann selbst nicht pushen

**Lösung:**
1. Prüfe, ob dein GitHub-Username korrekt in "Restrict who can push" eingetragen ist
2. Prüfe, ob du Repository-Admin-Rechte hast
3. Prüfe, ob "Do not allow bypassing" aktiviert ist und du trotzdem in der Liste stehst

---

## Nächste Schritte

Nach erfolgreicher Einrichtung:

1. ✅ Repository ist öffentlich
2. ✅ Nur du kannst auf `master` committen
3. ✅ GitHub Actions können weiterhin automatisch pushen
4. ✅ Andere können das Repository forken und Pull Requests erstellen
5. ✅ Lizenz-Dateien sind vorhanden (LICENSE, LICENSE_CONTENT.txt)

**Das Repository ist jetzt bereit für die Open-Source-Veröffentlichung!** 🎉

---

## Referenzen

- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Docs: Configuring protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/configuring-protected-branch-rules)
- [GitHub Docs: Bypassing branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/bypassing-branch-protection)

