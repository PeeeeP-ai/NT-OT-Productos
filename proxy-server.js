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
  console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl} - Origen: ${req.headers.origin || 'desconocido'}`);
  console.log(`📡 [${timestamp}] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📡 [${timestamp}] Content-Type: ${req.headers['content-type']}`);
  console.log(`📡 [${timestamp}] Content-Length: ${req.headers['content-length']}`);

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

// Middleware adicional para logging de requests POST
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`📝 [${new Date().toISOString()}] POST REQUEST DETECTED: ${req.originalUrl}`);
    console.log(`📝 [${new Date().toISOString()}] POST Headers:`, JSON.stringify(req.headers, null, 2));

    // Interceptar el body si existe
    let originalSend = res.send;
    let originalJson = res.json;

    res.send = function(body) {
      console.log(`📤 [${new Date().toISOString()}] RESPONSE for ${req.originalUrl}:`, body);
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      console.log(`📤 [${new Date().toISOString()}] JSON RESPONSE for ${req.originalUrl}:`, JSON.stringify(body, null, 2));
      return originalJson.call(this, body);
    };
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

// =========================================
// RUTAS PARA ÓRDENES DE TRABAJO
// =========================================

// 📋 GET ÓRDENES DE TRABAJO
app.get('/work-orders', async (req, res) => {
  try {
    console.log('📊 Petición GET /work-orders');
    console.log('  Query params:', req.query);

    const params = req.query;
    let query = 'order=created_at.desc&limit=100';

    if (params.status) {
      query += `&status=eq.${params.status}`;
    }

    console.log('  Supabase query:', query);

    const response = await supabaseClient.get(`work_orders?${query}`);

    console.log('  Supabase response:', response.data.length, 'órdenes de trabajo encontradas');

    let workOrders = response.data || [];

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: Array.isArray(workOrders) ? workOrders : [],
      count: Array.isArray(workOrders) ? workOrders.length : 0,
      timestamp: new Date().toISOString(),
      origin: req.headers.origin || 'none',
      cors_working: true
    });

    console.log('  ✅ Respuesta enviada correctamente');

  } catch (error) {
    console.error('❌ Error obteniendo órdenes de trabajo:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo órdenes de trabajo',
      error: error.message,
      type: 'database_error',
      cors_working: true
    });
  }
});

// 📦 POST ÓRDENES DE TRABAJO
app.post('/work-orders', async (req, res) => {
  try {
    console.log('➕ Creando orden de trabajo');
    console.log('📊 Headers recibidos:', JSON.stringify(req.headers, null, 2));
    console.log('📊 Body recibido:', JSON.stringify(req.body, null, 2));
    console.log('📊 Content-Type:', req.headers['content-type']);

    const { description, priority, planned_start_date, planned_end_date, notes, items } = req.body;

    console.log('📋 Datos parseados:');
    console.log('  - description:', description);
    console.log('  - priority:', priority);
    console.log('  - planned_start_date:', planned_start_date);
    console.log('  - planned_end_date:', planned_end_date);
    console.log('  - notes:', notes);
    console.log('  - items:', JSON.stringify(items, null, 2));

    // Generar número de orden automáticamente
    console.log('🔢 Generando número de orden...');

    let orderNumber;
    try {
      const orderNumberResponse = await supabaseClient.post('rpc/generate_work_order_number');
      console.log('🔢 Respuesta de generación de número:', JSON.stringify(orderNumberResponse.data, null, 2));
      orderNumber = orderNumberResponse.data;
    } catch (rpcError) {
      console.warn('⚠️ Función RPC no disponible, generando número manualmente:', rpcError.message);
      // Fallback: generar número basado en timestamp
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      orderNumber = `OT-${new Date().getFullYear()}-${timestamp.toString().slice(-4)}${random.toString().padStart(3, '0')}`;
    }

    console.log('🔢 Número de orden generado:', orderNumber);

    // Crear la orden de trabajo
    const workOrderData = {
      order_number: orderNumber,
      description: description || null,
      priority: priority || 'normal',
      planned_start_date: planned_start_date || null,
      planned_end_date: planned_end_date || null,
      notes: notes || null,
      status: 'pending',
      created_by: 'Sistema',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📊 Creando orden de trabajo con datos:', JSON.stringify(workOrderData, null, 2));

    const workOrderResponse = await supabaseClient.post('work_orders', workOrderData);

    console.log('📊 Respuesta completa de Supabase:', {
      status: workOrderResponse.status,
      statusText: workOrderResponse.statusText,
      headers: workOrderResponse.headers,
      data: workOrderResponse.data
    });
    console.log('📊 Respuesta de creación de OT:', JSON.stringify(workOrderResponse.data, null, 2));

    // Supabase sometimes returns empty response body but still creates the record successfully
    // Check if the request was successful (status 201) rather than checking response data
    if (workOrderResponse.status !== 201) {
      console.error('❌ Error en la creación de orden de trabajo. Verificando error...');
      console.error('❌ Status:', workOrderResponse.status);
      console.error('❌ StatusText:', workOrderResponse.statusText);
      console.error('❌ Headers:', workOrderResponse.headers);
      console.error('❌ Response data:', workOrderResponse.data);
      throw new Error(`Error al crear orden de trabajo - Status: ${workOrderResponse.status}`);
    }

    // Since Supabase may return empty response, we need to fetch the created work order
    // to get the ID. We'll use the order number to find it.
    console.log('🔍 Buscando orden de trabajo creada...');
    const searchResponse = await supabaseClient.get(`work_orders?order_number=eq.${orderNumber}`);

    if (!searchResponse.data || searchResponse.data.length === 0) {
      console.error('❌ No se pudo encontrar la orden de trabajo creada');
      throw new Error('Orden de trabajo creada pero no encontrada en la base de datos');
    }

    const workOrderId = searchResponse.data[0].id;
    console.log('✅ Orden de trabajo encontrada con ID:', workOrderId);

    // Procesar items si existen
    let createdItems = [];
    if (items && Array.isArray(items)) {
      console.log('📦 Procesando', items.length, 'items...');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`📦 Procesando item ${i + 1}/${items.length}:`, JSON.stringify(item, null, 2));

        const itemData = {
          work_order_id: workOrderId,
          product_id: item.product_id,
          planned_quantity: parseFloat(item.planned_quantity),
          unit: item.unit || 'unidad',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('📦 Datos del item a crear:', JSON.stringify(itemData, null, 2));

        const itemResponse = await supabaseClient.post('work_order_items', itemData);

        console.log('📦 Respuesta de creación de item:', JSON.stringify(itemResponse.data, null, 2));

        if (itemResponse.data && itemResponse.data.length > 0) {
          createdItems.push(itemResponse.data[0]);

          // Calcular consumo planificado basado en fórmula del producto
          try {
            console.log('🔬 Calculando consumo para producto:', item.product_id);
            const consumptionQuery = `select * from calculate_planned_consumption('${item.product_id}', ${item.planned_quantity})`;
            console.log('🔬 Query de consumo:', consumptionQuery);

            const consumptionResponse = await supabaseClient.post('rpc/calculate_planned_consumption', {
              product_id: item.product_id,
              p_quantity: item.planned_quantity
            });

            console.log('🔬 Respuesta de cálculo de consumo:', JSON.stringify(consumptionResponse.data, null, 2));

            const consumptions = consumptionResponse.data || [];

            for (const consumption of consumptions) {
              console.log('🔬 Creando registro de consumo:', JSON.stringify(consumption, null, 2));

              const consumptionData = {
                work_order_item_id: itemResponse.data[0].id,
                raw_material_id: consumption.raw_material_id,
                planned_consumption: parseFloat(consumption.consumption_quantity),
                unit: consumption.unit,
                created_at: new Date().toISOString()
              };

              const consumptionResult = await supabaseClient.post('work_order_consumption', consumptionData);

              console.log('🔬 Consumo creado:', JSON.stringify(consumptionResult.data, null, 2));
            }
          } catch (consumptionError) {
            console.warn('⚠️ Error calculando consumo para producto:', item.product_id, consumptionError.message);
            console.warn('⚠️ Detalles del error:', consumptionError.response?.data);
          }
        } else {
          console.warn('⚠️ No se pudo crear el item:', JSON.stringify(item, null, 2));
        }
      }
    } else {
      console.log('📦 No hay items para procesar');
    }

    // Verificar disponibilidad de materias primas
    let warnings = [];
    try {
      console.log('🔍 Verificando disponibilidad de materias primas...');
      const availabilityQuery = `select * from check_raw_materials_availability('${workOrderId}')`;
      console.log('🔍 Query de disponibilidad:', availabilityQuery);

      const availabilityResponse = await supabaseClient.post('rpc/check_raw_materials_availability', {
        work_order_uuid: workOrderId
      });

      console.log('🔍 Respuesta de verificación de disponibilidad:', JSON.stringify(availabilityResponse.data, null, 2));

      const availabilityData = availabilityResponse.data || [];

      availabilityData.forEach(availability => {
        if (!availability.is_available) {
          const shortage = availability.shortage_quantity;
          warnings.push(`Insuficiente ${availability.raw_material_name}: faltan ${shortage} ${availability.raw_material_name}`);
        }
      });

      console.log('🔍 Advertencias generadas:', warnings.length);
    } catch (availabilityError) {
      console.warn('⚠️ Error verificando disponibilidad:', availabilityError.message);
      console.warn('⚠️ Detalles del error:', availabilityError.response?.data);
    }

    console.log('📤 Preparando respuesta final...');

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    const responseData = {
      success: true,
      data: {
        work_order: searchResponse.data[0],
        items: createdItems,
        warnings: warnings
      },
      message: warnings.length > 0 ? 'Orden de trabajo creada con advertencias' : 'Orden de trabajo creada exitosamente'
    };

    console.log('📤 Respuesta final:', JSON.stringify(responseData, null, 2));

    res.status(201).json(responseData);
    console.log('✅ Respuesta enviada exitosamente');

  } catch (error) {
    console.error('❌ Error creando orden de trabajo:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error completo:', error);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error creando orden de trabajo',
      error: error.message,
      stack: error.stack
    });
  }
});

// 📋 GET ORDEN DE TRABAJO POR ID
app.get('/work-orders/:id', async (req, res) => {
  try {
    console.log('📊 Obteniendo orden de trabajo por ID:', req.params.id);

    // Obtener la orden de trabajo básica
    const workOrderResponse = await supabaseClient.get(`work_orders?id=eq.${req.params.id}`);

    if (!workOrderResponse.data || workOrderResponse.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
    }

    const workOrder = workOrderResponse.data[0];

    // Obtener los items asociados a la orden de trabajo
    const itemsResponse = await supabaseClient.get(`work_order_items?work_order_id=eq.${req.params.id}`);
    const items = itemsResponse.data || [];

    // Para cada item, obtener información del producto
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      try {
        const productResponse = await supabaseClient.get(`products?id=eq.${item.product_id}`);
        const product = productResponse.data && productResponse.data.length > 0 ? productResponse.data[0] : null;

        return {
          ...item,
          product: product
        };
      } catch (productError) {
        console.warn('⚠️ Error obteniendo producto para item:', item.id, productError.message);
        return {
          ...item,
          product: null
        };
      }
    }));

    // Construir respuesta completa
    const completeWorkOrder = {
      ...workOrder,
      items: itemsWithProducts
    };

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: completeWorkOrder
    });

  } catch (error) {
    console.error('❌ Error obteniendo orden de trabajo:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo orden de trabajo',
      error: error.message
    });
  }
});

// 📊 GET DETALLES COMPLETOS DE ORDEN DE TRABAJO
app.get('/work-orders/:id/details', async (req, res) => {
  try {
    console.log('📊 Obteniendo detalles completos de OT:', req.params.id);

    // Use the correct axios RPC call syntax for Supabase
    const response = await supabaseClient.post('rpc/get_work_order_details', {
      work_order_uuid: req.params.id
    });

    console.log('📊 Respuesta RPC:', response.data);

    const result = response.data || [];

    if (!result || result.length === 0) {
      console.log('⚠️ No se encontraron detalles para la OT:', req.params.id);
      return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada o sin detalles' });
    }

    console.log('📊 Procesando', result.length, 'registros de detalles');

    // Organizar los datos por producto
    let workOrderDetails = null;
    const products = {};

    result.forEach((row) => {
      if (!workOrderDetails) {
        // Ensure dates are properly formatted as strings (ignoring timezone)
        const formatDate = function(date) {
          if (!date) return null;

          // If it's already a string in YYYY-MM-DD format, return as-is
          if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
          }

          // Handle Date objects and date strings, ignoring timezone
          try {
            let dateObj;

            if (date instanceof Date) {
              dateObj = date;
            } else if (typeof date === 'string') {
              // Parse date string, assuming it's in YYYY-MM-DD format or ISO format
              dateObj = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
            } else {
              return null;
            }

            if (isNaN(dateObj.getTime())) {
              return null;
            }

            // Get date components in local timezone to avoid timezone shifts
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
          } catch (e) {
            return null;
          }
        };

        workOrderDetails = {
          id: row.work_order_id,
          order_number: row.order_number,
          description: row.work_order_description,
          status: row.work_order_status,
          priority: row.work_order_priority,
          planned_start_date: formatDate(row.planned_start_date),
          planned_end_date: formatDate(row.planned_end_date),
          actual_start_date: formatDate(row.actual_start_date),
          actual_end_date: formatDate(row.actual_end_date),
          created_at: row.work_order_created_at,
          items: []
        };
      }

      const productKey = row.product_id;
      if (!products[productKey]) {
        products[productKey] = {
          id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_unit: row.product_unit,
          product_base_quantity: row.product_base_quantity,
          planned_quantity: row.planned_quantity,
          produced_quantity: row.produced_quantity,
          status: row.item_status,
          formula: []
        };
      }

      if (row.formula_raw_material_id) {
        products[productKey].formula.push({
          raw_material_id: row.formula_raw_material_id,
          raw_material_name: row.raw_material_name,
          raw_material_unit: row.raw_material_unit,
          raw_material_current_stock: row.raw_material_current_stock,
          quantity: row.formula_quantity,
          planned_consumption: row.consumption_planned,
          actual_consumption: row.consumption_actual
        });
      }
    });

    workOrderDetails.items = Object.values(products);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: workOrderDetails
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalles de orden de trabajo:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error obteniendo detalles de orden de trabajo',
      error: error.message
    });
  }
});

// ✏️ PUT ORDEN DE TRABAJO
app.put('/work-orders/:id', async (req, res) => {
  try {
    console.log('✏️ Actualizando orden de trabajo:', req.params.id);
    console.log('📊 Body recibido:', JSON.stringify(req.body, null, 2));

    const workOrderId = req.params.id;
    const { items, ...workOrderUpdates } = req.body;

    // Actualizar la orden de trabajo básica
    const updates = { ...workOrderUpdates, updated_at: new Date().toISOString() };
    console.log('📊 Actualizando work_order con:', JSON.stringify(updates, null, 2));

    const response = await supabaseClient.patch(`work_orders?id=eq.${workOrderId}`, updates);
    console.log('📊 Respuesta de actualización de work_order:', JSON.stringify(response.data, null, 2));

    // Procesar items si existen
    if (items && Array.isArray(items)) {
      console.log('📦 Procesando', items.length, 'items...');

      // Obtener items actuales de la OT
      const currentItemsResponse = await supabaseClient.get(`work_order_items?work_order_id=eq.${workOrderId}`);
      const currentItems = currentItemsResponse.data || [];
      console.log('📦 Items actuales:', currentItems.length);

      const updatedProductIds = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`📦 Procesando item ${i + 1}/${items.length}:`, JSON.stringify(item, null, 2));

        const productId = item.product_id;
        const plannedQuantity = parseFloat(item.planned_quantity);

        updatedProductIds.push(productId);

        // Verificar si el item ya existe
        const existingItem = currentItems.find(ci => ci.product_id === productId);

        if (existingItem) {
          // Actualizar item existente
          console.log('📦 Actualizando item existente:', existingItem.id);
          const itemUpdateData = {
            planned_quantity: plannedQuantity,
            updated_at: new Date().toISOString()
          };

          await supabaseClient.patch(`work_order_items?id=eq.${existingItem.id}`, itemUpdateData);

          // Actualizar consumo planificado
          try {
            console.log('🔬 Recalculando consumo para producto:', productId);
            const consumptionQuery = `select * from calculate_planned_consumption('${productId}', ${plannedQuantity})`;
            console.log('🔬 Query de consumo:', consumptionQuery);

            const consumptionResponse = await supabaseClient.post('rpc/exec', {
              query: consumptionQuery
            });

            const consumptions = consumptionResponse.data || [];
            console.log('🔬 Consumos calculados:', consumptions.length);

            // Eliminar consumos anteriores
            await supabaseClient.delete(`work_order_consumption?work_order_item_id=eq.${existingItem.id}`);

            // Crear nuevos consumos
            for (const consumption of consumptions) {
              const consumptionData = {
                work_order_item_id: existingItem.id,
                raw_material_id: consumption.raw_material_id,
                planned_consumption: parseFloat(consumption.consumption_quantity),
                unit: consumption.unit,
                created_at: new Date().toISOString()
              };

              await supabaseClient.post('work_order_consumption', consumptionData);
            }
          } catch (consumptionError) {
            console.warn('⚠️ Error recalculando consumo:', consumptionError.message);
          }
        } else {
          // Crear nuevo item
          console.log('📦 Creando nuevo item para producto:', productId);
          const newItemData = {
            work_order_id: workOrderId,
            product_id: productId,
            planned_quantity: plannedQuantity,
            unit: 'unidad', // TODO: obtener de producto
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const itemResponse = await supabaseClient.post('work_order_items', newItemData);
          const createdItem = itemResponse.data[0];
          console.log('📦 Nuevo item creado:', createdItem.id);

          // Calcular consumo planificado
          try {
            const consumptionQuery = `select * from calculate_planned_consumption('${productId}', ${plannedQuantity})`;
            const consumptionResponse = await supabaseClient.post('rpc/exec', {
              query: consumptionQuery
            });

            const consumptions = consumptionResponse.data || [];

            for (const consumption of consumptions) {
              const consumptionData = {
                work_order_item_id: createdItem.id,
                raw_material_id: consumption.raw_material_id,
                planned_consumption: parseFloat(consumption.consumption_quantity),
                unit: consumption.unit,
                created_at: new Date().toISOString()
              };

              await supabaseClient.post('work_order_consumption', consumptionData);
            }
          } catch (consumptionError) {
            console.warn('⚠️ Error calculando consumo para nuevo item:', consumptionError.message);
          }
        }
      }

      // Eliminar items que ya no están en la lista
      for (const currentItem of currentItems) {
        if (!updatedProductIds.includes(currentItem.product_id)) {
          console.log('🗑️ Eliminando item obsoleto:', currentItem.id);
          await supabaseClient.delete(`work_order_items?id=eq.${currentItem.id}`);
        }
      }
    }

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Orden de trabajo actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando orden de trabajo:', error.message);
    console.error('❌ Stack trace:', error.stack);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error actualizando orden de trabajo',
      error: error.message
    });
  }
});

// 🔄 PATCH CAMBIAR ESTADO DE ORDEN DE TRABAJO
app.patch('/work-orders/:id/status', async (req, res) => {
  try {
    console.log('🔄 Cambiando estado de orden de trabajo:', req.params.id);

    const { status } = req.body;
    const updates = {
      status: status,
      updated_at: new Date().toISOString()
    };

    // Actualizar fechas según el estado
    if (status === 'in_progress') {
      updates.actual_start_date = new Date().toISOString();
    } else if (status === 'completed') {
      updates.actual_end_date = new Date().toISOString();
    }

    const response = await supabaseClient.patch(`work_orders?id=eq.${req.params.id}`, updates);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      data: response.data[0] || response.data,
      message: 'Estado de orden de trabajo actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error cambiando estado de orden de trabajo:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error cambiando estado de orden de trabajo',
      error: error.message
    });
  }
});

// 🗑️ DELETE ORDEN DE TRABAJO
app.delete('/work-orders/:id', async (req, res) => {
  try {
    console.log('🗑️ Eliminando orden de trabajo:', req.params.id);

    // Verificar que no esté en progreso o completada
    const checkResponse = await supabaseClient.get(`work_orders?id=eq.${req.params.id}`);
    const workOrder = checkResponse.data[0];

    if (workOrder && ['in_progress', 'completed'].includes(workOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una orden de trabajo en progreso o completada'
      });
    }

    await supabaseClient.delete(`work_orders?id=eq.${req.params.id}`);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.json({
      success: true,
      message: 'Orden de trabajo eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando orden de trabajo:', error.message);

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    res.status(500).json({
      success: false,
      message: 'Error eliminando orden de trabajo',
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
  console.log('🎯 ÓRDENES DE TRABAJO ENDPOINTS:');
  console.log('   ✅ GET /work-orders → Lista órdenes de trabajo');
  console.log('   ✅ POST /work-orders → Crear orden de trabajo');
  console.log('   ✅ GET /work-orders/:id → Orden de trabajo por ID');
  console.log('   ✅ PUT /work-orders/:id → Actualizar orden de trabajo');
  console.log('   ✅ PATCH /work-orders/:id/status → Cambiar estado');
  console.log('   ✅ DELETE /work-orders/:id → Eliminar orden de trabajo');
  console.log('   ✅ GET /work-orders/:id/details → Detalles completos');
  console.log();
  console.log('📱 Frontend listo en: http://localhost:5174');
  console.log('🛡️ CORS headers aplicados a todas las respuestas');
  console.log('🔥 ¡YA PUEDES CREAR ÓRDENES DE TRABAJO!');
});

module.exports = app;
