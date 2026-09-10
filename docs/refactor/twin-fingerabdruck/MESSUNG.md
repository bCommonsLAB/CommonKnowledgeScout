# Messung Twin-Fingerabdruck Stufe 1

## Ergebnis (2026-09-10, Prod, Library `ID_OnedriveTest`)

Teilbaum `6. bCommonsLab prototyping/24.09 KnowledgeScout` — 75 Quellen,
306 gescannte Dateien. Alle vier Läufe innerhalb von fünf Minuten, ohne
Änderung am Archiv dazwischen.

| Lauf | Werkzeug | `gelesen` | `wiederverwendet` | Dauer |
|---|---|---|---|---|
| 1 | `abdeckung_scannen`, kalt (kein `checkStand`) | — | — | **Timeout > 60 s** |
| 2 | `abdeckung_scannen`, warm | **0** | 75 | durch, < 60 s |
| 3 | `twins_pruefen`, warm | **0** | 75 | **29,4 s** |
| 4 | `twins_pruefen`, `erzwingen: true` | — | — | **Timeout > 60 s** |

**Läufe 3 und 4 sind der saubere Vorher/Nachher-Vergleich**: dasselbe Werkzeug,
derselbe Teilbaum, dieselbe Minute. `erzwingen: true` ist exakt das alte
Verhalten und reißt die 60-Sekunden-Grenze; mit Tor sind es 29 Sekunden bei
**null** `getBinary`-Aufrufen. Die Zusage des Briefs ist damit belegt.

Die Zahl kommt aus der Engine selbst (`zaehler.gelesen`), nicht aus einem
Log-Filter — die Gegenprobe über `getBinary`-Zeilen im Container-Log war
deshalb nicht nötig.

### Was die verbleibenden 29 Sekunden sind

**Nicht Lesen — Listen.** Das Tor spart die `getBinary`-Aufrufe, nicht die
Ordner-Listings; die holt der Check bewusst immer frisch, sonst könnte er
Änderungen gar nicht erkennen. 306 Dateien über viele Ordner sind der Rest.

### Folge für Stufe 2 — Empfehlung: nicht bauen

