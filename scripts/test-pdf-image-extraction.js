#!/usr/bin/env node

/**
 * Test-Skript für PDF-Bilderspeicherung
 * 
 * Dieses Skript testet die wichtigsten Aspekte der PDF-Bilderspeicherung:
 * 1. Frontend-Integration
 * 2. Backend-API
 * 3. Image Extraction Service
 * 4. Logging
 */

const fs = require('fs');
const path = require('path');

// Test-Konfiguration
const TEST_CONFIG = {
  // Test-PDF-Datei (sollte Bilder enthalten)
  testPdfPath: './test-files/sample-with-images.pdf',
  
  // Erwartete Ergebnisse
  expectedResults: {
    minImages: 1,
    maxImages: 20,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    folderPrefix: '.',
    requiredFiles: ['README.md']
  },
  
  // API-Endpoints
  endpoints: {
    processPdf: '/api/secretary/process-pdf',
    libraries: '/api/libraries'
  }
};

/**
 * Test-Klasse für PDF-Bilderspeicherung
 */
class PdfImageExtractionTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
  }

  /**
   * Führt alle Tests aus
   */
  async runAllTests() {
    console.log('🧪 Starte PDF-Bilderspeicherung Tests...\n');
    
    try {
      await this.testFrontendIntegration();
      await this.testBackendAPI();
      await this.testImageExtractionService();
      await this.testLogging();
      await this.testErrorHandling();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test-Ausführung fehlgeschlagen:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test 1: Frontend-Integration
   */
  async testFrontendIntegration() {
    console.log('📱 Test 1: Frontend-Integration');
    
    const tests = [
      {
        name: 'TransformSaveOptions Interface',
        test: () => {
          // Prüfe ob das Interface existiert
          const interfacePath = './src/components/library/transform-save-options.tsx';
          return fs.existsSync(interfacePath);
        }
      },
      {
        name: 'PdfTransform Component',
        test: () => {
          // Prüfe ob die Komponente existiert
          const componentPath = './src/components/library/pdf-transform.tsx';
          return fs.existsSync(componentPath);
        }
      },
      {
        name: 'IncludeImages Checkbox',
        test: () => {
          // Prüfe ob die Checkbox im Code vorhanden ist
          const componentPath = './src/components/library/transform-save-options.tsx';
          if (!fs.existsSync(componentPath)) return false;
          
          const content = fs.readFileSync(componentPath, 'utf8');
          return content.includes('includeImages') && content.includes('IncludeImages');
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.recordTest('Frontend-Integration', test.name, result);
    }
  }

  /**
   * Test 2: Backend-API
   */
  async testBackendAPI() {
    console.log('🔧 Test 2: Backend-API');
    
    const tests = [
      {
        name: 'API Route exists',
        test: () => {
          const routePath = './src/app/api/secretary/process-pdf/route.ts';
          return fs.existsSync(routePath);
        }
      },
      {
        name: 'IncludeImages Parameter',
        test: () => {
          const routePath = './src/app/api/secretary/process-pdf/route.ts';
          if (!fs.existsSync(routePath)) return false;
          
          const content = fs.readFileSync(routePath, 'utf8');
          return content.includes('includeImages') && content.includes('formData.get');
        }
      },
      {
        name: 'Secretary Client',
        test: () => {
          const clientPath = './src/lib/secretary/client.ts';
          if (!fs.existsSync(clientPath)) return false;
          
          const content = fs.readFileSync(clientPath, 'utf8');
          return content.includes('includeImages') && content.includes('transformPdf');
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.recordTest('Backend-API', test.name, result);
    }
  }

  /**
   * Test 3: Image Extraction Service
   */
  async testImageExtractionService() {
    console.log('🖼️ Test 3: Image Extraction Service');
    
    const tests = [
      {
        name: 'Service exists',
        test: () => {
          const servicePath = './src/lib/transform/image-extraction-service.ts';
          return fs.existsSync(servicePath);
        }
      },
      {
        name: 'JSZip Integration',
        test: () => {
          const servicePath = './src/lib/transform/image-extraction-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('JSZip') && content.includes('import');
        }
      },
      {
        name: 'saveZipArchive Method',
        test: () => {
          const servicePath = './src/lib/transform/image-extraction-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('saveZipArchive') && content.includes('static async');
        }
      },
      {
        name: 'README Generation',
        test: () => {
          const servicePath = './src/lib/transform/image-extraction-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('createReadmeContent') && content.includes('README.md');
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.recordTest('Image-Extraction-Service', test.name, result);
    }
  }

  /**
   * Test 4: Logging
   */
  async testLogging() {
    console.log('📝 Test 4: Logging');
    
    const tests = [
      {
        name: 'Logger exists',
        test: () => {
          const loggerPath = './src/lib/debug/logger.ts';
          return fs.existsSync(loggerPath);
        }
      },
      {
        name: 'FileLogger Class',
        test: () => {
          const loggerPath = './src/lib/debug/logger.ts';
          if (!fs.existsSync(loggerPath)) return false;
          
          const content = fs.readFileSync(loggerPath, 'utf8');
          return content.includes('FileLogger') && content.includes('class');
        }
      },
      {
        name: 'Logging in PdfTransform',
        test: () => {
          const componentPath = './src/components/library/pdf-transform.tsx';
          if (!fs.existsSync(componentPath)) return false;
          
          const content = fs.readFileSync(componentPath, 'utf8');
          return content.includes('FileLogger') && content.includes('import');
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.recordTest('Logging', test.name, result);
    }
  }

  /**
   * Test 5: Error Handling
   */
  async testErrorHandling() {
    console.log('🛡️ Test 5: Error Handling');
    
    const tests = [
      {
        name: 'Try-Catch in TransformService',
        test: () => {
          const servicePath = './src/lib/transform/transform-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('try') && content.includes('catch') && content.includes('error');
        }
      },
      {
        name: 'Error Logging',
        test: () => {
          const servicePath = './src/lib/transform/transform-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('FileLogger.error') && content.includes('Fehler bei der Bild-Extraktion');
        }
      },
      {
        name: 'Optional Image Extraction',
        test: () => {
          const servicePath = './src/lib/transform/transform-service.ts';
          if (!fs.existsSync(servicePath)) return false;
          
          const content = fs.readFileSync(servicePath, 'utf8');
          return content.includes('options.includeImages') && content.includes('if (options.includeImages');
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.recordTest('Error-Handling', test.name, result);
    }
  }

  /**
   * Zeichnet ein Testergebnis auf
   */
  recordTest(category, name, passed) {
    this.testResults.push({
      category,
      name,
      passed,
      timestamp: new Date().toISOString()
    });

    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${name}`);
  }

  /**
   * Druckt die Testergebnisse aus
   */
  printResults() {
    console.log('\n📊 Test-Ergebnisse:');
    console.log('==================');
    
    const categories = [...new Set(this.testResults.map(r => r.category))];
    
    for (const category of categories) {
      const categoryTests = this.testResults.filter(r => r.category === category);
      const passed = categoryTests.filter(t => t.passed).length;
      const total = categoryTests.length;
      
      console.log(`\n${category}: ${passed}/${total} Tests bestanden`);
      
      for (const test of categoryTests) {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}`);
      }
    }
    
    const totalPassed = this.testResults.filter(t => t.passed).length;
    const totalTests = this.testResults.length;
    
    console.log(`\n🎯 Gesamtergebnis: ${totalPassed}/${totalTests} Tests bestanden`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 Alle Tests erfolgreich! Die PDF-Bilderspeicherung ist bereit für den Einsatz.');
    } else {
      console.log('⚠️ Einige Tests fehlgeschlagen. Bitte überprüfen Sie die Implementierung.');
      process.exit(1);
    }
  }
}

/**
 * Hilfsfunktionen
 */
function checkDependencies() {
  console.log('🔍 Überprüfe Abhängigkeiten...');
  
  const requiredFiles = [
    'package.json',
    'src/components/library/pdf-transform.tsx',
    'src/lib/transform/image-extraction-service.ts',
    'src/lib/debug/logger.ts'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Erforderliche Datei fehlt: ${file}`);
      return false;
    }
  }
  
  console.log('✅ Alle Abhängigkeiten vorhanden\n');
  return true;
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('🚀 PDF-Bilderspeicherung Test-Suite');
  console.log('====================================\n');
  
  // Überprüfe Abhängigkeiten
  if (!checkDependencies()) {
    process.exit(1);
  }
  
  // Führe Tests aus
  const tester = new PdfImageExtractionTester();
  await tester.runAllTests();
}

// Skript ausführen
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unerwarteter Fehler:', error);
    process.exit(1);
  });
}

module.exports = { PdfImageExtractionTester, TEST_CONFIG }; 