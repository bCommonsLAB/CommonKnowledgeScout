"use client"

/**
 * useStorageForm — zentraler Hook für StorageForm.
 *
 * Kapselt:
 * - Zod-Schema + Typen (storageFormSchema, StorageFormValues)
 * - React-Hook-Form Initialisierung
 * - useEffects: Form-Befüllung, Token-Status, OAuth-Parameter-Verarbeitung
 * - Handler: onSubmit, handleOneDriveAuth, handleOneDriveLogout, handleTest
 *
 * Extrahiert aus storage-form.tsx (Welle 3-IV-Settings-Sections-Split).
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useAtom, useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { toast } from "sonner"
import { StorageProviderType } from "@/types/library"
import { useStorage } from "@/contexts/storage-context"
import { StorageFactory } from "@/lib/storage/storage-factory"

/** Im Settings-Formular waehlbare Storage-Typen ('inbox' ist intern, ADR-0004 II). */
const STORAGE_FORM_STORAGE_TYPES = ["local", "onedrive", "gdrive", "nextcloud"] as const;

/** Mappt StorageProviderType auf den Form-Enum; 'inbox' ist kein User-Typ. */
function toStorageFormStorageType(
  type: StorageProviderType,
): (typeof STORAGE_FORM_STORAGE_TYPES)[number] {
  if (
    type !== "local" &&
    type !== "onedrive" &&
    type !== "gdrive" &&
    type !== "nextcloud"
  ) {
    throw new Error(`Ungueltiger Bibliothekstyp fuer Storage-Settings: "${type}"`);
  }
  return type;
}

// --------------------------------------------------------------------------
// Schema
// --------------------------------------------------------------------------

