// Servidor más simple posible, sin dependencias problemáticas
const http = require('http');
const url = require('url');
const querystring = require('querystring');

// Materiales en memoria
const materialsMemory = JSON.parse('[{"id":"test-1","code":"MAT-001","name":"Material de Test","unit":"unidad","current_stock":100,"min_stock":10,"max_stock":500,"location":"Bodega A","supplier":"Proveedor XYZ","is_active":true,"created_at":"2025-08-31T15:14:30.000Z","updated_at":"2025-08-31T15:14:30.000Z"}]');

const server = http.createServer((request, response) => {
  console.log(`🔧 ${request.method} ${request.url}`);

  // ✅ CORS MANUAL SIMPLE
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.setHeader('Access-Control-Max-Age', '86400');

  // ✅ OPTIONS/PREFLIGHT
  if (request.method === 'OPTIONS') {
    console.log('✈️ Preflight handled');
    response.writeHead(200, {'Content-Type': 'text/plain'});
    return response.end('');
  }

  // Parse URL
  const parsedUrl = url.parse(request.url);
  const [path, ...queryParams] = parsedUrl.pathname.substring(1).split('/');

  if (request.method === 'GET' && path === '') {
    // ROOT endpoint
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({
      success: true,
      message: '✅ Servidor Simple Funcionando Perfectamente',
      timestamp: new Date().toISOString(),
      pid: process.pid
    }));
    return;
  }

  if (request.method === 'GET' && path === 'test-cors') {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({
      success: true,
      message: '🧪 CORS funcionando ✅',
      origin: request.headers.origin,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (request.method === 'GET' && path === 'raw-materials') {
    console.log('📊 GET raw-materials (simple server)');
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({
      success: true,
      message: 'Lista de materiales - TEST MODE',
      data: materialsMemory,
      count: materialsMemory.length
    }));
    return;
  }

  if (request.method === 'POST' && path === 'raw-materials') {
    console.log('➕ POST raw-materials (simple server)');

    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });

    request.on('end', () => {
      try {
        const data = JSON.parse(body);

        const newMaterial = {
          id: 'test-' + (materialsMemory.length + 1),
          code: data.code || 'MAT-' + (materialsMemory.length + 1),
          name: data.name,
          unit: data.unit || 'unidad',
          current_stock: 0,
          min_stock: data.min_stock || 0,
          max_stock: data.max_stock || null,
          location: data.location || null,
          supplier: data.supplier || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        materialsMemory.push(newMaterial);

        console.log('✅ Material creado:', newMaterial.name);
        response.writeHead(201, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({
          success: true,
          message: 'Material creado exitosamente (TEST MODE)',
          data: newMaterial
        }));

      } catch (error) {
        response.writeHead(400, {'Content-Type': 'application/json'});
        response.end(JSON.stringify({
          success: false,
          message: 'Error parsing JSON'
        }));
      }
    });
    return;
  }

  // Not found
  console.log(`⚠️ Route not found: ${request.method} ${path}`);
  response.writeHead(404, {'Content-Type': 'application/json'});
  response.end(JSON.stringify({
    success: false,
    message: `Route not found: ${request.method} ${path}`,
    available_routes: ['GET /', 'GET /test-cors', 'GET /raw-materials', 'POST /raw-materials']
  }));
});

const PORT = 4000;

server.listen(PORT, () => {
  console.log('==============================');
  console.log(`🔥 SERVIDOR SIMPLE EN PUERTO ${PORT}`);
  console.log('✅ CORS ACTIVADO');
  console.log('✅ VANILLA HTTP (sin Express)');
  console.log('');
  console.log('🎯 Rutas disponibles:');
  console.log('   • GET  /');
  console.log('   • GET  /test-cors');
  console.log('   • GET  /raw-materials');
  console.log('   • POST /raw-materials');
  console.log('');
  console.log('🚀 ¡Prueba ahora!');
});

process.on('SIGINT', () => {
  console.log('👋 Servidor elegantemente cerrado');
  process.exit(0);
});