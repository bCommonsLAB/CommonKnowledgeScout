# Mailjet E-Mail-Service Implementierung

Diese Dokumentation beschreibt die Implementierung des E-Mail-Services mit Mailjet für das Einladungssystem.

## Interface-Definition

Der E-Mail-Service muss folgendes Interface erfüllen:

```typescript
interface InvitationEmailData {
  to: string;
  name: string;
  subject: string;
  inviterName: string;
  organizationName?: string;
  loginUrl: string;
  personalMessage?: string;
}

interface EmailService {
  sendInvitationEmail(data: InvitationEmailData): Promise<boolean>;
}
```

---

## Mailjet Implementierung

**Package:** `node-mailjet`

**Installation:**
```bash
npm install node-mailjet
```

**Implementierung:**

```typescript
import Mailjet from 'node-mailjet'

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_KEY,
  apiSecret: process.env.MAILJET_API_SECRET,
})

export class EmailService {
  static async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    try {
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME
          },
          To: [{
            Email: data.to,
            Name: data.name
          }],
          Subject: data.subject,
          HTMLPart: this.generateHTML(data),
          TextPart: this.generateText(data)
        }]
      })
      return true
    } catch (error) {
      console.error('E-Mail-Versand Fehler:', error)
      return false
    }
  }
  
  private static generateHTML(data: InvitationEmailData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Sie wurden eingeladen!</h2>
        
        <p>Hallo ${data.name},</p>
        
        <p>${data.inviterName} hat Sie eingeladen${data.organizationName ? ` (${data.organizationName})` : ''}.</p>
        
        ${data.personalMessage ? `
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #2d5016; margin: 20px 0;">
          <p style="margin: 0; font-style: italic; color: #2d5016;">
            <strong>Persönliche Nachricht von ${data.inviterName}:</strong><br>
            "${data.personalMessage}"
          </p>
        </div>
        ` : ''}
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d5016; margin-top: 0;">Ihre Registrierung:</h3>
          <p style="margin: 10px 0;"><strong>E-Mail:</strong> ${data.to}</p>
          <p style="margin: 10px 0;"><strong>Name:</strong> ${data.name}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.loginUrl}" 
             style="background-color: #2d5016; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Einladung annehmen & direkt starten
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Bei Fragen antworten Sie einfach auf diese E-Mail oder wenden Sie sich an ${data.inviterName}.
        </p>
      </div>
    `
  }
  
  private static generateText(data: InvitationEmailData): string {
    return `
      Sie wurden eingeladen!
      
      Hallo ${data.name},
      
      ${data.inviterName} hat Sie eingeladen${data.organizationName ? ` (${data.organizationName})` : ''}.
      
      ${data.personalMessage ? `Persönliche Nachricht von ${data.inviterName}: "${data.personalMessage}"` : ''}
      
      Ihre Registrierung:
      E-Mail: ${data.to}
      Name: ${data.name}
      
      Einladung annehmen: ${data.loginUrl}
      
      Wichtig: Klicken Sie auf den Link, um Ihre Einladung anzunehmen.
    `
  }
}
```

**Umgebungsvariablen:**
```env
MAILJET_API_KEY=your-api-key
MAILJET_API_SECRET=your-api-secret
MAILJET_FROM_EMAIL=noreply@example.com
MAILJET_FROM_NAME=Meine App
```

**Hinweis:** In der aktuellen Implementierung werden `MAILJET_FROM_EMAIL` und `MAILJET_FROM_NAME` verwendet. Alternativ können auch `EMAIL_FROM_EMAIL` und `EMAIL_FROM_NAME` verwendet werden, wenn eine allgemeinere Namensgebung bevorzugt wird.

---

## E-Mail-Templates

### HTML-Template

Das HTML-Template enthält:
- Responsive Design mit inline Styles
- Persönliche Begrüßung
- Organisations-Informationen (falls vorhanden)
- Persönliche Nachricht (falls vorhanden)
- Registrierungsinformationen
- Call-to-Action Button mit Einladungslink
- Kontaktinformationen

### Text-Template

Das Text-Template ist eine Fallback-Version für E-Mail-Clients ohne HTML-Unterstützung und enthält alle wichtigen Informationen als reiner Text.

---

## Testing

### Mock-Implementierung für Tests

Für Tests kann ein Mock-Service verwendet werden:

```typescript
export class MockEmailService {
  private static sentEmails: InvitationEmailData[] = []
  
