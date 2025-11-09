/**
 * @fileoverview Event Job Repository - MongoDB Repository for Event Job Management
 * 
 * @description
 * Repository for managing event jobs and batches in MongoDB. Handles CRUD operations
 * for event jobs, batch management, job status updates, progress tracking, and access
 * control. Provides optimized queries with filtering, pagination, and sorting.
 * 
 * @module event-job
 * 
 * @exports
 * - EventJobRepository: Main repository class for event jobs and batches
 * 
 * @usedIn
 * - src/app/api/event-job: Event job API routes use repository
 * - src/lib/session/session-processor.ts: Session processor uses repository
 * - src/components/event-monitor: Event monitor components use repository
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/types/event-job: Event job type definitions
 * - mongodb: MongoDB driver types
 * - uuid: UUID generation
 */

import { Collection, UpdateFilter } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  Batch, 
  Job, 
  JobStatus, 
  AccessVisibility, 
  JobProgress, 
  JobError, 
  JobResults,
  AccessControl,
  BatchStatus
} from '@/types/event-job';
import { getCollection } from './mongodb-service';

/**
 * Hilfs-Interface für dynamische $set-Updates
 */
interface JobSetUpdate {
  status: JobStatus;
  updated_at: Date;
  'parameters.target_language'?: string;
  [key: string]: unknown;
}

/**
 * Repository für Event-Jobs und Batches
 */
export class EventJobRepository {
  private jobCollectionName = 'event_jobs';
  private batchCollectionName = 'event_batches';
  
  /**
   * Hilfsmethode: Holt die Job-Collection
   */
  private async getJobCollection(): Promise<Collection<Job>> {
    return getCollection<Job>(this.jobCollectionName);
  }
  
  /**
   * Hilfsmethode: Holt die Batch-Collection
   */
  private async getBatchCollection(): Promise<Collection<Batch>> {
    return getCollection<Batch>(this.batchCollectionName);
  }
  
  /**
   * Erstellt einen neuen Job
   */
  async createJob(jobData: Omit<Job, 'job_id' | 'created_at' | 'updated_at' | 'status'>): Promise<string> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      const job_id = `job-${uuidv4()}`;
      
      // Standardwerte setzen, falls nicht vorhanden
      const job: Job = {
        ...jobData,
        job_id,
        status: JobStatus.PENDING,
        created_at: now,
        updated_at: now,
        archived: false,
        access_control: jobData.access_control || this.createDefaultAccessControl(jobData.user_id)
      };
      
      // Job-Name automatisch generieren, falls nicht angegeben
      if (!job.job_name) {
        const parts: string[] = [];
        if (job.parameters.event) parts.push(job.parameters.event);
        if (job.parameters.track) parts.push(job.parameters.track);
        if (job.parameters.session) parts.push(job.parameters.session);
        
        if (parts.length > 0) {
          job.job_name = parts.join(' - ');
        }
      }
      
      await jobCollection.insertOne(job);
      
