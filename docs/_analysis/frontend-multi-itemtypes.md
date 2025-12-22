# Frontend-Unterstützung für mehrere Item-Typen pro Library

## Übersicht

Das Frontend muss mehrere Item-Typen (`document`, `event`, `joboffer`, `testimonial`, etc.) innerhalb einer Library unterstützen. Dies erfordert Anpassungen in Gallery-Komponenten, Detailansichten und Filter-Logik.

## Aktuelle Struktur

### Gallery-Typen

**Datei**: `src/lib/gallery/types.ts`

- `DocCardMeta`: Frontend-spezifisches Format für Gallery-Anzeige
- `mapItemToDocCardMeta`: Mapping-Funktion von `Item` → `DocCardMeta`

**Wichtig**: `DocCardMeta` wurde erweitert um:
- `docType?: string` - Item-Typ für Diskriminierung
- `parentId?: string` - Für Hierarchien (z.B. Testimonials → Events)

### Gallery-Komponenten

**Hauptkomponenten**:
- `src/components/library/gallery/gallery-root.tsx` - Haupt-Gallery-Komponente
- `src/components/library/gallery/items-view.tsx` - Items-Ansicht (Grid/Table)
- `src/components/library/gallery/document-card.tsx` - Dokument-Karte
- `src/components/library/gallery/detail-overlay.tsx` - Detail-Overlay

**Aktuell**: Komponenten verwenden `DocCardMeta`, sind aber noch nicht typ-spezifisch.

## Zielbild: Mehrere Item-Typen unterstützen

### 1. Filter nach Item-Typ

**In Gallery-Filtern** (`src/components/library/gallery/gallery-filters.tsx` oder ähnlich):

- `docType` als Facette verfügbar machen
- Filter-Komponente zeigt Checkboxen/Select für verfügbare `docType`-Werte
- Filter-Logik: `docType in ['document', 'event']` etc.

**Beispiel**:
```typescript
// In Filter-Komponente
const docTypeFilter = filters.docType as string[] | undefined;
const availableDocTypes = ['document', 'event', 'joboffer', 'testimonial'];

// Filter-UI
<Select
  value={docTypeFilter}
  onValueChange={(values) => updateFilter('docType', values)}
>
  {availableDocTypes.map(type => (
    <SelectItem key={type} value={type}>
      {KNOWN_ITEM_TYPES[type] || type}
    </SelectItem>
  ))}
</Select>
```

### 2. Typ-spezifische Facetten

**In Library-Config** (`src/types/library.ts`):

- `config.chat.gallery.facets` pro Library definieren
- Typ-spezifische Facetten nur anzeigen, wenn entsprechender `docType`-Filter gesetzt ist

**Beispiel**:
```typescript
// Library-Config
facets: [
  { metaKey: 'docType', label: 'Typ', type: 'string[]', visible: true }, // Global
  { metaKey: 'year', label: 'Jahr', type: 'number', visible: true }, // Global
  { metaKey: 'employer', label: 'Arbeitgeber', type: 'string', visible: true, docTypes: ['joboffer'] }, // Nur bei JobOffers
  { metaKey: 'speakers', label: 'Sprecher', type: 'string[]', visible: true, docTypes: ['event'] }, // Nur bei Events
]
```

**Filter-Komponente**:
- Zeigt nur Facetten an, die für aktuelle `docType`-Filter relevant sind
- Oder zeigt alle Facetten, markiert aber typ-spezifische als "nur für X"

### 3. Typ-spezifische Detailansichten

**Routing nach `docType`**:

- `document` → `BookDetail` / `DocumentDetail` (bestehende Komponente)
- `event` → `EventDetail` (neue Komponente)
- `joboffer` → `JobOfferDetail` (neue Komponente)
- `testimonial` → `TestimonialDetail` (neue Komponente)

**Implementierung**:
```typescript
// In detail-overlay.tsx oder ähnlich
function DetailView({ item }: { item: Item }) {
  switch (item.docType) {
    case 'event':
      return <EventDetail item={item} />;
    case 'joboffer':
      return <JobOfferDetail item={item} />;
    case 'testimonial':
      return <TestimonialDetail item={item} parentId={item.parentId} />;
    case 'document':
    default:
      return <BookDetail item={item} />;
  }
}
```

