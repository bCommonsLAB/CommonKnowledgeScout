# Library Module

Complete documentation for the Library module.

## Overview

The Library module manages library configuration, state, and UI components. Libraries represent collections of files organized by storage backend and user ownership.

## Key Files

### Types
- **`src/types/library.ts`**: Complete library type definitions including `Library`, `ClientLibrary`, `LibraryChatConfig`, `StorageConfig`, and `PublicLibraryConfig`

### State Management
- **`src/atoms/library-atom.ts`**: Jotai atoms for library state management including active library, folder navigation, and file caching

### Service
- **`src/lib/services/library-service.ts`**: MongoDB-based library service for CRUD operations

### Components
- **`src/components/library/library.tsx`**: Main library component combining file tree, list, and preview
- **`src/components/library/library-header.tsx`**: Library header with switcher and actions
- **`src/components/library/library-switcher.tsx`**: Library selection component
- **`src/components/library/file-list.tsx`**: File list component with header actions and record-level operations

## Exports

### Types
- `Library`: Complete library configuration type
- `ClientLibrary`: Client-side library type
- `LibraryChatConfig`: Chat/RAG configuration
- `StorageConfig`: Storage provider configuration
- `PublicLibraryConfig`: Public publishing configuration
- `StorageProviderType`: Supported storage provider types

### Atoms
- `libraryAtom`: Main library state atom
- `activeLibraryIdAtom`: Active library ID atom
- `librariesAtom`: Libraries list atom
- `activeLibraryAtom`: Active library object atom
- `currentFolderIdAtom`: Current folder ID atom
- `folderItemsAtom`: Folder items atom family

### Service
- `LibraryService`: Singleton service class for library operations

### Components
- `Library`: Main library component
- `LibraryHeader`: Library header component
- `LibrarySwitcher`: Library switcher component
- `FileList`: File list component with actions and batch operations

## Usage Examples

### Accessing Library State
```typescript
import { useAtomValue } from 'jotai';
import { activeLibraryAtom, librariesAtom } from '@/atoms/library-atom';

function MyComponent() {
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const libraries = useAtomValue(librariesAtom);
  // Use library data
}
```

### Using Library Service
```typescript
import { LibraryService } from '@/lib/services/library-service';

const service = LibraryService.getInstance();
const libraries = await service.getUserLibraries(userEmail);
const library = await service.getLibrary(userEmail, libraryId);
```

### Library Component
```typescript
import { Library } from '@/components/library/library';

export default function LibraryPage() {
  return <Library />;
}
```

### Using Root Items Hook
```typescript
import { useRootItems, useRootItemsSync } from '@/hooks/use-root-items';

function MyComponent() {
  // Get function to load root items (async)
  const getRootItems = useRootItems();
  
  // Get root items synchronously if already loaded
  const rootItems = useRootItemsSync();
  
  useEffect(() => {
    if (!rootItems) {
      // Load root items if not available
      getRootItems().then(items => {
        console.log('Root items loaded:', items);
      });
    }
  }, [getRootItems, rootItems]);
}
```

## Dependencies

- **Storage Layer**: Uses `@/lib/storage/storage-factory` for provider access
- **Database**: Uses `@/lib/mongodb-service` for persistence
- **State Management**: Uses Jotai for state management
- **Chat System**: Uses `@/lib/chat/constants` for chat configuration types

## Library Configuration

Libraries support:
- **Storage Configuration**: Provider type and authentication
- **Chat Configuration**: RAG settings, target language, character
- **Public Publishing**: Gallery and story mode configuration
- **Gallery Configuration**: Facets, detail view types

## State Management

Library state is managed through Jotai atoms with a centralized caching strategy:

### State Architecture

The Library module uses a **centralized state management** approach with Jotai atoms:

- **Global State**: Libraries list, active library
- **Navigation State**: Current folder, path
- **UI State**: Loading states, selected files
- **Cache**: Folder items cache for performance

### Central State Logic

#### 1. Folder Items Cache (`folderItemsAtom`)

The `folderItemsAtom` is an **atom family** that caches folder contents by folder ID:

```typescript
// Atom family for folder-specific caching
export const folderItemsAtom = atomFamily((folderId: string) => 
  atom<StorageItem[] | null>(null)
);
```

**How it works:**
- Each folder has its own cached state
- When `currentFolderId === 'root'`, root items are cached
- Components can access cached items synchronously without API calls
- Cache is updated when folders are loaded via `StorageContext`

**Benefits:**
- Eliminates duplicate API calls for the same folder
- Provides instant access to already-loaded data
- Reduces server load and improves performance

#### 2. Root Items Central Management (`useRootItems`)

The `useRootItems` hook provides centralized access to root items:

```typescript
// Hook automatically uses cache if available
const getRootItems = useRootItems();

// Synchronous access if root items are already cached
const rootItems = useRootItemsSync();
```

**How it works:**
- Checks `folderItemsAtom` if `currentFolderId === 'root'`
- Falls back to API call via `StorageContext.listItems('root')`
- Uses request deduplication from `StorageContext`
- All components share the same cached root items

