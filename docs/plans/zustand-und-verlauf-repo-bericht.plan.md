---
name: zustand-und-verlauf-repo-bericht
overview: "Berichte im Archiv wachsen zu Tagebüchern, und die Programmierarbeit kommt dort nicht an. Ein Modell löst beides: BERICHT.md ist Zustand und wird überschrieben, Notizen und Verlaufsdateien sind Verlauf und dürfen wachsen. Paket 1 macht das in KnowledgeScout messbar (Wunschliste 6, Teile A–C), Paket 2 baut den Skill repo-bericht, Paket 3 zieht Skills und Konventionen im Archiv nach, Paket 4 ist der Prüflauf in Cowork. Handover von Cowork an Claude Code vom 18.09.2026."
vorhaben: [24.09 KnowledgeScout]
status: in-arbeit
todos:
  - id: p1-messen
    content: "A1–A3: Befunde bericht_zu_lang, status_zu_lang, bericht_ueberholt; Schwellen agentView.berichtMaxBytes {anwendung, plattform}, statusMaxZeilen, ueberholtNachTagen; berichtBytes je Vorhaben im Report und in abdeckung_lesen."
    status: completed
  - id: p1-werkzeuge
    content: "B1 datei_lesen mit bereich gliederung; B2 Größenhinweis in datei_patchen/datei_schreiben/datei_anlegen bei BERICHT.md (nicht blockierend); B3 bericht_unvollstaendig folgt den Verweisen, Tiefe 1."
    status: completed
  - id: p1-contract
    content: "C1 type notiz | verlauf im Twin-Contract; C2 Befund verlauf_fehlt; C3 Feld repo_stand_commit und Befund entwicklung_unberichtet. Werkzeugsatz 2.30.0."
    status: completed
  - id: p1-live
    content: "Live-Messung nach dem Deploy: Dauer eines Voll-Scans mit mitgelesenen Begleitdokumenten; Schwellen in den Library-Einstellungen setzen (Owner-Entscheidung)."
    status: pending
  - id: p2-skill
    content: "Skill repo-bericht nach dem Konzept im Archiv bauen (~/.claude/skills/repo-bericht/, Original danach ins Archiv). Schreibt nur in die Verlaufsdatei Entwicklung.md der Plattform und setzt im Plattformbericht repo_stand_am und repo_stand_commit. Erstlauf ab 01.09.2026."
    status: completed
  - id: p3-archiv
    content: "Skills und Konventionen im Archiv auf die tatsächlichen Namen aus Paket 1 anpassen (Konventionen, mail-verfassen, Korrespondenz-Methode, archiv-aufraeumen Schritt 6 und Tabelle Befund zu Aktion)."
    status: completed
  - id: p4-prueflauf
    content: "Prüflauf in Cowork gegen das Qualitätsmuster (macht der Owner, nicht Claude Code). Erst danach Rollout auf die übrigen Berichte."
    status: pending
---

# Zustand und Verlauf trennen, Repo-Bericht