/** Haupt-Zod-Schema für das Storage-Formular */
export const storageFormSchema = z.object({
  // 'gdrive' ist Legacy (nie funktionsfaehig, UI bietet es nicht mehr an, F4) —
  // bleibt im Enum, damit Bestands-Libraries mit diesem Typ ladbar bleiben.
  type: z.enum(STORAGE_FORM_STORAGE_TYPES, {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  // Zusätzliche Storage-Konfiguration für OneDrive
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  // Nextcloud/WebDAV-Konfiguration
  nextcloudWebdavUrl: z.string().optional(),
  nextcloudUsername: z.string().optional(),
  nextcloudAppPassword: z.string().optional(),
});

export type StorageFormValues = z.infer<typeof storageFormSchema>

// --------------------------------------------------------------------------
// Test-Log Typ (für handleTest)
// --------------------------------------------------------------------------

export interface TestLogEntry {
  step: string;
  status: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Return-Typ
// --------------------------------------------------------------------------

export interface UseStorageFormResult {
  form: ReturnType<typeof useForm<StorageFormValues>>
  activeLibrary: ReturnType<typeof useAtomValue<typeof librariesAtom>>[number] | undefined
  currentType: StorageProviderType | undefined
  isLoading: boolean
  isTesting: boolean
  testDialogOpen: boolean
  setTestDialogOpen: (v: boolean) => void
  testResults: TestLogEntry[]
  tokenStatus: {
    isAuthenticated: boolean
    isExpired: boolean
    loading: boolean
  }
  onSubmit: (data: StorageFormValues) => Promise<void>
  handleOneDriveAuth: () => Promise<void>
  handleOneDriveLogout: () => Promise<void>
  handleTest: () => Promise<void>
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

/**
 * Haupthook für das Storage-Einstellungsformular.
 * Kapselt den gesamten State und alle Handler-Funktionen.
 */
export function useStorageForm(): UseStorageFormResult {
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestLogEntry[]>([]);
  const [processedAuthParams, setProcessedAuthParams] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{
    isAuthenticated: boolean;
    isExpired: boolean;
    loading: boolean;
  }>({
    isAuthenticated: false,
    isExpired: false,
    loading: false
  });
  const [oauthDefaults, setOauthDefaults] = useState<{
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }>({
    tenantId: "",
    clientId: "",
    clientSecret: "",
  });

  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  const { refreshLibraries, refreshAuthStatus } = useStorage();

  // Stable default values — als useMemo damit kein re-render-Loop in useEffect
  const defaultValues = useMemo(() => ({
    type: 'local' as const,
    path: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    nextcloudWebdavUrl: '',
    nextcloudUsername: '',
    nextcloudAppPassword: '',
  }), []);

  const form = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues,
  });

  // Aktueller Storage-Typ für bedingte Felder
  const currentType = form.watch("type") || (activeLibrary?.type as StorageProviderType | undefined);

  // Logging: Mount/Update
  useEffect(() => {
    console.log('[StorageForm] Komponente gemountet/aktualisiert:', {
      pathname: window.location.pathname,
      search: window.location.search,
      activeLibraryId,
      activeLibraryLabel: activeLibrary?.label,
      librariesCount: libraries.length,
      formValues: form.getValues()
    });
  }, [activeLibraryId, activeLibrary, libraries.length, form]);

  // OAuth-Standardwerte laden
  useEffect(() => {
    async function loadOAuthDefaults() {
      try {
        console.log('[StorageForm] Lade OAuth-Standardwerte...');
        const response = await fetch('/api/settings/oauth-defaults');

        if (!response.ok) {
          throw new Error(`Fehler beim Laden der OAuth-Standardwerte: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[StorageForm] Geladene OAuth-Defaults:', {
          hasDefaults: data.hasDefaults,
          tenantId: data.defaults?.tenantId ? 'vorhanden' : 'nicht vorhanden',
          clientId: data.defaults?.clientId ? 'vorhanden' : 'nicht vorhanden',
          clientSecret: data.defaults?.clientSecret ? 'vorhanden' : 'nicht vorhanden',
        });

        if (data.hasDefaults) {
          setOauthDefaults({
            tenantId: data.defaults.tenantId,
            clientId: data.defaults.clientId,
            clientSecret: data.defaults.clientSecret,
          });
        } else {
          console.log('[StorageForm] Keine OAuth-Standardwerte gefunden');
        }
      } catch (error) {
        console.error('[StorageForm] Fehler beim Laden der OAuth-Standardwerte:', error);
      }
    }

    loadOAuthDefaults();
  }, []);

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      const ncConfig = activeLibrary.config?.nextcloud as { webdavUrl?: string; username?: string; appPassword?: string } | undefined;

      console.log('[StorageForm] Befülle Form mit Library-Daten:', {
        libraryLabel: activeLibrary.label,
        type: activeLibrary.type,
        path: activeLibrary.path,
        hasNextcloudConfig: !!ncConfig,
        nextcloudUsername: ncConfig?.username,
        nextcloudWebdavUrl: ncConfig?.webdavUrl,
      });

      const libraryType = activeLibrary.type;
      if (libraryType !== 'local' && libraryType !== 'onedrive' && libraryType !== 'gdrive' && libraryType !== 'nextcloud') {
        console.error(`[StorageForm] Ungültiger Bibliothekstyp: "${libraryType}"`);
      }
      const validType = toStorageFormStorageType(libraryType);

      const formData = {
        type: validType,
        path: activeLibrary.path || "",
        tenantId: activeLibrary.config?.tenantId as string || oauthDefaults.tenantId,
        clientId: activeLibrary.config?.clientId as string || oauthDefaults.clientId,
        clientSecret: (activeLibrary.config?.clientSecret as string === '********')
          ? ''
          : activeLibrary.config?.clientSecret as string || oauthDefaults.clientSecret,
        nextcloudWebdavUrl: ncConfig?.webdavUrl || '',
        nextcloudUsername: ncConfig?.username || '',
        nextcloudAppPassword: (ncConfig?.appPassword === '********')
          ? ''
          : ncConfig?.appPassword || '',
      };

      form.reset(formData);

      setTimeout(() => {
        const afterReset = form.getValues();
        if (!afterReset.type || (afterReset.type !== 'local' && afterReset.type !== 'onedrive' && afterReset.type !== 'gdrive' && afterReset.type !== 'nextcloud')) {
          console.warn('[StorageForm] Type ist nach Reset ungültig, setze auf:', validType);
          form.setValue('type', validType);
        }
      }, 0);

    } else {
      form.reset(defaultValues);
    }
  }, [activeLibrary, form, oauthDefaults, defaultValues]);

  // Token-Status laden (OneDrive) bei Library-Wechsel
  useEffect(() => {
    async function loadTokenStatus() {
      if (!activeLibrary || activeLibrary.type !== 'onedrive') {
        setTokenStatus({ isAuthenticated: false, isExpired: false, loading: false });
        return;
      }

      setTokenStatus(prev => ({ ...prev, loading: true }));

      try {
        const localStorageKey = `onedrive_tokens_${activeLibrary.id}`;
        const tokensJson = localStorage.getItem(localStorageKey);

        if (tokensJson) {
          const tokens = JSON.parse(tokensJson);
          const isExpired = tokens.expiry ? tokens.expiry <= Math.floor(Date.now() / 1000) : false;
          setTokenStatus({ isAuthenticated: true, isExpired, loading: false });
          console.log('[StorageForm] Token-Status aus localStorage:', { hasTokens: true, isExpired });
        } else {
          setTokenStatus({ isAuthenticated: false, isExpired: false, loading: false });
        }
      } catch (error) {
        console.error('[StorageForm] Fehler beim Laden des Token-Status aus localStorage:', error);
        setTokenStatus({ isAuthenticated: false, isExpired: false, loading: false });
      }
    }

    loadTokenStatus();
  }, [activeLibrary]);

  // Formular-Typ/Pfad nach Reload sicherstellen
  useEffect(() => {
    if (!activeLibrary) return;
    const currentValues = form.getValues() as Partial<StorageFormValues>;
    const nextValues: Partial<StorageFormValues> = { ...currentValues };
    let needsReset = false;

    if (activeLibrary.type && currentValues.type !== activeLibrary.type) {
      nextValues.type = toStorageFormStorageType(activeLibrary.type);
      needsReset = true;
    }
    if (typeof currentValues.path !== 'string' || currentValues.path === '') {
      nextValues.path = activeLibrary.path || '';
      needsReset = true;
    }
    if (activeLibrary.type === 'onedrive') {
      if (!currentValues.tenantId) { nextValues.tenantId = (activeLibrary.config?.tenantId as string) || ''; needsReset = true; }
      if (!currentValues.clientId) { nextValues.clientId = (activeLibrary.config?.clientId as string) || ''; needsReset = true; }
      if (currentValues.clientSecret === undefined) { nextValues.clientSecret = ''; needsReset = true; }
    }
    if (activeLibrary.type === 'nextcloud') {
      const nc = activeLibrary.config?.nextcloud as { webdavUrl?: string; username?: string; appPassword?: string } | undefined;
      if (!currentValues.nextcloudWebdavUrl) { nextValues.nextcloudWebdavUrl = nc?.webdavUrl || ''; needsReset = true; }
      if (!currentValues.nextcloudUsername) { nextValues.nextcloudUsername = nc?.username || ''; needsReset = true; }
      if (currentValues.nextcloudAppPassword === undefined) { nextValues.nextcloudAppPassword = ''; needsReset = true; }
    }
    if (needsReset) {
      form.reset(nextValues as StorageFormValues, { keepDefaultValues: false, keepDirty: false, keepTouched: false });
    }
  }, [activeLibrary, form]);

  // OAuth URL-Parameter verarbeiten (authSuccess / authError)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const hasAuthSuccess = searchParams.get('authSuccess') === 'true';
    const hasAuthError = searchParams.get('authError');

    if (!processedAuthParams && libraries.length > 0 && (hasAuthSuccess || hasAuthError)) {
      console.log('[StorageForm] Verarbeite Auth-URL-Parameter:', {
        authSuccess: searchParams.get('authSuccess'),
        authError: searchParams.get('authError'),
        libraryId: searchParams.get('libraryId'),
        activeLibraryId,
      });

      if (hasAuthSuccess) {
        const authenticatedLibraryId = searchParams.get('libraryId');
        toast.success("Authentifizierung erfolgreich", {
          description: "Sie wurden erfolgreich bei OneDrive angemeldet."
        });

        if (authenticatedLibraryId) {
          (async () => {
            try {
              const tokenResponse = await fetch(`/api/libraries/${authenticatedLibraryId}/tokens`, { method: 'POST' });
              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                if (tokenData.success && tokenData.tokens) {
                  const localStorageKey = `onedrive_tokens_${authenticatedLibraryId}`;
                  localStorage.setItem(localStorageKey, JSON.stringify({
                    accessToken: tokenData.tokens.accessToken,
                    refreshToken: tokenData.tokens.refreshToken,
                    expiry: parseInt(tokenData.tokens.tokenExpiry, 10)
                  }));
                  setTokenStatus({ isAuthenticated: true, isExpired: false, loading: false });

                  try {
                    const factory = StorageFactory.getInstance();
                    await factory.clearProvider(authenticatedLibraryId);
                  } catch (error) {
                    console.error('[StorageForm] Fehler beim Leeren des Provider-Cache:', error);
                  }

                  await refreshAuthStatus();
                }
              } else {
                console.error('[StorageForm] Fehler beim Abrufen der temporären Tokens:', tokenResponse.statusText);
              }
            } catch (error) {
              console.error('[StorageForm] Fehler beim Verarbeiten der temporären Tokens:', error);
            }
          })();

          (async () => {
            try {
              const res = await fetch(`/api/libraries/${authenticatedLibraryId}`)
              if (res.ok) {
                const updatedLibrary = await res.json()
                setLibraries(libraries.map(lib => lib.id === updatedLibrary.id ? updatedLibrary : lib))
                form.reset({
                  type: updatedLibrary.type,
                  path: updatedLibrary.path || '',
                  tenantId: updatedLibrary.config?.tenantId || oauthDefaults.tenantId,
                  clientId: updatedLibrary.config?.clientId || oauthDefaults.clientId,
                  clientSecret: ''
                })
              }
            } catch (error) {
              console.error('[StorageForm] Fehler beim Laden der aktualisierten Library:', error)
            }
          })();
        }
      }

      if (hasAuthError) {
        const errorMessage = searchParams.get('authError');
        console.error('[StorageForm] OAuth-Fehler:', errorMessage);
        toast.error("Fehler bei der Authentifizierung", {
          description: errorMessage || "Unbekannter Fehler bei der Authentifizierung",
        });
      }

      setProcessedAuthParams(true);

      // URL bereinigen
      const url = new URL(window.location.href);
      url.searchParams.delete('authSuccess');
      url.searchParams.delete('authError');
      url.searchParams.delete('libraryId');
      url.searchParams.delete('errorDescription');
      window.history.replaceState({}, '', url.toString());
    }
  }, [libraries, activeLibraryId, processedAuthParams, setLibraries, refreshAuthStatus, form, oauthDefaults]);

  // --------------------------------------------------------------------------
  // Handler
  // --------------------------------------------------------------------------

  /** Formular absenden */
  const onSubmit = useCallback(async (data: StorageFormValues) => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." });
      return;
    }

    setIsLoading(true);

    try {
      console.log('[StorageForm] === SUBMIT START ===');
      console.log('[StorageForm] Formular-Rohdaten:', data);

      const config: Record<string, unknown> = {};

      if (data.type === 'onedrive') {
        if (data.tenantId) config.tenantId = data.tenantId.trim();
        if (data.clientId) config.clientId = data.clientId.trim();
        if (data.clientSecret && data.clientSecret !== '********') {
          const trimmedSecret = data.clientSecret.trim();
          if (trimmedSecret !== '') config.clientSecret = trimmedSecret;
        }
      }

      if (data.type === 'nextcloud') {
        const nc: Record<string, string> = {};
        if (data.nextcloudWebdavUrl) nc.webdavUrl = data.nextcloudWebdavUrl.trim();
        if (data.nextcloudUsername) nc.username = data.nextcloudUsername.trim();
        if (data.nextcloudAppPassword && data.nextcloudAppPassword !== '********') {
          const trimmed = data.nextcloudAppPassword.trim();
          if (trimmed) nc.appPassword = trimmed;
        }
        if (Object.keys(nc).length > 0) config.nextcloud = nc;
      }

      const requestBody = { type: data.type, path: data.path, config };
      const response = await fetch(`/api/libraries/${activeLibrary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error(`Fehler beim Speichern: ${response.statusText}`);

      const updatedLibrary = await response.json();
      setLibraries(libraries.map(lib => lib.id === updatedLibrary.id ? updatedLibrary : lib));
      toast.success("Erfolg", { description: "Die Einstellungen wurden gespeichert." });
      console.log('[StorageForm] === SUBMIT END ===');
    } catch (error) {
      console.error('[StorageForm] Fehler beim Speichern:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeLibrary, libraries, setLibraries]);

  /** OneDrive OAuth-Flow starten */
  const handleOneDriveAuth = useCallback(async () => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." });
      return;
    }

    try {
      if (form.formState.isDirty) {
        toast.info("Speichere Änderungen", {
          description: "Die aktuellen Konfigurationseinstellungen werden gespeichert...",
        });
        await onSubmit(form.getValues());
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await fetch(`/api/libraries/${activeLibrary.id}`);
      if (!response.ok) throw new Error(`Fehler beim Laden der Bibliothek: ${response.statusText}`);

      const updatedLibrary = await response.json();

      if (!updatedLibrary.config?.clientId) {
        toast.error("Unvollständige Konfiguration", {
          description: "Bitte geben Sie eine Client ID ein und speichern Sie die Änderungen.",
        });
        return;
      }

      const hasClientSecret = updatedLibrary.config?.clientSecret && updatedLibrary.config.clientSecret !== '';
      if (!hasClientSecret) {
        toast.error("Unvollständige Konfiguration", {
          description: "Bitte geben Sie ein Client Secret ein und speichern Sie die Änderungen.",
        });
        return;
      }

      // OAuth-URL über Factory erstellen (kein direkter Provider-Zugriff)
      const provider = StorageFactory.getInstance().createOneDriveProviderForAuth(updatedLibrary);
      const authUrlString = await provider.getAuthUrl();

      const currentUrl = window.location.href;
      const stateObj = { libraryId: updatedLibrary.id, redirect: currentUrl };
      const urlWithState = new URL(authUrlString);
      urlWithState.searchParams.set('state', JSON.stringify(stateObj));

      window.location.href = urlWithState.toString();
    } catch (error) {
      console.error('[StorageForm] Fehler beim Starten der OneDrive-Authentifizierung:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Authentifizierung",
      });
    }
  }, [activeLibrary, form, onSubmit]);

  /** Von OneDrive abmelden */
  const handleOneDriveLogout = useCallback(async () => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." });
      return;
    }

    try {
      const response = await fetch(`/api/libraries/${activeLibrary.id}/tokens`, { method: 'DELETE' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Abmelden');
      }

      try {
        localStorage.removeItem(`onedrive_tokens_${activeLibrary.id}`);
      } catch (error) {
        console.error('[StorageForm] Fehler beim Entfernen der Tokens aus localStorage:', error);
      }

      setTokenStatus({ loading: false, isAuthenticated: false, isExpired: false });
      await refreshLibraries();

      try {
        await StorageFactory.getInstance().clearProvider(activeLibrary.id);
      } catch (error) {
        console.error('[StorageForm] Fehler beim Leeren des Provider-Cache:', error);
      }

      toast.success("Erfolgreich abgemeldet", {
        description: "Sie wurden erfolgreich von OneDrive abgemeldet.",
      });
    } catch (error) {
      console.error('[StorageForm] Fehler beim Abmelden von OneDrive:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Abmelden",
      });
    }
  }, [activeLibrary, refreshLibraries]);

  /** Storage-Provider testen */
  const handleTest = useCallback(async () => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." });
      return;
    }
    setIsTesting(true);
    setTestResults([]);
    setTestDialogOpen(true);
    try {
      const logs: TestLogEntry[] = [];
      const logStep = (step: string, status: TestLogEntry['status'], message: string, details?: TestLogEntry['details']) => {
        const entry = { timestamp: new Date().toISOString(), step, status, message, details };
        logs.push(entry);
        setTestResults([...logs]);
      };

      const factory = StorageFactory.getInstance();
      const provider = await factory.getProvider(activeLibrary.id);

      if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function') {
        const isAuth = (provider as { isAuthenticated(): boolean }).isAuthenticated();
        logStep("Provider-Status", "info", "Provider-Informationen", {
          name: provider.name, id: provider.id, isAuthenticated: isAuth,
        });
      }

      logStep("Validierung", "info", "Validiere Storage-Provider Konfiguration...");
      const validationResult = await provider.validateConfiguration();

      if (!validationResult.isValid) {
        logStep("Validierung", "error", `Storage-Provider Konfiguration ungültig: ${validationResult.error}`);
        return;
      }
      logStep("Validierung", "success", "Storage-Provider Konfiguration ist gültig.", { validationResult });

      try {
        const rootItems = await provider.listItemsById('root');
        logStep("Root-Verzeichnis", "success", `${rootItems.length} Elemente im Root gefunden.`);

        const testFolderName = `test-folder-${Math.random().toString(36).substring(7)}`;
        const testFolder = await provider.createFolder('root', testFolderName);
        logStep("Testverzeichnis", "success", `Testverzeichnis "${testFolderName}" erstellt.`);

        const testFileName = `test-file-${Math.random().toString(36).substring(7)}.txt`;
        const blob = new Blob(["Testdatei Knowledge Scout"], { type: 'text/plain' });
        const testFile = new File([blob], testFileName, { type: 'text/plain' });
        const createdFile = await provider.uploadFile(testFolder.id, testFile);
        logStep("Testdatei", "success", `Testdatei "${testFileName}" erstellt.`);

        await provider.deleteItem(testFolder.id);
        logStep("Aufräumen", "success", `Testverzeichnis gelöscht.`);

        // Serverseitiger Test
        try {
          logStep("API-Aufruf", "info", "Starte serverseitigen Storage-Test...");
          const resp = await fetch('/api/settings/storage-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ libraryId: activeLibrary.id })
          });
          if (!resp.ok) {
            const msg = await resp.text();
            logStep("Server-Test", "error", `Server-Test fehlgeschlagen: ${resp.status}`, { body: msg.slice(0, 300) });
          } else {
            const data = await resp.json();
            const serverLogs = Array.isArray(data.logs) ? data.logs as TestLogEntry[] : [];
            for (const entry of serverLogs) logs.push(entry);
            setTestResults([...logs]);
            logStep("Server-Test", data.success ? "success" : "error", data.success ? "Server-Test abgeschlossen" : "Server-Test fehlgeschlagen");
          }
        } catch (e) {
          logStep("Server-Test", "error", e instanceof Error ? e.message : String(e));
        }

        // Suppress unused variable warning — createdFile wird für den Typen benötigt
        void createdFile;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Nicht authentifiziert') || errorMessage.includes('AUTH_REQUIRED')) {
          logStep("Fehler", "error", "Zugriff verweigert: Provider ist nicht authentifiziert");
          logStep("Hinweis", "info", "Bitte authentifizieren Sie sich zuerst in den Storage-Einstellungen");
          return;
        }
        const safeDetails = typeof error === 'object' && error !== null ? error as Record<string, unknown> : { error };
        logStep("Fehler", "error", `Test fehlgeschlagen: ${errorMessage}`, safeDetails);
      }
    } catch (error) {
      console.error('[StorageForm] Fehler beim Testen:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Testen",
      });
    } finally {
      setIsTesting(false);
    }
  }, [activeLibrary]);

  return {
    form,
    activeLibrary,
    currentType,
    isLoading,
    isTesting,
    testDialogOpen,
    setTestDialogOpen,
    testResults,
    tokenStatus,
    onSubmit,
    handleOneDriveAuth,
    handleOneDriveLogout,
    handleTest,
  };
}
