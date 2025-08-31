const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './public_html/api/.env' });

const app = express();
const PORT = 4000;

console.log('🔧 Iniciando servidor proxy API...');
console.log('📍 Puerto:', PORT);

// 📡 MIDDLEWARE MANUAL PARA CORS (doble capa de protección)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl} - Origen: ${req.headers.origin || 'desconocido'}` );

  // Headers manuales
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 1 día

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    console.log(`✈️ Preflight OPTIONS manejado para ruta: ${req.originalUrl} - Origen: ${req.headers.origin}`);
    res.status(200).send();
    return;
  }

  next();
});

app.use(express.json());

// 📊 SUPABASE CLIENT
const supabaseClient = axios.create({
  baseURL: process.env.SUPABASE_REST_URL,
  headers: {
    'apikey': process.env.SUPABASE_ANON_PUBLIC,
    'Authorization': `Bearer ${process.env.SUPABASE_ANON_PUBLIC}`,
    'Content-Type': 'application/json'
  }
});

// 🏠 ROOT ENDPOINT
app.get('/', (req, res) => {
  console.log('🏠 Accediendo a raíz de API');
  res.json({
    success: true,
    message: '🚀 API de Gestión de Materias Primas - FUNCIONANDO',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      'GET /': 'Esta información',
      'GET /health': 'Estado del servidor',
      'GET /test-cors': 'Test de CORS',
      'GET /raw-materials': 'Lista de materiales',
      'POST /raw-materials': 'Crear nueva materia prima',
      'GET /raw-materials/:id': 'Obtener material por ID',
      'PUT /raw-materials/:id': 'Actualizar material',
      'PATCH /raw-materials/:id/disable': 'Habilitar/deshabilitar material',
      'DELETE /raw-materials/:id': 'Eliminar material',
      'GET /raw-materials/:id/entries': 'Obtener entradas de inventario',
      'POST /raw-materials/:id/entries': 'Crear entrada/salida de inventario',
      'GET /products': 'Lista de productos',
      'POST /products': 'Crear nuevo producto',
      'GET /products/:id': 'Obtener producto por ID',
      'PUT /products/:id': 'Actualizar producto',
      'PATCH /products/:id/disable': 'Habilitar/deshabilitar producto',
      'DELETE /products/:id': 'Eliminar producto',
      'GET /products/:id/formula': 'Obtener fórmula del producto',
      'POST /products/:id/formula': 'Agregar ingrediente a fórmula',
      'PUT /products/:id/formula/:rawMaterialId': 'Actualizar ingrediente de fórmula',
      'DELETE /products/:id/formula/:rawMaterialId': 'Eliminar ingrediente de fórmula',
      'GET /products/:id/with-formula': 'Obtener producto completo con fórmula'
    },
    cors_enabled: true,
    all_origins_accepted: true
  });
});

// 🩺 HEALTH CHECK
app.get('/health', (req, res) => {
  console.log('🩺 Health check solicitado');
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      cors: 'enabled',
      supabase: !!process.env.SUPABASE_REST_URL ? 'conected' : 'verify config'
    }
  });
});

