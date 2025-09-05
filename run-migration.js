const fs = require('fs');
const path = require('path');

// Leer variables de entorno
require('dotenv').config({ path: path.join(__dirname, 'public_html/api/.env') });

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración 006: Sistema de análisis de productos...');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'supabase-migrations/006_create_product_analyses_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migración cargada, ejecutando...');

    // Ejecutar la migración usando el endpoint /execute-sql del servidor proxy
    const response = await fetch('http://localhost:4000/execute-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error en migración:', result);
      return;
    }

    console.log('✅ Migración ejecutada exitosamente');
    console.log('📊 Resultado:', result);

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
  }
}

runMigration();
