/**
 * Gemeinsame Typen für Storage-Typ-Komponenten
 */
import { z } from "zod"

// Basis-Schema für alle Storage-Typen
export const baseStorageSchema = z.object({
  type: z.enum(["local", "onedrive", "gdrive", "webdav"]),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
})

// OneDrive-spezifisches Schema
export const onedriveStorageSchema = baseStorageSchema.extend({
  type: z.literal("onedrive"),
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
})

// WebDAV-spezifisches Schema
export const webdavStorageSchema = baseStorageSchema.extend({
  type: z.literal("webdav"),
  url: z.string().min(1, "WebDAV URL ist erforderlich"),
  username: z.string().min(1, "Benutzername ist erforderlich"),
  password: z.string().min(1, "Passwort ist erforderlich"),
  basePath: z.string().optional(),
})

// Google Drive-spezifisches Schema
export const gdriveStorageSchema = baseStorageSchema.extend({
  type: z.literal("gdrive"),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
})

// Local-spezifisches Schema
export const localStorageSchema = baseStorageSchema.extend({
  type: z.literal("local"),
})

// Union-Typ für alle Storage-Schemas
export type StorageFormData = 
  | z.infer<typeof onedriveStorageSchema>
  | z.infer<typeof webdavStorageSchema>
  | z.infer<typeof gdriveStorageSchema>
  | z.infer<typeof localStorageSchema>

// Gemeinsame Props für alle Storage-Form-Komponenten
export interface StorageFormProps {
  defaultValues?: Partial<StorageFormData>
  onSubmit: (data: StorageFormData) => Promise<void>
  onTest?: () => Promise<void>
  isLoading?: boolean
  isTestLoading?: boolean
}

// Token-Status für OAuth-Provider
export interface TokenStatus {
  isAuthenticated: boolean
  isExpired: boolean
  loading: boolean
}