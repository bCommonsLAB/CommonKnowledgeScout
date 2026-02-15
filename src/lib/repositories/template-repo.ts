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
   * Generiert eine Template-ID aus Library-ID und Name
   * Diese Kombination ist eindeutig pro Library
   */
  private static generateTemplateId(libraryId: string, name: string): string {
    return `${libraryId}:${name}`
  }

  /**
   * Stellt sicher, dass alle benötigten Indizes existieren
   */
  private static async ensureIndexes(collection: Collection<TemplateDocument>): Promise<void> {
    try {
      await Promise.all([
        // Unique Index: Template-Namen pro Library eindeutig
        // Dieser Index stellt sicher, dass name + libraryId zusammen eindeutig sind
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
   * @param templateId Template-ID (kann entweder kombinierte ID `${libraryId}:${name}` oder nur `name` sein)
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
    
    // Wenn templateId bereits die kombinierte Form hat (enthält ':'), verwende sie direkt
    // Sonst generiere die kombinierte ID aus libraryId und templateId (name)
    const actualId = templateId.includes(':') 
      ? templateId 
      : this.generateTemplateId(libraryId, templateId)
    
    // Debug-Logging für Template-Suche
    if (process.env.NODE_ENV === 'development') {
      console.debug('[TemplateRepository] findById:', {
        templateId,
        libraryId,
        actualId,
        admin,
      })
    }
    
    // Admin kann alle Templates sehen, normale User nur Templates ihrer Library
    const filter = admin 
      ? { _id: actualId }
      : { _id: actualId, libraryId }
    
    let result = await col.findOne(filter)
    
    // Fallback: Alte _id-Struktur (nur name, ohne libraryId-Prefix)
    // Templates die vor der libraryId-Migration erstellt wurden, haben _id = name
    if (!result && !templateId.includes(':')) {
      const oldFilter = admin
        ? { _id: templateId, libraryId }
        : { _id: templateId, libraryId }
      result = await col.findOne(oldFilter)
      if (result && process.env.NODE_ENV === 'development') {
        console.debug('[TemplateRepository] findById: Gefunden mit alter _id, Migration empfohlen')
      }
    }
    
    // Debug-Logging für Ergebnis
    if (process.env.NODE_ENV === 'development') {
      console.debug('[TemplateRepository] findById result:', {
        templateId,
        libraryId,
        actualId,
        found: !!result,
        resultId: result?._id,
        resultLibraryId: result?.libraryId,
        filter,
      })
      
      // Wenn nicht gefunden, suche nach libraryId allein, um zu sehen, welche Templates existieren
      if (!result) {
        const byLibraryId = await col.find({ libraryId }).toArray()
        console.debug('[TemplateRepository] findById - Templates mit dieser libraryId:', {
          count: byLibraryId.length,
          templates: byLibraryId.map(t => ({ _id: t._id, name: t.name, libraryId: t.libraryId }))
        })
      }
    }
    
    return result
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
    
    // Generiere eindeutige _id aus libraryId und name
    const templateId = this.generateTemplateId(template.libraryId, template.name)
    
    const document: TemplateDocument = {
      _id: templateId, // Kombiniere libraryId und name für eindeutige _id
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
   * @param templateId Template-ID (kann entweder kombinierte ID `${libraryId}:${name}` oder nur `name` sein)
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
    
    // Verwende die tatsächliche _id aus dem gefundenen Dokument
    const filter = admin 
      ? { _id: existing._id }
      : { _id: existing._id, libraryId }
    
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
   * @param templateId Template-ID (kann entweder kombinierte ID `${libraryId}:${name}` oder nur `name` sein)
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
    
    // Verwende die tatsächliche _id aus dem gefundenen Dokument
    const filter = admin 
      ? { _id: existing._id }
      : { _id: existing._id, libraryId }
    
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
    const templateId = this.generateTemplateId(libraryId, name)
    const result = await col.findOne({ _id: templateId })
    return result !== null
  }

  /**
   * Migriert ein Template von alter _id-Struktur (nur name) zu neuer Struktur (libraryId:name)
   * 
   * @param name Template-Name
   * @param libraryId Library-ID
   * @returns true wenn Migration erfolgreich war, false wenn Template nicht gefunden oder bereits migriert
   */
  static async migrateTemplateId(name: string, libraryId: string): Promise<boolean> {
    const col = await this.getCollection()
    
    // Prüfe, ob Template mit alter _id existiert
    const oldTemplate = await col.findOne({ _id: name, libraryId })
    if (!oldTemplate) {
      // Template existiert nicht oder wurde bereits migriert
      return false
    }
    
    // Prüfe, ob Template mit neuer _id bereits existiert
    const newId = this.generateTemplateId(libraryId, name)
    const newTemplate = await col.findOne({ _id: newId })
    if (newTemplate) {
      // Template wurde bereits migriert, lösche alte Version
      await col.deleteOne({ _id: name, libraryId })
      return true
    }
    
    // Erstelle neues Template mit korrekter _id
    const migratedTemplate: TemplateDocument = {
      ...oldTemplate,
      _id: newId,
      updatedAt: new Date(),
    }
    
    // Speichere neues Template und lösche altes
    await col.insertOne(migratedTemplate)
    await col.deleteOne({ _id: name, libraryId })
    
    return true
  }
}








