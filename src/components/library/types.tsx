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
 * @property {string} currentFolderId - ID of the currently selected folder
 * @property {string} [libraryName] - Optional name of the library to display at root level
 */
export interface FileTreeProps {
  provider: StorageProvider | null;
  onSelect: (item: StorageItem) => void;
  currentFolderId: string;
  libraryName?: string;
}

/**
 * Props for the FileList component which displays files in the current folder.
 * @property {StorageItem[]} items - Array of items to display in the list
 * @property {StorageItem | null} selectedItem - Currently selected item
 * @property {Function} onSelect - Callback function when an item is selected
 * @property {string} currentFolderId - ID of the current folder being displayed
 */
export interface FileListProps {
  items: StorageItem[];
  selectedItem: StorageItem | null;
  onSelect: (item: StorageItem) => void;
  currentFolderId: string;
}

/**
 * Props for the FilePreview component which shows file previews.
 * @property {StorageItem | null} item - The item to preview
 * @property {string} [className] - Optional CSS class name for styling
 */
export interface FilePreviewProps {
  item: StorageItem | null;
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