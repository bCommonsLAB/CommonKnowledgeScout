---
name: contracts-ingestion-chat
description: Harte Invarianten für Ingestion (Embeddings, Bilder, Vektoren, Meta-Dokumente) und Chat/RAG (Retriever, Ingestion-Service, Cache-Vertrag). Verwende diesen Skill, BEVOR du an src/lib/ingestion/**, src/lib/chat/** oder deren Unit-Tests etwas änderst — also sobald von Embeddings, Vektor-Suche, RAG, Retriever, Chunking oder Chat-Antworten die Rede ist.
---

# Contracts: Ingestion & Chat (RAG)

Diese Regeln sind **nicht verhandelbar**. Details je Thema in `docs/contracts/`.

## Die vier Invarianten auf einen Blick

1. **Determinismus**: Gleiche Eingabe ⇒ gleiche Chunks, gleiche Vektoren,
   gleiche Meta-Dokumente. Keine zufälligen IDs oder Zeitstempel im Schlüssel.
2. **Kein stiller Fallback für Ingest-Quellen**: Fehlt eine Quelle, ist das ein
   Fehler — kein Überspringen, kein Ersatzwert.
3. **Erlaubte Ausnahmen sind benannt**: Result-Objekt-Pattern bei der
   Bild-Verarbeitung und bewusstes `try/catch` MIT Logging sind zulässig;
   alles andere nicht.
4. **Cache-Vertrag** (chat): Cache-Schlüssel und Invalidierung sind Teil des
   Contracts — keine ad-hoc-Caches.

## Zuständige Contract-Dateien

| Datei | Thema |
|---|---|
| [ingestion-contracts.md](../../../docs/contracts/ingestion-contracts.md) | Embeddings, Bilder, Vektoren, Meta-Dokumente, Fehler-Semantik |
| [chat-contracts.md](../../../docs/contracts/chat-contracts.md) | RAG-Konsum, Retriever, Ingestion-Service, Cache-Vertrag |
| [contracts-story-pipeline.md](../../../docs/contracts/contracts-story-pipeline.md) | Ingestion Input Contract + Vector-Search-/Index-Contract (Atlas) |

## Zusätzlich beachten

- **ADR 0010** (vorgeschlagen): Retrieval-Strategien sollen pluggbar werden
  (Profile pro Library, z. B. Geo-Vorfilter statt rein semantisch) —
  `docs/adr/0010-retrieval-profile.md`. Neue Retrieval-Wege bitte als Strategie
  denken, nicht als Sonderzweig.
