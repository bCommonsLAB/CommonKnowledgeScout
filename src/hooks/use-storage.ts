import { useState, useCallback } from 'react';
import { StorageService } from '@/lib/storage/storage-service';
import { StorageItem, StorageFile, StorageFolder } from '@/lib/storage/types';

export function useStorage(providerId: string = 'mock') {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const storageService = StorageService.getInstance();
  const provider = storageService.getProvider(providerId);

  const listItems = useCallback(async (path: string): Promise<StorageItem[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await provider.listItems(path);
      return items;
    } catch (err) {
      setError(err as Error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const uploadFile = useCallback(async (path: string, file: File): Promise<StorageFile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await provider.uploadFile(path, file);
      return result;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const createFolder = useCallback(async (path: string, name: string): Promise<StorageFolder | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await provider.createFolder(path, name);
      return result;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const deleteItem = useCallback(async (path: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await provider.deleteItem(path);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const downloadFile = useCallback(async (path: string): Promise<Blob | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const blob = await provider.downloadFile(path);
      return blob;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  return {
    isLoading,
    error,
    listItems,
    uploadFile,
    createFolder,
    deleteItem,
    downloadFile,
    provider
  };
} 