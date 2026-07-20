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
 * - mail-dispatch: zentraler Mailjet-Versand + Mail-Log (mail_log-Collection)
 * - process.env: MAILJET_FROM_EMAIL, MAILJET_FROM_NAME
 */

import { dispatchMail } from '@/lib/services/mail-dispatch';

/** Gemeinsamer Absender fuer alle Access-/Invite-Mails. */
function fromSender(): { Email?: string; Name: string } {
  return {
    Email: process.env.MAILJET_FROM_EMAIL,
    Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout',
  };
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
    return dispatchMail(
      'access-request-confirmation',
      {
        From: fromSender(),
        To: [{ Email: userEmail, Name: userName }],
        Subject: `Ihre Zugriffsanfrage für "${libraryName}" wurde erhalten`,
        HTMLPart: this.generateAccessRequestConfirmationHTML(userName, libraryName),
        TextPart: this.generateAccessRequestConfirmationText(userName, libraryName),
      },
      { libraryName },
    );
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const accessRequestsUrl = `${appUrl}/settings/public/access-requests`;

    return dispatchMail(
      'access-request-admin-notification',
      {
        From: fromSender(),
        To: [{ Email: adminEmail, Name: adminName }],
        Subject: `Neue Zugriffsanfrage für "${libraryName}"`,
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
        ),
      },
      { libraryName, requestedBy: userEmail },
    );
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
    return dispatchMail(
      'invite',
      {
        From: fromSender(),
        To: [{ Email: invitedEmail, Name: invitedName }],
        Subject: `Sie wurden zu "${libraryName}" eingeladen`,
        HTMLPart: this.generateInviteEmailHTML(invitedName, libraryName, inviteUrl, invitedBy, inviteMessage),
        TextPart: this.generateInviteEmailText(invitedName, libraryName, inviteUrl, invitedBy, inviteMessage),
      },
      { libraryName, invitedBy },
    );
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const libraryUrl = `${appUrl}/explore/${librarySlug}`;

    return dispatchMail(
      'access-approved',
      {
        From: fromSender(),
        To: [{ Email: userEmail, Name: userName }],
        Subject: `Ihr Zugriff auf "${libraryName}" wurde genehmigt`,
        HTMLPart: this.generateAccessApprovedHTML(userName, libraryName, libraryUrl),
        TextPart: this.generateAccessApprovedText(userName, libraryName, libraryUrl),
      },
      { libraryName, librarySlug },
    );
  }

  /**
   * Sendet Einladungs-E-Mail fuer eine Mitgliedschaft (Co-Creator / Moderator).
   * Verwendet einen eigenen Bestaetigungslink mit Member-Token.
   */
  static async sendMemberInviteEmail(
    recipientEmail: string,
    recipientName: string,
    libraryName: string,
    role: string,
    inviteUrl: string,
    inviterName: string
  ): Promise<boolean> {
    const roleLabel = role === 'co-creator' ? 'Co-Creator' : role === 'contributor' ? 'Mitwirkender' : 'Moderator';

    return dispatchMail(
      'member-invite',
      {
        From: fromSender(),
        To: [{ Email: recipientEmail, Name: recipientName || recipientEmail }],
        Subject: `Einladung als ${roleLabel} fuer "${libraryName}"`,
        HTMLPart: this.generateMemberInviteHTML(recipientName || recipientEmail, libraryName, roleLabel, inviteUrl, inviterName),
        TextPart: this.generateMemberInviteText(recipientName || recipientEmail, libraryName, roleLabel, inviteUrl, inviterName),
      },
      { libraryName, role, inviterName },
    );
  }

  /**
   * Sendet Ablehnungs-E-Mail an Benutzer
   */
  static async sendAccessRejectedEmail(
    userEmail: string,
    userName: string,
    libraryName: string
  ): Promise<boolean> {
    return dispatchMail(
      'access-rejected',
      {
        From: fromSender(),
        To: [{ Email: userEmail, Name: userName }],
        Subject: `Ihre Zugriffsanfrage für "${libraryName}" wurde abgelehnt`,
        HTMLPart: this.generateAccessRejectedHTML(userName, libraryName),
        TextPart: this.generateAccessRejectedText(userName, libraryName),
      },
      { libraryName },
    );
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

  // -- Mitglieder-Einladung Templates --

  private static generateMemberInviteHTML(
    recipientName: string,
    libraryName: string,
    roleLabel: string,
    inviteUrl: string,
    inviterName: string
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Einladung als ${roleLabel}</h2>
        
        <p>Hallo ${recipientName},</p>
        
        <p>${inviterName} hat Sie als <strong>${roleLabel}</strong> fuer die Library "${libraryName}" eingeladen.</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d5016; margin-top: 0;">Ihre Einladung:</h3>
          <p style="margin: 10px 0;"><strong>Library:</strong> ${libraryName}</p>
          <p style="margin: 10px 0;"><strong>Rolle:</strong> ${roleLabel}</p>
          <p style="margin: 10px 0;"><strong>Eingeladen von:</strong> ${inviterName}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" 
             style="background-color: #2d5016; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Einladung annehmen
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Wichtig: Bitte melden Sie sich mit der E-Mail-Adresse an, an die diese Einladung gesendet wurde.
        </p>
      </div>
    `;
  }

  private static generateMemberInviteText(
    recipientName: string,
    libraryName: string,
    roleLabel: string,
    inviteUrl: string,
    inviterName: string
  ): string {
    return `
      Einladung als ${roleLabel}
      
      Hallo ${recipientName},
      
      ${inviterName} hat Sie als ${roleLabel} fuer die Library "${libraryName}" eingeladen.
      
      Ihre Einladung:
      Library: ${libraryName}
      Rolle: ${roleLabel}
      Eingeladen von: ${inviterName}
      
      Einladung annehmen: ${inviteUrl}
      
      Wichtig: Bitte melden Sie sich mit der E-Mail-Adresse an, an die diese Einladung gesendet wurde.
    `;
  }
}