// 🧪 TEST CORS ENDPOINT
app.get('/test-cors', (req, res) => {
  console.log('🧪 Test de CORS ejecutado');
  res.json({
    success: true,
    message: 'CORS funcionando correctamente ✅',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// 📋 GET MATERIALES
app.get('/raw-materials', async (req, res) => {
  try {
    console.log('📊 Petición GET /raw-materials');
    console.log('  Query params:', req.query);

    const params = req.query;
    const showInactive = params.inactive === 'true';

    let query = 'order=created_at.desc';

    if (params.options !== 'false') {
      query = 'select=*&' + query;
    }

    console.log('  Supabase query:', query);

    const response = await supabaseClient.get(`raw_materials?${query}`);

    console.log('  Supabase response:', response.data.length, 'materiales encontrados');
    
    // LOG DETALLADO: Mostrar stocks de materias primas
    response.data.forEach(material => {
      console.log(`    📦 RAW-MATERIALS: ${material.name} - Stock: ${material.current_stock} ${material.unit}`);
    });

    let materials = response.data || [];

    if (!showInactive) {
      materials = materials.filter((item) => item.is_active !== false);
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: Array.isArray(materials) ? materials : [],
      count: Array.isArray(materials) ? materials.length : 0,
      timestamp: new Date().toISOString(),
      origin: req.headers.origin || 'none',
      cors_working: true
    });

    console.log('  ✅ Respuesta enviada correctamente');

  } catch (error) {
    console.error('❌ Error obteniendo materiales:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo materiales primas',
      error: error.message,
      type: 'database_error',
      cors_working: true
    });
  }
});

// 📦 POST MATERIALES
app.post('/raw-materials', async (req, res) => {
  try {
    console.log('➕ Creando material prima:', req.body.name);

    const { name, code, unit, min_stock, max_stock, location, supplier } = req.body;
    const current_stock = req.body.current_stock || 0;
    const is_active = req.body.is_active !== false;

    const response = await supabaseClient.post('raw_materials', {
      name, code, unit, current_stock, min_stock, max_stock, location, supplier, is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log('  ✅ Material creado en Supabase');

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(201).json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Material prima creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando material:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error creando material prima',
      error: error.message
    });
  }
});

// 📋 GET MATERIAL POR ID
app.get('/raw-materials/:id', async (req, res) => {
  try {
    console.log('📊 Obteniendo material por ID:', req.params.id);

    const response = await supabaseClient.get(`raw_materials?id=eq.${req.params.id}`);

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Material prima no encontrado' });
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo material:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo material prima',
      error: error.message
    });
  }
});

// ✏️ PUT MATERIAL
app.put('/raw-materials/:id', async (req, res) => {
  try {
    console.log('✏️ Actualizando material:', req.params.id);

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const response = await supabaseClient.patch(`raw_materials?id=eq.${req.params.id}`, updates);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Material prima actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando material:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error actualizando material prima',
      error: error.message
    });
  }
});

// 🔄 PATCH DISABLE MATERIAL
app.patch('/raw-materials/:id/disable', async (req, res) => {
  try {
    console.log('🔄 Cambiando estado material:', req.params.id);

    const response = await supabaseClient.patch(`raw_materials?id=eq.${req.params.id}`, {
      is_active: req.body.is_active,
      updated_at: new Date().toISOString()
    });

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Estado del material prima modificado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error cambiando estado material:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error cambiando estado del material prima',
      error: error.message
    });
  }
});

// 🗑️ DELETE MATERIAL
app.delete('/raw-materials/:id', async (req, res) => {
  try {
    console.log('🗑️ Eliminando material:', req.params.id);

    await supabaseClient.delete(`raw_materials?id=eq.${req.params.id}`);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      message: 'Material prima eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando material:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error eliminando material prima',
      error: error.message
    });
  }
});

// 📊 GET ENTRADAS DE MATERIAL
app.get('/raw-materials/:id/entries', async (req, res) => {
  try {
    console.log('📊 Obteniendo entradas para material:', req.params.id);

    let query = `raw_material_id=eq.${req.params.id}&order=created_at.desc`;

    if (req.query.type === 'in' || req.query.type === 'out') {
      query += `&entry_type=eq.${req.query.type}`;
    }

    const response = await supabaseClient.get(`inventory_entries?${query}`);
    const entries = response.data || [];

    console.log('  📊 API respuesta cruda:', response.data);
    console.log('  📊 Entradas parseadas:', Array.isArray(entries) ? entries.length : 'no array', 'items');
    if (Array.isArray(entries) && entries.length > 0) {
      console.log('  📊 Primera entrada muestra:', JSON.stringify(entries[0], null, 2));
    }
    console.log('  📊 Query usada:', query);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: entries,
      count: entries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo entradas:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo entradas de inventario',
      error: error.message
    });
  }
});

