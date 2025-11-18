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

Library state is managed through Jotai atoms:
- **Global State**: Libraries list, active library
- **Navigation State**: Current folder, path
- **UI State**: Loading states, selected files
- **Cache**: Folder items cache for performance

## API Integration

Libraries are managed through:
- `GET /api/libraries`: Get user libraries
- `POST /api/libraries`: Create/update library
- `GET /api/libraries/[id]`: Get specific library
- `PUT /api/libraries/[id]`: Update library
- `DELETE /api/libraries/[id]`: Delete library