Spezifikation, Konzept des Skills und Qualitätsmuster liegen im Archiv
(Wunschliste 6 vom 18.09.2026 und das Konzept „Repo-Bericht"). Dieser Plan hält
fest, was davon im Repo gebaut wird und wo die Umsetzung von der Wunschliste
abweicht — bei Wunschliste 5 kamen Abweichungen erst im Nachhinein ans Licht.

## Das Modell

- **`BERICHT.md` = Zustand.** Er wird überschrieben und bleibt klein.
- **Notizen (`type: notiz`) und Verlaufsdateien (`type: verlauf`) = Verlauf.**
  Sie dürfen wachsen. Der Bericht verweist mit echten Links auf sie.
- Berichte werden **nicht von Hand** umgebaut. Normale Läufe tun es, angestoßen
  durch die Befunde und unterstützt durch die Werkzeuge aus Paket 1.

## Paket 1 — was gebaut ist

| Punkt | Umsetzung | Ort |
|---|---|---|
| A1 `bericht_zu_lang` | Bytes aus dem Ordner-Listing gegen die Schwelle der `rolle`; `warning` | `bericht-zustand.ts`, `bericht-zustand-regel.ts` |
| A2 `status_zu_lang` | nicht-leere Zeilen unter „## Status" außerhalb von Codeblöcken; `info` | ebenda |
| A3 `bericht_ueberholt` | offene Punkte unter „## Nächste Schritte" mit vergangenem Datum, dazu `naechster_termin`; ein Sammelbefund je Bericht, Zeilen wörtlich im Detail; `info` | ebenda |
| B1 `gliederung` | je Überschrift Ebene, Wortlaut, Zeilenbereich, Bytes, offene Punkte; kein Body | `mcp/storage/gliederung.ts` |
| B2 Größenhinweis | `groesseNachher`, `schwelle`, `schwelleUeberschritten`, `hinweis` | `mcp/storage/bericht-hinweis.ts` |
| B3 Verweisen folgen | der Scan liest die vom Bericht verlinkten Markdown-Dateien des Vorhabens mit | `begleitdokumente.ts`, `reference-audit.ts` |
| C1 `notiz`, `verlauf` | Twin-Contract §3.1; Pflichtfelder als `twin_core_missing` (Akteur Cowork) | `verlauf-regel.ts` |
| C2 `verlauf_fehlt` | `postfach_bis` gesetzt, keine verlinkte Verlaufsdatei; `info` | ebenda |
| C3 `entwicklung_unberichtet` | Eintrag `## JJJJ-MM-TT — Titel {#anker}` mit Zeile `**Vorhaben:** [[…]]`; ein Sammelbefund je Bericht; `info` | ebenda |

## Abweichungen von der Wunschliste

1. **`repo_stand_commit` neben `repo_stand`.** Seit Wunschliste 5 liest der Code
   den Commit aus `repo_stand`. Wunschliste 6 nennt das Feld
   `repo_stand_commit`. Der neue Name führt, der alte bleibt lesbar.
2. **`bericht_ueberholt` gilt „ab N Tagen", nicht „mehr als N Tage".** Der Beleg
   der Wunschliste (Punkt zwei Tage nach dem Termin, Schwelle 2) soll feuern.
   `naechster_termin` wird ohne Schonfrist gemessen: ab dem Tag danach.
3. **Datumsformen.** Zusätzlich zu `TT.MM.`, `TT.MM.JJJJ` und `JJJJ-MM-TT` wird
   `TT.MM` ohne Schlusspunkt gelesen (so steht es im Beleg). Tag und Monat
   müssen zweistellig sein, sonst würden Versionsnummern und Beträge zu
   Terminen. Nennt ein Punkt mehrere Daten, zählt das jüngste.
4. **`verlauf_fehlt` und `entwicklung_unberichtet` sehen nur verlinkte
   Dateien.** Die Wunschliste sagt „liegt im Vorhaben keine Datei mit
   `type: verlauf`". Den `type` einer Datei kennt der Scan erst, wenn er sie
   liest, und er liest nur, worauf ein Bericht verweist (höchstens 40 Dateien
   je Bericht). Folge: Der Plattformbericht muss auf seine Verlaufsdatei
   verlinken, sonst bleibt `entwicklung_unberichtet` stumm.
5. **`entwicklung_unberichtet` im Teilbaum-Scan.** Liegt die Verlaufsdatei
   außerhalb des gescannten Teilbaums, schweigt die Regel — dieselbe Grenze wie
   bei `sicht_veraltet`. Der nächste Voll-Scan bringt den Befund zurück.
6. **Rolle fehlt.** Ein Bericht ohne `rolle: anwendung | plattform` wird als
   Anwendung gemessen; der Befund sagt das.
7. **Gliederung und Scheinüberschriften.** Zeilen, die im Frontmatter oder in
   einem Codeblock wie eine Überschrift aussehen, stehen in der Gliederung mit
   `keineEchteUeberschrift: true` — `abschnitt` und `abschnitt_ersetzen`
   behandeln sie ebenfalls als Überschrift, die Grenze ist dieselbe.
8. **Keine neuen Werkzeugnamen.** Die Soll-Toolliste bleibt gleich;
   `bruecke_info` weist die Schema-Änderungen unter `neuInDieserVersion` aus.

## Grenzen

- Kein Bericht wird von Hand umgebaut, auch nicht zum Testen.
- Aus dem Repo wandert nichts ins Archiv außer verdichteten Einträgen; Pläne
  und Code werden über Pfad und Commit-Hash verwiesen.
- Der Skill `repo-bericht` fasst nie einen Anwendungsbericht an.