// 🔄 POST RECALCULAR TODOS LOS STOCKS
app.post('/raw-materials/recalculate-stocks', async (req, res) => {
  try {
    console.log('🔄 Recalculando todos los stocks...');

    // Obtener todas las materias primas
    const materialsResponse = await supabaseClient.get('raw_materials');
    const materials = materialsResponse.data || [];

    console.log('📦 Materiales a recalcular:', materials.length);

    // Recalcular stock para cada material
    for (const material of materials) {
      try {
        // Obtener todas las entradas de este material
        const entriesResponse = await supabaseClient.get(`inventory_entries?raw_material_id=eq.${material.id}`);
        const entries = entriesResponse.data || [];

        // Calcular stock actual
        let calculatedStock = 0;
        entries.forEach(entry => {
          if (entry.entry_type === 'in') {
            calculatedStock += entry.quantity;
          } else if (entry.entry_type === 'out') {
            calculatedStock -= entry.quantity;
          }
        });

        // Asegurar que no sea negativo
        calculatedStock = Math.max(0, calculatedStock);

        // Actualizar el stock en la base de datos
        await supabaseClient.patch(`raw_materials?id=eq.${material.id}`, {
          current_stock: calculatedStock,
          updated_at: new Date().toISOString()
        });

        console.log(`✅ ${material.name}: ${material.current_stock} → ${calculatedStock} ${material.unit}`);

      } catch (materialError) {
        console.error(`❌ Error recalculando ${material.name}:`, materialError.message);
      }
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      message: `Stocks recalculados para ${materials.length} materiales`,
      timestamp: new Date().toISOString()
    });

    console.log('🎉 Recálculo de stocks completado');

  } catch (error) {
    console.error('❌ Error recalculando stocks:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error recalculando stocks',
      error: error.message
    });
  }
});

// 📦 POST ENTRADA PARA MATERIAL
app.post('/raw-materials/:id/entries', async (req, res) => {
  try {
    console.log('➕ Creando entrada para material:', req.params.id);

    const { quantity, entry_type, notes, movement_date } = req.body;

    if (!quantity || !['in', 'out'].includes(entry_type)) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos: quantity y entry_type requeridos'
      });
    }

    const response = await supabaseClient.post('inventory_entries', {
      raw_material_id: req.params.id,
      quantity, entry_type,
      notes: notes || null,
      movement_date: movement_date || new Date().toISOString()
    });

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(201).json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Entrada de inventario creada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando entrada:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error creando entrada de inventario',
      error: error.message
    });
  }
});

// =========================================
// RUTAS PARA PRODUCTOS
// =========================================

// 📋 GET PRODUCTOS
app.get('/products', async (req, res) => {
  try {
    console.log('📊 Petición GET /products');
    console.log('  Query params:', req.query);

    const params = req.query;
    const showInactive = params.inactive === 'true';

    let query = 'order=created_at.desc';

    console.log('  Supabase query:', query);

    const response = await supabaseClient.get(`products?${query}`);

    console.log('  Supabase response:', response.data.length, 'productos encontrados');

    let products = response.data || [];

    if (!showInactive) {
      products = products.filter((item) => item.is_active !== false);
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: Array.isArray(products) ? products : [],
      count: Array.isArray(products) ? products.length : 0,
      timestamp: new Date().toISOString(),
      origin: req.headers.origin || 'none',
      cors_working: true
    });

    console.log('  ✅ Respuesta enviada correctamente');

  } catch (error) {
    console.error('❌ Error obteniendo productos:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo productos',
      error: error.message,
      type: 'database_error',
      cors_working: true
    });
  }
});

// 📦 POST PRODUCTOS
app.post('/products', async (req, res) => {
  try {
    console.log('➕ Creando producto:', req.body.name);

    const { name, description, unit, base_quantity } = req.body;

    // Validaciones básicas
    if (!name || !unit || !base_quantity) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos: name, unit y base_quantity son requeridos'
      });
    }

    const response = await supabaseClient.post('products', {
      name, 
      description: description || null, 
      unit, 
      base_quantity: parseFloat(base_quantity),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log('  ✅ Producto creado en Supabase');

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(201).json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Producto creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando producto:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error creando producto',
      error: error.message
    });
  }
});

