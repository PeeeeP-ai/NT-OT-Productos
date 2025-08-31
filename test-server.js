const express = require('express');
const app = express();
const PORT = 4000; // ⚠️ CAMBIO: Ahora 4000 que es lo que el usuario quiere

app.use(express.json());

// 🎯 CORS ABSOLUTAMENTE GUARANTEZADO
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl} - Origen: ${req.headers.origin || 'desconocido'} - Content-Type: ${req.headers['content-type'] || 'none'}`);

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');

  // Preflight handled
  if (req.method === 'OPTIONS') {
    console.log(`✈️ Preflight OPTIONS: ${req.originalUrl} - Origen: ${req.headers.origin}`);
    return res.status(200).send();
  }

  next();
});

// STORE IN MEMORY
let materialsMemory = [
  {
    id: 'test-1',
    code: 'MAT-001',
    name: 'Material de Test',
    unit: 'unidad',
    current_stock: 100,
    min_stock: 10,
    max_stock: 500,
    location: 'Bodega A',
    supplier: 'Proveedor XYZ',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// ROOT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✅ SERVIDOR FUNCIONANDO PERFECTAMENTE',
    port: PORT,
    version: '1.0.0',
    cors_enabled: true,
    endpoints_available: {
      '/test-cors': 'Prueba CORS',
      '/raw-materials': 'List + Create',
      '/raw-materials/:id': 'Get + Update + Delete',
      '/raw-materials/:id/disable': 'Toggle status',
      '/raw-materials/:id/entries': 'Inventory history'
    }
  });
});

// 🧪 TEST CORS
app.get('/test-cors', (req, res) => {
  console.log('🧪 Test CORS ejecutado');
  res.json({
    success: true,
    message: 'CORS HABILITADO para todos los origines ✅',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// 📋 RAW MATERIALS LIST & CREATE
app.get('/raw-materials', (req, res) => {
  console.log('📊 Getting materials');
  res.json({
    success: true,
    data: materialsMemory,
    count: materialsMemory.length,
    message: 'TEST MODE - In-memory data'
  });
});

app.post('/raw-materials', (req, res) => {
  console.log('➕ Creating material:', req.body.name);

  const newMaterial = {
    id: 'test-' + (materialsMemory.length + 1),
    code: req.body.code || 'MAT-' + (materialsMemory.length + 1),
    name: req.body.name,
    unit: req.body.unit || 'unidad',
    current_stock: 0,
    min_stock: req.body.min_stock || 0,
    max_stock: req.body.max_stock || null,
    location: req.body.location || null,
    supplier: req.body.supplier || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  materialsMemory.push(newMaterial);

  console.log('✅ Material created:', newMaterial.name);

  res.status(201).json({
    success: true,
    message: 'Material creado exitosamente',
    data: newMaterial
  });
});

// ⛔ CATCH-ALL FOR DEBUGGING
app.all('*', (req, res) => {
  console.log(`⚠️ Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    available_routes: [
      'GET /',
      'GET /test-cors',
      'GET /raw-materials',
      'POST /raw-materials'
    ]
  });
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log('==============================');
  console.log('🎯 SERVIDOR API LISTO');
  console.log(`📍 Puerto: ${PORT}`);
  console.log('🔓 CORS: ABIERTO PARA TODOS');
  console.log('💾 MODE: IN-MEMORY (TEST)');
  console.log('');
  console.log('✅ Endpoints preparados:');
  console.log('   • GET  / - Estado');
  console.log('   • GET  /test-cors - Prueba CORS');
  console.log('   • GET  /raw-materials - Lista');
  console.log('   • POST /raw-materials - Crear');
  console.log('');
  console.log('🔥 ¿Funciona ahora?');
});