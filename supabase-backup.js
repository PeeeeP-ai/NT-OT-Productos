const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration from .env
const supabaseUrl = 'https://mheygelvprzkjjbrkzil.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXlnZWx2cHJ6a2pqYnJremlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI3Njc0MywiZXhwIjoyMDcwODUyNzQzfQ.Ncy9ZGmth-Z9Rffgw9DFJ28ozFJoKFvRSKpeKhJCYes';

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

class SupabaseBackup {
  constructor() {
    this.backupData = {
      timestamp: new Date().toISOString(),
      database: 'supabase',
      schema: {},
      data: {},
      migrations: []
    };

    // Known tables from the project structure
    this.knownTables = [
      'raw_materials',
      'products',
      'product_formulas',
      'formula_items',
      'work_orders',
      'work_order_analyses',
      'inventory_entries',
      'product_analyses'
    ];
  }

  async run() {
    console.log('🚀 Starting Supabase backup...');

    try {
      await this.loadMigrations();
      await this.extractData();
      await this.extractSchemaInfo();

      this.saveBackup();
      console.log('✅ Backup completed successfully!');
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  async loadMigrations() {
    console.log('� Loading migration files...');

    const migrationsDir = path.join(__dirname, 'supabase-migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      this.backupData.migrations.push({
        filename: file,
        content: content
      });
    }

    console.log(`Loaded ${this.backupData.migrations.length} migration files`);
  }

  async extractData() {
    console.log('📊 Extracting table data...');

    for (const tableName of this.knownTables) {
      console.log(`  Extracting data from ${tableName}...`);

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.warn(`Warning: Could not extract data from ${tableName}:`, error.message);
          this.backupData.data[tableName] = [];
        } else {
          this.backupData.data[tableName] = data || [];
          console.log(`    Found ${data?.length || 0} records in ${tableName}`);
        }
      } catch (err) {
        console.warn(`Error extracting data from ${tableName}:`, err.message);
        this.backupData.data[tableName] = [];
      }
    }
  }

  async extractSchemaInfo() {
    console.log('� Extracting schema information...');

    // Store migration files as schema
    this.backupData.schema = {
      migrations: this.backupData.migrations,
      tables: this.knownTables
    };
  }

  saveBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `supabase-backup-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(this.backupData, null, 2));
    console.log(`💾 Backup saved to ${filename}`);

    // Also create a SQL dump file
    this.createSQLDump(filename.replace('.json', '.sql'));
  }

  createSQLDump(jsonFilename) {
    const sqlFilename = jsonFilename.replace('.json', '.sql');
    let sql = `-- Supabase Database Dump\n-- Generated on ${new Date().toISOString()}\n\n`;

    // Migrations (Schema)
    sql += '-- Schema Migrations\n';
    this.backupData.migrations.forEach(migration => {
      sql += `-- Migration: ${migration.filename}\n`;
      sql += `${migration.content}\n\n`;
    });

    // Data
    sql += '-- Data\n';
    Object.keys(this.backupData.data).forEach(tableName => {
      const data = this.backupData.data[tableName];
      if (data && data.length > 0) {
        sql += `-- Data for table: ${tableName}\n`;
        data.forEach(row => {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return val;
          });
          sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        sql += '\n';
      }
    });

    fs.writeFileSync(sqlFilename, sql);
    console.log(`💾 SQL dump saved to ${sqlFilename}`);
  }
}

// Run the backup
const backup = new SupabaseBackup();
backup.run().catch(console.error);