// 📋 GET PRODUCTO POR ID
app.get('/products/:id', async (req, res) => {
  try {
    console.log('📊 Obteniendo producto por ID:', req.params.id);

    const response = await supabaseClient.get(`products?id=eq.${req.params.id}`);

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo producto:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto',
      error: error.message
    });
  }
});

// ✏️ PUT PRODUCTO
app.put('/products/:id', async (req, res) => {
  try {
    console.log('✏️ Actualizando producto:', req.params.id);

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const response = await supabaseClient.patch(`products?id=eq.${req.params.id}`, updates);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Producto actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando producto:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error actualizando producto',
      error: error.message
    });
  }
});

// 🔄 PATCH DISABLE PRODUCTO
app.patch('/products/:id/disable', async (req, res) => {
  try {
    console.log('🔄 Cambiando estado producto:', req.params.id);

    const response = await supabaseClient.patch(`products?id=eq.${req.params.id}`, {
      is_active: req.body.is_active,
      updated_at: new Date().toISOString()
    });

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Estado del producto modificado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error cambiando estado producto:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error cambiando estado del producto',
      error: error.message
    });
  }
});

// 🗑️ DELETE PRODUCTO
app.delete('/products/:id', async (req, res) => {
  try {
    console.log('🗑️ Eliminando producto:', req.params.id);

    await supabaseClient.delete(`products?id=eq.${req.params.id}`);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando producto:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error eliminando producto',
      error: error.message
    });
  }
});

// 📊 GET FÓRMULA DE PRODUCTO
app.get('/products/:id/formula', async (req, res) => {
  try {
    console.log('📊 Obteniendo fórmula para producto:', req.params.id);

    // Obtener fórmula básica - IGUAL QUE MATERIAS PRIMAS
    const formulaResponse = await supabaseClient.get(`product_formulas?product_id=eq.${req.params.id}`);
    const formulaData = formulaResponse.data || [];

    console.log('  📊 Fórmula básica obtenida:', formulaData.length, 'items');

    // Obtener todas las materias primas - USANDO EL MISMO MÉTODO QUE FUNCIONA
    const materialsResponse = await supabaseClient.get(`raw_materials?order=created_at.desc`);
    const allMaterials = materialsResponse.data || [];

    console.log('  📦 Materias primas obtenidas:', allMaterials.length, 'materiales');
    
    // LOG DETALLADO: Mostrar todas las materias primas con sus stocks
    allMaterials.forEach(material => {
      console.log(`    📦 Material: ${material.name} (ID: ${material.id}) - Stock: ${material.current_stock} ${material.unit}`);
    });
    
    // LOG DETALLADO: Mostrar todos los items de fórmula
    formulaData.forEach(item => {
      console.log(`    📋 Fórmula item: raw_material_id=${item.raw_material_id}, quantity=${item.quantity}`);
    });

    // Combinar datos de fórmula con materias primas
    const formula = formulaData.map(item => {
      const material = allMaterials.find(m => m.id === item.raw_material_id);
      
      if (material) {
        console.log(`  🔗 Material encontrado: ${material.name} - Stock: ${material.current_stock} ${material.unit}`);
        return {
          id: item.id,
          product_id: item.product_id,
          raw_material_id: material.id,
          raw_material_name: material.name,
          raw_material_code: material.code,
          raw_material_unit: material.unit,
          raw_material_current_stock: material.current_stock,
          raw_material_is_active: material.is_active,
          quantity: item.quantity,
          created_at: item.created_at,
          // Agregar referencia completa para compatibilidad
          raw_material: material
        };
      } else {
        console.log(`  ⚠️ Material no encontrado: ${item.raw_material_id}`);
        return {
          id: item.id,
          product_id: item.product_id,
          raw_material_id: item.raw_material_id,
          raw_material_name: 'Material no encontrado',
          raw_material_code: '',
          raw_material_unit: 'unidad',
          raw_material_current_stock: 0,
          raw_material_is_active: false,
          quantity: item.quantity,
          created_at: item.created_at,
          raw_material: null
        };
      }
    });

    console.log('  📊 Fórmula encontrada:', formula.length, 'ingredientes');
    if (formula.length > 0) {
      console.log('  📊 Primer ingrediente:', formula[0].raw_material_name, 'stock:', formula[0].raw_material_current_stock);
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: formula,
      count: formula.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo fórmula:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo fórmula del producto',
      error: error.message
    });
  }
});

