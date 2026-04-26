# Storage Module

Complete documentation for the Storage module.

## Overview

The Storage module provides an abstraction layer for file storage operations across multiple backends. It supports local filesystem, OneDrive and Nextcloud (WebDAV).

## Key Files

### Core Types
- **`src/lib/storage/types.ts`**: Core type definitions including `StorageProvider` interface, `StorageItem`, and `StorageValidationResult`

### Factory & Providers
- **`src/lib/storage/storage-factory.ts`**: Main factory for creating storage providers (`LocalStorageProvider`, `NextcloudClientProvider`, `OneDriveProvider`)
- **`src/lib/storage/filesystem-provider.ts`**: Server-side filesystem provider (legacy reference; in-tree, currently no active import — slated for Folge-PR cleanup)
- **`src/lib/storage/nextcloud-provider.ts`**: Server-side Nextcloud (WebDAV) provider, used by `StorageFactory` in Server-Kontext
- **`src/lib/storage/onedrive-provider.ts`**: OneDrive provider implementation (Welle 1: Helper extrahiert nach `onedrive/errors.ts`)
- **`src/lib/storage/onedrive/oauth-server.ts`**: OAuth-Authorization-Code-Flow Server-Helper (kein `StorageProvider`-Implementierer; Welle 1: umgezogen vom alten Pfad `onedrive-provider-server.ts`)

### Client & Server
- **`src/lib/storage/filesystem-client.ts`**: Client-side filesystem helper (legacy reference; in-tree, currently no active import — slated for Folge-PR cleanup)
- **`src/lib/storage/server-provider.ts`**: Server-side provider helper (`getServerProvider`)

### Helper / Capability
- **`src/lib/storage/library-capability.ts`**: Storage-agnostische Capability-Helper (`isFilesystemBacked`); siehe `.cursor/rules/storage-contracts.mdc` §5
- **`src/lib/storage/onedrive/errors.ts`**: Pure Helper fuer OneDrive (`extractGraphEndpoint`, `parseRetryAfter`)
- **`src/lib/storage/provider-request-cache.ts`**: Per-Request-Cache-Wrapper fuer Provider
- **`src/lib/storage/request-deduplicator.ts`**: Deduplizierungs-Helper
- **`src/lib/storage/non-portable-media-url.ts`**: Erkennung von Loopback-URLs

### Context & Hooks
- **`src/contexts/storage-context.tsx`**: React context for storage provider management
- **`src/hooks/use-storage-provider.tsx`**: React hook for storage provider access

### Utilities
- **`src/lib/storage/supported-types.ts`**: Supported library type definitions

## Exports

### Types
- `StorageProvider`: Core interface for storage providers
- `StorageItem`: Unified type for files and folders
- `StorageItemMetadata`: Metadata for storage items
- `StorageValidationResult`: Result of validation operations
- `StorageError`: Error type for storage operations

### Classes
- `StorageFactory`: Singleton factory for creating providers
- `OneDriveProvider`: OneDrive provider
- `NextcloudProvider`: Server-side Nextcloud (WebDAV) provider
- `OneDriveServerProvider`: OAuth-Authorization-Code-Flow Helper (in `onedrive/oauth-server.ts`)

### Functions
- `getServerProvider()`: Creates server-side storage provider
- `isSupportedLibraryType()`: Type guard for library types
- `getSupportedLibraryTypesString()`: UI helper for supported types
- `isFilesystemBacked()`: Storage-agnostic capability check (Welle 1)
- `extractGraphEndpoint()`, `parseRetryAfter()`: OneDrive-Helper (Welle 1)

## Usage Examples

### Creating a Provider (Client-side)
```typescript
import { StorageFactory } from '@/lib/storage/storage-factory';

const factory = StorageFactory.getInstance();
const provider = await factory.getProvider(libraryId);
const items = await provider.listItemsById('root');
```

### Using Storage Context (React)
```typescript
import { useStorage } from '@/contexts/storage-context';

function MyComponent() {
  const { provider, listItems, currentLibrary } = useStorage();
  // Use provider for storage operations
}
```

### Server-side Provider
```typescript
import { getServerProvider } from '@/lib/storage/server-provider';

const provider = await getServerProvider(userEmail, libraryId);
const items = await provider.listItemsById('root');
```

## Dependencies

- **Core Infrastructure**: Uses `@/lib/env`, `@/lib/auth`, `@/lib/mongodb-service`
- **Library System**: Uses `@/types/library`, `@/lib/services/library-service`
- **External**: Uses Clerk for authentication, MongoDB for data storage

## Architecture

The storage module follows a layered architecture:

1. **Types Layer**: Pure type definitions
2. **Provider Layer**: Concrete provider implementations
3. **Factory Layer**: Provider creation and management
4. **Context Layer**: React integration
5. **API Layer**: Server-side route handlers

## Supported Storage Backends

- ✅ **Local File System**: Direct filesystem access (`local`)
- ✅ **OneDrive**: Microsoft OneDrive integration (`onedrive`)
- ✅ **Nextcloud**: WebDAV-based Nextcloud integration (`nextcloud`)

## Error Handling

Storage operations use typed errors (`StorageError`) with error codes:
- `HTTP_ERROR`: Network/HTTP errors
- `AUTH_ERROR`: Authentication failures
- `NOT_FOUND`: Item not found
- `VALIDATION_ERROR`: Configuration validation failures

## Performance Optimizations

- **Caching**: Client-side caching for file listings
- **Request Deduplication**: Prevents duplicate concurrent requests
- **Lazy Loading**: Providers created on-demand
- **Connection Pooling**: MongoDB connection reuse



























