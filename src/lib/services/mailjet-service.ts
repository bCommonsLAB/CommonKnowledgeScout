/**
 * @fileoverview Mailjet E-Mail-Service
 * 
 * @description
 * Service für den Versand von E-Mails über Mailjet. Unterstützt verschiedene
 * E-Mail-Typen für das Library Access Request System:
 * - Zugriffsanfrage-Bestätigungen
 * - Admin-Benachrichtigungen
 * - Einladungs-E-Mails
 * - Genehmigungs-/Ablehnungs-Benachrichtigungen
 * 
 * @module services
 * 
 * @dependencies
 * - node-mailjet: Mailjet API Client
 * - process.env: MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL, MAILJET_FROM_NAME
 */

import Mailjet from 'node-mailjet';

// Mailjet-Client lazy initialisieren (nur wenn benötigt)
let mailjetInstance: Mailjet | null = null;

function getMailjetClient(): Mailjet {
  if (!mailjetInstance) {
    const apiKey = process.env.MAILJET_API_KEY || '';
    const apiSecret = process.env.MAILJET_API_SECRET || '';
    
    // Prüfe ob API-Keys vorhanden sind
    if (!apiKey || !apiSecret) {
      throw new Error('Mailjet API_KEY and API_SECRET are required');
    }
    
    mailjetInstance = new Mailjet({
      apiKey,
      apiSecret,
    });
  }
  return mailjetInstance;
}

/**
 * E-Mail-Service für Library Access Requests
 */