// 📦 POST AGREGAR INGREDIENTE A FÓRMULA
app.post('/products/:id/formula', async (req, res) => {
  try {
    console.log('➕ Agregando ingrediente a fórmula del producto:', req.params.id);
    console.log('📊 Datos recibidos:', JSON.stringify(req.body, null, 2));

    const { raw_material_id, quantity } = req.body;

    if (!raw_material_id || !quantity) {
      console.log('❌ Datos inválidos - raw_material_id:', raw_material_id, 'quantity:', quantity);
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos: raw_material_id y quantity son requeridos'
      });
    }

    // Mantener raw_material_id como string UUID, no convertir a integer
    const formulaData = {
      product_id: req.params.id,
      raw_material_id: raw_material_id, // Mantener como string UUID
      quantity: parseFloat(quantity)
      // Note: created_at is handled by database default, no updated_at column exists
    };

    console.log('📊 Datos a enviar a Supabase:', JSON.stringify(formulaData, null, 2));

    console.log('🚀 Enviando datos a Supabase...');

    try {
      const response = await supabaseClient.post('product_formulas', formulaData);
      console.log('✅ Respuesta de Supabase:', response.status, JSON.stringify(response.data, null, 2));

      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      res.status(201).json({
        success: true,
        data: response.data[0] || response.data,
        message: 'Ingrediente agregado a la fórmula exitosamente'
      });

    } catch (supabaseError) {
      console.error('❌ Error de Supabase:', supabaseError.response?.status, supabaseError.response?.data);
      console.error('❌ Detalles del error:', supabaseError.message);

      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      res.status(500).json({
        success: false,
        message: 'Error agregando ingrediente a la fórmula',
        error: supabaseError.message,
        supabase_error: supabaseError.response?.data || 'No additional details'
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error agregando ingrediente a la fórmula',
      error: error.message
    });
  }
});

// ✏️ PUT ACTUALIZAR INGREDIENTE DE FÓRMULA
app.put('/products/:id/formula/:rawMaterialId', async (req, res) => {
  try {
    console.log('✏️ Actualizando ingrediente de fórmula:', req.params.rawMaterialId);

    const { quantity } = req.body;

    const response = await supabaseClient.patch(
      `product_formulas?product_id=eq.${req.params.id}&raw_material_id=eq.${req.params.rawMaterialId}`,
      {
        quantity: parseFloat(quantity)
        // Note: product_formulas table doesn't have updated_at column
      }
    );

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Ingrediente de fórmula actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando ingrediente:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error actualizando ingrediente de fórmula',
      error: error.message
    });
  }
});

// 🗑️ DELETE INGREDIENTE DE FÓRMULA
app.delete('/products/:id/formula/:rawMaterialId', async (req, res) => {
  try {
    console.log('🗑️ Eliminando ingrediente de fórmula:', req.params.rawMaterialId);

    await supabaseClient.delete(
      `product_formulas?product_id=eq.${req.params.id}&raw_material_id=eq.${req.params.rawMaterialId}`
    );

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      message: 'Ingrediente eliminado de la fórmula exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando ingrediente:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error eliminando ingrediente de fórmula',
      error: error.message
    });
  }
});

