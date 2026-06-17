# Analyse: Inbox-Verarbeitungsflow, Dopplungen, Transkript-Rückfluss & Original/Assets

Stand: 2026-06-17 · Branch: `claude/confident-maxwell-9sz7cq`

## Leitfrage des Anwenders

> „Ich würde den ganzen Verarbeitungsflow 1:1 verwenden wie im Archiv — nur mit
> Inbox-Library. Haben wir viele Dopplungen? Wie ist das jetzt implementiert?"

Kurzantwort: **Die schwere Pipeline wird bereits 1:1 wiederverwendet.** Es gibt
EINE relevante Dopplung — bei der **Job-Abschluss-Behandlung** — und genau die
verursacht den fehlenden Transkript-Body (Befund A).

## Ist-Architektur: Was wird wiederverwendet, was ist gedoppelt?

### Wiederverwendet (KEINE Dopplung)

Die Inbox-Analyse ist ein **normaler `ExternalJob`** mit `providerScope='inbox'`
(`src/lib/submissions/submission-analysis-job.ts`). Sie läuft durch
**denselben Worker** und **dieselbe Callback-Route**
(`src/app/api/external/jobs/[jobId]/route.ts`) wie ein Archiv-Job:

- Extract (Secretary), `transform_template`, `ingest_rag`
- Artefakt-Speicherung (`storage.ts`), Shadow-Twin, Bilder/Seiten, Cache

Einziger Unterschied: der **Provider-Scope**. `buildProvider(..., providerScope:'inbox')`
liefert den Inbox-Provider statt des Archiv-Providers. Damit liegen Original +
Transkript + Assets bereits **als Shadow-Twin in der Inbox-Quarantäne**.
→ Die komplexe „am Ende das Richtige speichern"-Logik ist **nicht** doppelt.

### Echte Dopplung: zwei Job-Abschluss-Pfade

Der Job-Abschluss existiert an **zwei** Stellen, die **auseinandergedriftet** sind:

| Aspekt | Normalpfad `setJobCompleted` (`complete.ts`) | Kurzschluss `runExtractOnly` (`extract-only.ts`) |
|---|---|---|
| Steps skip (template/ingest) | ja | ja (eigene Implementierung) |
| `setResult` + `setStatus('completed')` | ja | ja (eigene Implementierung) |
| Contract-Enforcement (`savedItemId`) | ja | nein |
| Shadow-Twin „ready" | — | ja |
| **Submission-Rückfluss `applyAnalysisResult`** | **ja (Z. 241–250)** | **NEIN** |

Die Route verzweigt bei `!templatePhaseEnabled && !ingestPhaseEnabled` in
`runExtractOnly` und **kehrt sofort zurück** (`route.ts` Z. 650–666) — `setJobCompleted`
wird in diesem Pfad nie erreicht.

### Der „Rückfluss" ist KEINE Kopie der Archiv-Speicherung

`applyAnalysisResult` (`src/lib/submissions/submission-analysis.ts`) ist ein
**dünner Brückenschritt**: Es liest das **bereits** von der gemeinsamen Pipeline
gespeicherte Artefakt (`savedItemId`) über den Provider, parst Frontmatter+Body
und schreibt sie in das **MongoDB-Submission-Dokument** — damit der Wizard
Vorschau/Edit zeigen und später promoten kann. Es speichert **nicht** erneut in
den Storage. → Also keine inhaltliche Dopplung der Speicherlogik, sondern eine
nötige Brücke „Storage-Artefakt → Submission-Doc".

## Befund A (KRITISCH): Transkript fehlt im Dokument

**Ursache:** Der 5a-Modus setzt `phases.template=false`+`ingest=false` → Route nimmt
den Extract-Only-Kurzschluss → `runExtractOnly` schließt selbst ab und ruft
**nie** `applyAnalysisResult` auf. Das Transkript liegt als Shadow-Twin in der
Inbox, wird aber **nicht** in `submission.markdownBody` zurückgeschrieben → beim
Publizieren ist der Body leer (nur Template-Frontmatter mit `{{…}}`).

→ **Das ist die oben beschriebene Dopplung in Aktion**: Der Rückfluss lebt nur im
einen Abschluss-Pfad.

