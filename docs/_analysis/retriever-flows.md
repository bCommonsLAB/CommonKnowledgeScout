## Zwei Retriever-Flows im Chat-Modul – Architektur, Varianten, Plan

Ziel: Die zwei konzeptionell unterschiedlichen Retrieval-Methoden klar trennen, robuste Gemeinsame Utilities schaffen und einen Orchestrator etablieren, der je nach Konfiguration/Query-Param den passenden Flow ausführt. So minimieren wir Kopplung, senken Änderungsrisiken und verbessern Debuggability/Tests.

### Ausgangslage (heute)
- Ein einzelner Route-Handler (`src/app/api/chat/[libraryId]/route.ts`) enthält beide Pfade:
  - Chunk-Flow: Klassische RAG-Suche via Embedding der Frage → Vektor-Query auf Chunks → Nachbarfenster laden → Scoring/Boosts → Quellen-Budget → Prompt → LLM.
  - Summary-Flow: Kapitel-Summaries der gefilterten Dokumente listen (ohne Ranking), knappen Gesamt-Kontext bauen → Prompt → LLM.
- Gemeinsame Aspekte (heute verstreut im Handler): Auth/Context-Laden, Facetten/Filter, Budgetsteuerung, Prompt-Erstellung, Logging/Tracing, LLM-Aufruf, Fehlerbehandlung.

### Anforderungen
- Saubere Trennung: Jeder Flow in eigener Datei mit klarer, gemeinsamer Schnittstelle.
- Wiederverwendung: Gemeinsame Utilities (Filter, Prompt, Budget, Ranking/Boosting, LLM-Call, Logging-Hooks) nur einmal implementieren.
- Typensicherheit: Strikte Interfaces, typed Errors, kein `any`.
- Testbarkeit: Unit- und Integrationstests je Flow, Mocks für Vektor-/LLM-Backends.
- Observability: Bestehendes Query-Logging unverändert weiter nutzbar; Orchestrator schreibt die gleichen Schritte.

---

### Zielarchitektur

#### Kern-Schnittstellen (TypeScript-Interfaces)
```ts
// src/types/retriever.ts
export interface RetrieverInput {
  libraryId: string
  userEmail: string
  question: string
  answerLength: 'kurz' | 'mittel' | 'ausführlich'
  filters: Record<string, unknown> // normalisierte Pinecone-ähnliche Filter
  queryId: string // für Logging; wird vom Orchestrator gesetzt
  context: {
    vectorIndex: string
  }
}

export interface RetrievedSource {
  id: string
  fileName?: string
  chunkIndex?: number
  score?: number
  text: string
}

export interface RetrieverOutput {
  sources: RetrievedSource[]
  timing: { retrievalMs: number }
}

export interface ChatRetriever {
  retrieve(input: RetrieverInput): Promise<RetrieverOutput>
}
```

#### Modulstruktur (Dateien)
- `src/lib/chat/orchestrator.ts` – Strategy/Delegator, wählt Flow anhand Param/Config und koordiniert Logging + LLM.
- `src/lib/chat/retrievers/chunks.ts` – Implementierung „klassischer RAG“-Flow.
- `src/lib/chat/retrievers/summaries.ts` – Implementierung „Summaries zusammenführen“-Flow.
- `src/lib/chat/common/filters.ts` – URL/Facet → Filter; Normalisierung; Mapping Mongo/Pinecone.
- `src/lib/chat/common/budget.ts` – Zeichen-/Token-Budgets pro Antwortlänge; Reduktionsstrategie.
- `src/lib/chat/common/prompt.ts` – Prompt-Builder (stilabhängig), Context-Composer (Quellenformatierung).
- `src/lib/chat/common/ranking.ts` – Scoring/Boosts (Kapitel-Boost, lexikalischer Zusatz, Sortierung, Nachbarfenster-Bestimmung).
- `src/lib/chat/common/llm.ts` – Provider-agnostischer Chat-Aufruf (zunächst OpenAI), mit einheitlicher Fehlerform.
- `src/types/retriever.ts` – Interfaces (s. oben) und Fehlertypen.

