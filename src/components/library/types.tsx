import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { ClientLibrary } from "@/types/library";

/**
 * Represents the different types of files that can be displayed in the library.
 * Used for determining appropriate icons and preview behaviors.
 */
export type FileType = 'folder' | 'audio' | 'video' | 'pdf' | 'text' | 'markdown';

/**
 * Props for the FileTree component which displays the folder hierarchy.
 * @property {StorageProvider | null} provider - The active storage provider for file operations
 * @property {Function} onSelect - Callback function when a folder is selected
 * @property {string} [libraryName] - Optional name of the library to display at root level
 */
export interface FileTreeProps {
  provider: StorageProvider | null;
  onSelect: (item: StorageItem) => void;
  libraryName?: string;
}

/**
 * Props for the FileList component which displays files in the current folder.
 * @property {StorageItem[]} items - Array of items to display in the list
 * @property {StorageItem | null} selectedItem - Currently selected item
 * @property {Function} onSelectAction - Callback function when an item is selected
 * @property {string} [searchTerm] - Optional search term to filter the items
 */
export interface FileListProps {
  items: StorageItem[];
  selectedItem: StorageItem | null;
  onSelectAction: (item: StorageItem) => void;
  searchTerm?: string;
}

/**
 * Props for the LibraryHeader component which displays the path and actions for the current folder.
 * @property {ClientLibrary | undefined} activeLibrary - The currently active library
 * @property {StorageItem[]} breadcrumbItems - Items to show in the breadcrumb path
 * @property {Function} onFolderSelect - Callback when a folder in the breadcrumb is selected
 * @property {Function} onRootClick - Callback when the root folder is selected
 * @property {StorageProvider | null} provider - The active storage provider
 * @property {Function} [onUploadComplete] - Optional callback when an upload completes
 * @property {string | null} [error] - Optional error message to display
 */
export interface LibraryHeaderProps {
  activeLibrary: ClientLibrary | undefined;
  breadcrumbItems: StorageItem[];
  onFolderSelect: (item: StorageItem) => void;
  onRootClick: () => void;
  provider: StorageProvider | null;
  onUploadComplete?: () => void;
  error?: string | null;
}

/**
 * Props for the FilePreview component which shows file previews.
 * @property {StorageItem | null} item - The item to preview
 * @property {StorageProvider | null} provider - The storage provider to fetch content
 * @property {string} [className] - Optional CSS class name for styling
 */
export interface FilePreviewProps {
  item: StorageItem | null;
  provider: StorageProvider | null;
  className?: string;
}

/**
 * Context props for the Library component to manage library state.
 * Used to share library state between components and handle library switching.
 * @property {ClientLibrary[]} libraries - Available libraries
 * @property {string} activeLibraryId - ID of the currently active library
 * @property {Function} onLibraryChange - Callback when active library changes
 */
export interface LibraryContextProps {
  libraries: ClientLibrary[];
  activeLibraryId: string;
  onLibraryChange: (libraryId: string) => void;
}

export interface UploadAreaProps {
  provider: StorageProvider | null
  currentFolderId: string
  onUploadComplete?: () => void
}

export interface UploadingFile extends File {
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'error' | 'complete'
  error?: string
}