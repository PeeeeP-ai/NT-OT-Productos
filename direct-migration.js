const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'public_html/api/.env') });

async function runDirectMigration() {
  try {
    console.log('🚀 Ejecutando migración directa 006: Sistema de análisis de productos...');

    // Crear cliente Supabase
    const supabaseUrl = process.env.SUPABASE_REST_URL;
    const supabaseKey = process.env.SUPABASE_ANON_PUBLIC;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no encontradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'supabase-migrations/006_create_product_analyses_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migración cargada, ejecutando...');

    // Ejecutar la migración usando el cliente Supabase directamente
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Error en migración:', error);
      return;
    }

    console.log('✅ Migración ejecutada exitosamente');
    console.log('📊 Resultado:', data);

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
  }
}

runDirectMigration();