Hinweis: Bereits vorhandene Bausteine (`embedTexts`, `pinecone`-Adapter, `query-logger`, `loader`, `doc-meta-repo`) werden direkt wiederverwendet und nicht verdoppelt.

---

### Flow-Beschreibungen

#### 1) Chunk-Retriever (klassischer RAG)
Schritte:
1. Frage-Embedding berechnen.
2. Vektor-Query auf Chunks mit Filtern (Top-K).
3. Optional: Parallel Kapitel-Summary-Query (Top-K) → Kapitel-Boost-Map aufbauen.
4. Nachbarfenster für Top-Treffer bestimmen (±w) und vollständige Metadaten via `fetchVectors` laden.
5. Scoring-Phase: Kapitel-Boost und leichter lexikalischer Boost anwenden; Sortierung.
6. Budgetakkumulation: Snippets in Reihenfolge einfügen bis Budget erreicht.
7. Logging: embed → query(chunks) → query(summary, optional) → fetchNeighbors → KPIs.

Output: `sources[]` mit Texten und Metadaten; `retrievalMs`.

#### 2) Summary-Retriever (Kapitel-Summaries als Gesamt-Kontext)
Schritte:
1. Vektoren listen (oder gefiltert selektieren) und clientseitig nach `kind=chapterSummary` + Filter einschränken.
2. Zu den gefundenen Kapiteln ergänzende Metadaten aus `doc-meta-repo` laden (Titel, ShortTitle, Summary-Felder).
3. Kurz-Text für jedes Kapitel komponieren (Kapitel-Header, Summary-Content, ggf. Fallbacks).
4. Budgetakkumulation: Summaries der Reihe nach, bis Zeichenziel erreicht.
5. Logging: list(summary) → KPIs.

Output: `sources[]` als lange, aber komprimierte Kapitelkontexte; `retrievalMs`.

---

### Gemeinsame Utilities (einmalig implementieren)
- Filter-Normalisierung: Query/Facets → Pinecone-Filter; besondere Regeln für Summary-Flow (libraryId optional).
- Budgetsteuerung: Basierend auf `answerLength` und adaptiver Reduktion bei LLM-Kontextfehlern.
- Prompt-Builder: Stilhinweise je Antwortlänge; Quellenformatierung einheitlich.
- Ranking/Boosting: Kapitel-Boost aus Summary-Query, lexikalische Zusatzpunkte, Nachbarn (Fenstergröße abhängig von Antwortlänge).
- LLM-Adapter: Einheitliche Schnittstelle, Fehlerklassifizierung, Token-Limits-Handling (Retry mit reduziertem Kontext).
- Logging-Hooks: `startQueryLog`, `logAppend`, `finalizeQueryLog`, `failQueryLog`, `markStepStart/End`.

---

### Fehlertypen (typed)
- `NotAuthenticatedError`, `MissingApiKeyError`, `IndexNotFoundError`, `OpenAIChatError`, `NoSourcesFoundError`.
- Orchestrator mappt bekannte Fehler auf HTTP-Status (401/404/422/429/500) und persistiert sie über `failQueryLog`.

---

### Orchestrator-Verhalten
- Liest Request-Parameter (insb. `retriever=chunk|doc`) und Library-Konfiguration (Default-Mode).
- Initialisiert Logging und übergibt `queryId` an den gewählten Retriever.
- Übernimmt Prompt-Erstellung, LLM-Aufruf, Budget-Reduktion bei Bedarf sowie finalisiert das Logging.
- Route-Handler wird dadurch dünn (Auth + Param-Parsing + Orchestrator-Aufruf + Response).

---

### Varianten der Umsetzung

1) Strategy-Pattern mit Interface (empfohlen)
- Zwei Module implementieren `ChatRetriever` und werden im Orchestrator registriert.
- Vorteile: Sehr klare Trennung, einfache Austauschbarkeit, gute Testbarkeit.
- Nachteile: Ein zusätzlicher Delegationslayer.

2) Funktionale Pipeline (Steps-Array)
- Jeder Step ist eine reine Funktion; Flow ist ein Array von Steps, das der Orchestrator ausführt.
- Vorteile: Hohe Wiederverwendbarkeit und Kombinierbarkeit einzelner Steps.
- Nachteile: Höhere Komplexität bei State-Passing und Logging-Konsistenz.