// 📊 GET PRODUCTO CON FÓRMULA COMPLETA
app.get('/products/:id/with-formula', async (req, res) => {
  try {
    console.log('📊 Obteniendo producto completo con fórmula:', req.params.id);

    // Obtener producto
    const productResponse = await supabaseClient.get(`products?id=eq.${req.params.id}`);
    
    if (!productResponse.data || productResponse.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Obtener fórmula básica - IGUAL QUE EN LA OTRA RUTA
    const formulaResponse = await supabaseClient.get(`product_formulas?product_id=eq.${req.params.id}`);
    const formulaData = formulaResponse.data || [];

    // Obtener todas las materias primas - USANDO EL MISMO MÉTODO
    const materialsResponse = await supabaseClient.get(`raw_materials?order=created_at.desc`);
    const allMaterials = materialsResponse.data || [];

    // Combinar datos
    const formula = formulaData.map(item => {
      const material = allMaterials.find(m => m.id === item.raw_material_id);
      
      if (material) {
        return {
          id: item.id,
          product_id: item.product_id,
          raw_material_id: material.id,
          raw_material_name: material.name,
          raw_material_code: material.code,
          raw_material_unit: material.unit,
          raw_material_current_stock: material.current_stock,
          raw_material_is_active: material.is_active,
          quantity: item.quantity,
          created_at: item.created_at,
          raw_material: material
        };
      } else {
        return {
          id: item.id,
          product_id: item.product_id,
          raw_material_id: item.raw_material_id,
          raw_material_name: 'Material no encontrado',
          raw_material_code: '',
          raw_material_unit: 'unidad',
          raw_material_current_stock: 0,
          raw_material_is_active: false,
          quantity: item.quantity,
          created_at: item.created_at,
          raw_material: null
        };
      }
    });
    
    const productWithFormula = {
      ...productResponse.data[0],
      formula: formula
    };

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: productWithFormula
    });

  } catch (error) {
    console.error('❌ Error obteniendo producto con fórmula:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto con fórmula',
      error: error.message
    });
  }
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log('=======================================');
  console.log('🚀 SERVIDOR API COMPLETO FUNCIONANDO');
  console.log('=======================================');
  console.log();
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('🔓 CORS: HABILITADO PARA TODOS LOS ORIGINS');
  console.log('💾 Supabase: CONECTADO Y LISTO');
  console.log();
  console.log('🎯 ENDPOINTS IMPLEMENTADOS:');
  console.log('   ✅ POST /raw-materials → Crear material');
  console.log('   ✅ GET /raw-materials → Lista materiales');
  console.log('   ✅ GET /raw-materials/:id → Material por ID');
  console.log('   ✅ PUT /raw-materials/:id → Actualizar material');
  console.log('   ✅ PATCH /raw-materials/:id/disable → Cambiar estado');
  console.log('   ✅ DELETE /raw-materials/:id → Eliminar material');
  console.log('   ✅ GET /raw-materials/:id/entries → Historial entradas');
  console.log('   ✅ POST /raw-materials/:id/entries → Crear entrada');
  console.log();
  console.log('🎯 PRODUCTOS ENDPOINTS:');
  console.log('   ✅ GET /products → Lista productos');
  console.log('   ✅ POST /products → Crear producto');
  console.log('   ✅ GET /products/:id → Producto por ID');
  console.log('   ✅ PUT /products/:id → Actualizar producto');
  console.log('   ✅ PATCH /products/:id/disable → Cambiar estado');
  console.log('   ✅ DELETE /products/:id → Eliminar producto');
  console.log('   ✅ GET /products/:id/formula → Fórmula del producto');
  console.log('   ✅ POST /products/:id/formula → Agregar ingrediente');
  console.log('   ✅ PUT /products/:id/formula/:rawMaterialId → Actualizar ingrediente');
  console.log('   ✅ DELETE /products/:id/formula/:rawMaterialId → Eliminar ingrediente');
  console.log('   ✅ GET /products/:id/with-formula → Producto completo');
  console.log();
  console.log('📱 Frontend listo en: http://localhost:5174');
  console.log('🛡️ CORS headers aplicados a todas las respuestas');
  console.log('🔥 ¡YA PUEDES CREAR PRODUCTOS Y FÓRMULAS!');
});

module.exports = app;
