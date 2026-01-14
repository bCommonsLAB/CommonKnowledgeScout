/**
 * @fileoverview Testimonial Service - Zentrale Service-Logik für Testimonials
 * 
 * @description
 * Zentrale Service-Klasse für alle Testimonial-Operationen:
 * - Erstellen von Testimonials
 * - Löschen von Testimonials
 * - Auflösen von Testimonials (für Events)
 * 
 * @module testimonials
 * 
 * @exports
 * - TestimonialService: Haupt-Service-Klasse
 */

import type { StorageProvider } from '@/lib/storage/types'
import { discoverTestimonials, type DiscoveredTestimonial } from './testimonial-discovery'
import type { CreateTestimonialOptions, CreateTestimonialResult, Testimonial } from './testimonial-types'
import crypto from 'crypto'

/**
 * Zentrale Service-Klasse für Testimonial-Operationen
 */
export class TestimonialService {
  constructor(
    private provider: StorageProvider,
    private eventFileId: string
  ) {}

  /**
   * Erstellt ein neues Testimonial
   */
  async create(options: CreateTestimonialOptions): Promise<CreateTestimonialResult> {
    const eventItem = await this.provider.getItemById(this.eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      throw new Error('Event-Datei nicht gefunden')
    }
    const eventFolderId = eventItem.parentId || 'root'

    // Stelle sicher, dass testimonials-Ordner existiert
    const testimonialsFolderId = await this.ensureTestimonialsFolder(eventFolderId)

    // Generiere eindeutige Testimonial-ID
    const testimonialId = crypto.randomUUID()
    const testimonialFolderId = await this.ensureTestimonialFolder(testimonialsFolderId, testimonialId)

    // Lade Audio hoch, falls vorhanden
    let audioFileId: string | null = null
    if (options.audioFile) {
      const ext = this.getFileExtensionFromName(options.audioFile.name) || 'webm'
      const audioName = `audio.${ext}`
      const uploaded = await this.provider.uploadFile(
        testimonialFolderId,
        new File([options.audioFile], audioName, { type: options.audioFile.type || 'audio/*' })
      )
      audioFileId = uploaded.id
    }

    // Erstelle meta.json
    const meta = {
      testimonialId,
      createdAt: new Date().toISOString(),
      eventFileId: this.eventFileId,
      speakerName: options.speakerName || null,
      consent: options.consent ?? null,
      text: options.text || null,
      audio: audioFileId
        ? {
            fileId: audioFileId,
            fileName: audioFileId ? `audio.${this.getFileExtensionFromName(options.audioFile?.name || '') || 'webm'}` : null,
            mimeType: options.audioFile?.type || null,
          }
        : null,
    }
    const metaFile = new File([JSON.stringify(meta, null, 2)], 'meta.json', { type: 'application/json' })
    await this.provider.uploadFile(testimonialFolderId, metaFile)

    return {
      testimonialId,
      folderId: testimonialFolderId,
      audioFileId,
    }
  }

  /**
   * Löscht ein Testimonial
   */
  async delete(testimonialId: string): Promise<void> {
    const eventItem = await this.provider.getItemById(this.eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      throw new Error('Event-Datei nicht gefunden')
    }
    const eventFolderId = eventItem.parentId || 'root'

    const testimonialsFolderId = await this.ensureTestimonialsFolder(eventFolderId)
    const children = await this.provider.listItemsById(testimonialsFolderId)
    
    const folder = children.find(
      (it) =>
        it.type === 'folder' &&
        (String(it.metadata?.name || '').trim() === testimonialId || it.id === testimonialId)
    )
    
    if (!folder) {
      throw new Error('Testimonial nicht gefunden')
    }

    await this.provider.deleteItem(folder.id)
  }

  /**
   * Findet alle Testimonials für das Event
   */
  async findAll(): Promise<Testimonial[]> {
    const discovered = await discoverTestimonials({
      provider: this.provider,
      eventFileId: this.eventFileId,
    })

    // Konvertiere DiscoveredTestimonial zu Testimonial
    // (Für vollständige Testimonial-Daten müssten wir meta.json nochmal lesen,
    // aber für die meisten Use Cases reicht DiscoveredTestimonial)
    return discovered.map((d): Testimonial => ({
      folderId: d.folderId,
      testimonialId: d.testimonialId,
      speakerName: d.speakerName,
      createdAt: d.createdAt,
      text: d.text,
      hasAudio: d.hasAudio,
      audioFileName: d.audioFileName,
      audioFileId: d.audioFileId,
      source: d.source,
      eventFileId: this.eventFileId,
      consent: null, // Wird aus meta.json gelesen, wenn benötigt
    }))
  }

  /**
   * Hilfsfunktion: Stelle sicher, dass testimonials-Ordner existiert
   */
  private async ensureTestimonialsFolder(eventFolderId: string): Promise<string> {
    const items = await this.provider.listItemsById(eventFolderId)
    const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === 'testimonials')
    if (existing?.id) return existing.id
    const created = await this.provider.createFolder(eventFolderId, 'testimonials')
    return created.id
  }

  /**
   * Hilfsfunktion: Stelle sicher, dass Testimonial-Ordner existiert
   */
  private async ensureTestimonialFolder(testimonialsFolderId: string, testimonialId: string): Promise<string> {
    const items = await this.provider.listItemsById(testimonialsFolderId)
    const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === testimonialId)
    if (existing?.id) return existing.id
    const created = await this.provider.createFolder(testimonialsFolderId, testimonialId)
    return created.id
  }

  /**
   * Hilfsfunktion: Extrahiere Dateiendung aus Dateinamen
   */
  private getFileExtensionFromName(name: string): string | null {
    const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
    return m?.[1] || null
  }
}
