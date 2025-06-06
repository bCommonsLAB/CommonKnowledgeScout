import * as React from "react";
import { Button } from "@/components/ui/button";
import { LucideCloud, LucideCloudDrizzle, LucideCloudCog } from "lucide-react";
import { OneDriveProvider } from "@/lib/storage/onedrive-provider";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom";

const providerIcons: Record<string, React.ReactNode> = {
  onedrive: <LucideCloud className="mr-2 h-4 w-4" />,
  google: <LucideCloudDrizzle className="mr-2 h-4 w-4" />,
  dropbox: <LucideCloudCog className="mr-2 h-4 w-4" />,
};

interface StorageAuthButtonProps {
  provider: string;
  label?: string;
  authUrl?: string;
}

/**
 * Generischer Auth-Button für verschiedene Storage-Provider.
 * Startet den Authentifizierungs-Flow für den angegebenen Provider.
 */
export function StorageAuthButton({ provider, label, authUrl }: StorageAuthButtonProps) {
  const libraries = useAtomValue(librariesAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  const providerKey = activeLibrary?.type || provider;

  const handleLogin = async () => {
    const currentUrl = window.location.href;
    if (providerKey === "onedrive" && activeLibrary) {
      try {
        const oneDriveProvider = new OneDriveProvider(activeLibrary);
        const authUrlString = await oneDriveProvider.getAuthUrl();
        const urlWithState = new URL(authUrlString);
        const stateObj = { libraryId: activeLibrary.id, redirect: currentUrl };
        urlWithState.searchParams.set("state", JSON.stringify(stateObj));
        window.location.href = urlWithState.toString();
      } catch (error) {
        // Fehlerbehandlung: Zeige eine Meldung oder logge den Fehler
        // eslint-disable-next-line no-console
        console.error("[StorageAuthButton] Fehler beim Starten der OneDrive-Authentifizierung:", error);
      }
    } else {
      // Füge redirect-Parameter auch für andere Provider hinzu
      const baseUrl = authUrl || `/api/auth/${providerKey}`;
      const url = new URL(baseUrl, window.location.origin);
      const stateObj = { redirect: currentUrl };
      url.searchParams.set("state", JSON.stringify(stateObj));
      window.location.href = url.toString();
    }
  };

  return (
    <Button onClick={handleLogin} variant="outline">
      {providerIcons[providerKey] || null}
      {label || `Bei ${providerKey.charAt(0).toUpperCase() + providerKey.slice(1)} anmelden`}
    </Button>
  );
} 