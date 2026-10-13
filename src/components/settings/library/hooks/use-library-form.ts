/**
 * @fileoverview Haupt-Hook für das Library-Grundlagen-Formular.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split). Seit Teil B
 * des Plans speicher-verbindungen-und-library-anlage haelt der Hook NUR noch
 * die Grundlagen (Name, Aktiv, Speicherpfad/-typ, Inhaltstyp bei Anlage);
 * die Experten-Felder haben je Seite unter „Erweitert" ein eigenes Formular
 * (src/components/settings/library/advanced/**), „Inhalte erfassen" liegt
 * auf der Archive-Seite (capture-wizards-form.tsx). Submit schickt nur die
 * Config-Schluessel dieser Seite; der Server fuehrt die Config zusammen.
 *
 * Enthält:
 * - Form-Schema und defaultValues
 * - Bibliothek-CRUD-Callbacks (create, update, delete)
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { toast } from '@ks/ui'
import { useActiveLibraryId, useLibraries, useSetActiveLibraryId, useSetLibraries } from '@ks/shell/react'
import { StorageProviderType } from "@/types/library";
import type { ClientLibrary } from "@/types/library";
import { useSafeUser } from "@/hooks/use-safe-user";
import { detailViewTypeSchema } from "@/lib/detail-view-types/registry";

/** Im Settings-Formular waehlbare Storage-Typen ('inbox' ist intern, ADR-0004 II). */
const LIBRARY_FORM_STORAGE_TYPES = ["local", "onedrive", "gdrive", "nextcloud"] as const;

/** Mappt StorageProviderType auf den Form-Enum; 'inbox' ist kein User-Typ. */
function toLibraryFormStorageType(
  type: StorageProviderType,
): (typeof LIBRARY_FORM_STORAGE_TYPES)[number] {
  if (
    type !== "local" &&
    type !== "onedrive" &&
    type !== "gdrive" &&
    type !== "nextcloud"
  ) {
    throw new Error(`Ungueltiger Bibliothekstyp fuer Library-Settings: "${type}"`);
  }
  return type;
}