export class MailjetService {
  /**
   * Sendet Bestätigungs-E-Mail an Benutzer, der eine Zugriffsanfrage gestellt hat
   */
  static async sendAccessRequestConfirmation(
    userEmail: string,
    userName: string,
    libraryName: string
  ): Promise<boolean> {
    try {
      const subject = `Ihre Zugriffsanfrage für "${libraryName}" wurde erhalten`;
      
      const mailjet = getMailjetClient();
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout'
          },
          To: [{
            Email: userEmail,
            Name: userName
          }],
          Subject: subject,
          HTMLPart: this.generateAccessRequestConfirmationHTML(userName, libraryName),
          TextPart: this.generateAccessRequestConfirmationText(userName, libraryName)
        }]
      });
      
      console.log(`[MailjetService] Zugriffsanfrage-Bestätigung gesendet an ${userEmail}`);
      return true;
    } catch (error) {
      console.error('[MailjetService] Fehler beim Versand der Zugriffsanfrage-Bestätigung:', error);
      return false;
    }
  }

  /**
   * Sendet Benachrichtigungs-E-Mail an Owner und Moderatoren über neue Zugriffsanfrage
   */
  static async sendAccessRequestNotificationToAdmin(
    adminEmail: string,
    adminName: string,
    userEmail: string,
    userName: string,
    libraryName: string
  ): Promise<boolean> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const accessRequestsUrl = `${appUrl}/settings/public/access-requests`;
      
      const subject = `Neue Zugriffsanfrage für "${libraryName}"`;
      
      const mailjet = getMailjetClient();
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout'
          },
          To: [{
            Email: adminEmail,
            Name: adminName
          }],
          Subject: subject,
          HTMLPart: this.generateAccessRequestNotificationHTML(
            adminName,
            userName,
            userEmail,
            libraryName,
            accessRequestsUrl
          ),
          TextPart: this.generateAccessRequestNotificationText(
            adminName,
            userName,
            userEmail,
            libraryName,
            accessRequestsUrl
          )
        }]
      });
      
      console.log(`[MailjetService] Zugriffsanfrage-Benachrichtigung gesendet an ${adminEmail}`);
      return true;
    } catch (error) {
      console.error('[MailjetService] Fehler beim Versand der Admin-Benachrichtigung:', error);
      return false;
    }
  }

  /**
   * Sendet Einladungs-E-Mail an eingeladenen Benutzer
   */
  static async sendInviteEmail(
    invitedEmail: string,
    invitedName: string,
    libraryName: string,
    inviteUrl: string,
    invitedBy: string,
    inviteMessage?: string
  ): Promise<boolean> {
    try {
      const subject = `Sie wurden zu "${libraryName}" eingeladen`;
      
      const mailjet = getMailjetClient();
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout'
          },
          To: [{
            Email: invitedEmail,
            Name: invitedName
          }],
          Subject: subject,
          HTMLPart: this.generateInviteEmailHTML(invitedName, libraryName, inviteUrl, invitedBy, inviteMessage),
          TextPart: this.generateInviteEmailText(invitedName, libraryName, inviteUrl, invitedBy, inviteMessage)
        }]
      });
      
      console.log(`[MailjetService] Einladungs-E-Mail gesendet an ${invitedEmail}`);
      return true;
    } catch (error) {
      console.error('[MailjetService] Fehler beim Versand der Einladungs-E-Mail:', error);
      return false;
    }
  }

  /**
   * Sendet Genehmigungs-E-Mail an Benutzer
   */
  static async sendAccessApprovedEmail(
    userEmail: string,
    userName: string,
    libraryName: string,
    librarySlug: string
  ): Promise<boolean> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const libraryUrl = `${appUrl}/explore/${librarySlug}`;
      
      const subject = `Ihr Zugriff auf "${libraryName}" wurde genehmigt`;
      
      const mailjet = getMailjetClient();
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout'
          },
          To: [{
            Email: userEmail,
            Name: userName
          }],
          Subject: subject,
          HTMLPart: this.generateAccessApprovedHTML(userName, libraryName, libraryUrl),
          TextPart: this.generateAccessApprovedText(userName, libraryName, libraryUrl)
        }]
      });
      
      console.log(`[MailjetService] Genehmigungs-E-Mail gesendet an ${userEmail}`);
      return true;
    } catch (error) {
      console.error('[MailjetService] Fehler beim Versand der Genehmigungs-E-Mail:', error);
      return false;
    }
  }

  /**
   * Sendet Ablehnungs-E-Mail an Benutzer
   */
  static async sendAccessRejectedEmail(
    userEmail: string,
    userName: string,
    libraryName: string
  ): Promise<boolean> {
    try {
      const subject = `Ihre Zugriffsanfrage für "${libraryName}" wurde abgelehnt`;
      
      const mailjet = getMailjetClient();
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout'
          },
          To: [{
            Email: userEmail,
            Name: userName
          }],
          Subject: subject,
          HTMLPart: this.generateAccessRejectedHTML(userName, libraryName),
          TextPart: this.generateAccessRejectedText(userName, libraryName)
        }]
      });
      
      console.log(`[MailjetService] Ablehnungs-E-Mail gesendet an ${userEmail}`);
      return true;
    } catch (error) {
      console.error('[MailjetService] Fehler beim Versand der Ablehnungs-E-Mail:', error);
      return false;
    }
  }

  // HTML-Template-Generatoren

  private static generateAccessRequestConfirmationHTML(userName: string, libraryName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Ihre Zugriffsanfrage wurde erhalten</h2>
        
        <p>Hallo ${userName},</p>
        
        <p>vielen Dank für Ihr Interesse an der Library "${libraryName}".</p>
        
        <p>Ihre Zugriffsanfrage wurde erfolgreich übermittelt und wird nun von den Administratoren geprüft. Sie erhalten eine E-Mail, sobald über Ihre Anfrage entschieden wurde.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #2d5016; margin: 20px 0;">
          <p style="margin: 0; color: #2d5016;">
            <strong>Status:</strong> Ihre Anfrage wird bearbeitet
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Bei Fragen können Sie sich jederzeit an uns wenden.
        </p>
      </div>
    `;
  }

  private static generateAccessRequestConfirmationText(userName: string, libraryName: string): string {
    return `
      Ihre Zugriffsanfrage wurde erhalten
      
      Hallo ${userName},
      
      vielen Dank für Ihr Interesse an der Library "${libraryName}".
      
      Ihre Zugriffsanfrage wurde erfolgreich übermittelt und wird nun von den Administratoren geprüft. Sie erhalten eine E-Mail, sobald über Ihre Anfrage entschieden wurde.
      
      Status: Ihre Anfrage wird bearbeitet
      
      Bei Fragen können Sie sich jederzeit an uns wenden.
    `;
  }

  private static generateAccessRequestNotificationHTML(
    adminName: string,
    userName: string,
    userEmail: string,
    libraryName: string,
    accessRequestsUrl: string
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Neue Zugriffsanfrage</h2>
        
        <p>Hallo ${adminName},</p>
        
        <p>es liegt eine neue Zugriffsanfrage für die Library "${libraryName}" vor.</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d5016; margin-top: 0;">Anfrage-Details:</h3>
          <p style="margin: 10px 0;"><strong>Benutzer:</strong> ${userName}</p>
          <p style="margin: 10px 0;"><strong>E-Mail:</strong> ${userEmail}</p>
          <p style="margin: 10px 0;"><strong>Library:</strong> ${libraryName}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accessRequestsUrl}" 
             style="background-color: #2d5016; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Zugriffsanfragen verwalten
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Bitte melden Sie sich an, um die Anfrage zu bearbeiten.
        </p>
      </div>
    `;
  }

  private static generateAccessRequestNotificationText(
    adminName: string,
    userName: string,
    userEmail: string,
    libraryName: string,
    accessRequestsUrl: string
  ): string {
    return `
      Neue Zugriffsanfrage
      
      Hallo ${adminName},
      
      es liegt eine neue Zugriffsanfrage für die Library "${libraryName}" vor.
      
      Anfrage-Details:
      Benutzer: ${userName}
      E-Mail: ${userEmail}
      Library: ${libraryName}
      
      Zugriffsanfragen verwalten: ${accessRequestsUrl}
      
      Bitte melden Sie sich an, um die Anfrage zu bearbeiten.
    `;
  }

  private static generateInviteEmailHTML(
    invitedName: string,
    libraryName: string,
    inviteUrl: string,
    invitedBy: string,
    inviteMessage?: string
  ): string {
    // Persönliche Nachricht als zusätzlicher Block (nur wenn vorhanden)
    const messageSection = inviteMessage ? `
        <div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #2d5016; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #2d5016;">Persönliche Nachricht von ${invitedBy}:</p>
          <p style="margin: 0; font-style: italic; color: #333; white-space: pre-wrap;">${inviteMessage.replace(/\n/g, '<br>')}</p>
        </div>
    ` : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Sie wurden eingeladen!</h2>
        
        <p>Hallo ${invitedName},</p>
        
        <p>${invitedBy} hat Sie eingeladen, auf die Library "${libraryName}" zuzugreifen.</p>
        
        ${messageSection}
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d5016; margin-top: 0;">Ihre Einladung:</h3>
          <p style="margin: 10px 0;"><strong>Library:</strong> ${libraryName}</p>
          <p style="margin: 10px 0;"><strong>Eingeladen von:</strong> ${invitedBy}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" 
             style="background-color: #2d5016; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Einladung annehmen
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Wichtig: Bitte melden Sie sich an, bevor Sie auf den Link klicken. Die Einladung ist nur für Ihre E-Mail-Adresse gültig.
        </p>
      </div>
    `;
  }

  private static generateInviteEmailText(
    invitedName: string,
    libraryName: string,
    inviteUrl: string,
    invitedBy: string,
    inviteMessage?: string
  ): string {
    // Persönliche Nachricht als zusätzlicher Abschnitt (nur wenn vorhanden)
    const messageSection = inviteMessage ? `
      
      Persönliche Nachricht von ${invitedBy}:
      "${inviteMessage}"
    ` : '';

    return `
      Sie wurden eingeladen!
      
      Hallo ${invitedName},
      
      ${invitedBy} hat Sie eingeladen, auf die Library "${libraryName}" zuzugreifen.
      ${messageSection}
      
      Ihre Einladung:
      Library: ${libraryName}
      Eingeladen von: ${invitedBy}
      
      Einladung annehmen: ${inviteUrl}
      
      Wichtig: Bitte melden Sie sich an, bevor Sie auf den Link klicken. Die Einladung ist nur für Ihre E-Mail-Adresse gültig.
    `;
  }

  private static generateAccessApprovedHTML(userName: string, libraryName: string, libraryUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Zugriff genehmigt!</h2>
        
        <p>Hallo ${userName},</p>
        
        <p>Ihre Zugriffsanfrage für die Library "${libraryName}" wurde genehmigt.</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #2d5016;">
            <strong>Status:</strong> Zugriff gewährt
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${libraryUrl}" 
             style="background-color: #2d5016; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Library öffnen
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Sie können nun auf die Library zugreifen und alle Inhalte nutzen.
        </p>
      </div>
    `;
  }

  private static generateAccessApprovedText(userName: string, libraryName: string, libraryUrl: string): string {
    return `
      Zugriff genehmigt!
      
      Hallo ${userName},
      
      Ihre Zugriffsanfrage für die Library "${libraryName}" wurde genehmigt.
      
      Status: Zugriff gewährt
      
      Library öffnen: ${libraryUrl}
      
      Sie können nun auf die Library zugreifen und alle Inhalte nutzen.
    `;
  }

  private static generateAccessRejectedHTML(userName: string, libraryName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Zugriffsanfrage abgelehnt</h2>
        
        <p>Hallo ${userName},</p>
        
        <p>leider wurde Ihre Zugriffsanfrage für die Library "${libraryName}" abgelehnt.</p>
        
        <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f; margin: 20px 0;">
          <p style="margin: 0; color: #d32f2f;">
            <strong>Status:</strong> Zugriff abgelehnt
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Bei Fragen können Sie sich jederzeit an uns wenden.
        </p>
      </div>
    `;
  }

  private static generateAccessRejectedText(userName: string, libraryName: string): string {
    return `
      Zugriffsanfrage abgelehnt
      
      Hallo ${userName},
      
      leider wurde Ihre Zugriffsanfrage für die Library "${libraryName}" abgelehnt.
      
      Status: Zugriff abgelehnt
      
      Bei Fragen können Sie sich jederzeit an uns wenden.
    `;
  }
}

