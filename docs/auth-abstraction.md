# Auth-Abstraktionsschicht für CommonKnowledgeScout

## Übersicht

Die Auth-Abstraktionsschicht ermöglicht es CommonKnowledgeScout, sowohl mit Clerk-Authentifizierung als auch im Offline-Modus ohne externe Auth-Abhängigkeiten zu funktionieren. Dies ist besonders nützlich für Offline-Anwendungen oder Umgebungen, in denen Clerk nicht verfügbar ist.

## Architektur

### Dateien

- `src/lib/auth/types.ts` - Typen und Interfaces
- `src/lib/auth/mock.ts` - Mock-Implementierungen für Offline-Modus
- `src/lib/auth/server.ts` - Server-seitige Auth-Funktionen
- `src/lib/auth/client.tsx` - Client-seitige Auth-Funktionen

### Konfiguration

Die Auth-Abstraktionsschicht wird über Umgebungsvariablen konfiguriert:

```bash
# Auth-Modus (clerk oder offline)
NEXT_PUBLIC_AUTH_MODE=offline

# Offline-User-Konfiguration (optional)
NEXT_PUBLIC_OFFLINE_USER_EMAIL=offline@example.com
NEXT_PUBLIC_OFFLINE_USER_FIRST_NAME=Offline
NEXT_PUBLIC_OFFLINE_USER_LAST_NAME=User

# Clerk-Keys (für Clerk-Modus)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Verwendung

### Server-seitig (API-Routen)

```typescript
import { getServerAuth, requireAuth } from '@/lib/auth/server';