3) Konfigurationsgetriebener Super-Flow
- Ein „Super“-Retriever mit Flags für „chunk“ vs. „summary“ Pfad; interne if-Zweige und konfigurierbare Steps.
- Vorteile: Weniger Dateien.
- Nachteile: Hohe Kopplung, Risiko erneuter Vermischung – explizit nicht empfohlen.

Entscheidung: Variante 1 (Strategy) – prägnant, modular, minimal-invasiv bei Refactor des Route-Handlers.

---

### Konkreter Umsetzungsplan (inkrementell, risikoarm)
1. Types & Errors anlegen: `src/types/retriever.ts` (Interfaces, Fehlertypen).
2. Shared Utilities: `filters.ts`, `budget.ts`, `prompt.ts`, `ranking.ts`, `llm.ts` in `src/lib/chat/common/`.
3. Retriever implementieren:
   - `retrievers/chunks.ts` (unter Nutzung bestehender `embedTexts`, `pinecone`-Adapter, `query-logger`).
   - `retrievers/summaries.ts` (unter Nutzung `listVectors`, `doc-meta-repo`).
4. Orchestrator: `src/lib/chat/orchestrator.ts` – Strategy-Registrierung, Logging-Integration, LLM-Aufruf.
5. Route-Refactor: `src/app/api/chat/[libraryId]/route.ts` auf Orchestrator umstellen (Auth/Params bleiben dort).
6. Tests:
   - Unit-Tests für Utilities (Budget, Prompt, Ranking).
   - Unit-Tests für beide Retriever (Pinecone/LLM gemockt).
   - Integrationstest über Orchestrator (beide Flows, Budget-Reduktion, Logging-Schritte).
7. Debug-UI: Prüfen, ob Step-Namen/Level konsistent bleiben (sollten sie; keine UI-Änderung nötig).
8. Feature-Flag: Default-Flow aus ENV (z. B. `CHAT_DEFAULT_RETRIEVER=chunk`), Overwrite via Query-Param.

Akzeptanzkriterien
- Beide Flows laufen isoliert; Refactor bricht keine bestehende Funktion.
- Query-Logs behalten kompatible Step-Struktur; Debug-Panel zeigt beide Flows korrekt an.
- Tests decken zentrale Pfade ab; Linter/Type-Checks sind sauber.

Risiken & Mitigation
- `listVectors`-Kosten im Summary-Flow: ggf. Pagination/Server-Filter ergänzen; harte Obergrenze für Summaries.
- Kontextlängenfehler: Bereits abgedeckte Reduktionsstrategie; in Tests erzwingen und verifizieren.
- Filter-Divergenz: Single-Source-of-Truth in `filters.ts`.

Rollout
- Hinter Feature-Flag entwickeln, lokal testen, dann Staging, schließlich Produktion.
- Metriken beobachten (retrievalMs, llmMs, fehlerhafte Requests, Kontext-Reduktionen).

---

### MongoDB-basierter Summary-Flow: Kapitel‑Schwelle und Fallback

Motivation: Bei vielen Dokumenten und/oder sehr vielen Kapiteln kann ein Kapitel‑Summaries‑Prompt zu groß werden. Daher entscheidet der Summary‑Retriever dynamisch:
- Wenn die Summen‑Kapitelanzahl (über gefilterte Dokumente) klein genug ist → Kapitel‑Summaries verwenden.
- Sonst → auf Dokument‑Summaries zurückfallen.

Datenquellen (MongoDB)
- Pro Dokument: `chaptersCount`, `docMetaJson.summary`, optional `docMetaJson.shortTitle/title`, `chapters[].summary` (falls mitpersistiert), `upsertedAt`, `fileId`, `fileName`, Facetten (`authors`, `region`, `year`, `docType`, `source`, `tags`).