### Varianten Fix A (jetzt im Licht der Dopplung)

- **A-U1 – Pflaster in der Route:** Nach `runExtractOnly` den Rückfluss separat
  aufrufen. *Nachteil:* Job ist bereits `completed` → Retry-Invariante verletzt;
  die Dopplung bleibt bestehen.
- **A-U2 – Rückfluss in `runExtractOnly` vor `setStatus`:** Klein, hält die
  Invariante. *Nachteil:* zwei Abschluss-Pfade bleiben (Drift-Risiko bleibt).
- **A-U3 – Abschluss vereinheitlichen (empfohlenes Zielbild):** Gemeinsamen
  Finalize-Schritt (`setResult` + Contract + `applyAnalysisResult` + `setStatus`
  + Event) extrahieren, den BEIDE Pfade aufrufen. Beseitigt die Drift dauerhaft
  UND fixt A. Größer, daher als eigene Refactor-Scheibe.

**Empfehlung A:** **A-U2 als sofortige, sichere Scheibe** (Transkript zurück im
Dokument), **A-U3 als Folge-Refactor** (Abschluss-Dopplung dauerhaft beseitigen).

## Befund B: Original + Assets sollen ins Ziel-Storage

Die Inbox-Quarantäne ist ein **eigener Provider-Typ `'inbox'`** (Azure-Blob,
server-only; `src/lib/storage/inbox/inbox-provider-entry.ts`), NICHT das Archiv.
Dort liegt nach der Analyse bereits die **vollständige Shadow-Twin-Struktur**
(Original-Ref, Transkript, Bilder/Seiten).

Die Promotion (`src/lib/submissions/promotion.ts`) kopiert heute **nur** das
komponierte Markdown in den Zielordner — nicht die Shadow-Twin-Struktur.

→ „Original + Assets im Ziel" = **die Inbox-Shadow-Twin-Struktur beim Promoten in
die Ziel-Library übernehmen** (statt nur Markdown). Das passt exakt zur Idee
„Flow 1:1 wie Archiv": Die Speicher-/Shadow-Twin-Logik existiert schon, die
Promotion muss sie nur ziel-seitig wiederverwenden statt zu verkürzen.

### Varianten Fix B

- **B1 – Nur Original mitkopieren:** PDF aus Inbox neben die `.md` ins Ziel.
- **B2 – Komplette Shadow-Twin-Übernahme (Zielbild):** Original + Transkript +
  Assets als zusammenhängende Shadow-Twin-Struktur ins Ziel (Wiederverwendung der
  vorhandenen Shadow-Twin-Writer). Aufwändiger, aber konsistent.
- **B3 – Verweis statt Kopie:** widerspricht der Soll-Architektur (Original soll
  ins Ziel) → verworfen.

**Empfehlung B: B2** als Zielbild, **B1** als erste Scheibe. Eigener Branch +
vertiefte Analyse (fileId-Stabilität Filesystem/Nextcloud, RAG-Index).

## Nebenidee: „Inbox-Library im Archiv öffnen"

Der Provider-Typ `'inbox'` ist **server-only** (kein Client-Proxy). Ein direktes
Browsen im Datei-Explorer ist heute nicht vorgesehen. Eine read-only
Inspektions-Ansicht der Inbox wäre eine **separate kleine Scheibe** (eigener
HTTP-Proxy + Explorer-Einstieg) — nützlich zum Verifizieren, aber unabhängig von
A/B/C.

## Befund C: Doppelter Inbox-Ordner (`inbox 1`, `inbox 2`)

Race/Eventual-Consistency im find-or-create der Promotion (OneDrive
`conflictBehavior:'rename'`). Variante **C1** (nach `createFolder` Name prüfen,
bei Rename re-listen + vorhandenen Ordner nehmen). Eigener Branch.

## Vorgeschlagene Reihenfolge

1. **A-U2** (kritisch, dieser Branch): Transkript-Rückfluss im Extract-Only-Pfad.
2. **A-U3** (Folge-Refactor): Abschluss-Pfade vereinheitlichen (Dopplung weg).
3. **C1** (eigener Branch): Inbox-Ordner-Duplikate.
4. **B2/B1** (eigenes Vorhaben): Original + Assets via Shadow-Twin ins Ziel.