**Integration with StorageContext:**
- `StorageContext` loads root items once when library is initialized
- Updates `folderItemsAtom` when root items are loaded
- `useRootItems` reads from cache, avoiding duplicate requests

#### 3. Request Deduplication

The `StorageContext` implements request deduplication:

- Multiple simultaneous requests for the same folder are merged
- Only one API call is made, all callers receive the same promise
- Prevents duplicate network requests during rapid navigation

#### 4. State Flow

```
1. User navigates to folder
   ↓
2. StorageContext.listItems(folderId)
   ↓
3. Request deduplication checks for pending requests
   ↓
4. API call (if not cached/deduplicated)
   ↓
5. folderItemsAtom updated with results
   ↓
6. All components using folderItemsAtom receive updates
```

### State Atoms Reference

| Atom | Type | Purpose |
|------|------|---------|
| `libraryAtom` | `LibraryState` | Main library state container |
| `activeLibraryIdAtom` | `string` | Currently active library ID |
| `librariesAtom` | `ClientLibrary[]` | List of all user libraries |
| `activeLibraryAtom` | `ClientLibrary \| undefined` | Active library object (derived) |
| `currentFolderIdAtom` | `string` | Current folder ID (default: 'root') |
| `folderItemsAtom` | `atomFamily` | Folder items cache by folder ID |
| `libraryStatusAtom` | `LibraryStatus` | Library loading status |

### Best Practices

1. **Always use `folderItemsAtom` for folder contents** - Don't make direct API calls
2. **Use `useRootItems` for root items** - Provides cache-aware access
3. **Let StorageContext manage loading** - Components should read from atoms, not trigger loads
4. **Cache is automatically updated** - No manual cache invalidation needed

## File List Component

The `FileList` component displays files and folders in a table format with header actions and record-level operations.

### Header Actions

The header bar (visible when not in compact mode) provides batch operations:

| Button | Icon | Function | When Visible |
|--------|------|----------|--------------|
| **Refresh** | `RefreshCw` | Reloads current folder contents | Always |
| **File Category Filter** | Filter icon | Filters files by category (PDF, Audio, Video, etc.) | Always |
| **Batch Transcription** | `ScrollText` | Opens transcription dialog for selected audio/video files | When audio/video files are selected |
| **Batch Transformation** | `Plus` | Opens transformation dialog for selected PDF files | When PDF files are selected |
| **Batch Ingest** | Text button | Ingests selected documents into RAG system | When PDF/Markdown files are selected |
| **Bulk Delete** | `Trash2` | Deletes all selected files | When any files are selected |

**Usage:**
1. Select files using checkboxes
2. Header buttons appear automatically based on file types selected
3. Click button to perform batch operation
4. Operation runs in background, progress shown per file

### Record-Level Actions

Each file row provides the following actions:

| Element | Function | Details |
|---------|----------|--------|
| **Checkbox** | Select file for batch operations | Leftmost column, enables batch actions |
| **File Icon** | Visual file type indicator | Shows icon based on MIME type (PDF, Audio, Video, Text) |
| **File Name** | Select/Edit file | Click to select, double-click to rename |
| **Shadow-Twin Icon** | View Shadow-Twin files | Blue `FileText` icon, shows if Shadow-Twin exists (transcript or transformed file or directory) |
| **Create Transcript** | Create new transcript | Plus icon, only shown for transcribable files without Shadow-Twin |
| **Delete Button** | Delete file | Red `Trash2` icon, deletes file after confirmation |

**File Interactions:**
- **Single Click**: Selects file (opens in preview)
- **Double Click**: Enters rename mode
- **Long Press** (touch): Opens context menu
- **Drag & Drop**: Reorder files (if supported)

**Shadow-Twin Integration:**
- Shadow-Twin files (transcripts and transformed files) are grouped with their base files
- Single Shadow-Twin icon indicates if Shadow-Twin exists (file or directory)
- Clicking Shadow-Twin icon opens the transformed file (if available) or first transcript file
- Shadow-Twin state is automatically analyzed and displayed

### File Categories

Files are automatically categorized:
- **PDF Files**: Can be transformed, transcribed (OCR), and ingested
- **Audio Files**: Can be transcribed and ingested
- **Video Files**: Can be transcribed and ingested
- **Markdown Files**: Can be ingested, may be transcripts or transformed files
- **Other Files**: Display only, limited operations

### Batch Operations

Batch operations support multiple files simultaneously:

1. **Batch Transcription**: Transcribes multiple audio/video files in parallel
2. **Batch Transformation**: Transforms multiple PDFs to Markdown
3. **Batch Ingestion**: Ingests multiple documents into RAG system
4. **Bulk Delete**: Deletes multiple files at once

**Selection:**
- Use checkboxes to select individual files
- Selection persists across folder navigation
- Header shows count of selected files

## API Integration

Libraries are managed through:
- `GET /api/libraries`: Get user libraries
- `POST /api/libraries`: Create/update library
- `GET /api/libraries/[id]`: Get specific library
- `PUT /api/libraries/[id]`: Update library
- `DELETE /api/libraries/[id]`: Delete library



























