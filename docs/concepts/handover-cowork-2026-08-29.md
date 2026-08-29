# Handover für Cowork — Befund „24.09 KnowledgeScout" und Werkzeugsatz 2.16.0

Stand: 2026-08-29. Antwort auf deine Analyse des Ordners „24.09
KnowledgeScout" (43 Befunde, Alt-Format-Migration, „completed ohne
Schreiben", G7-Timeout). Deine Beobachtungen waren richtig — zwei deiner
Diagnosen und die daraus abgeleitete Hochrechnung waren es nicht. Beides ist
jetzt im Code adressiert.

## 1. Was an deiner Analyse richtig war

- **Die Beobachtung selbst:** Zehn `quelle_erschliessen`-Jobs wurden
  `completed` und schrieben nichts. Stimmt, reproduzierbar, und war über die
  Brücke nicht erkennbar — das war unser Fehler (siehe §3).
- **Die zwei ehrlichen Fehlschläge** („Global Contract verletzt …
  savedItemId fehlt") bei nicht-kanonischen Namen: Das war der Contract-Check,
  der **funktioniert** — er weigerte sich, Erfolg zu behaupten.
- **„Zusammenfassung ohne Transkript" nach der Migration** ist kein
  Migrationsfehler: Das Alt-Format *hatte* nur die Zusammenfassung; die
  Migration kann kein Transkript erfinden.
- Die Ordnerstruktur unangetastet zu lassen, bis Peter entscheidet: richtig.

## 2. Was nicht stimmte

**„Der Contract-Check prüft nur die falsche Sache" — nein.** Der Täter war
das **Extract-Gate**, nicht der Contract-Check. Das Gate arbeitet mit der
Annahme „Transformation impliziert Transkript" (in der Pipeline entsteht
eine Transformation immer AUS einem Transkript). Deine zwölf migrierten
Familien verletzen genau diese Annahme: Transformation da, Transkript fehlt.
Das Gate las die Zusammenfassung als Beweis, übersprang die Transkription,
der Job wurde ehrlich `completed` — mit Verweis auf das Artefakt, das schon
vorher da war. Der Contract-Check (completed ⇒ referenzierbares Artefakt)
tat dabei exakt seinen Job.

**Deinen Reparaturvorschlag „Contract-Check aufs Transkript ausweiten"
haben wir deshalb NICHT umgesetzt** — er würde legitime Wege brechen:
`transformation_starten` arbeitet mit Text aus MongoDB (kein
Transkript-Schreiben im Job), und ein `nur_transkript`-Job hat umgekehrt nie
eine Transformation. Dein zweiter Vorschlag (`erzwingen`) war dagegen genau
richtig und ist umgesetzt (§3).

**„Über die Brücke nicht mehr zu vervollständigen / 236 Familien betroffen"
— so nicht.** `legacy_twin_name` ist ein **Namens**-Befund, kein Beleg für
fehlende Transkripte. Ob einer Familie das Transkript fehlt, sagt
`abdeckung_lesen`/`abdeckung_scannen` pro Familie — hochrechnen musst du
nicht. Blockiert waren real nur die von deinen Jobs bereits angefassten
Familien (ein Nebeneffekt, der ebenfalls behoben ist, §3); der Rest war
schon vorher per `template: "nur_transkript"` erschließbar.

**G7 „Video-Worker-Timeout exakt zehn Minuten" — Zahl richtig, Täter
offen.** Die 10 Minuten sind KnowledgeScout-seitige Grenzen (Job-Watchdog,
SSE-Stream-Timeout, Request-Timeout — alle 600 s). Ein Abbruch nach exakt
10 Minuten heißt: 10 Minuten kein Fortschrittssignal. Am Video-Worker zu
drehen würde daran nichts ändern. Videos >600 MB bleiben bis auf Weiteres
eine Betreiber-Entscheidung — bitte weiterhin melden statt wiederholen,
welcher Timeout gefeuert hat, steht im Job-Trace.

## 3. Was sich mit Werkzeugsatz 2.16.0 ändert

Prüfe nach dem Deployment mit `bruecke_info`, dass du 2.16.0 siehst.

1. **`quelle_erschliessen` nimmt `erzwingen: true`** — übergeht das
   Extract-Gate und transkribiert/extrahiert auch dann, wenn vorhandene
   Artefakte den Schritt sonst überspringen würden. Das ist der Weg für die
   Familien „Transformation ohne Transkript". `erzwingen` ist die Ausnahme:
   ohne konkreten Grund kostet es nur doppelt.
2. **`job_status` sagt jetzt, was NICHT getan wurde.** Übersprungene
   Schritte tragen `uebersprungen: true` und `grund` (z. B.
   `shadow_twin_exists`); hat ein completed-Job alle Schritte übersprungen,
   steht `nichtsGeschrieben` mit Klartext in der Antwort. „completed" ohne
   diesen Blick ist keine Erfolgsmeldung mehr, die du glauben musst.
3. **Der Gate-Fallback zementiert Fehl-Skips nicht mehr.** Bisher zählte
   jeder completed-Job mit `savedItemId` als „früherer Erfolg" — auch einer,
   der selbst nur übersprungen hatte. Deine zehn Jobs hatten damit alle
   weiteren Versuche (auch `nur_transkript`) verriegelt. Jetzt zählt ein Job
   mit übersprungenem Extract-Schritt nicht mehr als Beweis.

## 4. Konkretes Vorgehen für „24.09 KnowledgeScout"

1. `bruecke_info` → 2.16.0 bestätigen.
2. Die 12 migrierten Familien: `quelle_erschliessen` mit
   `template: "nur_transkript"` und `erzwingen: true` (Stapel via
   `sourceIds`). Die Transformation existiert schon — es fehlt nur das
   Transkript; ein Template-Lauf wäre doppelt bezahlt.
3. `job_status` je Job prüfen: Jetzt muss `extract_*` OHNE
   `uebersprungen` durchlaufen. Danach Gegenprüfen, ob die
   Transkript-Dateien wirklich entstanden sind.
4. Für weitere Alt-Familien in der Library: NICHT von `legacy_twin_name`
   auf fehlende Transkripte schließen — den Erschließungszustand je Familie
   aus dem Abdeckungs-Report lesen und nur dort nacharbeiten, wo wirklich
   `transkript` fehlt. Kostenpflichtige Stapel wie immer erst nach
   Bestätigung durch Peter, mit Probe vor dem Stapel.
5. Die zwei Videos >600 MB: liegen lassen, als Betreiber-Thema gemeldet.

## 5. Skill-Stand

Die Repo-Fassung von `archiv-aufraeumen` (`.claude/skills/…/SKILL.md`) trägt
den neuen Abschnitt **1b-iv „completed heißt nicht ‚hat geschrieben'"** und
die 2.16.0-Versionsmarker. Deine hochgeladene Paket-Kopie ist damit wieder
einen Stand hinter dem Repo — Peter muss das Paket neu bauen und in den
Einstellungen ersetzen, ein `git pull` genügt nicht. Bis dahin gilt: Bei
Widerspruch zwischen deiner Skill-Kopie und diesem Handover gewinnt das
Handover.
