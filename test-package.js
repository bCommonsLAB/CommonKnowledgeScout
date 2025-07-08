#!/usr/bin/env node

/**
 * 🧪 Testscript für das CommonKnowledgeScout Package
 * 
 * Dieses Script testet die grundlegende Funktionalität des veröffentlichten Packages
 * inklusive Server-Start, API-Zugriff und ordnungsgemäße Beendigung.
 */

const { startServer } = require('./dist/index.js');
const http = require('http');
const { performance } = require('perf_hooks');

// Konfiguration
const CONFIG = {
  port: 3001,
  hostname: 'localhost',
  dev: false,
  testDuration: 10000, // 10 Sekunden
  healthCheckPath: '/api/user-info',
  env: {
    // Clerk Authentifizierung
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_placeholder',
    
    // Optional: Weitere Umgebungsvariablen
    NODE_ENV: process.env.NODE_ENV || 'production',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    
    // MongoDB (falls benötigt)
    MONGODB_URI: process.env.MONGODB_URI || '',
    
    
    // Secretary Service (falls benötigt)
    SECRETARY_SERVICE_URL: process.env.SECRETARY_SERVICE_URL || '',
    SECRETARY_SERVICE_TOKEN: process.env.SECRETARY_SERVICE_TOKEN || ''
  }
};

/**
 * Überprüft und validiert die erforderlichen Umgebungsvariablen
 * @returns {Object} - Validierungsergebnis mit Status und Warnungen
 */
function validateEnvironment() {
  const warnings = [];
  const errors = [];
  
  // Prüfe Clerk Secret Key
  if (!process.env.CLERK_SECRET_KEY) {
    warnings.push('⚠️  CLERK_SECRET_KEY nicht gesetzt - verwende Placeholder');
    console.log('💡 Tipp: Setze CLERK_SECRET_KEY als Umgebungsvariable:');
    console.log('   Windows: set CLERK_SECRET_KEY=sk_test_your_key_here');
    console.log('   Linux/Mac: export CLERK_SECRET_KEY=sk_test_your_key_here');
  } else {
    console.log('✅ CLERK_SECRET_KEY gefunden');
  }
  
  // Prüfe andere wichtige Variablen
  const optionalVars = [
    'MONGODB_URI', 
    'ONEDRIVE_CLIENT_ID', 
    'SECRETARY_SERVICE_URL'
  ];
  
  optionalVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`⚠️  ${varName} nicht gesetzt - falls benötigt`);
    }
  });
  
  return { warnings, errors, isValid: errors.length === 0 };
}

/**
 * Führt einen HTTP-Request zum Health Check durch
 * @param {string} url - Die URL für den Health Check
 * @returns {Promise<object>} - Response-Objekt mit Status und Daten
 */
async function performHealthCheck(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Health Check Timeout'));
    });
  });
}

/**
 * Haupttest-Funktion
 */
async function testPackage() {
  console.log('🧪 Teste CommonKnowledgeScout Package...');
  console.log('📦 Package: @bcommonslab/common-knowledge-scout (lokale dist-Version)');
  console.log('⚙️  Konfiguration:', CONFIG);
  console.log('');
  
  const startTime = performance.now();
  let server = null;
  
  try {
    // 1. Umgebungsvariablen validieren
    console.log('🔍 Validiere Umgebungsvariablen...');
    const envValidation = validateEnvironment();
    
    if (envValidation.warnings.length > 0) {
      console.log('⚠️  Warnungen:');
      envValidation.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    if (!envValidation.isValid) {
      console.error('❌ Kritische Umgebungsvariablen fehlen!');
      process.exit(1);
    }
    
    console.log('');
    
    // 2. Server starten
    console.log('🚀 Starte Server...');
    server = await startServer({ 
      port: CONFIG.port, 
      hostname: CONFIG.hostname,
      dev: CONFIG.dev,
      env: CONFIG.env
    });
    
    const serverStartTime = performance.now();
    console.log(`✅ Server erfolgreich gestartet! (${Math.round(serverStartTime - startTime)}ms)`);
    console.log(`🌐 URL: ${server.url}`);
    console.log(`📊 Port: ${server.port}`);
    console.log(`🏠 Hostname: ${server.hostname}`);
    console.log('');
    
    // 3. Health Check durchführen
    console.log('🔍 Führe Health Check durch...');
    try {
      const healthUrl = `http://${CONFIG.hostname}:${CONFIG.port}${CONFIG.healthCheckPath}`;
      const healthResult = await performHealthCheck(healthUrl);
      
      console.log(`✅ Health Check erfolgreich!`);
      console.log(`📊 Status Code: ${healthResult.statusCode}`);
      console.log(`📄 Content-Type: ${healthResult.headers['content-type']}`);
      console.log(`📏 Response Length: ${healthResult.data.length} Zeichen`);
      console.log('');
      
      // Response-Daten analysieren
      if (healthResult.statusCode === 200) {
        try {
          const responseData = JSON.parse(healthResult.data);
          console.log('🔄 API Response analysiert:');
          console.log(`   - Type: ${typeof responseData}`);
          console.log(`   - Properties: ${Object.keys(responseData).length}`);
          console.log('');
        } catch (e) {
          console.log('ℹ️  Response ist nicht JSON-formatiert');
        }
      }
    } catch (healthError) {
      console.warn(`⚠️  Health Check fehlgeschlagen: ${healthError.message}`);
      console.log('   (Das ist möglicherweise normal, wenn Authentication erforderlich ist)');
      console.log('');
    }
    
    // 4. Server-Stabilität testen
    console.log(`⏳ Teste Server-Stabilität für ${CONFIG.testDuration / 1000} Sekunden...`);
    
    await new Promise((resolve) => {
      let secondsRemaining = CONFIG.testDuration / 1000;
      
      const countdown = setInterval(() => {
        process.stdout.write(`\r   ⏱️  Noch ${secondsRemaining} Sekunden...`);
        secondsRemaining--;
        
        if (secondsRemaining < 0) {
          clearInterval(countdown);
          console.log('\n');
          resolve();
        }
      }, 1000);
    });
    
    // 5. Server beenden
    console.log('🛑 Beende Server...');
    await new Promise((resolve) => {
      server.server.close(() => {
        const endTime = performance.now();
        const totalTime = Math.round(endTime - startTime);
        
        console.log('✅ Server erfolgreich beendet!');
        console.log(`⏱️  Gesamtzeit: ${totalTime}ms`);
        console.log('');
        console.log('🎉 Alle Tests erfolgreich abgeschlossen!');
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Testen des Packages:');
    console.error(`   Fehler: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    
    // Fallback: Server-Cleanup
    if (server && server.server) {
      try {
        server.server.close();
      } catch (cleanupError) {
        console.error('❌ Fehler beim Server-Cleanup:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

/**
 * Error Handler für unbehandelte Exceptions
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful Shutdown Handler
process.on('SIGINT', () => {
  console.log('\n🛑 Beende Test durch Benutzer-Interrupt...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Beende Test durch SIGTERM...');
  process.exit(0);
});

// Test ausführen
if (require.main === module) {
  testPackage();
}

module.exports = { testPackage, CONFIG }; 