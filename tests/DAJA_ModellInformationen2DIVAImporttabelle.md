---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---

## Artikel-Importtabelle
{{ArticleImportTable|Ich habe diese Informationen eines Möbelprogramms und möchte eine Artikel-Importtabelle in Markdown auf Basis dieser Artikelbeschreibungen generieren. Es handelt sich beidesmal um dasselbe Modell, es wurde vom Kunden anonymisiert, wir verwenden den Modellnamen Daja. Bitte verwende dabei dieselbe Struktur wie in der Tabelle unten (Spaltenüberschriften und Reihenfolge beachten). Gib mir das Ergebnis als Markdown-Tabelle mit einer Zeile für jeden Artikel zurück.  Spaltenstruktur (Beispiel): 
| Cat-Codex | Cat-Name | Group-Codex | GroupName_DEUTSCH | GroupName_FRANZÖSISCH | GroupName_ITALIENISCH | Art-Codex | ArtName_DEUTSCH | ArtName_FRANZÖSISCH | ArtName_ITALIENISCH |
|-----------|----------|-------------|--------------------|------------------------|------------------------|-----------|------------------|----------------------|----------------------|
| MODELL-CODEX (grossbuchstaben)   | Modellnamen    | Kategorie-Key(Grossbuchstaben)      | Kategorie-Name  auf Deutsch |Kategorie-Name auf Französisch  | Kategorie-Name auf Italienisch | Typen-Nr.      | Artikelbez. auf Deutsch             | Artikelbez. auf Französisch   | Artikelbez. auf Italienisch  |}}


## Preis-Importtabelle
{{PriceImportTable|Ich habe diese Informationen eines Möbelprogramms und möchte eine Preis-Importtabelle in Markdown auf Basis dieser Preisliste generieren. Es handelt sich beidesmal um dasselbe Modell, es wurde vom Kunden anonymisiert, wir verwenden den Modellnamen Daja. Bitte verwende dabei dieselbe Struktur wie in der Tabelle unten (Spaltenüberschriften und Reihenfolge beachten). Gib mir das Ergebnis als Markdown-Tabelle mit einer Zeile für jeden Artikel und Preisgruppe (Stoffgruppe) zurück. Sortiert nach C atCodex, ArtCodex und Pricegroup.
Verwende für Preis- und Stoffgruppen einen selbstsprechenden PG-Schlüssel, Führend soll PG für Preisgruppe stehen, gefolgt von einem Unterstrich und dann die Nummer oder der Buchstabe der Preisgruppe:

Spaltenstruktur (Beispiel): 

| CatCodex | ArtCodex | Pricegroup | Price | Beschreibung |
|-----------|----------|-------------|--------------------|------------------------|------------------------|-----------|------------------|----------------------|----------------------|
| MODELL-CODEX (grossbuchstaben)  | Typen-Nr.  (grossbuchstaben)    | PG-Schlüssel    | Preis ohne Währung | kurze Artikelbez. ohne Preisinfo |}}

--- systemprompt
You are a specialized assistant that processes and structures information clearly and concisely.
IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.