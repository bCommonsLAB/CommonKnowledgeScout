# Messung Twin-Fingerabdruck Stufe 1 — Anleitung für die lokale Sitzung

> Offener Punkt aus [`AGENT-BRIEF.md`](AGENT-BRIEF.md). Stufe 1 ist gebaut und
> auf `master` (PRs #261 + #262, `ci-main` 516 grün). Was fehlt, ist die
> Messung am echten Archiv — sie entscheidet, ob Stufe 2 überhaupt gebaut wird.
> Cloud-Sitzungen können sie nicht ausführen: dazu braucht es OneDrive mit
> angemeldetem Konto.

## Was gemessen wird und warum

Der Check der Sync-Engine lud bisher für **jede** Quelle **jede** Markdown-Datei
ihrer Twin-Familie — rund 330 ms je Datei gegen OneDrive, in zwei Anfragen
(Dateiinformationen + Inhalt). Bei einem Vorhaben mit 200 Dateien ist das über
eine Minute nur fürs Lesen, und genau das riss das 60-Sekunden-Limit der
MCP-Brücke.

Seit Stufe 1 liest der Check eine Familie nur noch, wenn sich im Ordner-Listing
oder im Mongo-Dokument etwas geändert hat. Die Zusage aus dem Brief:

> Ein zweiter Lauf über ein unverändertes Archiv macht **null
> `getBinary`-Aufrufe** und liefert denselben Report.

Zu belegen sind zwei Zahlen, je für den ERSTEN und den ZWEITEN Lauf:

1. **Zahl der `getBinary`-Aufrufe**
2. **Dauer von `abdeckung_scannen`**

**Wichtig — der erste Lauf ist nicht der Vorher-Wert.** Er liest alles wie
bisher UND schreibt zusätzlich je Quelle einen `checkStand`. Er ist also eher
langsamer als der alte Zustand. Der Effekt zeigt sich erst im zweiten Lauf.
Wer einen echten Vorher-Wert will, misst auf `origin/master~` vor PR #261 —
das ist optional, die Aussage „zweiter Lauf ≈ 0 Reads" trägt für sich.

## Scope

- Library `ID_OnedriveTest`
- Teilbaum `6. bCommonsLab prototyping/24.09 KnowledgeScout`

Ein Teilbaum, kein Voll-Scan: die Messung soll in Minuten fertig sein, und der
Teilbaum ist genau der Fall, für den das Tor gebaut wurde.

## Ablauf

### Vorbereitung

Die Disziplin aus [`docs/guides/verification-playbook.md`](../../guides/verification-playbook.md)
gilt — sie ist die Lehre aus verlorenen Stunden:

- **Frischer Dev-Server.** Ein „reused" Server hat einen vollen Log-Buffer, und
  dann ist jede Zahl über „neue" Aufrufe unsicher.
- **EINE kontrollierte Aktion**, dann sofort messen.
- Log in eine Datei umlenken, nicht im Terminal scrollen.

```bash
git checkout master && git pull
pnpm install
pnpm dev 2>&1 | tee /tmp/ks-lauf1.log
```

### Lauf 1 (legt die Stände an)

Agentensicht öffnen → Teilbaum `24.09 KnowledgeScout` → **„Teilbaum neu scannen"**.

Dabei mitschreiben:
- Dauer: die Zeile `POST /api/library/.../agent-view/scan ... in XXXXms` im Log
- `getBinary`-Aufrufe: siehe unten

### Lauf 2 (der eigentliche Beweis)

**Zwischen den Läufen nichts am Archiv ändern** — kein Erschließen, keine
Transformation, keine Handkorrektur in Obsidian. Jede Änderung öffnet das Tor
für die betroffene Familie, völlig zu Recht, macht die Zahl aber unscharf.

Dev-Server neu starten (frischer Buffer), Log in `/tmp/ks-lauf2.log`, dieselbe
Aktion.

### Auswerten

**Primär — die Zähler des Reports.** Die Antwort der Scan-Route trägt sie unter
`report.totals.engineCheck`; in den DevTools im Network-Tab ablesbar:

```json
"engineCheck": { "gelesen": 0, "wiederverwendet": 137 }
```

Das ist die belastbare Zahl: sie kommt aus der Engine selbst, nicht aus einem
Log-Filter. **Erwartung Lauf 2: `gelesen: 0`.**

**Sekundär — `getBinary` im Log gegenzählen.** Der OneDrive-Provider loggt jeden
Aufruf (`onedrive-provider.ts` ~Zeile 1892):

```bash
grep -c "getBinary: Starte Laden der Datei" /tmp/ks-lauf1.log
grep -c "getBinary: Starte Laden der Datei" /tmp/ks-lauf2.log
```

Die zweite Zahl muss **0** sein. Zählt sie mehr als null, obwohl
`gelesen: 0` meldet, liest etwas anderes als der Sync-Check — dann ist der
Befund interessanter als die Messung, siehe unten.

**Dauer** aus der `POST … in XXXXms`-Zeile beider Läufe.

### Gegenprobe (eine Minute, lohnt sich)

Eine einzige Datei im Teilbaum anfassen (in Obsidian ein Leerzeichen anfügen und
speichern), dann Lauf 3. Erwartung: `gelesen: 1`, der Rest wiederverwendet. Das
belegt, dass das Tor nicht einfach blind zumacht — der wertvollere Beweis von
beiden, weil ein Tor, das immer schließt, auch „schnell" wäre.

## Ergebnis eintragen

Vier Zahlen in eine Tabelle in [`docs/STAND.md`](../../STAND.md) unter
„Zwischenschnitt · Twin-Fingerabdruck", mit Datum:

| Lauf | `gelesen` | `wiederverwendet` | `getBinary` | Dauer |
|---|---|---|---|---|
| 1 (kalt) | | | | |
| 2 (warm) | | | | |
| 3 (eine Datei geändert) | | | | |

## Und dann? Die Entscheidung über Stufe 2

Stufe 2 („eine Anfrage statt zwei": `getBinary` im OneDrive-Provider holt die
Dateiinformationen separat, obwohl der Aufrufer sie aus dem Listing schon hat)
war im Brief als eigene PR vorgesehen. Nach der Messung gilt:

- **Lauf 2 ist schnell genug** (kein 60-Sekunden-Problem mehr): Stufe 2 ist
  **verzichtbar**. Sie halbiert nur die Anfragen der Läufe, die ohnehin lesen
  müssen — und das sind jetzt wenige. Dann zurück zu Vorhaben 1 (M5).
- **Lauf 1 bleibt untragbar langsam** (der kalte Fall, z.B. nach einem Import
  oder beim ersten Scan einer neuen Library): Stufe 2 lohnt, weil sie genau
  diesen Fall halbiert. Start-Prompt dafür steht in
  [`AGENT-BRIEF.md`](AGENT-BRIEF.md), Abschnitt „Stufe 2".

Diese Entscheidung gehört dem Owner; die Messung liefert nur die Grundlage.

## Wenn etwas nicht stimmt

**`gelesen` ist in Lauf 2 nicht 0.** Das Tor hat für diese Quellen nicht
gegriffen. Vier Merkmale müssen übereinstimmen — Listing-Fingerabdruck,
`updatedAt` des Dokuments, `SYNC_ENGINE_VERSION`, Pfadlänge. Erste Verdächtige:

- Ein Schreibweg bumpt `updatedAt`, ohne dass sich inhaltlich etwas ändert.
  Fünf solche Wege sind in PR #261 nachgezogen; ein sechster ist denkbar.
  Prüfen: `checkStand.mongoUpdatedAt` im Twin-Dokument gegen `updatedAt`.
- Der Provider liefert bei jedem Listing ein anderes `modifiedAt` oder
  `version` für dieselbe Datei (OneDrive-Eigenheit). Prüfen:
  `checkStand.fingerabdruck` zweier Läufe vergleichen.

Beides ist in MongoDB read-only nachsehbar (Playbook, Regel 1):

```javascript
db.getCollection('shadow_twins__ID_OnedriveTest')
  .find({}, { sourceName: 1, updatedAt: 1, 'checkStand.mongoUpdatedAt': 1,
              'checkStand.fingerabdruck': 1, 'checkStand.geprueftAm': 1 })
  .limit(20)
```

**Der Report von Lauf 2 unterscheidet sich inhaltlich von Lauf 1.** Das wäre
ernst — die Zusage ist „derselbe Report". Dann `erzwingen` gegenprüfen
(s.u.): stimmt der erzwungene Lauf mit Lauf 1 überein und der wiederverwendete
nicht, ist die gespeicherte Zeile schuld.

**Der Schalter zum Gegenprüfen.** `erzwingen: true` umgeht das Tor. Die
Agentensicht-Route reicht ihn bewusst nicht durch (der Brief: „Die Werkbank
braucht ihn vorerst nicht"), die MCP-Brücke schon:

```
abdeckung_scannen(libraryId: "ID_OnedriveTest",
                  pfad: "6. bCommonsLab prototyping/24.09 KnowledgeScout",
                  erzwingen: true)
```

Das setzt voraus, dass die Brücke auf die **lokale** Instanz zeigt, nicht auf
die deployte — sonst misst man den falschen Server.
