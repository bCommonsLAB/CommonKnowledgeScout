# BreadCrumb Komponente

## 1. User Stories
- Als User möchte ich den aktuellen Pfad sehen und schnell zu übergeordneten Ordnern navigieren.
- Als User möchte ich per Klick auf einen Pfadteil direkt dorthin springen.

## 2. Initialisierung
- Wird im Header eingebettet und bei jedem Ordnerwechsel aktualisiert.
- Liest den aktuellen Pfad aus dem globalen State (Atoms).

## 3. Features
- Anzeige des vollständigen Navigationspfads (Breadcrumb)
- Klickbare Pfadteile für schnelle Navigation
- Automatisches Scrollen zum letzten Element

## 4. Abhängigkeiten
- **Atoms:**
  - `breadcrumbItemsAtom`
  - `currentFolderIdAtom`
- **Komponenten:**
  - Header (als Parent)
- **Contexts:**
  - Keine direkten Contexts

## 5. API Calls
- Keine direkten API-Calls.
- Indirekt: Klick auf einen Pfadteil kann das Nachladen von Ordnerinhalten triggern (Provider.listItemsById)

## 6. Auffälligkeiten & Verbesserungsmöglichkeiten
- Scroll-Handling ist teilweise manuell implementiert
- Breadcrumb-Logik ist teilweise im Header, teilweise in der Komponente
- UX: Lange Pfade werden ggf. nicht optimal gekürzt

## 7. ToDos
- Breadcrumb-Logik vollständig in die Komponente verlagern
- Besseres Handling für sehr lange Pfade (z.B. Ellipsis)
- Testabdeckung für Navigation und Scrollverhalten 