      return job_id;
    } catch (error) {
      console.error('Fehler beim Erstellen des Jobs:', error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert den Status eines Jobs
   */
  async updateJobStatus(
    jobId: string, 
    status: JobStatus, 
    progress?: JobProgress, 
    results?: JobResults, 
    error?: JobError
  ): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      const updateData: Partial<Job> = {
        status,
        updated_at: now
      };
      
      if (status === JobStatus.PROCESSING) {
        updateData.processing_started_at = now;
      }
      
      if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
        updateData.completed_at = now;
      }
      
      if (progress) {
        updateData.progress = progress;
      }
      
      if (results) {
        updateData.results = results;
      }
      
      if (error) {
        updateData.error = error;
      }
      
      const result = await jobCollection.updateOne(
        { job_id: jobId },
        { $set: updateData }
      );
      
      const success = result.modifiedCount > 0;
      
      if (success) {
        // Wenn der Job Teil eines Batches ist, aktualisiere auch den Batch-Fortschritt
        const job = await this.getJob(jobId);
        if (job && job.batch_id) {
          await this.updateBatchProgress(job.batch_id);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Job-Status:', error);
      throw error;
    }
  }
  
  /**
   * Fügt einen Log-Eintrag zu einem Job hinzu
   */
  async addLogEntry(jobId: string, level: 'debug' | 'info' | 'warning' | 'error' | 'critical', message: string): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      const logEntry = {
        timestamp: now,
        level,
        message
      };
      
      const result = await jobCollection.updateOne(
        { job_id: jobId },
        { 
          $push: { logs: logEntry },
          $set: { updated_at: now }
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Log-Eintrags:', error);
      throw error;
    }
  }
  
  /**
   * Holt einen Job anhand seiner ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const jobCollection = await this.getJobCollection();
      return await jobCollection.findOne({ job_id: jobId });
    } catch (error) {
      console.error('Fehler beim Abrufen des Jobs:', error);
      throw error;
    }
  }
  
  /**
   * Löscht einen Job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      const result = await jobCollection.deleteOne({ job_id: jobId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Fehler beim Löschen des Jobs:', error);
      throw error;
    }
  }
  
  /**
   * Erstellt einen neuen Batch
   */
  async createBatch(batchData: Omit<Batch, 'batch_id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      const now = new Date();
      const batch_id = `batch-${uuidv4()}`;
      
      const batch: Batch = {
        ...batchData,
        batch_id,
        created_at: now,
        updated_at: now,
        status: BatchStatus.PENDING,
        completed_jobs: 0,
        failed_jobs: 0,
        pending_jobs: batchData.total_jobs,
        processing_jobs: 0,
        archived: false,
        access_control: batchData.access_control || this.createDefaultAccessControl(batchData.user_id)
      };
      
      await batchCollection.insertOne(batch);
      
      return batch_id;
    } catch (error) {
      console.error('Fehler beim Erstellen des Batches:', error);
      throw error;
    }
  }
  
  /**
   * Holt einen Batch anhand seiner ID
   */
  async getBatch(batchId: string): Promise<Batch | null> {
    try {
      const batchCollection = await this.getBatchCollection();
      return await batchCollection.findOne({ batch_id: batchId });
    } catch (error) {
      console.error('Fehler beim Abrufen des Batches:', error);
      throw error;
    }
  }
  
  /**
   * Holt mehrere Batches mit Paginierung
   */
  async getBatches(options: { 
    archived?: boolean; 
    status?: BatchStatus; 
    limit?: number; 
    skip?: number;
    isActive?: boolean;
    eventName?: string; // 🆕 Event-Filter
  } = {}): Promise<Batch[]> {
    try {
      const { eventName, ...otherOptions } = options;
      
      // Falls Event-Filter gesetzt, nutze spezifische Methode
      if (eventName) {
        return this.getBatchesByEvent(eventName, otherOptions);
      }
      
      // Ansonsten normale getBatches Logik
      const batchCollection = await this.getBatchCollection();
      
      const { 
        archived, 
        status, 
        limit = 100, 
        skip = 0,
        isActive
      } = otherOptions;
      
      const query: Record<string, unknown> = {};
      
      if (archived !== undefined) {
        query.archived = archived;
      }
      
      if (status !== undefined) {
        query.status = status;
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive;
      }
      
      return await batchCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Fehler beim Abrufen der Batches:', error);
      throw error;
    }
  }
  
  /**
   * Zählt die Anzahl der Batches
   */
  async countBatches(options: { 
    archived?: boolean; 
    status?: BatchStatus;
    isActive?: boolean;
  } = {}): Promise<number> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      const { archived, status, isActive } = options;
      
      const query: Record<string, unknown> = {};
      
      if (archived !== undefined) {
        query.archived = archived;
      }
      
      if (status !== undefined) {
        query.status = status;
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive;
      }
      
      return await batchCollection.countDocuments(query);
    } catch (error) {
      console.error('Fehler beim Zählen der Batches:', error);
      throw error;
    }
  }
  
  /**
   * Löscht einen Batch und alle zugehörigen Jobs
   */
  async deleteBatch(batchId: string): Promise<boolean> {
    try {
      const batchCollection = await this.getBatchCollection();
      const jobCollection = await this.getJobCollection();
      
      // Alle Jobs des Batches löschen
      await jobCollection.deleteMany({ batch_id: batchId });
      
      // Batch selbst löschen
      const result = await batchCollection.deleteOne({ batch_id: batchId });
      
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Fehler beim Löschen des Batches:', error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert den Fortschritt eines Batches basierend auf den zugehörigen Jobs
   */
  async updateBatchProgress(batchId: string): Promise<boolean> {
    try {
      const batchCollection = await this.getBatchCollection();
      const jobCollection = await this.getJobCollection();
      
      // Batch abrufen
      const batch = await this.getBatch(batchId);
      if (!batch) return false;
      
      // Jobs nach Status zählen
      const completedJobs = await jobCollection.countDocuments({
        batch_id: batchId,
        status: JobStatus.COMPLETED
      });
      
      const failedJobs = await jobCollection.countDocuments({
        batch_id: batchId,
        status: JobStatus.FAILED
      });
      
      const pendingJobs = await jobCollection.countDocuments({
        batch_id: batchId,
        status: JobStatus.PENDING
      });
      
      const processingJobs = await jobCollection.countDocuments({
        batch_id: batchId,
        status: JobStatus.PROCESSING
      });
      
      // Status bestimmen
      let status = BatchStatus.RUNNING;
      const now = new Date();
      const updateData: Partial<Batch> = {
        completed_jobs: completedJobs,
        failed_jobs: failedJobs,
        pending_jobs: pendingJobs,
        processing_jobs: processingJobs,
        updated_at: now
      };
      
      // Wenn alle Jobs abgeschlossen oder fehlgeschlagen sind, ist der Batch abgeschlossen
      if (completedJobs + failedJobs >= batch.total_jobs) {
        status = failedJobs > 0 ? BatchStatus.FAILED : BatchStatus.COMPLETED;
        updateData.status = status;
        updateData.completed_at = now;
      }
      
      // Batch aktualisieren
      const result = await batchCollection.updateOne(
        { batch_id: batchId },
        { $set: updateData }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Batch-Fortschritts:', error);
      throw error;
    }
  }
  
  /**
   * Archiviert einen Batch
   */
  async archiveBatch(batchId: string): Promise<boolean> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      const result = await batchCollection.updateOne(
        { batch_id: batchId },
        { 
          $set: { 
            archived: true,
            updated_at: new Date()
          } 
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Archivieren des Batches:', error);
      throw error;
    }
  }
  
  /**
   * Schaltet den isActive-Status eines Batches um
   */
  async toggleBatchActive(batchId: string): Promise<boolean> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      // Aktuellen Batch laden
      const batch = await this.getBatch(batchId);
      if (!batch) return false;
      
      // isActive-Status umkehren
      const result = await batchCollection.updateOne(
        { batch_id: batchId },
        { 
          $set: { 
            isActive: !batch.isActive,
            updated_at: new Date()
          } 
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Umschalten des Batch-Status:', error);
      throw error;
    }
  }
  
  /**
   * Holt alle verfügbaren Event-Namen aus der Datenbank
   */
  async getAvailableEvents(): Promise<string[]> {
    try {
      const jobCollection = await this.getJobCollection();
      
      // Erst versuchen aus event_name Feld (für neue Struktur)
      const eventsFromField = await jobCollection.distinct('event_name', {
        event_name: { $exists: true, $ne: "" }
      }) as string[];
      
      // Falls keine event_name Felder vorhanden, aus parameters.event extrahieren
      if (eventsFromField.length === 0) {
        const eventsFromParams = await jobCollection.distinct('parameters.event', {
          'parameters.event': { $exists: true, $ne: "" }
        }) as string[];
        return eventsFromParams.filter(event => event != null).sort();
      }
      
      return eventsFromField.filter(event => event != null).sort();
    } catch (error) {
      console.error('Fehler beim Abrufen der verfügbaren Events:', error);
      throw error;
    }
  }

  /**
   * Holt Batches gefiltert nach Event
   */
  async getBatchesByEvent(
    eventName: string,
    options: { 
      archived?: boolean; 
      status?: BatchStatus; 
      limit?: number; 
      skip?: number;
      isActive?: boolean;
    } = {}
  ): Promise<Batch[]> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      const { 
        archived, 
        status, 
        limit = 100, 
        skip = 0,
        isActive
      } = options;
      
      // Query mit event_name oder fallback auf batch_name Pattern
      const baseQuery: Record<string, unknown> = {
        $or: [
          { event_name: eventName },
          { batch_name: { $regex: `^${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -` } }
        ]
      };
      
      const query: Record<string, unknown> = { ...baseQuery };
      
      if (archived !== undefined) {
        query.archived = archived;
      }
      
      if (status !== undefined) {
        query.status = status;
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive;
      }
      
      return await batchCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Fehler beim Abrufen der Batches für Event:', error);
      throw error;
    }
  }

  /**
   * Migriert bestehende Jobs/Batches um event_name Feld hinzuzufügen
   */
  async migrateEventNames(): Promise<{ jobsUpdated: number, batchesUpdated: number }> {
    try {
      const jobCollection = await this.getJobCollection();
      const batchCollection = await this.getBatchCollection();
      
      // Jobs migrieren: event_name aus parameters.event extrahieren
      const jobResult = await jobCollection.updateMany(
        { 
          event_name: { $exists: false },
          'parameters.event': { $exists: true, $ne: "" }
        },
        [
          {
            $set: {
              event_name: "$parameters.event",
              updated_at: new Date()
            }
          }
        ]
      );
      
      // Batches migrieren: event_name aus dem ersten Job des Batches ableiten
      const batches = await batchCollection.find({ 
        event_name: { $exists: false } 
      }).toArray();
      
      let batchesUpdated = 0;
      
      for (const batch of batches) {
        // Finde ersten Job des Batches um event_name zu ermitteln
        const firstJob = await jobCollection.findOne(
          { 
            batch_id: batch.batch_id,
            'parameters.event': { $exists: true, $ne: "" }
          }
        );
        
        if (firstJob && firstJob.parameters.event) {
          await batchCollection.updateOne(
            { batch_id: batch.batch_id },
            { 
              $set: { 
                event_name: firstJob.parameters.event,
                updated_at: new Date()
              } 
            }
          );
          batchesUpdated++;
        }
      }
      
      return {
        jobsUpdated: jobResult.modifiedCount,
        batchesUpdated
      };
    } catch (error) {
      console.error('Fehler bei der Migration der Event-Namen:', error);
      throw error;
    }
  }

  /**
   * Setzt alle Batches auf Failed (mit Event-Filter)
   */
  async failAllBatches(eventName?: string): Promise<{ batchesUpdated: number, jobsUpdated: number }> {
    try {
      const batchCollection = await this.getBatchCollection();
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      
      // Query für Batch-Filter
      let batchQuery: Record<string, unknown> = { archived: false };
      let jobQuery: Record<string, unknown> = { archived: false };
      
      if (eventName) {
        batchQuery = {
          archived: false,
          $or: [
            { event_name: eventName },
            { batch_name: { $regex: `^${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -` } }
          ]
        };
        jobQuery = {
          archived: false,
          $or: [
            { event_name: eventName },
            { 'parameters.event': eventName }
          ]
        };
      }
      
      // Batches auf Failed setzen
      const batchResult = await batchCollection.updateMany(
        batchQuery,
        { 
          $set: { 
            status: BatchStatus.FAILED,
            updated_at: now,
            completed_at: now
          } 
        }
      );
      
      // Jobs auf Failed setzen
      const jobResult = await jobCollection.updateMany(
        jobQuery,
        { 
          $set: { 
            status: JobStatus.FAILED,
            updated_at: now,
            completed_at: now,
            error: {
              code: 'FORCED_FAILURE',
              message: 'Job wurde manuell auf failed gesetzt',
              details: {
                forced_at: now.toISOString(),
                reason: 'Manuelle Massenaktualisierung',
                eventFilter: eventName || 'Alle Events'
              }
            }
          } 
        }
      );
      
      return {
        batchesUpdated: batchResult.modifiedCount,
        jobsUpdated: jobResult.modifiedCount
      };
    } catch (error) {
      console.error('Fehler beim Setzen aller Batches auf Failed:', error);
      throw error;
    }
  }
  
  /**
   * Setzt alle nicht archivierten Batches und deren Jobs auf Pending (mit Event-Filter)
   * @param targetLanguage Optionale Zielsprache, die für alle Jobs gesetzt werden soll
   * @param eventName Optionaler Event-Filter
   */
  async pendingAllBatches(targetLanguage?: string, eventName?: string): Promise<{ batchesUpdated: number, jobsUpdated: number }> {
    try {
      const batchCollection = await this.getBatchCollection();
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      
      // Query für Batch-Filter
      const batchQuery: Record<string, unknown> = { archived: false };
      const jobQuery: Record<string, unknown> = { archived: false };
      
      if (eventName) {
        batchQuery.$or = [
          { event_name: eventName },
          { batch_name: { $regex: `^${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -` } }
        ];
        jobQuery.$or = [
          { event_name: eventName },
          { 'parameters.event': eventName }
        ];
      }
      
      // Batches auf Pending setzen
      const batchResult = await batchCollection.updateMany(
        batchQuery,
        { 
          $set: { 
            status: BatchStatus.PENDING,
            updated_at: now,
            completed_at: undefined,
            // Jobs-Zähler zurücksetzen, wird bei nächster Aktualisierung neu berechnet
            pending_jobs: -1,  // Temporärer Wert, wird durch updateBatchProgress aktualisiert
            failed_jobs: 0,
            completed_jobs: 0,
            processing_jobs: 0
          } 
        }
      );
      
      // Update-Operation für Jobs vorbereiten
      const setUpdate: JobSetUpdate = {
        status: JobStatus.PENDING,
        updated_at: now
      };
      if (targetLanguage) {
        setUpdate['parameters.target_language'] = targetLanguage;
      }
      const updateOperation: UpdateFilter<Job> = {
        $set: setUpdate,
        $unset: {
          processing_started_at: "",
          completed_at: "",
          error: "",
          progress: "",
          results: ""
        }
      };
      
      // Jobs auf Pending setzen
      const jobResult = await jobCollection.updateMany(
        jobQuery,
        updateOperation
      );
      
      // Batch-Fortschritte aktualisieren
      if (batchResult.modifiedCount > 0) {
        const batches = await batchCollection.find(batchQuery).toArray();
          
        for (const batch of batches) {
          await this.updateBatchProgress(batch.batch_id);
        }
      }
      
      return {
        batchesUpdated: batchResult.modifiedCount,
        jobsUpdated: jobResult.modifiedCount
      };
    } catch (error) {
      console.error('Fehler beim Setzen aller Batches auf Pending:', error);
      throw error;
    }
  }
  
  /**
   * Holt Batches für einen bestimmten Benutzer
   */
  async getBatchesForUser(
    userId: string, 
    options: { 
      status?: BatchStatus; 
      archived?: boolean; 
      limit?: number; 
      skip?: number;
    } = {}
  ): Promise<Batch[]> {
    try {
      const batchCollection = await this.getBatchCollection();
      
      const { status, archived, limit = 100, skip = 0 } = options;
      
      const query: Record<string, unknown> = {
        $or: [
          { user_id: userId },
          { 'access_control.read_access': userId },
          { 'access_control.visibility': AccessVisibility.PUBLIC }
        ]
      };
      
      if (status !== undefined) {
        query.status = status;
      }
      
      if (archived !== undefined) {
        query.archived = archived;
      }
      
      return await batchCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Fehler beim Abrufen der Batches für Benutzer:', error);
      throw error;
    }
  }
  
  /**
   * Holt Jobs für einen Batch mit Paginierung
   */
  async getJobsForBatch(
    batchId: string, 
    options: { 
      limit?: number; 
      skip?: number;
      status?: JobStatus;
    } = {}
  ): Promise<Job[]> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const { limit = 2000, skip = 0, status } = options;
      
      const query: Record<string, unknown> = { batch_id: batchId };
      
      if (status !== undefined) {
        query.status = status;
      }
      
      // Projektion verwenden, um nur die benötigten Felder zu laden
      const projection = {
        job_id: 1,
        status: 1,
        job_name: 1,
        created_at: 1,
        updated_at: 1,
        completed_at: 1,
        processing_started_at: 1,
        progress: 1,
        error: 1,
        batch_id: 1,
        user_id: 1,
        parameters: 1,
        results: 1,
        _id: 0
      };
      
      return await jobCollection
        .find(query, { projection })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Fehler beim Abrufen der Jobs für Batch:', error);
      throw error;
    }
  }
  
  /**
   * Erstellt eine Standard-Zugriffssteuerung für einen Benutzer
   */
  private createDefaultAccessControl(userId?: string): AccessControl {
    if (!userId) {
      return {
        visibility: AccessVisibility.PRIVATE,
        read_access: [],
        write_access: [],
        admin_access: []
      };
    }
    
    return {
      visibility: AccessVisibility.PRIVATE,
      read_access: [userId],
      write_access: [userId],
      admin_access: [userId]
    };
  }
  
  /**
   * Setzt alle Jobs eines Batches auf PENDING zurück und aktualisiert optional parameters.use_cache
   */
  async restartBatchWithOptions(batchId: string, useCache?: boolean): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      const batchCollection = await this.getBatchCollection();
      const batch = await this.getBatch(batchId);
      if (!batch) return false;
      const now = new Date();

      // Alle Jobs des Batches abrufen
      const jobs = await jobCollection.find({ batch_id: batchId }).toArray();
      let modifiedCount = 0;
      for (const job of jobs) {
        const parameters = { ...job.parameters };
        if (useCache !== undefined) {
          parameters.use_cache = useCache;
        }
        const updateResult = await jobCollection.updateOne(
          { job_id: job.job_id },
          {
            $set: {
              status: JobStatus.PENDING,
              updated_at: now,
              processing_started_at: undefined,
              completed_at: undefined,
              error: undefined,
              progress: undefined,
              parameters,
            },
            $unset: { results: "" }
          }
        );
        if (updateResult.modifiedCount > 0) modifiedCount++;
      }
      // Batch-Status aktualisieren
      if (modifiedCount > 0) {
        await batchCollection.updateOne(
          { batch_id: batchId },
          {
            $set: {
              status: BatchStatus.PENDING,
              updated_at: now,
              completed_jobs: 0,
              failed_jobs: 0,
              pending_jobs: batch.total_jobs || 0,
              processing_jobs: 0
            }
          }
        );
      }
      return modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Neustarten des Batches (mit Optionen):', error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert die Zielsprache eines Jobs
   */
  async updateJobLanguage(jobId: string, targetLanguage: string): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      const result = await jobCollection.updateOne(
        { job_id: jobId },
        { 
          $set: { 
            'parameters.target_language': targetLanguage,
            updated_at: now
          }
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Sprache des Jobs:', error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert die Zielsprache eines Jobs und setzt ihn auf PENDING zurück
   */
  async updateJobLanguageAndReset(jobId: string, targetLanguage: string): Promise<boolean> {
    try {
      const jobCollection = await this.getJobCollection();
      
      const now = new Date();
      const result = await jobCollection.updateOne(
        { job_id: jobId },
        { 
          $set: { 
            'parameters.target_language': targetLanguage,
            updated_at: now,
            status: JobStatus.PENDING,
            processing_started_at: undefined,
            completed_at: undefined,
            error: undefined,
            progress: undefined
          },
          $unset: { results: "" }
        }
      );
      
      const success = result.modifiedCount > 0;
      
      if (success) {
        // Wenn der Job Teil eines Batches ist, aktualisiere auch den Batch-Fortschritt
        const job = await this.getJob(jobId);
        if (job && job.batch_id) {
          await this.updateBatchProgress(job.batch_id);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Sprache und Zurücksetzen des Jobs:', error);
      throw error;
    }
  }
} 