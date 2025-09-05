const fs = require('fs');
const path = require('path');

function showMigration() {
  try {
    console.log('📄 Mostrando contenido de la migración 006...');
    console.log('='.repeat(60));
    console.log('COPIA Y PEGA ESTE SQL EN EL SQL EDITOR DE SUPABASE:');
    console.log('='.repeat(60));
    console.log('');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'supabase-migrations/006_create_product_analyses_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(migrationSQL);
    console.log('');
    console.log('='.repeat(60));
    console.log('INSTRUCCIONES:');
    console.log('1. Ve a tu proyecto de Supabase');
    console.log('2. Abre el SQL Editor');
    console.log('3. Copia y pega el SQL de arriba');
    console.log('4. Ejecuta la consulta');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error leyendo migración:', error);
  }
}

showMigration();