**Wichtig**: Alle Detail-Komponenten nutzen dasselbe `Item`-Modell, nur die Darstellung variiert.

### 4. Event + Testimonials im UI

**Event-Detailansicht**:

- Zeigt Event-Item selbst
- Zeigt zugehörige Testimonials (Filter: `docType='testimonial'` + `parentId=eventId`)
- Testimonial-Liste als eigene Sektion oder Tabs

**Implementierung**:
```typescript
// In EventDetail-Komponente
function EventDetail({ item }: { item: Item }) {
  const [testimonials, setTestimonials] = useState<Item[]>([]);
  
  useEffect(() => {
    // Lade Testimonials für dieses Event
    loadItems({
      libraryId: item.libraryId,
      filters: {
        docType: 'testimonial',
        parentId: item.id,
      },
    }).then(setTestimonials);
  }, [item.id]);
  
  return (
    <div>
      {/* Event-Details */}
      <EventContent item={item} />
      
      {/* Testimonials-Sektion */}
      <TestimonialsSection testimonials={testimonials} eventId={item.id} />
    </div>
  );
}
```

**Testimonial-Formular**:

- In Event-Detailansicht: Button "Testimonial hinzufügen"
- Formular erzeugt `RawItem` mit `docType='testimonial'`, `parentId=eventId`
- Submit → ItemWorker → VectorWorker (wie alle anderen Flows)

### 5. Chat/RAG-Filterung

**In Chat-Orchestrator** (`src/lib/chat/orchestrator.ts`):

- Filter-Logik erweitern, um `docType` + `parentId` zu unterstützen
- Wenn Event abgefragt wird: Automatisch `docType in ['event','testimonial']` + `parentId=eventId` hinzufügen

**Beispiel**:
```typescript
// In buildFilters oder ähnlich
function buildEventFilters(eventId: string, includeTestimonials: boolean = true) {
  const filters: Record<string, unknown> = {
    docType: includeTestimonials ? ['event', 'testimonial'] : ['event'],
  };
  
  if (includeTestimonials) {
    // Entweder Event selbst oder Testimonials zum Event
    filters.$or = [
      { fileId: eventId },
      { parentId: eventId },
    ];
  } else {
    filters.fileId = eventId;
  }
  
  return filters;
}
```

## Migrationspfad

### Schritt 1: DocCardMeta erweitern

✅ **Erledigt**: `DocCardMeta` wurde um `docType` und `parentId` erweitert.

### Schritt 2: Mapping-Funktion

✅ **Erledigt**: `mapItemToDocCardMeta` wurde erstellt.

### Schritt 3: Filter-Komponenten anpassen

**TODO**:
- `docType` als Facette in Filter-Komponenten hinzufügen
- Typ-spezifische Facetten logik implementieren

### Schritt 4: Detailansichten erweitern

**TODO**:
- `EventDetail`-Komponente erstellen
- `JobOfferDetail`-Komponente erstellen
- `TestimonialDetail`-Komponente erstellen
- Routing nach `docType` implementieren

### Schritt 5: Testimonial-Formular

**TODO**:
- Testimonial-Formular-Komponente erstellen
- API-Endpunkt für Testimonial-Submit
- Integration in Event-Detailansicht

### Schritt 6: Chat-Filterung

**TODO**:
- Chat-Filter-Logik für `docType` + `parentId` erweitern
- Automatische Testimonial-Einbindung bei Event-Queries

## Zusammenfassung

Das Frontend kann mehrere Item-Typen pro Library unterstützen durch:

1. **Filter**: `docType` als Facette, typ-spezifische Facetten
2. **Detailansichten**: Routing nach `docType`, verschiedene Komponenten für verschiedene Typen
3. **Hierarchien**: `parentId` für Testimonials → Events
4. **Chat/RAG**: Filter-Logik für `docType` + `parentId`

**Wichtig**: Alle Komponenten nutzen dasselbe `Item`-Modell, nur die Darstellung und Filterung variiert.