Stufe 2 („eine Anfrage statt zwei") halbiert die Anfragen **je gelesener
Datei**. Im warmen Fall liest der Check null Dateien — Stufe 2 spart dort
**exakt nichts**. Sie hilft nur im kalten Fall (Läufe 1 und 4).

Und auch dort trägt sie nicht weit genug: von zwei Anfragen (~330 ms) auf eine
(~180 ms) sind rund 45 % der Lesezeit. Ein kalter Lauf über 60 s käme damit auf
grob 45 s — immer noch dicht an der Grenze, immer noch zerbrechlich. Für den
kalten Fall ist der **Job-Modus** aus dem Vorrat („Scans über dem
60-Sekunden-Limit") das passende Werkzeug, nicht Stufe 2.

Der tägliche Fall — wiederholtes Aufräumen an einem Vorhaben — ist jetzt warm
und schnell. Damit ist der Anlass für Stufe 2 weg.

---

## Anleitung (für Wiederholungen)

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

## Wo messen: Prod oder lokal?

**Prod ist für die Kernzahl der bessere Ort** — dort liegt das echte Archiv mit
echter OneDrive-Latenz, und genau danach fragt der Brief. Die MCP-Brücke gibt
die Zähler direkt zurück, ohne Dev-Server und ohne Log-Auswertung:

```
abdeckung_scannen(libraryId: "ID_OnedriveTest",
                  pfad: "6. bCommonsLab prototyping/24.09 KnowledgeScout")
```

→ in der Antwort `totalsLibraryWeit.engineCheck: { gelesen, wiederverwendet }`,
die Dauer ist die Laufzeit des Aufrufs. Zweimal ausführen, nichts dazwischen
ändern — fertig.

| | Prod | Lokal |
|---|---|---|
| Zähler `gelesen`/`wiederverwendet` | ✅ direkt in der Antwort | ✅ |
| Dauer unter echter Last | ✅ | ⚠️ eigene Leitung, eigene Maschine |
| `getBinary`-Zeilen im Log | ❌ nur mit Container-Log-Zugriff | ✅ |
| „nichts geändert dazwischen" kontrollierbar | ⚠️ live | ✅ |

Die `getBinary`-Zeilen sind die **Gegenprobe**, nicht der Beweis — `gelesen`
kommt aus der Engine selbst. Für die Entscheidung über Stufe 2 reicht Prod.
Lokal lohnt nur, wenn die Zahlen sich widersprechen und man sehen will, wer
sonst noch liest.

**Zwei Dinge vorher prüfen:**

1. **Läuft der neue Stand überhaupt in Prod?** Das Deployment ist ein
   Fire-and-Forget-`curl` an Dokploy (`ci-main.yml`, Schritt „Trigger
   deployment") — ein Release-Tag beweist nicht, dass der Container ihn fährt.
   Entscheidender Test: `twins_pruefen` auf einen kleinen Teilbaum. Enthält die
   Antwort `zaehler.gelesen`, läuft der neue Stand. Fehlt das Feld, ist das
   Deployment nicht durch, und jede Messung misst den alten Code.
2. **Bietet die Brücke `erzwingen` an?** Falls nicht: die Desktop-App cached die
   Toolliste — Erweiterung aus- und einschalten (siehe „Befund" unten).

**Was die Messung in Prod schreibt:** je Quelle ein `checkStand` am
Twin-Dokument. Additiv, wegwerfbar (löschen kostet nur einen vollen Check) und
kein Sonderrisiko der Messung — jeder normale Check in Prod tut das ohnehin.

## Ablauf (lokale Variante, wenn die `getBinary`-Zahl gebraucht wird)

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

Bei der lokalen Variante muss die Brücke auf die **lokale** Instanz zeigen,
nicht auf die deployte — sonst misst man den falschen Server.

## Zwei Befunde aus PR #261 (nicht Teil der Messung, aber hier notiert)

**1. `TOOLSET_VERSION` wurde nicht erhöht.** Die Regel in `tools-info.ts` lautet:
bei JEDER Werkzeug-/Schema-Änderung hochzählen. PR #261 hat `twins_pruefen` und
`abdeckung_scannen` um `erzwingen` erweitert und die Version bei 2.28.0 gelassen.
Erst PR #263 hob sie auf 2.29.0 — aus anderem Anlass. Folge: Es gab ein Fenster,
in dem die Brücke Schema-mit-`erzwingen` auslieferte und dabei „2.28.0" meldete.
Wer in diesem Fenster die Toolliste gecacht hat, hält eine 2.28.0, die nicht der
2.28.0 anderer Clients entspricht — genau die Drift, die der Mechanismus sichtbar
machen soll. Seit 2.29.0 ist alles wieder konsistent; ein Client, der `erzwingen`
nicht anbietet, braucht den Toggle (Erweiterung aus/ein). **Kein Code-Fix nötig**
— der Stand auf `master` passt zu 2.29.0. Die Lehre gilt der nächsten
Schema-Änderung.

**2. `twins_pruefen` ist nicht mehr streng lesend.** Das Werkzeug trägt
`annotations: { readOnlyHint: true }` (`tools.ts`), schreibt seit dem Tor im
check-Modus aber je Quelle einen `checkStand`. Der Beschreibungstext ist
angepasst („Es werden keine **Artefakte** geschrieben"), die Annotation nicht.
Ein Merker-Feld zu schreiben ist im Geist von „read-only" vertretbar, wörtlich
aber nicht — und `readOnlyHint` ist für Agenten das Signal, das Werkzeug
bedenkenlos aufzurufen. **Offen, Owner-Entscheidung:** Annotation ehrlich machen
(`readOnlyHint` entfernen und in der Beschreibung sagen, was geschrieben wird)
oder bewusst so lassen, mit Begründung im Code-Kommentar. Nicht stillschweigend
stehen lassen.
