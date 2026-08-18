# Handover 2026-08-18: Zyklus v2 — Stand und nächste Wellen

Für neue KS-Sessions (Cloud oder lokal). Jede Welle unten ist eigenständig
startbar; Pflichtlektüre je Welle steht dabei.

## Wo wir stehen

- **Gemerged auf `master`:** Konzept-Set `docs/concepts/` (PR #159/#161),
  Welle 0a Twin-Kern + Writer-Stempel, 0c Sidecar-Adoption, 0d
  Handkorrektur-Vorrang + Kombi-Fehlerkennung (PR #162–#164, ein
  Sammel-Merge).
- **Pilot komplett durchlaufen** (`25.01 Common Secretary`, Library
  „Onedrive Test", Prod): 8 Aufnahmen erschlossen, Cowork-Bericht auf
  Twin-Basis, 6 Transkript-Korrekturen per Import übernommen, 4
  Transformationen + Bericht von Peter abgenommen (`verified_by:
  human:peter`), `_INDEX.md` auf `abgenommen`. Der Kreis Lücke → Erschließen →
  Bericht → Abnahme → grün ist einmal real bewiesen.
- **Zyklus v2** (dieser PR): Reihenfolge gedreht — erst Sichten/Erschließen,
  dann Strukturieren; Namens-Fenster ersetzt durch Familien-Umzug;
  Typ-Erkennung + Typ-Templates als neue Anforderung; MCP als
  Orchestrierungs-Ziel. Siehe `docs/concepts/erschliessungszyklus.md`.

## Nächste Wellen (Reihenfolge = Empfehlung)

### Welle 0e — `familie_umziehen` (klein, zuerst)

Quelle + `_`-Spiegelordner + Datenbank-Namen in einem Zug umziehen/umbenennen.
Feste Reihenfolge: (1) Import für die Quelle (Preset `import`, Scope
`sourceIds` — keine Handkorrektur verlieren), (2) `provider.moveItem` bzw.
`renameItem` auf die Quelle, (3) `sourceName`/`parentId` im Twin-Dokument
nachziehen (`shadow-twin-repo`), (4) alten Spiegelordner löschen, (5) Export
(Preset `export`, Scope `sourceIds`) regeneriert den Spiegel korrekt benannt.
Als Engine-nahe Funktion + API-Route (`POST …/shadow-twins/move-family`),
UI-Anbindung optional (Kontextmenü Dateiliste). Bausteine existieren alle.
GRENZEN: kein neues Identitätssystem (sourceId bleibt der Schlüssel); bei
`path-too-long` abbrechen mit Befund. Pflichtlektüre: Contract §7, Zyklus v2
§3, `sync-plan/allowed-ops.ts`. Modell: Sonnet. Eine PR.

### Welle 0f — Typ-Erkennung + Typ-Template-Registry

1. Library-Config-Feld `templateByDocType` (Map `doc_type → templateName`,
   Checkliste `library-config-field.mdc`); `secretaryService.template` bleibt
   Fallback (rückwärtskompatibel, kein Bruch).
2. Typ-Erkennungsschritt nach dem Transkript (kleiner LLM-Call, Ergebnis
   `doc_type` ins Frontmatter; nie raten — `other` + Fallback ist ein
   sichtbarer Wert). ACHTUNG: JSON-Form muss explizit in den Prompt-Text
   (Secretary erzwingt schema_json nicht — doc-relations-Muster).
3. Standard-Typ-Templates anlegen (konzept, email-diktat, besprechung,
   notiz) — `standard-meeting` existiert als Muster in der Test-Library.
Pflichtlektüre: Zyklus v2 §2, `template-service-mongodb.ts`
(`ensureContractFields`), `phase-template.ts`. Modell: Opus (Pipeline-Eingriff).

### Welle „MCP-Brücke" (nach 0e, unabhängig von 0f)

KnowledgeScout als MCP-Server: Werkzeuge `erschliessen` (Job enqueue +
Status), `pruefen`/`reparieren`/`import`/`export` (reconcile-Route),
`familie_umziehen` (0e), `abdeckung_lesen` (ab Welle 1). Dünne Schicht über
den bestehenden Services — in dieser Session wurde exakt dieser Werkzeugsatz
bereits von Hand über die HTTP-API bedient, die Brücke formalisiert das nur.
Auth: API-Key je Library (nie Owner-Tokens exponieren). Der Agent
orchestriert; KS bleibt Auditor (doppelte Buchhaltung unverändert).
Pflichtlektüre: Zyklus v2 §7, Projektauftrag §5 Welle 5,
`api-route-conventions.md`. Modell: Opus (Sicherheits-/API-Design).

### Welle 0g — Aufräumen bekannter Defekte (jederzeit, mechanisch)

a) `split-combined-artifact` erzeugt byte-identische Kopie unter
   Transformations-Namen — echte Transformation erzeugen oder Op umbenennen
   („Kombi-Kopie", ehrlicher Name).
b) Twin-Kern-Stempel fehlt im Adoptions-Pfad
   (`upsertArtifactFromPrepared`) — adoptierte Legacy-Twins bleiben ohne Kern.
c) `bodyResponse` dupliziert den kompletten Body im Frontmatter (alle
   Templates mit `{{bodyResponse}}`; 3957 vs. 1617 Zeichen im Pilot) — nach
   dem Einsetzen aus dem Frontmatter entfernen.
d) `sourceIds`-Scope ohne Sibling-Prüfung (`isArtifactOfSibling` nur im
   Ordner-Scan) — beim Datei-Öffnen entstehen Twin-Dokumente für
   Markdown-Artefakte (2 Rausch-Einträge + `_X.md/`-Ordner im Pilot-Ordner,
   dürfen nach dem Fix weg).
e) Producer-Anbindung für transform-service/testimonial-writer/write-bundle
   (`generatedBy` durchreichen).

## Bekannte Randbedingungen

- Worktrees: `.env` zeigt ggf. auf PROD (`MONGodb_DATABASE_NAME` prüfen!);
  `pnpm install` je Worktree; `root: true` in `.eslintrc.json` ist gemerged.
- Nextcloud-Provider nutzt pfadbasierte IDs — vor der Archiv-Migration
  (Zielbild Etappe 7) auf `fileid` umstellen; durch Zyklus v2 wichtiger geworden.
- Archiv-Seite (Konventionen, Berichte, erschliessung.py) wird von
  Cowork-Sessions gepflegt — Änderungen am Contract immer per Nachtrag ins
  `cowork-briefing-archivsicht.md` + Copy-Paste-Block an Peter.