// Formular-Schema der Grundlagen-Seite
export const libraryFormSchema = z.object({
  label: z
    .string({ required_error: "Bitte geben Sie einen Namen ein." })
    .min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  path: z.string({ required_error: "Bitte geben Sie einen Speicherpfad ein." }),
  type: z.enum(LIBRARY_FORM_STORAGE_TYPES, {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  isEnabled: z.boolean().default(true),
  // Inhaltstyp bei der Erstellung (Onboarding "Name + Inhaltstyp = fertig",
  // Petra-Review Punkt 2). Wird nur bei isNew in config.chat.gallery gesendet.
  // Werteliste aus der zentralen Registry (Galerie-Audit, Befund 3c)
  detailViewType: detailViewTypeSchema.default("book"),
  storageConfig: z.object({
    basePath: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),
});

export type LibraryFormValues = z.infer<typeof libraryFormSchema>;

/**
 * Liest die Grundlagen einer Library in die Formularwerte. EINE Stelle fuer
 * alle reset-Sites (library-config-field.md Schritt 4). Ein maskiertes
 * clientSecret wird beim Abbruch der Anlage geleert, beim Befuellen behalten.
 */
function readLibraryForm(lib: ClientLibrary, maskedSecretAsEmpty: boolean): LibraryFormValues {
  const rawClientSecret = (lib.config?.clientSecret as string) ?? "";
  return {
    label: lib.label,
    path: lib.path,
    type: toLibraryFormStorageType(lib.type),
    isEnabled: lib.isEnabled,
    detailViewType: "book",
    storageConfig: {
      basePath: lib.path,
      clientId: (lib.config?.clientId as string) ?? "",
      clientSecret: maskedSecretAsEmpty && rawClientSecret === "********" ? "" : rawClientSecret,
      redirectUri: (lib.config?.redirectUri as string) ?? "",
    },
  };
}

/**
 * Haupt-Hook für das Library-Grundlagen-Formular.
 * Gibt Form-Objekt, Zustand und alle Handler zurück.
 */
export function useLibraryForm(createNew: boolean) {
  const { user } = useSafeUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const libraries = useLibraries();
  const setLibraries = useSetLibraries();
  const activeLibraryId = useActiveLibraryId();
  const setActiveLibraryId = useSetActiveLibraryId();

  // Aktuelle Library
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId);

  const defaultValues = useMemo<LibraryFormValues>(
    () => ({
      label: "",
      path: "",
      type: "local",
      isEnabled: true,
      detailViewType: "book",
      storageConfig: {
        basePath: "",
        clientId: "",
        clientSecret: "",
        redirectUri: "",
      },
    }),
    []
  );

  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  });

  /** Erstellt eine neue Bibliothek (leeres Formular) */
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    setActiveLibraryId("");
    form.reset(defaultValues);
  }, [form, defaultValues, setActiveLibraryId]);

  /** Bricht das Erstellen ab und kehrt zur aktiven Library zurück */
  const handleCancelNew = useCallback(() => {
    setIsNew(false);
    if (activeLibrary) {
      form.reset(readLibraryForm(activeLibrary, true));
    } else if (libraries.length > 0) {
      setActiveLibraryId(libraries[0].id);
    }
  }, [activeLibrary, libraries, form, setActiveLibraryId]);

  // Form mit aktiver Library befüllen
  useEffect(() => {
    if (activeLibrary && !isNew) {
      form.reset(readLibraryForm(activeLibrary, false));
    }
  }, [activeLibrary, isNew, form]);

  // createNew-Prop: neue Library-Erstellung starten
  useEffect(() => {
    if (createNew) {
      handleCreateNew();
    }
  }, [createNew, handleCreateNew]);

  /** Submit: Bibliothek speichern (neu erstellen oder aktualisieren) */
  const onSubmit = useCallback(
    async (data: LibraryFormValues) => {
      if (!user?.primaryEmailAddress?.emailAddress) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um eine Bibliothek zu speichern.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        let storageConfig = {};
        const existingConfig = activeLibrary?.config ?? {};

        switch (data.type) {
          case "local":
            storageConfig = { basePath: data.storageConfig.basePath };
            break;
          case "onedrive":
          case "gdrive": {
            const clientSecret = data.storageConfig.clientSecret;
            const shouldSendSecret =
              clientSecret && clientSecret !== "********" && clientSecret.trim() !== "";
            storageConfig = {
              clientId: data.storageConfig.clientId,
              ...(shouldSendSecret ? { clientSecret: clientSecret.trim() } : {}),
              redirectUri: data.storageConfig.redirectUri,
            };
            break;
          }
          case "nextcloud":
            if (existingConfig.nextcloud) {
              storageConfig = { nextcloud: existingConfig.nextcloud };
            }
            break;
        }

        const newLibraryId = isNew ? uuidv4() : activeLibraryId;

        // Nur die Schluessel dieser Seite; der Server fuehrt die Config auf
        // oberster Ebene zusammen (POST /api/libraries) und setzt fuer neue
        // Libraries die Shadow-Twin-Vorgabe (v2/Mongo).
        const libraryData = {
          id: newLibraryId,
          label: data.label,
          path: data.path,
          type: data.type as StorageProviderType,
          isEnabled: data.isEnabled,
          config: {
            // Onboarding: Inhaltstyp gehoert zur Erstellung; bei Updates
            // verwaltet ihn der Inhaltstyp-Assistent (config.chat bleibt
            // hier unangetastet, der Server merged config).
            ...(isNew
              ? { chat: { gallery: { detailViewType: data.detailViewType ?? "book" } } }
              : {}),
            ...storageConfig,
          },
        };

        const response = await fetch("/api/libraries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(libraryData),
        });

        if (!response.ok) {
          throw new Error(`Fehler beim Speichern: ${response.statusText}`);
        }

        if (isNew) {
          const newLibrary = {
            ...libraryData,
            // icon wird vom Client-Side als React-Element erwartet — wird von der Atom-Initalisierung gesetzt
            config: { ...libraryData.config },
          };
          setLibraries([...libraries, newLibrary as Parameters<typeof setLibraries>[0][0]]);
          setActiveLibraryId(newLibraryId);
          setIsNew(false);
          toast({
            title: "Bibliothek erstellt",
            description: `Die Bibliothek "${data.label}" wurde erfolgreich erstellt.`,
          });
          router.push("/settings/archive");
        } else {
          const updatedLibraries = libraries.map((lib) =>
            lib.id === libraryData.id
              ? { ...lib, ...libraryData, icon: lib.icon, config: { ...lib.config, ...libraryData.config } }
              : lib
          );
          setLibraries(updatedLibraries);
          toast({
            title: "Bibliothek aktualisiert",
            description: `Die Bibliothek "${data.label}" wurde erfolgreich aktualisiert.`,
          });
        }
      } catch (error) {
        console.error("[LibraryForm] Fehler beim Speichern der Bibliothek:", error);
        toast({
          title: "Fehler",
          description:
            error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [user, activeLibrary, activeLibraryId, isNew, libraries, setLibraries, setActiveLibraryId, router]
  );

  /** Bibliothek löschen */
  const handleDeleteLibrary = useCallback(async () => {
    if (!activeLibraryId || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek zum Löschen ausgewählt oder Benutzer nicht angemeldet.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/libraries?libraryId=${activeLibraryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Fehler beim Löschen: ${response.statusText}`);
      }

      const updatedLibraries = libraries.filter((lib) => lib.id !== activeLibraryId);
      setLibraries(updatedLibraries);

      if (updatedLibraries.length > 0) {
        setActiveLibraryId(updatedLibraries[0].id);
      } else {
        setActiveLibraryId("");
        setIsNew(true);
        form.reset(defaultValues);
      }

      toast({
        title: "Bibliothek gelöscht",
        description: "Die Bibliothek wurde erfolgreich gelöscht.",
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("[LibraryForm] Fehler beim Löschen der Bibliothek:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeLibraryId, user, libraries, setLibraries, setActiveLibraryId, form, defaultValues]);

  // Aggregierter Return-Wert
  return {
    // Form
    form,
    defaultValues,
    onSubmit,
    // State
    user,
    isLoading,
    isNew,
    setIsNew,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    libraries,
    activeLibraryId,
    setActiveLibraryId,
    activeLibrary,
    // Handlers
    handleCreateNew,
    handleCancelNew,
    handleDeleteLibrary,
  };
}