  static async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    this.sentEmails.push(data)
    return true
  }
  
  static getSentEmails(): InvitationEmailData[] {
    return this.sentEmails
  }
  
  static clearSentEmails(): void {
    this.sentEmails = []
  }
}
```

**Verwendung in Tests:**
```typescript
// In Tests
import { MockEmailService } from './mock-email-service'

beforeEach(() => {
  MockEmailService.clearSentEmails()
})

test('sends invitation email', async () => {
  await sendInvitation({ email: 'test@example.com' })
  
  const sentEmails = MockEmailService.getSentEmails()
  expect(sentEmails).toHaveLength(1)
  expect(sentEmails[0].to).toBe('test@example.com')
})
```

---

## Mailjet-Konfiguration

### API-Schlüssel erhalten

1. Registrieren Sie sich bei [Mailjet](https://www.mailjet.com/)
2. Gehen Sie zu Account Settings → API Keys
3. Kopieren Sie den API Key und API Secret
4. Fügen Sie diese in Ihre `.env`-Datei ein

### Absender-E-Mail verifizieren

1. Gehen Sie zu Senders & Domains
2. Fügen Sie Ihre E-Mail-Adresse oder Domain hinzu
3. Verifizieren Sie die E-Mail-Adresse/Domain
4. Verwenden Sie die verifizierte E-Mail als `MAILJET_FROM_EMAIL`

### Limits

- **Kostenloser Plan:** Bis zu 6.000 E-Mails pro Monat
- **API-Limits:** 200 Requests pro Sekunde
- **Tägliches Limit:** Abhängig vom gewählten Plan

---

## Fehlerbehandlung

### Häufige Fehler

**Ungültige API-Schlüssel:**
```
Error: Unauthorized
```
- Prüfen Sie `MAILJET_API_KEY` und `MAILJET_API_SECRET`

**Nicht verifizierte Absender-E-Mail:**
```
Error: Sender address not verified
```
- Verifizieren Sie die Absender-E-Mail in Mailjet

**Rate Limit überschritten:**
```
Error: Too many requests
```
- Implementieren Sie Rate Limiting oder warten Sie

### Fehlerbehandlung im Code

```typescript
static async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  try {
    await mailjet.post('send', { version: 'v3.1' }).request({
      // ... E-Mail-Daten
    })
    return true
  } catch (error: any) {
    console.error('E-Mail-Versand Fehler:', error)
    
    // Spezifische Fehlerbehandlung
    if (error.statusCode === 401) {
      console.error('Ungültige API-Schlüssel')
    } else if (error.statusCode === 400) {
      console.error('Ungültige E-Mail-Daten:', error.response?.body)
    } else if (error.statusCode === 429) {
      console.error('Rate Limit überschritten')
    }
    
    return false
  }
}
```

---

## Integration in das Einladungssystem

Der Mailjet E-Mail-Service wird in folgenden Dateien verwendet:

- `src/lib/services/mailjet-service.ts` - E-Mail-Service-Implementierung
- `src/app/api/auth/invite/route.ts` - Einladung erstellen und E-Mail senden
- `src/app/api/auth/register/route.ts` - Willkommens-E-Mail nach Registrierung
- `src/app/api/auth/forgot-password/route.ts` - Passwort-Reset-E-Mail

**Verwendung:**
```typescript
import { MailjetService } from '@/lib/services/mailjet-service'

await MailjetService.sendInvitationEmail({
  to: 'user@example.com',
  name: 'Max Mustermann',
  subject: 'Einladung zu NatureScout',
  inviterName: 'Anna Schmidt',
  organizationName: 'Meine Organisation',
  loginUrl: 'https://example.com/invite/token123',
  personalMessage: 'Willkommen im Team!'
})
```

---

## Zusammenfassung

Die Mailjet-Implementierung bietet:

- ✅ Einfaches Setup mit API-Schlüsseln
- ✅ HTML- und Text-Versionen der E-Mails
- ✅ Kostenloser Plan für kleine Projekte (6k E-Mails/Monat)
- ✅ Gute Delivery Rate
- ✅ Analytics und Tracking über Mailjet-Dashboard
- ✅ Einfache Integration in bestehende Systeme

Die Einladungslogik ist vollständig vom E-Mail-Provider getrennt, sodass bei Bedarf ein Wechsel zu einem anderen Provider möglich ist, ohne die restliche Logik zu ändern.
