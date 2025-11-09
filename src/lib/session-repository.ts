/**
 * @fileoverview Session Repository - MongoDB Repository for Session Management
 * 
 * @description
 * Repository for managing event sessions in MongoDB. Handles CRUD operations for sessions,
 * filtering by event, track, day, language, and search queries. Supports pagination and
 * bulk operations for session import.
 * 
 * @module event-job
 * 
 * @exports
 * - SessionRepository: Main repository class for session management
 * 
 * @usedIn
 * - src/app/api/event-job: Event job API routes use repository
 * - src/components/event-monitor: Event monitor components use repository
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/types/session: Session type definitions
 * - mongodb: MongoDB driver types
 * - uuid: UUID generation
 */

import { Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionFilterOptions } from '@/types/session';
import { getCollection } from './mongodb-service';

/**
 * Repository für Session-Verwaltung
 */
export class SessionRepository {
  private collectionName = 'event_sessions';
  
  /**
   * Hilfsmethode: Holt die Session-Collection
   */
  private async getSessionCollection(): Promise<Collection<Session>> {
    return getCollection<Session>(this.collectionName);
  }
  
  /**
   * Erstellt eine neue Session
   */
  async createSession(sessionData: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const sessionCollection = await this.getSessionCollection();
      
      const now = new Date();
      const id = `session-${uuidv4()}`;
      
      const session: Session = {
        ...sessionData,
        id,
        created_at: now,
        updated_at: now
      };
      
      await sessionCollection.insertOne(session);
      
      return id;
    } catch (error) {
      console.error('Fehler beim Erstellen der Session:', error);
      throw error;
    }
  }
  
  /**
   * Erstellt mehrere Sessions
   */
  async createSessions(sessionsData: Omit<Session, 'id' | 'created_at' | 'updated_at'>[]): Promise<string[]> {
    try {
      const sessionCollection = await this.getSessionCollection();
      
      const now = new Date();
      const sessions: Session[] = sessionsData.map(sessionData => ({
        ...sessionData,
        id: `session-${uuidv4()}`,
        created_at: now,
        updated_at: now
      }));
      
      await sessionCollection.insertMany(sessions);
      
      return sessions.map(s => s.id!);
    } catch (error) {
      console.error('Fehler beim Erstellen der Sessions:', error);
      throw error;
    }
  }
  
  /**
   * Holt eine Session anhand ihrer ID
   */
  async getSession(id: string): Promise<Session | null> {
    try {
      const sessionCollection = await this.getSessionCollection();
      return await sessionCollection.findOne({ id });
    } catch (error) {
      console.error('Fehler beim Abrufen der Session:', error);
      throw error;
    }
  }
  
  /**
   * Holt Sessions mit Filterung und Paginierung
   */
  async getSessions(options: SessionFilterOptions & { 
    limit?: number; 
    skip?: number; 
  } = {}): Promise<Session[]> {
    try {
      const sessionCollection = await this.getSessionCollection();
      
      const { 
        event, 
        track, 
        day, 
        source_language, 
        search,
        limit, 
        skip = 0 
      } = options;
      
      const query: Record<string, unknown> = {};
      
      if (event) {
        query.event = event;
      }
      
      if (track) {
        query.track = track;
      }
      
      if (day) {
        query.day = day;
      }
      
      if (source_language) {
        query.source_language = source_language;
      }
      
      if (search) {
        query.$or = [
          { session: { $regex: search, $options: 'i' } },
          { subtitle: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { filename: { $regex: search, $options: 'i' } },
          { url: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Query builder mit optionalem Limit
      let queryBuilder = sessionCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip);
      
      // Nur Limit anwenden, wenn explizit gesetzt
      if (limit !== undefined) {
        queryBuilder = queryBuilder.limit(limit);
      }
      
      return await queryBuilder.toArray();
    } catch (error) {
      console.error('Fehler beim Abrufen der Sessions:', error);
      throw error;
    }
  }
  
  /**
   * Zählt Sessions mit Filterung
   */
  async countSessions(options: SessionFilterOptions = {}): Promise<number> {
    try {
      const sessionCollection = await this.getSessionCollection();
      
      const { event, track, day, source_language, search } = options;
      
      const query: Record<string, unknown> = {};
      
      if (event) {
        query.event = event;
      }
      
      if (track) {
        query.track = track;
      }
      
      if (day) {
        query.day = day;
      }
      
      if (source_language) {
        query.source_language = source_language;
      }
      
      if (search) {
        query.$or = [
          { session: { $regex: search, $options: 'i' } },
          { subtitle: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { filename: { $regex: search, $options: 'i' } },
          { url: { $regex: search, $options: 'i' } }
        ];
      }
      
      return await sessionCollection.countDocuments(query);
    } catch (error) {
      console.error('Fehler beim Zählen der Sessions:', error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert eine Session
   */
  async updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      const sessionCollection = await this.getSessionCollection();
      
      const result = await sessionCollection.updateOne(
        { id },
        { 
          $set: {
            ...updates,
            updated_at: new Date()
          }
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Session:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert eine Session über eindeutige Schlüssel (event + session + url + filename)
   */
  async updateSessionByKeys(
    keys: Pick<Session, 'event' | 'session' | 'url' | 'filename'>,
    updates: Partial<Omit<Session, 'id' | 'created_at'>>
  ): Promise<boolean> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const result = await sessionCollection.updateOne(
        { event: keys.event, session: keys.session, url: keys.url, filename: keys.filename },
        { $set: { ...updates, updated_at: new Date() } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Session (by keys):', error);
      throw error;
    }
  }
  
  /**
   * Löscht eine Session
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const result = await sessionCollection.deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Fehler beim Löschen der Session:', error);
      throw error;
    }
  }
  
  /**
   * Löscht mehrere Sessions
   */
  async deleteSessions(ids: string[]): Promise<number> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const result = await sessionCollection.deleteMany({ id: { $in: ids } });
      return result.deletedCount;
    } catch (error) {
      console.error('Fehler beim Löschen der Sessions:', error);
      throw error;
    }
  }
  
  /**
   * Holt alle verfügbaren Events
   */
  async getAvailableEvents(): Promise<string[]> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const events = await sessionCollection.distinct('event');
      return events.filter(event => event != null).sort();
    } catch (error) {
      console.error('Fehler beim Abrufen der Events:', error);
      throw error;
    }
  }
  
  /**
   * Holt alle verfügbaren Tracks für ein Event
   */
  async getAvailableTracks(event?: string): Promise<string[]> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const query = event ? { event } : {};
      const tracks = await sessionCollection.distinct('track', query);
      return tracks.filter(track => track != null).sort();
    } catch (error) {
      console.error('Fehler beim Abrufen der Tracks:', error);
      throw error;
    }
  }
  
  /**
   * Holt alle verfügbaren Tage für ein Event
   */
  async getAvailableDays(event?: string): Promise<string[]> {
    try {
      const sessionCollection = await this.getSessionCollection();
      const query = event ? { event } : {};
      const days = await sessionCollection.distinct('day', query);
      return days.filter(day => day != null).sort();
    } catch (error) {
      console.error('Fehler beim Abrufen der Tage:', error);
      throw error;
    }
  }
} 