/**
 * @fileoverview Template Repository - MongoDB Repository for Templates
 * 
 * @description
 * Repository for managing templates in MongoDB. Handles CRUD operations for templates,
 * supports library-based filtering, and provides admin/user permission checks.
 * 
 * @module repositories
 * 
 * @exports
 * - TemplateRepository: Repository class for template operations
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { TemplateDocument } from '@/lib/templates/template-types'

const COLLECTION_NAME = 'templates'
let collectionCache: Collection<TemplateDocument> | null = null

/**
 * Template Repository
 * 
 * Verwaltet Templates in MongoDB mit Library-basierter Filterung und Berechtigungsprüfung.
 */
export class TemplateRepository {
  /**
   * Holt die MongoDB Collection für Templates
   */
  private static async getCollection(): Promise<Collection<TemplateDocument>> {
    if (collectionCache) {
      return collectionCache
    }
    const col = await getCollection<TemplateDocument>(COLLECTION_NAME)
    await this.ensureIndexes(col)
    collectionCache = col
    return col
  }

  /**
   * Stellt sicher, dass alle benötigten Indizes existieren
   */
  private static async ensureIndexes(collection: Collection<TemplateDocument>): Promise<void> {
    try {
      await Promise.all([
        // Unique Index: Template-Namen pro Library eindeutig
        collection.createIndex(
          { libraryId: 1, name: 1 },
          { unique: true, name: 'libraryId_name_unique' }
        ),
        // Index für Library-Filterung
        collection.createIndex(
          { libraryId: 1 },
          { name: 'libraryId' }
        ),
        // Index für User-Filterung
        collection.createIndex(
          { user: 1 },
          { name: 'user' }
        ),
        // Index für updatedAt (Sortierung)
        collection.createIndex(
          { updatedAt: -1 },
          { name: 'updatedAt_desc' }
        ),
      ])
    } catch (error) {
      // Index-Erstellung kann fehlschlagen, wenn Index bereits existiert - ignorieren
      console.debug('[TemplateRepository] Index-Erstellung:', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Prüft, ob ein Benutzer Admin ist
   * 
   * TODO: Implementiere Admin-Check basierend auf deiner Admin-Logik
   * Für jetzt: Gibt false zurück (alle User sind normale User)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static async isAdmin(_unused_userEmail: string): Promise<boolean> {
    // TODO: Implementiere Admin-Check
    // Beispiel: Prüfe gegen Admin-Liste oder Clerk Metadata
    return false
  }

  /**
   * Lädt alle Templates einer Library
   * 
   * @param libraryId Library-ID
   * @param userEmail User-Email für Berechtigungsprüfung
   * @param isAdmin Optional: Ob User Admin ist (wenn nicht gesetzt, wird automatisch geprüft)
   * @returns Array von Templates
   */
  static async findByLibraryId(
    libraryId: string,
    userEmail: string,
    isAdmin?: boolean
  ): Promise<TemplateDocument[]> {
    const col = await this.getCollection()
    const admin = isAdmin ?? await this.isAdmin(userEmail)
    
    // Admin sieht alle Templates, normale User nur Templates ihrer Library
    const filter = admin ? {} : { libraryId }
    
    return await col.find(filter).sort({ updatedAt: -1 }).toArray()
  }

  /**
   * Lädt ein einzelnes Template nach ID
   * 
   * @param templateId Template-ID
   * @param libraryId Library-ID für Berechtigungsprüfung
   * @param userEmail User-Email für Berechtigungsprüfung
   * @param isAdmin Optional: Ob User Admin ist
   * @returns Template oder null wenn nicht gefunden
   */
  static async findById(
    templateId: string,
    libraryId: string,
    userEmail: string,
    isAdmin?: boolean
  ): Promise<TemplateDocument | null> {
    const col = await this.getCollection()
    const admin = isAdmin ?? await this.isAdmin(userEmail)
    
    // Admin kann alle Templates sehen, normale User nur Templates ihrer Library
    const filter = admin 
      ? { _id: templateId }
      : { _id: templateId, libraryId }
    
    return await col.findOne(filter)
  }

  /**
   * Erstellt ein neues Template
   * 
   * @param template Template-Dokument (ohne _id, createdAt, updatedAt, version)
   * @returns Erstelltes Template
   */
  static async create(template: Omit<TemplateDocument, '_id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TemplateDocument> {
    const col = await this.getCollection()
    const now = new Date()
    
    const document: TemplateDocument = {
      _id: template.name, // Verwende name als _id
      ...template,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    
    await col.insertOne(document)
    return document
  }

  /**
   * Aktualisiert ein bestehendes Template
   * 
   * @param templateId Template-ID
   * @param libraryId Library-ID für Berechtigungsprüfung
   * @param updates Teilweise Updates (ohne _id, createdAt, version)
   * @param userEmail User-Email für Berechtigungsprüfung
   * @param isAdmin Optional: Ob User Admin ist
   * @returns Aktualisiertes Template oder null wenn nicht gefunden
   */
  static async update(
    templateId: string,
    libraryId: string,
    updates: Partial<Omit<TemplateDocument, '_id' | 'createdAt' | 'version'>>,
    userEmail: string,
    isAdmin?: boolean
  ): Promise<TemplateDocument | null> {
    const col = await this.getCollection()
    const admin = isAdmin ?? await this.isAdmin(userEmail)
    
    // Prüfe Berechtigung
    const existing = await this.findById(templateId, libraryId, userEmail, admin)
    if (!existing) {
      return null
    }
    
    const updateDoc = {
      ...updates,
      updatedAt: new Date(),
    }
    
    const filter = admin 
      ? { _id: templateId }
      : { _id: templateId, libraryId }
    
    const result = await col.findOneAndUpdate(
      filter,
      { $set: updateDoc },
      { returnDocument: 'after' }
    )
    
    return result || null
  }

  /**
   * Löscht ein Template
   * 
   * @param templateId Template-ID
   * @param libraryId Library-ID für Berechtigungsprüfung
   * @param userEmail User-Email für Berechtigungsprüfung
   * @param isAdmin Optional: Ob User Admin ist
   * @returns true wenn gelöscht, false wenn nicht gefunden oder keine Berechtigung
   */
  static async delete(
    templateId: string,
    libraryId: string,
    userEmail: string,
    isAdmin?: boolean
  ): Promise<boolean> {
    const col = await this.getCollection()
    const admin = isAdmin ?? await this.isAdmin(userEmail)
    
    // Prüfe Berechtigung
    const existing = await this.findById(templateId, libraryId, userEmail, admin)
    if (!existing) {
      return false
    }
    
    const filter = admin 
      ? { _id: templateId }
      : { _id: templateId, libraryId }
    
    const result = await col.deleteOne(filter)
    return result.deletedCount > 0
  }

  /**
   * Prüft, ob ein Template mit gegebenem Namen in einer Library existiert
   * 
   * @param name Template-Name
   * @param libraryId Library-ID
   * @returns true wenn existiert
   */
  static async exists(name: string, libraryId: string): Promise<boolean> {
    const col = await this.getCollection()
    const result = await col.findOne({ _id: name, libraryId })
    return result !== null
  }
}