// Einfache Auth-Prüfung
export async function GET(request: NextRequest) {
  const authResult = await getServerAuth(request);
  
  if (!authResult.userId || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userEmail = authResult.user.email;
  // ... weitere Logik
}

// Mit Auth-Middleware
export async function POST(request: NextRequest) {
  return withAuth(request, async ({ userId, user }) => {
    const userEmail = user.email;
    // ... geschützte Logik
  });
}
```

### Client-seitig (React-Komponenten)

```typescript
import { useAuth, useUser } from '@/lib/auth/client';

function MyComponent() {
  const { user, isSignedIn, isLoaded } = useUser();
  
  if (!isLoaded) {
    return <div>Laden...</div>;
  }
  
  if (!isSignedIn) {
    return <div>Bitte anmelden</div>;
  }
  
  return <div>Willkommen, {user.firstName}!</div>;
}
```

### Dynamische Auth-Komponenten

```typescript
import { getAuthComponents } from '@/lib/auth/client';

function AuthButtons() {
  const [components, setComponents] = useState(null);
  
  useEffect(() => {
    getAuthComponents().then(setComponents);
  }, []);
  
  if (!components) return <div>Laden...</div>;
  
  return (
    <components.SignedIn>
      <components.UserButton />
    </components.SignedIn>
  );
}
```

## Offline-Modus

### Features

- **Mock-User**: Automatisch erstellter Benutzer mit konfigurierbaren Daten
- **Vollständige API-Kompatibilität**: Alle Auth-Funktionen sind verfügbar
- **Keine externen Abhängigkeiten**: Funktioniert ohne Clerk
- **Konfigurierbar**: Benutzerdaten über Umgebungsvariablen anpassbar

### Mock-User

```typescript
// Standard-Mock-User
{
  id: 'offline-user',
  email: 'offline@example.com',
  firstName: 'Offline',
  lastName: 'User',
  fullName: 'Offline User',
  imageUrl: undefined
}
```

### Konfiguration

```bash
# Benutzerdefinierte Offline-User-Daten
NEXT_PUBLIC_OFFLINE_USER_EMAIL=meine-email@example.com
NEXT_PUBLIC_OFFLINE_USER_FIRST_NAME=Max
NEXT_PUBLIC_OFFLINE_USER_LAST_NAME=Mustermann
```

## Clerk-Modus

### Features

- **Vollständige Clerk-Integration**: Alle Clerk-Funktionen verfügbar
- **Dynamisches Laden**: Clerk wird nur geladen, wenn verfügbar
- **Fallback-Mechanismus**: Automatischer Fallback zu Offline-Modus bei Fehlern

### Konfiguration

```bash
# Clerk-Keys setzen
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Auth-Modus auf Clerk setzen (optional, Standard)
NEXT_PUBLIC_AUTH_MODE=clerk
```

## Middleware

Die Middleware wurde angepasst, um beide Modi zu unterstützen:

```typescript
// Automatische Erkennung des Auth-Modus
const config = getAuthConfig();

if (config.mode === 'offline') {
  return handleOfflineMode(request);
} else {
  return handleClerkMode(request);
}
```

## Package-Build

### Offline-Package

Das Build-System erstellt automatisch eine Offline-Variante des Packages:

```bash
# Package mit Offline-Variante erstellen
pnpm run build:package

# Offline-Package testen
node test-offline-package.js
```

### Offline-Package verwenden

```javascript
const { startServer } = require('@bcommonslab/common-knowledge-scout-offline');

startServer({
  port: 3000,
  authMode: 'offline'
}).then(({ url }) => {
  console.log(`Server läuft auf ${url}`);
});
```

## Migration

### Von Clerk zu Auth-Abstraktionsschicht

1. **Imports ersetzen**:
   ```typescript
   // Alt
   import { useAuth, useUser } from '@clerk/nextjs';
   
   // Neu
   import { useAuth, useUser } from '@/lib/auth/client';
   ```

2. **User-Properties anpassen**:
   ```typescript
   // Alt
   const userEmail = user?.primaryEmailAddress?.emailAddress;
   
   // Neu
   const userEmail = user?.email;
   ```

3. **Server-Auth anpassen**:
   ```typescript
   // Alt
   import { auth, currentUser } from '@clerk/nextjs/server';
   
   // Neu
   import { getServerAuth } from '@/lib/auth/server';
   ```

### Komponenten anpassen

```typescript
// Alt: Clerk-spezifische Komponenten
import { SignInButton, UserButton } from '@clerk/nextjs';

// Neu: Dynamische Komponenten
import { getAuthComponents } from '@/lib/auth/client';

// In useEffect laden
const [components, setComponents] = useState(null);
useEffect(() => {
  getAuthComponents().then(setComponents);
}, []);
```

## Fehlerbehandlung

### Fallback-Mechanismus

Die Auth-Abstraktionsschicht hat mehrere Fallback-Ebenen:

1. **Clerk verfügbar**: Verwendet Clerk
2. **Clerk nicht verfügbar**: Fallback zu Offline-Modus
3. **Fehler beim Laden**: Fallback zu Mock-Implementierungen

### Debugging

```typescript
// Auth-Konfiguration prüfen
import { getAuthConfig } from '@/lib/auth/types';
console.log('Auth-Konfiguration:', getAuthConfig());

// Offline-Modus prüfen
import { isOfflineMode } from '@/lib/auth/mock';
console.log('Offline-Modus:', isOfflineMode());
```

## Best Practices

### 1. Immer Auth-Status prüfen

```typescript
const { isLoaded, isSignedIn, user } = useUser();

if (!isLoaded) {
  return <LoadingSpinner />;
}

if (!isSignedIn) {
  return <SignInPrompt />;
}
```

### 2. Graceful Degradation

```typescript
// Komponenten dynamisch laden
const [AuthComponent, setAuthComponent] = useState(null);

useEffect(() => {
  getAuthComponents()
    .then(({ UserButton }) => setAuthComponent(() => UserButton))
    .catch(() => setAuthComponent(() => MockUserButton));
}, []);
```

### 3. Environment-spezifische Konfiguration

```typescript
// Automatische Erkennung basierend auf Environment
const config = getAuthConfig();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.CLERK_SECRET_KEY) {
  // Produktionsumgebung ohne Clerk-Keys → Offline-Modus
  console.warn('Clerk-Keys nicht gefunden, verwende Offline-Modus');
}
```

## Troubleshooting

### Häufige Probleme

1. **"Clerk nicht verfügbar"**: Prüfe Clerk-Keys und Internetverbindung
2. **"Auth-Fehler"**: Prüfe Auth-Konfiguration und Middleware
3. **"Mock-User nicht geladen"**: Prüfe Offline-User-Konfiguration

### Debug-Schritte

1. Auth-Konfiguration loggen
2. Environment-Variablen prüfen
3. Network-Requests überwachen
4. Console-Fehler analysieren

## Zukunft

### Geplante Erweiterungen

- **Weitere Auth-Provider**: NextAuth.js, Auth0, etc.
- **Custom Auth-Implementierungen**: Eigene Auth-Logik
- **Hybrid-Modi**: Kombination verschiedener Auth-Methoden
- **Performance-Optimierungen**: Lazy Loading, Caching 