Konfigurierbare Schwellwerte (ENV)
- `SUMMARY_MAX_DOCS` (z. B. 150) – Obergrenze der in Betracht gezogenen Dokumente nach Filterung.
- `SUMMARY_CHAPTERS_THRESHOLD` (z. B. 300) – Max. Summe aller Kapitel, ab der auf Doc‑Summaries gewechselt wird.
- `SUMMARY_PER_DOC_CHAPTER_CAP` (z. B. 8) – Max. Kapitel pro Dokument, wenn Kapitel‑Summaries genutzt werden.
- `SUMMARY_ESTIMATE_CHARS_PER_CHAPTER` (z. B. 800) – Schätzlänge pro Kapitel‑Summary zur Prompt‑Budgetabschätzung.
- `SUMMARY_ESTIMATE_CHARS_PER_DOC` (z. B. 1200) – Schätzlänge pro Doc‑Summary.
- `SUMMARY_MAX_PROMPT_CHARS` – Abgeleitet vom Antwortlängen‑Budget; aus `budget.ts` beziehen.

Entscheidungslogik (vereinfacht)
```ts
function decideSummaryMode(docs: Array<{ chaptersCount?: number }>, budgetChars: number): 'chapters' | 'docs' {
  const docCap = env.SUMMARY_MAX_DOCS
  const perDocCap = env.SUMMARY_PER_DOC_CHAPTER_CAP
  const chaptersThreshold = env.SUMMARY_CHAPTERS_THRESHOLD
  const perChapterChars = env.SUMMARY_ESTIMATE_CHARS_PER_CHAPTER
  const perDocChars = env.SUMMARY_ESTIMATE_CHARS_PER_DOC

  const limitedDocs = docs.slice(0, docCap)
  const estChapters = limitedDocs
    .map(d => Math.min(Math.max(0, d.chaptersCount ?? 0), perDocCap))
    .reduce((a, b) => a + b, 0)

  const estCharsChapters = estChapters * perChapterChars
  const estCharsDocs = limitedDocs.length * perDocChars

  // Kapitelmodus nur, wenn unter Kapitel‑Schwelle und im Budget günstiger
  if (estChapters <= chaptersThreshold && estCharsChapters <= budgetChars) return 'chapters'
  return 'docs'
}
```

Ablauf im Summary‑Retriever (Mongo‑Variante)
1. Facettenfilter anwenden (Mongo‑Query). Nur benötigte Felder projizieren: `fileId`, `fileName`, `chaptersCount`, `docMetaJson.summary`, optional `chapters.summary`, `upsertedAt`.
2. Obergrenzen anwenden: `SUMMARY_MAX_DOCS` (Server‑seitig limitieren, z. B. `sort: { upsertedAt: -1 }`).
3. Budget aus Antwortlänge beziehen (`budget.ts`). Mit `decideSummaryMode` Modus wählen.
4. Wenn `chapters`:
   - Pro Dokument höchstens `SUMMARY_PER_DOC_CHAPTER_CAP` Kapitel nehmen.
   - Kapitel‑Summaries kürzen (Hard Cap, z. B. 800 Zeichen) und mit Titel/Metadaten labeln.
   - In Reihenfolge akkumulieren, bis Budget.
   - Logging‑Step: `list`/`summary` mit `topKReturned = numberOfChaptersUsed`.
5. Wenn `docs`:
   - Pro Dokument `docMetaJson.summary` (oder Short Summary) kürzen (z. B. 1200 Zeichen).
   - Akkumulieren, bis Budget.
   - Logging‑Step: `list`/`summary` mit `topKReturned = numberOfDocsUsed`.
6. Prompt bauen (einheitlicher `prompt.ts`), LLM aufrufen, Reduktion bei Kontextfehlern aus `budget.ts` nutzen.

Selektion/Sortierung
- Standard: `upsertedAt` absteigend (neuere zuerst) oder regelbar über ENV.
- Optional: einfache Heuristik nach Facetten‑Match‑Dichte (keywords/tags) – nur wenn ohne großen Aufwand.

Fehlerfälle
- Kein `summary` vorhanden → kurzer Fallback aus `title/shortTitle` + `docMetaJson.summary`‑ähnlichen Feldern; wenn leer: Dokument überspringen.
- Sehr hohe Dokumentzahl → Harde Caps greifen; Logging vermerkt Trunkierung.

Beobachtbarkeit
- Loggt genutzten Modus (`mode: 'summaries'` bleibt konsistent), zusätzlich `decision: 'chapters' | 'docs'` in `retrieval`‑Step‑Metadata aufnehmen.


