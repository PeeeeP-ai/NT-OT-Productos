<?php

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

echo "🚀 routes.php loaded\n";

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar cliente Guzzle para Supabase
$supabase_client = new Client([
    'base_uri' => $_ENV['SUPABASE_REST_URL'],
    'headers' => [
        'apikey' => $_ENV['SUPABASE_ANON_PUBLIC'],
        'Authorization' => 'Bearer ' . $_ENV['SUPABASE_ANON_PUBLIC'],
        'Content-Type' => 'application/json'
    ]
]);

global $app;

// Middleware CORS
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', 'http://localhost:3000') // Cambiar en producción
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
});

// Middleware de validación básica
$basicValidation = function ($request, $response, $next) use ($app, $supabase_client) {
    try {
        return $next($request, $response);
    } catch (Exception $e) {
        $data = [
            'success' => false,
            'message' => $e->getMessage(),
            'error' => true
        ];
        return $response->withJson($data, 500);
    }
};

// Función helper para validar datos de materia prima
function validateRawMaterialData($data) {
    $errors = [];

    if (empty($data['code'])) {
        $errors[] = 'El código es requerido';
    }
    if (empty($data['name'])) {
        $errors[] = 'El nombre es requerido';
    }
    if (empty($data['unit'])) {
        $errors[] = 'La unidad es requerida';
    }
    if (!isset($data['min_stock'])) {
        $data['min_stock'] = 0;
    }

    return ['errors' => $errors, 'data' => $data];
}

// Función helper para validar entrada de inventario
function validateInventoryEntryData($data) {
    $errors = [];

    if (!isset($data['quantity']) || !is_numeric($data['quantity']) || $data['quantity'] == 0) {
        $errors[] = 'La cantidad es requerida y debe ser un número diferente de cero';
    }
    if (empty($data['entry_type']) || !in_array($data['entry_type'], ['in', 'out'])) {
        $errors[] = 'El tipo de entrada debe ser "in" o "out"';
    }

    return ['errors' => $errors, 'data' => $data];
}

// =========================================
// RUTAS BÁSICAS
// =========================================

$app->get('/', function ($request, $response, $args) {
    $data = [
        'success' => true,
        'message' => 'API Materias Primas - Running',
        'timestamp' => date('Y-m-d H:i:s')
    ];
    return $response->withJson($data);
});

$app->get('/health', function ($request, $response, $args) {
    $data = [
        'success' => true,
        'status' => 'healthy',
        'services' => [
            'database_supabase' => 'connected',
            'api_slim' => 'running'
        ]
    ];
    return $response->withJson($data);
});

// =========================================
// RUTAS MATERIAS PRIMAS
// =========================================

// GET /api/raw-materials - Listar todas las materias primas activas
$app->get('/raw-materials', function ($request, $response, $args) use ($supabase_client) {
    try {
        $params = $request->getQueryParams();
        $withoutOptions = $params['options'] ?? 'true';
        $showInactive = $params['inactive'] ?? 'false';

        echo "📊 Petición GET /raw-materials\n";
        echo "Query params: " . print_r($params, true) . "\n";

        $query = 'select=id,code,name,description,unit,current_stock,min_stock,max_stock,location,supplier,is_active,created_at,updated_at&order=created_at.desc&limit=10000';

        if ($withoutOptions === 'false') {
            $query = 'select=*&order=created_at.desc';
        }

        echo "Supabase query: " . $query . "\n";

        $api_response = $supabase_client->get("raw_materials?" . $query);

        $raw_materials = json_decode($api_response->getBody(), true);

        if ($showInactive === 'false') {
            $raw_materials = array_filter($raw_materials, function($item) {
                return $item['is_active'] ?? true;
            });
        }

        echo "Supabase response: " . count($raw_materials) . " materiales encontrados\n";
        
        // Debug: mostrar stock de cada material
        foreach ($raw_materials as $material) {
            echo "Material {$material['code']}: current_stock = {$material['current_stock']}\n";
        }

        $data = [
            'success' => true,
            'data' => array_values($raw_materials),
            'count' => count($raw_materials)
        ];

        echo "✅ Respuesta enviada correctamente\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener materias primas',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/raw-materials/{id} - Obtener materia prima por ID
$app->get('/raw-materials/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        $api_response = $supabase_client->get("raw_materials?id=eq.{$id}");

        $raw_materials = json_decode($api_response->getBody(), true);

        if (empty($raw_materials)) {
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $data = [
            'success' => true,
            'data' => $raw_materials[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener materia prima',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/raw-materials - Crear nueva materia prima
$app->post('/raw-materials', function ($request, $response, $args) use ($supabase_client) {
    try {
        $input_data = json_decode($request->getBody()->getContents(), true);

        // Validar datos
        $validation = validateRawMaterialData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        $dataToSave = [
            'code' => $validation['data']['code'],
            'name' => $validation['data']['name'],
            'description' => $validation['data']['description'] ?? null,
            'unit' => $validation['data']['unit'],
            'current_stock' => 0,
            'min_stock' => $validation['data']['min_stock'],
            'max_stock' => $validation['data']['max_stock'] ?? null,
            'location' => $validation['data']['location'] ?? null,
            'supplier' => $validation['data']['supplier'] ?? null,
            'is_active' => true
        ];

        $api_response = $supabase_client->post('raw_materials', [
            'json' => $dataToSave
        ]);

        $created_material = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Materia prima creada exitosamente',
            'data' => $created_material[0]
        ];

        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        $error_body = $e->getResponse()->getBody(true)->getContents();
        $error_data = json_decode($error_body, true);

        $data = [
            'success' => false,
            'message' => 'Error al crear materia prima',
            'error' => $error_data['message'] ?? $e->getMessage()
        ];

        return $response->withJson($data, $e->getResponse() ? $e->getResponse()->getStatusCode() : 500);
    }
});

// PUT /api/raw-materials/{id} - Actualizar materia prima
$app->put('/raw-materials/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        // Validar datos
        $validation = validateRawMaterialData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        $dataToUpdate = [
            'code' => $validation['data']['code'],
            'name' => $validation['data']['name'],
            'description' => $validation['data']['description'] ?? null,
            'unit' => $validation['data']['unit'],
            'min_stock' => $validation['data']['min_stock'],
            'max_stock' => $validation['data']['max_stock'] ?? null,
            'location' => $validation['data']['location'] ?? null,
            'supplier' => $validation['data']['supplier'] ?? null,
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        // Verificar que el material existe
        $check_response = $supabase_client->get("raw_materials?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $api_response = $supabase_client->patch("raw_materials?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_material = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Materia prima actualizada exitosamente',
            'data' => $updated_material[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al actualizar materia prima',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PATCH /api/raw-materials/{id}/disable - Deshabilitar/habilitar materia prima
$app->patch('/raw-materials/{id}/disable', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);
        $is_active = isset($input_data['is_active']) ? (bool)$input_data['is_active'] : false;

        $dataToUpdate = [
            'is_active' => $is_active,
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        // Verificar que el material existe
        $check_response = $supabase_client->get("raw_materials?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $api_response = $supabase_client->patch("raw_materials?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_material = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => $is_active ? 'Materia prima habilitada' : 'Materia prima deshabilitada',
            'data' => $updated_material[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al cambiar estado de materia prima',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// DELETE /api/raw-materials/{id} - Eliminar materia prima
$app->delete('/raw-materials/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        // Verificar que el material existe
        $check_response = $supabase_client->get("raw_materials?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $api_response = $supabase_client->delete("raw_materials?id=eq.{$id}");

        $data = [
            'success' => true,
            'message' => 'Materia prima eliminada exitosamente'
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al eliminar materia prima',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/raw-materials/{id}/entries - Obtener entradas de inventario de una materia prima
$app->get('/raw-materials/{id}/entries', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $params = $request->getQueryParams();
        $type = $params['type'] ?? null; // 'in', 'out', or null for all

        $query = "raw_material_id=eq.{$id}&order=movement_date.desc&limit=10000";

        if ($type && in_array($type, ['in', 'out'])) {
            $query .= "&entry_type=eq.{$type}";
        }

        $api_response = $supabase_client->get("inventory_entries?" . $query);

        $entries = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'data' => $entries,
            'count' => count($entries)
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener entradas de inventario',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/raw-materials/recalculate-stocks - Recalcular todos los stocks
$app->post('/raw-materials/recalculate-stocks', function ($request, $response, $args) use ($supabase_client) {
    try {
        // Ejecutar la función SQL para recalcular stocks
        $sql_query = "UPDATE raw_materials SET current_stock = calculate_raw_material_stock(id), updated_at = NOW() WHERE id IN (SELECT DISTINCT raw_material_id FROM inventory_entries)";
        
        $api_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $sql_query]
        ]);

        $data = [
            'success' => true,
            'message' => 'Stocks recalculados exitosamente'
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al recalcular stocks',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/raw-materials/{id}/entries - Crear nueva entrada/salida de inventario
$app->post('/raw-materials/{id}/entries', function ($request, $response, $args) use ($supabase_client) {
    try {
        $raw_material_id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        // Agregar el raw_material_id al data
        $input_data['raw_material_id'] = $raw_material_id;

        // Validar datos
        $validation = validateInventoryEntryData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        $dataToSave = [
            'raw_material_id' => $raw_material_id,
            'quantity' => $validation['data']['quantity'],
            'entry_type' => $validation['data']['entry_type'],
            'unit_price' => isset($validation['data']['unit_price']) ? (float)$validation['data']['unit_price'] : null,
            'notes' => $validation['data']['notes'] ?? null,
            'movement_date' => isset($validation['data']['movement_date']) ?
                date('Y-m-d\TH:i:s\Z', strtotime($validation['data']['movement_date'])) :
                date('Y-m-d\TH:i:s\Z')
        ];

        // Verificar que la materia prima existe
        $check_response = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        // Verificar si es salida de stock, chequear que hay suficiente stock
        if ($dataToSave['entry_type'] === 'out') {
            // Calcular stock real basado en entradas de inventario
            $entries_response = $supabase_client->get("inventory_entries?raw_material_id=eq.{$raw_material_id}&order=movement_date.desc&limit=10000");
            $entries = json_decode($entries_response->getBody(), true);
            
            $calculated_stock = 0;
            foreach ($entries as $entry) {
                if ($entry['entry_type'] === 'in') {
                    $calculated_stock += $entry['quantity'];
                } else {
                    $calculated_stock -= $entry['quantity'];
                }
            }
            
            $calculated_stock = max(0, $calculated_stock); // No permitir stock negativo
            
            if ($calculated_stock - abs($dataToSave['quantity']) < 0) {
                $material_name = $check_data[0]['name'];
                $unit = $check_data[0]['unit'];
                $data = [
                    'success' => false,
                    'message' => "No hay suficiente stock de '{$material_name}'. Stock disponible: {$calculated_stock} {$unit}, solicitado: {$dataToSave['quantity']} {$unit}"
                ];
                return $response->withJson($data, 400);
            }
        }

        $api_response = $supabase_client->post('inventory_entries', [
            'json' => $dataToSave
        ]);

        $created_entry = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Entrada de inventario registrada exitosamente',
            'data' => $created_entry[0]
        ];

        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al registrar entrada de inventario',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});
// ==
=======================================
// FUNCIONES DE VALIDACIÓN PARA PRODUCTOS
// =========================================

// Función helper para validar datos de producto
function validateProductData($data) {
    $errors = [];

    if (empty($data['name'])) {
        $errors[] = 'El nombre es requerido';
    } elseif (strlen($data['name']) < 2) {
        $errors[] = 'El nombre debe tener al menos 2 caracteres';
    } elseif (strlen($data['name']) > 255) {
        $errors[] = 'El nombre no puede exceder 255 caracteres';
    }

    if (empty($data['unit'])) {
        $errors[] = 'La unidad es requerida';
    }

    if (!isset($data['base_quantity']) || !is_numeric($data['base_quantity']) || $data['base_quantity'] <= 0) {
        $errors[] = 'La cantidad base debe ser un número positivo';
    }

    if (isset($data['description']) && strlen($data['description']) > 1000) {
        $errors[] = 'La descripción no puede exceder 1000 caracteres';
    }

    return ['errors' => $errors, 'data' => $data];
}

// =========================================
// RUTAS PARA PRODUCTOS
// =========================================

// GET /api/products - Listar todos los productos
$app->get('/products', function ($request, $response, $args) use ($supabase_client) {
    try {
        $params = $request->getQueryParams();
        $showInactive = $params['inactive'] ?? 'false';

        echo "📊 Petición GET /products\n";
        echo "Query params: " . print_r($params, true) . "\n";

        $query = 'select=id,name,description,unit,base_quantity,is_active,created_at,updated_at&order=created_at.desc&limit=10000';

        echo "Supabase query: " . $query . "\n";

        $api_response = $supabase_client->get("products?" . $query);

        $products = json_decode($api_response->getBody(), true);

        if ($showInactive === 'false') {
            $products = array_filter($products, function($item) {
                return $item['is_active'] ?? true;
            });
        }

        echo "Supabase response: " . count($products) . " productos encontrados\n";
        
        // Debug: mostrar información de cada producto
        foreach ($products as $product) {
            echo "Producto {$product['name']}: base_quantity = {$product['base_quantity']} {$product['unit']}\n";
        }

        $data = [
            'success' => true,
            'data' => array_values($products),
            'count' => count($products)
        ];

        echo "✅ Respuesta enviada correctamente\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener productos',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/products/{id} - Obtener producto por ID
$app->get('/products/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        echo "📊 Obteniendo producto por ID: {$id}\n";

        $api_response = $supabase_client->get("products?id=eq.{$id}");

        $products = json_decode($api_response->getBody(), true);

        if (empty($products)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        $data = [
            'success' => true,
            'data' => $products[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener producto',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/products - Crear nuevo producto
$app->post('/products', function ($request, $response, $args) use ($supabase_client) {
    try {
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 Creando producto: " . print_r($input_data, true) . "\n";

        // Validar datos
        $validation = validateProductData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Verificar que el nombre no esté duplicado
        $check_response = $supabase_client->get("products?name=eq." . urlencode($validation['data']['name']));
        $existing_products = json_decode($check_response->getBody(), true);

        if (!empty($existing_products)) {
            $data = [
                'success' => false,
                'message' => 'Ya existe un producto con ese nombre',
                'errors' => ['El nombre del producto debe ser único']
            ];
            return $response->withJson($data, 400);
        }

        $dataToSave = [
            'name' => $validation['data']['name'],
            'description' => $validation['data']['description'] ?? null,
            'unit' => $validation['data']['unit'],
            'base_quantity' => $validation['data']['base_quantity'],
            'is_active' => true
        ];

        $api_response = $supabase_client->post('products', [
            'json' => $dataToSave
        ]);

        $created_product = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Producto creado exitosamente',
            'data' => $created_product[0]
        ];

        echo "✅ Producto creado: {$created_product[0]['name']}\n";
        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        $error_body = $e->getResponse() ? $e->getResponse()->getBody()->getContents() : '';
        $error_data = json_decode($error_body, true);

        $data = [
            'success' => false,
            'message' => 'Error al crear producto',
            'error' => $error_data['message'] ?? $e->getMessage()
        ];

        return $response->withJson($data, $e->getResponse() ? $e->getResponse()->getStatusCode() : 500);
    }
});

// PUT /api/products/{id} - Actualizar producto
$app->put('/products/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 Actualizando producto ID: {$id}\n";

        // Validar datos
        $validation = validateProductData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Verificar que el producto existe
        $check_response = $supabase_client->get("products?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        // Verificar que el nombre no esté duplicado (excepto el mismo producto)
        $name_check_response = $supabase_client->get("products?name=eq." . urlencode($validation['data']['name']) . "&id=neq.{$id}");
        $existing_products = json_decode($name_check_response->getBody(), true);

        if (!empty($existing_products)) {
            $data = [
                'success' => false,
                'message' => 'Ya existe otro producto con ese nombre',
                'errors' => ['El nombre del producto debe ser único']
            ];
            return $response->withJson($data, 400);
        }

        $dataToUpdate = [
            'name' => $validation['data']['name'],
            'description' => $validation['data']['description'] ?? null,
            'unit' => $validation['data']['unit'],
            'base_quantity' => $validation['data']['base_quantity'],
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        $api_response = $supabase_client->patch("products?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_product = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Producto actualizado exitosamente',
            'data' => $updated_product[0]
        ];

        echo "✅ Producto actualizado: {$updated_product[0]['name']}\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al actualizar producto',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PATCH /api/products/{id}/disable - Deshabilitar/habilitar producto
$app->patch('/products/{id}/disable', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);
        $is_active = isset($input_data['is_active']) ? (bool)$input_data['is_active'] : false;

        echo "📊 Cambiando estado producto ID: {$id} a " . ($is_active ? 'activo' : 'inactivo') . "\n";

        $dataToUpdate = [
            'is_active' => $is_active,
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        // Verificar que el producto existe
        $check_response = $supabase_client->get("products?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        $api_response = $supabase_client->patch("products?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_product = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => $is_active ? 'Producto habilitado' : 'Producto deshabilitado',
            'data' => $updated_product[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al cambiar estado del producto',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// DELETE /api/products/{id} - Eliminar producto
$app->delete('/products/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        echo "📊 Eliminando producto ID: {$id}\n";

        // Verificar que el producto existe
        $check_response = $supabase_client->get("products?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        // Verificar si el producto tiene fórmulas asociadas
        $formula_check_response = $supabase_client->get("product_formulas?product_id=eq.{$id}");
        $formulas = json_decode($formula_check_response->getBody(), true);

        if (!empty($formulas)) {
            echo "⚠️ Producto tiene " . count($formulas) . " fórmulas asociadas, se eliminarán en cascada\n";
        }

        $api_response = $supabase_client->delete("products?id=eq.{$id}");

        $data = [
            'success' => true,
            'message' => 'Producto eliminado exitosamente'
        ];

        echo "✅ Producto eliminado correctamente\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al eliminar producto',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});
//
 =========================================
// FUNCIONES DE VALIDACIÓN PARA FÓRMULAS
// =========================================

// Función helper para validar datos de fórmula
function validateFormulaItemData($data) {
    $errors = [];

    echo "🔍 Validando datos de fórmula: " . print_r($data, true) . "\n";

    if (empty($data['raw_material_id'])) {
        $errors[] = 'La materia prima es requerida';
        echo "❌ Error: raw_material_id vacío\n";
    } else {
        echo "✅ raw_material_id válido: {$data['raw_material_id']}\n";
        // Validar formato UUID
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $data['raw_material_id'])) {
            $errors[] = 'El ID de materia prima debe ser un UUID válido';
            echo "❌ Error: raw_material_id no es un UUID válido: {$data['raw_material_id']}\n";
        }
    }

    if (!isset($data['quantity']) || !is_numeric($data['quantity']) || $data['quantity'] <= 0) {
        $errors[] = 'La cantidad debe ser un número positivo';
        echo "❌ Error: quantity inválida - valor: " . ($data['quantity'] ?? 'no definido') . "\n";
    } else {
        echo "✅ quantity válida: {$data['quantity']}\n";
    }

    echo "🎯 Errores de validación: " . count($errors) . "\n";
    if (!empty($errors)) {
        echo "❌ Errores encontrados: " . implode(', ', $errors) . "\n";
    }

    return ['errors' => $errors, 'data' => $data];
}

// =========================================
// RUTAS PARA FÓRMULAS DE PRODUCTOS
// =========================================

// GET /api/products/{id}/formula - Obtener fórmula del producto
$app->get('/products/{id}/formula', function ($request, $response, $args) use ($supabase_client) {
    try {
        $product_id = $args['id'];

        echo "📊 Obteniendo fórmula para producto: {$product_id}\n";

        // Verificar que el producto existe
        $product_check = $supabase_client->get("products?id=eq.{$product_id}");
        $product_data = json_decode($product_check->getBody(), true);

        if (empty($product_data)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        // Obtener fórmula con información de materias primas
        $query = "product_id=eq.{$product_id}&select=id,product_id,raw_material_id,quantity,created_at,raw_materials(id,code,name,unit,current_stock,is_active)&order=created_at.asc";
        
        $api_response = $supabase_client->get("product_formulas?" . $query);
        $formula_items = json_decode($api_response->getBody(), true);

        echo "Fórmula encontrada: " . count($formula_items) . " ingredientes\n";

        $data = [
            'success' => true,
            'data' => $formula_items,
            'count' => count($formula_items)
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener fórmula del producto',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/products/{id}/formula - Agregar materia prima a fórmula
$app->post('/products/{id}/formula', function ($request, $response, $args) use ($supabase_client) {
    echo "🚀 [DEBUG] POST route reached for product: {$args['id']}\n";
    try {
        $product_id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 [POST] Agregando ingrediente a fórmula del producto: {$product_id}\n";
        echo "📊 [POST] Datos recibidos: " . print_r($input_data, true) . "\n";

        // Validar datos
        echo "📊 [POST] Iniciando validación de datos...\n";
        $validation = validateFormulaItemData($input_data);
        if (!empty($validation['errors'])) {
            echo "❌ [POST] Errores de validación: " . print_r($validation['errors'], true) . "\n";
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }
        echo "✅ [POST] Validación exitosa\n";

        // Verificar que el producto existe
        echo "📊 [POST] Verificando existencia del producto...\n";
        $product_check = $supabase_client->get("products?id=eq.{$product_id}");
        $product_data = json_decode($product_check->getBody(), true);
        echo "📊 [POST] Respuesta de producto: " . print_r($product_data, true) . "\n";

        if (empty($product_data)) {
            echo "❌ [POST] Producto no encontrado\n";
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }
        echo "✅ [POST] Producto encontrado: {$product_data[0]['name']}\n";

        // Verificar que la materia prima existe y está activa
        $raw_material_id = $validation['data']['raw_material_id'];
        echo "📊 [POST] Verificando materia prima: {$raw_material_id}\n";
        $material_check = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}");
        $material_data = json_decode($material_check->getBody(), true);
        echo "📊 [POST] Respuesta de materia prima: " . print_r($material_data, true) . "\n";

        if (empty($material_data)) {
            echo "❌ [POST] Materia prima no encontrada\n";
            $data = [
                'success' => false,
                'message' => 'Materia prima no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        if (!$material_data[0]['is_active']) {
            echo "❌ [POST] Materia prima inactiva\n";
            $data = [
                'success' => false,
                'message' => 'La materia prima está inactiva y no se puede agregar a la fórmula'
            ];
            return $response->withJson($data, 400);
        }
        echo "✅ [POST] Materia prima válida: {$material_data[0]['name']}\n";

        // Verificar que no existe ya esta materia prima en la fórmula
        echo "📊 [POST] Verificando duplicados...\n";
        $duplicate_check = $supabase_client->get("product_formulas?product_id=eq.{$product_id}&raw_material_id=eq.{$raw_material_id}");
        $existing_items = json_decode($duplicate_check->getBody(), true);
        echo "📊 [POST] Items existentes: " . print_r($existing_items, true) . "\n";

        if (!empty($existing_items)) {
            $material_name = $material_data[0]['name'];
            echo "❌ [POST] Materia prima ya existe en fórmula: {$material_name}\n";
            $data = [
                'success' => false,
                'message' => "La materia prima '{$material_name}' ya está en la fórmula. Use la función de editar para cambiar la cantidad."
            ];
            return $response->withJson($data, 400);
        }
        echo "✅ [POST] No hay duplicados\n";

        $dataToSave = [
            'product_id' => $product_id,
            'raw_material_id' => $raw_material_id,
            'quantity' => $validation['data']['quantity']
        ];

        echo "📊 [POST] Datos a guardar: " . print_r($dataToSave, true) . "\n";
        echo "📊 [POST] Enviando a Supabase...\n";

        $api_response = $supabase_client->post('product_formulas', [
            'json' => $dataToSave
        ]);

        echo "📊 [POST] Respuesta de Supabase: " . $api_response->getStatusCode() . "\n";
        $response_body = $api_response->getBody()->getContents();
        echo "📊 [POST] Cuerpo de respuesta: {$response_body}\n";

        $created_item = json_decode($response_body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            echo "❌ [POST] Error decodificando JSON: " . json_last_error_msg() . "\n";
            throw new Exception('Error procesando respuesta de Supabase');
        }

        echo "📊 [POST] Item creado: " . print_r($created_item, true) . "\n";

        // Obtener el item creado con información de la materia prima
        echo "📊 [POST] Obteniendo item completo...\n";
        $item_with_material = $supabase_client->get("product_formulas?id=eq.{$created_item[0]['id']}&select=id,product_id,raw_material_id,quantity,created_at,raw_materials(id,code,name,unit,current_stock,is_active)");
        $complete_item = json_decode($item_with_material->getBody(), true);
        echo "📊 [POST] Item completo: " . print_r($complete_item, true) . "\n";

        $data = [
            'success' => true,
            'message' => 'Ingrediente agregado a la fórmula exitosamente',
            'data' => $complete_item[0]
        ];

        echo "✅ [POST] Ingrediente agregado exitosamente: {$material_data[0]['name']} - {$validation['data']['quantity']} {$material_data[0]['unit']}\n";
        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        echo "❌ [POST] RequestException: " . $e->getMessage() . "\n";
        if ($e->getResponse()) {
            echo "❌ [POST] Response status: " . $e->getResponse()->getStatusCode() . "\n";
            echo "❌ [POST] Response body: " . $e->getResponse()->getBody()->getContents() . "\n";
        }
        $data = [
            'success' => false,
            'message' => 'Error al agregar ingrediente a la fórmula',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    } catch (Exception $e) {
        echo "❌ [POST] Exception general: " . $e->getMessage() . "\n";
        $data = [
            'success' => false,
            'message' => 'Error interno del servidor',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PUT /api/products/{id}/formula/{formula_id} - Actualizar cantidad en fórmula
$app->put('/products/{id}/formula/{formula_id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $product_id = $args['id'];
        $formula_id = $args['formula_id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 Actualizando ingrediente {$formula_id} del producto {$product_id}\n";

        // Validar datos
        $validation = validateFormulaItemData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Verificar que el item de fórmula existe y pertenece al producto
        $formula_check = $supabase_client->get("product_formulas?id=eq.{$formula_id}&product_id=eq.{$product_id}");
        $formula_data = json_decode($formula_check->getBody(), true);

        if (empty($formula_data)) {
            $data = [
                'success' => false,
                'message' => 'Ingrediente de fórmula no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        $dataToUpdate = [
            'quantity' => $validation['data']['quantity']
        ];

        $api_response = $supabase_client->patch("product_formulas?id=eq.{$formula_id}", [
            'json' => $dataToUpdate
        ]);

        $updated_item = json_decode($api_response->getBody(), true);

        // Obtener el item actualizado con información de la materia prima
        $item_with_material = $supabase_client->get("product_formulas?id=eq.{$formula_id}&select=id,product_id,raw_material_id,quantity,created_at,raw_materials(id,code,name,unit,current_stock,is_active)");
        $complete_item = json_decode($item_with_material->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Cantidad actualizada exitosamente',
            'data' => $complete_item[0]
        ];

        echo "✅ Cantidad actualizada a: {$validation['data']['quantity']}\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al actualizar ingrediente de fórmula',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// DELETE /api/products/{id}/formula/{formula_id} - Eliminar materia prima de fórmula
$app->delete('/products/{id}/formula/{formula_id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $product_id = $args['id'];
        $formula_id = $args['formula_id'];

        echo "📊 Eliminando ingrediente {$formula_id} del producto {$product_id}\n";

        // Verificar que el item de fórmula existe y pertenece al producto
        $formula_check = $supabase_client->get("product_formulas?id=eq.{$formula_id}&product_id=eq.{$product_id}&select=id,raw_materials(name)");
        $formula_data = json_decode($formula_check->getBody(), true);

        if (empty($formula_data)) {
            $data = [
                'success' => false,
                'message' => 'Ingrediente de fórmula no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        $api_response = $supabase_client->delete("product_formulas?id=eq.{$formula_id}");

        $material_name = $formula_data[0]['raw_materials']['name'] ?? 'Ingrediente';

        $data = [
            'success' => true,
            'message' => "Ingrediente '{$material_name}' eliminado de la fórmula exitosamente"
        ];

        echo "✅ Ingrediente eliminado: {$material_name}\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al eliminar ingrediente de fórmula',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/products/{id}/with-formula - Obtener producto completo con fórmula
$app->get('/products/{id}/with-formula', function ($request, $response, $args) use ($supabase_client) {
    try {
        $product_id = $args['id'];

        echo "📊 Obteniendo producto completo con fórmula: {$product_id}\n";

        // Obtener producto
        $product_response = $supabase_client->get("products?id=eq.{$product_id}");
        $product_data = json_decode($product_response->getBody(), true);

        if (empty($product_data)) {
            $data = [
                'success' => false,
                'message' => 'Producto no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        // Obtener fórmula con información de materias primas
        $formula_query = "product_id=eq.{$product_id}&select=id,product_id,raw_material_id,quantity,created_at,raw_materials(id,code,name,unit,current_stock,min_stock,is_active)&order=created_at.asc";
        
        $formula_response = $supabase_client->get("product_formulas?" . $formula_query);
        $formula_items = json_decode($formula_response->getBody(), true);

        // Combinar producto con fórmula
        $product_with_formula = $product_data[0];
        $product_with_formula['formula'] = $formula_items;

        // Calcular información adicional
        $product_with_formula['total_formula_items'] = count($formula_items);
        
        // Calcular cantidad máxima producible
        $max_producible = null;
        $limiting_material = null;
        
        foreach ($formula_items as $item) {
            if ($item['raw_materials'] && $item['raw_materials']['is_active']) {
                $current_stock = $item['raw_materials']['current_stock'];
                $required_quantity = $item['quantity'];
                
                if ($required_quantity > 0) {
                    $possible_from_this = floor($current_stock / $required_quantity);
                    
                    if ($max_producible === null || $possible_from_this < $max_producible) {
                        $max_producible = $possible_from_this;
                        $limiting_material = $item['raw_materials'];
                    }
                }
            }
        }
        
        $product_with_formula['max_producible_quantity'] = $max_producible ?? 0;
        $product_with_formula['can_produce'] = ($max_producible ?? 0) > 0;
        $product_with_formula['limiting_material'] = $limiting_material;

        $data = [
            'success' => true,
            'data' => $product_with_formula
        ];

        echo "✅ Producto con fórmula obtenido: {$product_with_formula['total_formula_items']} ingredientes, max producible: {$product_with_formula['max_producible_quantity']}\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener producto con fórmula',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

echo "✅ Rutas de productos y fórmulas cargadas exitosamente\n";

// =========================================
// FUNCIONES DE VALIDACIÓN PARA ÓRDENES DE TRABAJO
// =========================================

// Función helper para validar datos de orden de trabajo
function validateWorkOrderData($data) {
    $errors = [];

    echo "🔍 Validando datos de OT: " . print_r($data, true) . "\n";

    if (empty($data['description']) && empty($data['notes'])) {
        $errors[] = 'Se requiere descripción o notas para la orden de trabajo';
        echo "❌ Error: descripción y notas vacías\n";
    } else {
        echo "✅ Descripción o notas válidas\n";
    }

    if (empty($data['priority']) || !in_array($data['priority'], ['low', 'normal', 'high', 'urgent'])) {
        $errors[] = 'La prioridad debe ser: low, normal, high o urgent';
        echo "❌ Error: prioridad inválida - valor: " . ($data['priority'] ?? 'no definido') . "\n";
    } else {
        echo "✅ Prioridad válida: {$data['priority']}\n";
    }

    if (!empty($data['planned_start_date']) && !strtotime($data['planned_start_date'])) {
        $errors[] = 'La fecha de inicio planificada no es válida';
        echo "❌ Error: fecha inicio inválida - valor: {$data['planned_start_date']}\n";
    } else {
        echo "✅ Fecha inicio válida: " . ($data['planned_start_date'] ?? 'no definida') . "\n";
    }

    if (!empty($data['planned_end_date']) && !strtotime($data['planned_end_date'])) {
        $errors[] = 'La fecha de fin planificada no es válida';
        echo "❌ Error: fecha fin inválida - valor: {$data['planned_end_date']}\n";
    } else {
        echo "✅ Fecha fin válida: " . ($data['planned_end_date'] ?? 'no definida') . "\n";
    }

    if (!empty($data['planned_start_date']) && !empty($data['planned_end_date'])) {
        if (strtotime($data['planned_start_date']) > strtotime($data['planned_end_date'])) {
            $errors[] = 'La fecha de inicio no puede ser posterior a la fecha de fin';
            echo "❌ Error: fecha inicio posterior a fecha fin\n";
        } else {
            echo "✅ Fechas en orden correcto\n";
        }
    }

    echo "🎯 Errores de validación: " . count($errors) . "\n";
    if (!empty($errors)) {
        echo "❌ Errores encontrados: " . implode(', ', $errors) . "\n";
    }

    return ['errors' => $errors, 'data' => $data];
}

// Función helper para validar item de orden de trabajo
function validateWorkOrderItemData($data) {
    $errors = [];

    if (empty($data['product_id'])) {
        $errors[] = 'El producto es requerido';
    } elseif (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $data['product_id'])) {
        $errors[] = 'El ID del producto debe ser un UUID válido';
    }

    if (!isset($data['planned_quantity']) || !is_numeric($data['planned_quantity']) || $data['planned_quantity'] <= 0) {
        $errors[] = 'La cantidad planificada debe ser un número positivo';
    }

    return ['errors' => $errors, 'data' => $data];
}

// =========================================
// RUTAS PARA ÓRDENES DE TRABAJO
// =========================================

// GET /api/work-orders - Listar órdenes de trabajo
$app->get('/work-orders', function ($request, $response, $args) use ($supabase_client) {
    try {
        $params = $request->getQueryParams();
        $status = $params['status'] ?? null;
        $limit = $params['limit'] ?? 100;

        echo "📊 Petición GET /work-orders\n";

        $query = 'select=id,order_number,description,status,priority,planned_start_date,planned_end_date,actual_start_datetime,actual_end_datetime,notes,created_by,created_at,updated_at&order=created_at.desc&limit=' . $limit;

        if ($status && in_array($status, ['pending', 'in_progress', 'completed', 'cancelled'])) {
            $query .= "&status=eq.{$status}";
        }

        $api_response = $supabase_client->get("work_orders?" . $query);
        $work_orders = json_decode($api_response->getBody(), true);

        echo "Work orders encontrados: " . count($work_orders) . "\n";

        $data = [
            'success' => true,
            'data' => $work_orders,
            'count' => count($work_orders)
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener órdenes de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/work-orders/{id} - Obtener orden de trabajo por ID
$app->get('/work-orders/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        echo "📊 Obteniendo OT por ID: {$id}\n";

        $api_response = $supabase_client->get("work_orders?id=eq.{$id}");
        $work_orders = json_decode($api_response->getBody(), true);

        if (empty($work_orders)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $data = [
            'success' => true,
            'data' => $work_orders[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/work-orders/{id}/details - Obtener orden de trabajo completa con productos y fórmulas
$app->get('/work-orders/{id}/details', function ($request, $response, $args) use ($supabase_client) {
    try {
        $work_order_id = $args['id'];

        echo "📊 [DEBUG] Obteniendo detalles completos de OT: {$work_order_id}\n";

        // Usar la función SQL para obtener detalles completos
        $query = "select * from get_work_order_details('{$work_order_id}')";
        echo "📊 [DEBUG] Query SQL: {$query}\n";

        $api_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $query]
        ]);

        $result = json_decode($api_response->getBody(), true);
        echo "📊 [DEBUG] Resultado de Supabase: " . print_r($result, true) . "\n";

        if (empty($result)) {
            echo "❌ [DEBUG] No se encontraron resultados para OT {$work_order_id}\n";
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada o sin detalles'
            ];
            return $response->withJson($data, 404);
        }

        echo "✅ [DEBUG] Se encontraron " . count($result) . " filas de resultado\n";

        // Organizar los datos por producto
        $work_order_details = null;
        $products = [];

        foreach ($result as $index => $row) {
            echo "📊 [DEBUG] Procesando fila {$index}: " . print_r($row, true) . "\n";

            if (!$work_order_details) {
                // Ensure dates are properly formatted as strings
                $formatDate = function($date, $fieldName) {
                    echo "📊 [DEBUG] Formateando fecha {$fieldName}: " . print_r($date, true) . " (tipo: " . gettype($date) . ")\n";

                    if (!$date) {
                        echo "📊 [DEBUG] Fecha {$fieldName} es null/vacía\n";
                        return null;
                    }

                    // For actual dates (with time), preserve the full datetime
                    $isActualDate = strpos($fieldName, 'actual_') === 0;

                    if ($date instanceof DateTime) {
                        $formatted = $isActualDate ? $date->format('c') : $date->format('Y-m-d');
                        echo "📊 [DEBUG] Fecha {$fieldName} es DateTime, formateada a: {$formatted}\n";
                        return $formatted;
                    }

                    // If it's already a string in YYYY-MM-DD format and it's a planned date, return as-is
                    if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && !$isActualDate) {
                        echo "📊 [DEBUG] Fecha {$fieldName} ya está en formato YYYY-MM-DD: {$date}\n";
                        return $date;
                    }

                    // If it's a datetime string, return as-is for actual dates
                    if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}T/', $date) && $isActualDate) {
                        echo "📊 [DEBUG] Fecha {$fieldName} ya está en formato ISO datetime: {$date}\n";
                        return $date;
                    }

                    // Try to parse and format other date formats
                    try {
                        echo "📊 [DEBUG] Intentando parsear fecha {$fieldName} como string: {$date}\n";
                        $dateTime = new DateTime($date);
                        $formatted = $isActualDate ? $dateTime->format('c') : $dateTime->format('Y-m-d');
                        echo "📊 [DEBUG] Fecha {$fieldName} parseada exitosamente a: {$formatted}\n";
                        return $formatted;
                    } catch (Exception $e) {
                        echo "❌ [DEBUG] Error parseando fecha {$fieldName}: {$date} - Error: " . $e->getMessage() . "\n";
                        return null;
                    }
                };

        $work_order_details = [
            'id' => $row['work_order_id'],
            'order_number' => $row['order_number'],
            'description' => $row['work_order_description'],
            'status' => $row['work_order_status'],
            'priority' => $row['work_order_priority'],
            'planned_start_date' => $formatDate($row['planned_start_date'], 'planned_start_date'),
            'planned_end_date' => $formatDate($row['planned_end_date'], 'planned_end_date'),
            'actual_start_date' => $formatDate($row['actual_start_date'], 'actual_start_date'),
            'actual_end_date' => $formatDate($row['actual_end_date'], 'actual_end_date'),
            // Use the correct datetime fields from the database
            'actual_start_datetime' => $formatDate($row['actual_start_datetime'], 'actual_start_datetime'),
            'actual_end_datetime' => $formatDate($row['actual_end_datetime'], 'actual_end_datetime'),
            'created_at' => $row['work_order_created_at'],
            'items' => []
        ];

                echo "📊 [DEBUG] Work order details creados: " . print_r($work_order_details, true) . "\n";
            }

            $product_key = $row['product_id'];
            if (!isset($products[$product_key])) {
                $products[$product_key] = [
                    'id' => $row['item_id'],
                    'product_id' => $row['product_id'],
                    'product_name' => $row['product_name'],
                    'product_unit' => $row['product_unit'],
                    'planned_quantity' => $row['planned_quantity'],
                    'produced_quantity' => $row['produced_quantity'],
                    'status' => $row['item_status'],
                    'formula' => []
                ];
            }

            if ($row['formula_raw_material_id']) {
                $products[$product_key]['formula'][] = [
                    'raw_material_id' => $row['formula_raw_material_id'],
                    'raw_material_name' => $row['raw_material_name'],
                    'raw_material_unit' => $row['raw_material_unit'],
                    'raw_material_current_stock' => $row['raw_material_current_stock'],
                    'quantity' => $row['formula_quantity'],
                    'planned_consumption' => $row['consumption_planned'],
                    'actual_consumption' => $row['consumption_actual']
                ];
            }
        }

        $work_order_details['items'] = array_values($products);

        $data = [
            'success' => true,
            'data' => $work_order_details
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener detalles de orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/work-orders - Crear nueva orden de trabajo
$app->post('/work-orders', function ($request, $response, $args) use ($supabase_client) {
    try {
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 Creando nueva OT\n";

        // Validar datos básicos de la OT
        $validation = validateWorkOrderData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Generar número de orden basado en la fecha planificada de inicio
        $planned_start_date = $validation['data']['planned_start_date'] ?? date('Y-m-d');
        $current_date = date('Y-m-d'); // Use PHP's date which respects the server timezone

        // If no planned start date or it's in the past, use current date for numbering
        $date_for_numbering = $planned_start_date;
        if (empty($planned_start_date) || strtotime($planned_start_date) < time()) {
            $date_for_numbering = $current_date;
        }

        $order_number_query = "select generate_work_order_number_for_date('{$date_for_numbering}') as order_number";
        $order_number_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $order_number_query]
        ]);
        $order_number_result = json_decode($order_number_response->getBody(), true);
        $order_number = $order_number_result[0]['order_number'] ?? 'OT-' . date('Y-m-d', strtotime($date_for_numbering)) . '-001';

        // Crear la orden de trabajo
        $work_order_data = [
            'order_number' => $order_number,
            'description' => $validation['data']['description'] ?? null,
            'priority' => $validation['data']['priority'],
            'planned_start_date' => $validation['data']['planned_start_date'] ?? null,
            'planned_end_date' => $validation['data']['planned_end_date'] ?? null,
            'notes' => $validation['data']['notes'] ?? null,
            'created_by' => $validation['data']['created_by'] ?? 'Sistema'
        ];

        $api_response = $supabase_client->post('work_orders', [
            'json' => $work_order_data
        ]);

        $created_work_order = json_decode($api_response->getBody(), true);
        $work_order_id = $created_work_order[0]['id'];

        // Procesar items de la orden (productos a producir)
        $items = $input_data['items'] ?? [];
        $created_items = [];
        $availability_warnings = [];

        foreach ($items as $item_data) {
            $item_validation = validateWorkOrderItemData($item_data);
            if (!empty($item_validation['errors'])) {
                // Si hay errores en un item, continuar con los demás pero registrar el error
                $availability_warnings[] = 'Error en producto: ' . implode(', ', $item_validation['errors']);
                continue;
            }

            // Verificar que el producto existe y está activo
            $product_check = $supabase_client->get("products?id=eq.{$item_validation['data']['product_id']}&is_active=eq.true");
            $product_data = json_decode($product_check->getBody(), true);

            if (empty($product_data)) {
                $availability_warnings[] = 'Producto no encontrado o inactivo';
                continue;
            }

            $product = $product_data[0];

            // Crear item de la orden de trabajo
            $work_order_item_data = [
                'work_order_id' => $work_order_id,
                'product_id' => $product['id'],
                'planned_quantity' => $item_validation['data']['planned_quantity'],
                'unit' => $product['unit']
            ];

            $item_response = $supabase_client->post('work_order_items', [
                'json' => $work_order_item_data
            ]);

            $created_item = json_decode($item_response->getBody(), true);
            $work_order_item_id = $created_item[0]['id'];

            // Calcular y crear consumo planificado de materias primas
            $consumption_query = "select * from calculate_planned_consumption('{$product['id']}', {$item_validation['data']['planned_quantity']})";
            $consumption_response = $supabase_client->post('rpc/exec', [
                'json' => ['query' => $consumption_query]
            ]);

            $consumptions = json_decode($consumption_response->getBody(), true);

            foreach ($consumptions as $consumption) {
                $consumption_data = [
                    'work_order_item_id' => $work_order_item_id,
                    'raw_material_id' => $consumption['raw_material_id'],
                    'planned_consumption' => $consumption['consumption_quantity'],
                    'unit' => $consumption['unit']
                ];

                $supabase_client->post('work_order_consumption', [
                    'json' => $consumption_data
                ]);
            }

            $created_items[] = $created_item[0];
        }

        // Verificar disponibilidad de materias primas
        $availability_query = "select * from check_raw_materials_availability('{$work_order_id}')";
        $availability_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $availability_query]
        ]);

        $availability_data = json_decode($availability_response->getBody(), true);

        foreach ($availability_data as $availability) {
            if (!$availability['is_available']) {
                $shortage = $availability['shortage_quantity'];
                $unit = $availability['raw_material_name'];
                $availability_warnings[] = "Insuficiente {$availability['raw_material_name']}: faltan {$shortage} {$unit}";
            }
        }

        $data = [
            'success' => true,
            'message' => 'Orden de trabajo creada exitosamente',
            'data' => [
                'work_order' => $created_work_order[0],
                'items' => $created_items,
                'warnings' => $availability_warnings
            ]
        ];

        if (!empty($availability_warnings)) {
            $data['message'] .= ' (con advertencias de disponibilidad)';
        }

        echo "✅ OT creada: {$order_number}\n";
        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al crear orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PUT /api/work-orders/{id} - Actualizar orden de trabajo
$app->put('/work-orders/{id}', function ($request, $response, $args) use ($supabase_client) {
    echo "🚀 PUT route reached for work order: {$args['id']}\n";
    try {
        $id = $args['id'];
        $raw_body = $request->getBody()->getContents();
        echo "📊 Raw request body: {$raw_body}\n";

        $input_data = json_decode($raw_body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo "❌ JSON decode error: " . json_last_error_msg() . "\n";
            $data = [
                'success' => false,
                'message' => 'JSON inválido: ' . json_last_error_msg(),
                'error' => 'JSON_DECODE_ERROR'
            ];
            return $response->withJson($data, 400);
        }

        echo "📊 Parsed input data: " . print_r($input_data, true) . "\n";
        echo "📊 Actualizando OT ID: {$id}\n";

        // Validar datos básicos de la OT
        $validation = validateWorkOrderData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Verificar que la OT existe
        $check_response = $supabase_client->get("work_orders?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $dataToUpdate = [
            'description' => $validation['data']['description'] ?? null,
            'priority' => $validation['data']['priority'],
            'planned_start_date' => $validation['data']['planned_start_date'] ?? null,
            'planned_end_date' => $validation['data']['planned_end_date'] ?? null,
            'notes' => $validation['data']['notes'] ?? null,
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        $api_response = $supabase_client->patch("work_orders?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_work_order = json_decode($api_response->getBody(), true);

        // Procesar items si se proporcionaron
        if (isset($input_data['items']) && is_array($input_data['items'])) {
            echo "📊 Actualizando items de la OT...\n";

            // Obtener items actuales de la OT
            $current_items_response = $supabase_client->get("work_order_items?work_order_id=eq.{$id}");
            $current_items = json_decode($current_items_response->getBody(), true);

            $current_item_ids = array_column($current_items, 'id');
            $updated_product_ids = [];

            foreach ($input_data['items'] as $item_data) {
                $item_validation = validateWorkOrderItemData($item_data);
                if (!empty($item_validation['errors'])) {
                    echo "❌ Error en item: " . implode(', ', $item_validation['errors']) . "\n";
                    continue;
                }

                $product_id = $item_validation['data']['product_id'];
                $planned_quantity = $item_validation['data']['planned_quantity'];

                $updated_product_ids[] = $product_id;

                // Verificar si el item ya existe
                $existing_item = null;
                foreach ($current_items as $current_item) {
                    if ($current_item['product_id'] === $product_id) {
                        $existing_item = $current_item;
                        break;
                    }
                }

                if ($existing_item) {
                    // Actualizar item existente
                    echo "📊 Actualizando item existente para producto {$product_id}\n";
                    $item_update_data = [
                        'planned_quantity' => $planned_quantity,
                        'updated_at' => date('Y-m-d\TH:i:s\Z')
                    ];

                    $supabase_client->patch("work_order_items?id=eq.{$existing_item['id']}", [
                        'json' => $item_update_data
                    ]);

                    // Actualizar consumo planificado
                    $consumption_query = "select * from calculate_planned_consumption('{$product_id}', {$planned_quantity})";
                    $consumption_response = $supabase_client->post('rpc/exec', [
                        'json' => ['query' => $consumption_query]
                    ]);

                    $consumptions = json_decode($consumption_response->getBody(), true);

                    // Eliminar consumos anteriores para este item
                    $supabase_client->delete("work_order_consumption?work_order_item_id=eq.{$existing_item['id']}");

                    // Crear nuevos consumos
                    foreach ($consumptions as $consumption) {
                        $consumption_data = [
                            'work_order_item_id' => $existing_item['id'],
                            'raw_material_id' => $consumption['raw_material_id'],
                            'planned_consumption' => $consumption['consumption_quantity'],
                            'unit' => $consumption['unit']
                        ];

                        $supabase_client->post('work_order_consumption', [
                            'json' => $consumption_data
                        ]);
                    }
                } else {
                    // Crear nuevo item
                    echo "📊 Creando nuevo item para producto {$product_id}\n";
                    $new_item_data = [
                        'work_order_id' => $id,
                        'product_id' => $product_id,
                        'planned_quantity' => $planned_quantity,
                        'unit' => 'unidad' // TODO: obtener de producto
                    ];

                    $item_response = $supabase_client->post('work_order_items', [
                        'json' => $new_item_data
                    ]);

                    $created_item = json_decode($item_response->getBody(), true);
                    $work_order_item_id = $created_item[0]['id'];

                    // Calcular y crear consumo planificado
                    $consumption_query = "select * from calculate_planned_consumption('{$product_id}', {$planned_quantity})";
                    $consumption_response = $supabase_client->post('rpc/exec', [
                        'json' => ['query' => $consumption_query]
                    ]);

                    $consumptions = json_decode($consumption_response->getBody(), true);

                    foreach ($consumptions as $consumption) {
                        $consumption_data = [
                            'work_order_item_id' => $work_order_item_id,
                            'raw_material_id' => $consumption['raw_material_id'],
                            'planned_consumption' => $consumption['consumption_quantity'],
                            'unit' => $consumption['unit']
                        ];

                        $supabase_client->post('work_order_consumption', [
                            'json' => $consumption_data
                        ]);
                    }
                }
            }

            // Eliminar items que ya no están en la lista actualizada
            foreach ($current_items as $current_item) {
                if (!in_array($current_item['product_id'], $updated_product_ids)) {
                    echo "📊 Eliminando item obsoleto {$current_item['id']}\n";
                    $supabase_client->delete("work_order_items?id=eq.{$current_item['id']}");
                }
            }
        }

        $data = [
            'success' => true,
            'message' => 'Orden de trabajo actualizada exitosamente',
            'data' => $updated_work_order[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al actualizar orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PATCH /api/work-orders/{id}/status - Cambiar estado de orden de trabajo
$app->patch('/work-orders/{id}/status', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);
        $new_status = $input_data['status'] ?? null;

        echo "🔄 [STATUS_CHANGE_START] Starting status change for work order: {$id}\n";
        echo "🔄 [STATUS_CHANGE_START] New status requested: {$new_status}\n";
        echo "🔄 [STATUS_CHANGE_START] Input data: " . print_r($input_data, true) . "\n";

        if (!$new_status || !in_array($new_status, ['pending', 'in_progress', 'completed', 'cancelled'])) {
            echo "❌ [STATUS_CHANGE_START] Invalid status: {$new_status}\n";
            $data = [
                'success' => false,
                'message' => 'Estado inválido. Debe ser: pending, in_progress, completed o cancelled'
            ];
            return $response->withJson($data, 400);
        }

        echo "📊 [STATUS_CHANGE] Starting status change processing...\n";
        echo "📊 Cambiando estado de OT {$id} a {$new_status}\n";

        // Verificar que la OT existe
        $check_response = $supabase_client->get("work_orders?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $current_work_order = $check_data[0];
        $current_status = $current_work_order['status'];

        echo "📊 [STATUS_CHECK] Current status in database: {$current_status}\n";
        echo "📊 [STATUS_CHECK] Requested new status: {$new_status}\n";
        echo "📊 [STATUS_CHECK] Work order data: " . print_r($current_work_order, true) . "\n";

        // Si estamos cambiando de pending a in_progress, deducir stock de materias primas
        // O si ya está en in_progress pero no se ha deducido stock aún
        $should_deduct_stock = false;
        $consumptions = [];

        if ($current_status === 'pending' && $new_status === 'in_progress') {
            echo "✅ [STATUS_CHECK] Condition met: changing from pending to in_progress\n";
            $should_deduct_stock = true;
        } elseif ($current_status === 'in_progress' && $new_status === 'in_progress') {
            echo "🔄 [STATUS_CHECK] Work order already in progress - checking if stock needs to be deducted\n";

            // Obtener consumo planificado de la OT para verificar si ya se dedujo stock
            $consumption_query = "select * from get_work_order_details('{$id}') where consumption_planned > 0";
            try {
                $consumption_response = $supabase_client->post('rpc/exec', [
                    'json' => ['query' => $consumption_query]
                ]);
                $consumptions = json_decode($consumption_response->getBody(), true);

                if (json_last_error() !== JSON_ERROR_NONE) {
                    $consumptions = [];
                }
            } catch (Exception $e) {
                $consumptions = [];
            }

            if (!empty($consumptions)) {
                // Verificar si ya se dedujo stock consultando inventory_entries
                $material_ids = array_map(function($c) { return "'{$c['formula_raw_material_id']}'"; }, $consumptions);
                $existing_entries_response = $supabase_client->get("inventory_entries?raw_material_id=in.(" . implode(',', $material_ids) . ")&notes=ilike.%OT {$current_work_order['order_number']}%");
                $existing_entries = json_decode($existing_entries_response->getBody(), true);

                if (empty($existing_entries)) {
                    echo "⚠️ [STATUS_CHECK] No stock deduction found for this work order - will deduct now\n";
                    $should_deduct_stock = true;
                } else {
                    echo "✅ [STATUS_CHECK] Stock already deducted for this work order - skipping\n";
                    $should_deduct_stock = false;
                }
            } else {
                echo "⚠️ [STATUS_CHECK] No consumptions found for this work order\n";
                $should_deduct_stock = false;
            }
        }

        if ($should_deduct_stock) {
            echo "📊 [STATUS_CHANGE] Iniciando OT - deducir stock de materias primas\n";
            echo "📊 [STATUS_CHANGE] Work Order ID: {$id}\n";
            echo "📊 [STATUS_CHANGE] Current status: {$current_status} -> New status: {$new_status}\n";

            // Obtener consumo planificado de la OT usando la función SQL
            $consumption_query = "select * from get_work_order_details('{$id}') where consumption_planned > 0";
            echo "📊 [STATUS_CHANGE] Query de consumo: {$consumption_query}\n";

            try {
                echo "📊 [STATUS_CHANGE] Ejecutando RPC call...\n";
                $consumption_response = $supabase_client->post('rpc/exec', [
                    'json' => ['query' => $consumption_query]
                ]);

                echo "📊 [STATUS_CHANGE] RPC Response status: " . $consumption_response->getStatusCode() . "\n";
                $response_body = $consumption_response->getBody()->getContents();
                echo "📊 [STATUS_CHANGE] RPC Raw response length: " . strlen($response_body) . " bytes\n";
                echo "📊 [STATUS_CHANGE] RPC Raw response: {$response_body}\n";

                $consumptions = json_decode($response_body, true);

                if (json_last_error() !== JSON_ERROR_NONE) {
                    echo "❌ [STATUS_CHANGE] JSON decode error: " . json_last_error_msg() . "\n";
                    $consumptions = [];
                }

                echo "📊 [STATUS_CHANGE] Consumos encontrados: " . count($consumptions) . "\n";

                if (!empty($consumptions)) {
                    echo "📊 [STATUS_CHANGE] Primer consumo: " . print_r($consumptions[0], true) . "\n";
                    echo "📊 [STATUS_CHANGE] Todos los consumos:\n";
                    foreach ($consumptions as $index => $consumption) {
                        echo "📊 [STATUS_CHANGE] Consumo {$index}: " . print_r($consumption, true) . "\n";
                    }
                } else {
                    echo "⚠️ [STATUS_CHANGE] No se encontraron consumos planificados\n";
                }
            } catch (Exception $e) {
                echo "❌ [STATUS_CHANGE] Error en RPC call: " . $e->getMessage() . "\n";
                echo "❌ [STATUS_CHANGE] Exception details: " . print_r($e, true) . "\n";
                $consumptions = [];
            }

            // LOG: Verificar si hay consumos para procesar
            echo "🔍 [LOG_CONSUMPTION] Total consumptions to process: " . count($consumptions) . "\n";
            if (empty($consumptions)) {
                echo "⚠️ [LOG_CONSUMPTION] No consumptions found - stock deduction will be skipped\n";
            }

            $warnings = [];

            if (!empty($consumptions)) {
                // Agrupar consumos por materia prima para evitar duplicados
                $consumptions_by_material = [];
                foreach ($consumptions as $consumption) {
                    $raw_material_id = $consumption['formula_raw_material_id'];
                    if (!isset($consumptions_by_material[$raw_material_id])) {
                        $consumptions_by_material[$raw_material_id] = [
                            'raw_material_id' => $raw_material_id,
                            'raw_material_name' => $consumption['raw_material_name'],
                            'planned_consumption' => 0,
                            'unit' => $consumption['raw_material_unit']
                        ];
                    }
                    $consumptions_by_material[$raw_material_id]['planned_consumption'] += $consumption['consumption_planned'];
                }

                echo "📊 [DEBUG] Consumos agrupados: " . count($consumptions_by_material) . "\n";

                $warnings = [];
                $insufficient_stock = [];

                // Verificar disponibilidad de stock para todas las materias primas
                foreach ($consumptions_by_material as $consumption) {
                    $raw_material_id = $consumption['raw_material_id'];
                    $planned_consumption = $consumption['planned_consumption'];

                    echo "🔍 [STOCK_CHECK] Verificando stock para material ID: {$raw_material_id}\n";
                    echo "🔍 [STOCK_CHECK] Consumo planificado requerido: {$planned_consumption}\n";

                    // Obtener stock actual de la materia prima
                    $stock_response = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}&select=id,name,current_stock,unit");
                    $stock_data = json_decode($stock_response->getBody(), true);

                    echo "🔍 [STOCK_CHECK] Stock response status: " . $stock_response->getStatusCode() . "\n";
                    echo "🔍 [STOCK_CHECK] Stock data: " . print_r($stock_data, true) . "\n";

                    if (!empty($stock_data)) {
                        $material = $stock_data[0];
                        $current_stock = $material['current_stock'];

                        echo "🔍 [STOCK_CHECK] Material: {$material['name']}, Stock actual: {$current_stock} {$material['unit']}\n";

                        if ($current_stock < $planned_consumption) {
                            echo "⚠️ [STOCK_CHECK] STOCK INSUFICIENTE: {$material['name']} - Disponible: {$current_stock}, Requerido: {$planned_consumption}\n";
                            $insufficient_stock[] = [
                                'name' => $material['name'],
                                'available' => $current_stock,
                                'required' => $planned_consumption,
                                'unit' => $material['unit']
                            ];
                        } else {
                            echo "✅ [STOCK_CHECK] Stock suficiente: {$material['name']} - Disponible: {$current_stock}, Requerido: {$planned_consumption}\n";
                        }
                    } else {
                        echo "❌ [STOCK_CHECK] No se pudo obtener datos de stock para material ID: {$raw_material_id}\n";
                    }
                }

                // Registrar advertencias por stock insuficiente
                if (!empty($insufficient_stock)) {
                    foreach ($insufficient_stock as $item) {
                        $warnings[] = "Advertencia: Stock insuficiente de '{$item['name']}': disponible {$item['available']} {$item['unit']}, requerido {$item['required']} {$item['unit']}";
                    }
                }

                // Deducir stock de todas las materias primas (permitir stock negativo si es necesario)
                foreach ($consumptions_by_material as $consumption) {
                    $raw_material_id = $consumption['raw_material_id'];
                    $planned_consumption = $consumption['planned_consumption'];
                    $material_name = $consumption['raw_material_name'];

                    echo "📊 [STATUS_CHANGE] Procesando material: {$material_name} (ID: {$raw_material_id})\n";
                    echo "📊 [STATUS_CHANGE] Consumo planificado: {$planned_consumption}\n";

                    // Obtener stock actual
                    echo "📊 [STATUS_CHANGE] Obteniendo stock actual para {$raw_material_id}...\n";
                    $stock_response = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}&select=current_stock");
                    $stock_data = json_decode($stock_response->getBody(), true);

                    echo "📊 [STATUS_CHANGE] Stock response status: " . $stock_response->getStatusCode() . "\n";
                    echo "📊 [STATUS_CHANGE] Stock data: " . print_r($stock_data, true) . "\n";

                    if (!empty($stock_data)) {
                        $current_stock = $stock_data[0]['current_stock'];
                        $new_stock = $current_stock - $planned_consumption;

                        echo "📊 [STATUS_CHANGE] Stock actual: {$current_stock}, Nuevo stock: {$new_stock}\n";

                        // Actualizar stock de la materia prima (permitir negativo)
                        $stock_update = [
                            'current_stock' => $new_stock,
                            'updated_at' => date('Y-m-d\TH:i:s\Z')
                        ];

                        echo "📊 [STOCK_UPDATE] Actualizando stock para {$material_name} (ID: {$raw_material_id})\n";
                        echo "📊 [STOCK_UPDATE] Datos de actualización: " . print_r($stock_update, true) . "\n";
                        echo "📊 [STOCK_UPDATE] Stock anterior: {$current_stock}, Nuevo stock: {$new_stock}, Diferencia: -{$planned_consumption}\n";

                        $update_response = $supabase_client->patch("raw_materials?id=eq.{$raw_material_id}", [
                            'json' => $stock_update
                        ]);

                        echo "📊 [STOCK_UPDATE] Stock update response status: " . $update_response->getStatusCode() . "\n";

                        if ($update_response->getStatusCode() >= 200 && $update_response->getStatusCode() < 300) {
                            echo "✅ [STOCK_UPDATE] Stock actualizado exitosamente: {$material_name} -> {$new_stock} (deducido: {$planned_consumption})\n";

                            // Verificar que el stock se actualizó correctamente
                            $verify_response = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}&select=current_stock");
                            $verify_data = json_decode($verify_response->getBody(), true);
                            if (!empty($verify_data)) {
                                $verified_stock = $verify_data[0]['current_stock'];
                                echo "🔍 [STOCK_VERIFY] Verificación de stock: esperado {$new_stock}, actual en BD {$verified_stock}\n";
                                if ($verified_stock == $new_stock) {
                                    echo "✅ [STOCK_VERIFY] Stock verificado correctamente\n";
                                } else {
                                    echo "❌ [STOCK_VERIFY] ERROR: Stock no coincide - esperado {$new_stock}, actual {$verified_stock}\n";
                                }
                            }
                        } else {
                            echo "❌ [STOCK_UPDATE] ERROR al actualizar stock para {$material_name}\n";
                            $error_body = $update_response->getBody()->getContents();
                            echo "❌ [STOCK_UPDATE] Error response: {$error_body}\n";
                        }

                        // Registrar movimiento de salida en inventory_entries
                        $movement_data = [
                            'raw_material_id' => $raw_material_id,
                            'quantity' => $planned_consumption,
                            'entry_type' => 'out',
                            'notes' => "{$current_work_order['order_number']} - {$material_name}",
                            'movement_date' => date('Y-m-d\TH:i:s\Z')
                        ];

                        echo "📊 [INVENTORY_ENTRY] Creando entrada de inventario para {$material_name}\n";
                        echo "📊 [INVENTORY_ENTRY] Datos del movimiento: " . print_r($movement_data, true) . "\n";

                        $inventory_response = $supabase_client->post('inventory_entries', [
                            'json' => $movement_data
                        ]);

                        echo "📊 [INVENTORY_ENTRY] Response status: " . $inventory_response->getStatusCode() . "\n";

                        if ($inventory_response->getStatusCode() >= 200 && $inventory_response->getStatusCode() < 300) {
                            $inventory_response_body = $inventory_response->getBody()->getContents();
                            echo "📊 [INVENTORY_ENTRY] Response body: {$inventory_response_body}\n";

                            $created_entry = json_decode($inventory_response_body, true);
                            if (!empty($created_entry) && isset($created_entry[0]['id'])) {
                                echo "✅ [INVENTORY_ENTRY] Movimiento registrado exitosamente - ID: {$created_entry[0]['id']}\n";
                                echo "✅ [INVENTORY_ENTRY] Movimiento: {$material_name} - Cantidad: {$planned_consumption} - Tipo: out\n";
                            } else {
                                echo "⚠️ [INVENTORY_ENTRY] Movimiento creado pero no se pudo obtener el ID\n";
                            }
                        } else {
                            echo "❌ [INVENTORY_ENTRY] ERROR al crear entrada de inventario para {$material_name}\n";
                            $error_body = $inventory_response->getBody()->getContents();
                            echo "❌ [INVENTORY_ENTRY] Error response: {$error_body}\n";
                        }
                    } else {
                        echo "❌ [STATUS_CHANGE] No se pudo obtener stock para material {$raw_material_id}\n";
                    }
                }

                echo "✅ Todos los stocks deducidos exitosamente\n";
            } else {
                echo "⚠️ No se encontró consumo planificado para la OT\n";
            }

            // LOG FINAL: Resumen del proceso de cambio de estado
            echo "🎯 [STATUS_CHANGE_SUMMARY] Resumen del cambio de estado OT {$id}\n";
            echo "🎯 [STATUS_CHANGE_SUMMARY] Estado anterior: {$current_status}\n";
            echo "🎯 [STATUS_CHANGE_SUMMARY] Estado nuevo: {$new_status}\n";
            echo "🎯 [STATUS_CHANGE_SUMMARY] Consumos procesados: " . count($consumptions_by_material ?? []) . "\n";
            echo "🎯 [STATUS_CHANGE_SUMMARY] Advertencias: " . count($warnings ?? []) . "\n";
            if (!empty($warnings)) {
                foreach ($warnings as $warning) {
                    echo "🎯 [STATUS_CHANGE_SUMMARY] ⚠️ {$warning}\n";
                }
            }
            echo "🎯 [STATUS_CHANGE_SUMMARY] Proceso completado exitosamente\n";
        }

        $dataToUpdate = [
            'status' => $new_status,
            'updated_at' => date('Y-m-d\TH:i:s\Z')
        ];

        // Actualizar fechas según el estado con timestamp completo
        if ($new_status === 'in_progress') {
            $dataToUpdate['actual_start_datetime'] = date('Y-m-d\TH:i:s\Z');
            $dataToUpdate['actual_start_date'] = date('Y-m-d'); // Keep for backward compatibility
        } elseif ($new_status === 'completed') {
            $dataToUpdate['actual_end_datetime'] = date('Y-m-d\TH:i:s\Z');
            $dataToUpdate['actual_end_date'] = date('Y-m-d'); // Keep for backward compatibility
        }

        $api_response = $supabase_client->patch("work_orders?id=eq.{$id}", [
            'json' => $dataToUpdate
        ]);

        $updated_work_order = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Estado de orden de trabajo actualizado exitosamente',
            'data' => $updated_work_order[0]
        ];

        // Incluir advertencias en la respuesta si las hay
        if (!empty($warnings)) {
            $data['warnings'] = $warnings;
            $data['message'] .= ' (con advertencias de stock)';
        }

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al cambiar estado de orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// PATCH /api/work-orders/{id}/complete - Completar orden de trabajo con deducción de stock
$app->patch('/work-orders/{id}/complete', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];
        $input_data = json_decode($request->getBody()->getContents(), true);

        echo "📊 Completando OT ID: {$id} con deducción de stock\n";

        // Verificar que la OT existe
        $check_response = $supabase_client->get("work_orders?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        $work_order = $check_data[0];

        // Verificar que esté en progreso
        if ($work_order['status'] !== 'in_progress') {
            $data = [
                'success' => false,
                'message' => 'Solo se pueden completar órdenes de trabajo en progreso'
            ];
            return $response->withJson($data, 400);
        }

        // Obtener items de la OT con consumo planificado
        $items_response = $supabase_client->get("work_order_items?work_order_id=eq.{$id}&select=id,product_id,planned_quantity,produced_quantity");
        $items = json_decode($items_response->getBody(), true);

        if (empty($items)) {
            $data = [
                'success' => false,
                'message' => 'La orden de trabajo no tiene items para completar'
            ];
            return $response->withJson($data, 400);
        }

        $errors = [];
        $warnings = [];

        // Procesar cada item
        foreach ($items as $item) {
            $item_id = $item['id'];
            $produced_quantity = $input_data['items'][$item_id]['produced_quantity'] ?? $item['planned_quantity'];
            $consumption_data = $input_data['items'][$item_id]['consumption'] ?? [];

            echo "📊 Procesando item {$item_id}, cantidad producida: {$produced_quantity}\n";

            // Actualizar cantidad producida del item
            $item_update_data = [
                'produced_quantity' => $produced_quantity,
                'status' => 'completed',
                'updated_at' => date('Y-m-d\TH:i:s\Z')
            ];

            $supabase_client->patch("work_order_items?id=eq.{$item_id}", [
                'json' => $item_update_data
            ]);

            // Procesar consumo de materias primas
            if (!empty($consumption_data)) {
                foreach ($consumption_data as $consumption) {
                    $raw_material_id = $consumption['raw_material_id'];
                    $actual_consumption = $consumption['actual_consumption'];

                    echo "📊 Registrando consumo: {$raw_material_id} -> {$actual_consumption}\n";

                    // Actualizar consumo real en work_order_consumption
                    $consumption_update = [
                        'actual_consumption' => $actual_consumption,
                        'updated_at' => date('Y-m-d\TH:i:s\Z')
                    ];

                    $supabase_client->patch("work_order_consumption?work_order_item_id=eq.{$item_id}&raw_material_id=eq.{$raw_material_id}", [
                        'json' => $consumption_update
                    ]);

                    // Verificar stock disponible antes de deducir
                    $stock_response = $supabase_client->get("raw_materials?id=eq.{$raw_material_id}&select=current_stock,name");
                    $stock_data = json_decode($stock_response->getBody(), true);

                    if (!empty($stock_data)) {
                        $current_stock = $stock_data[0]['current_stock'];
                        $material_name = $stock_data[0]['name'];

                        if ($current_stock < $actual_consumption) {
                            $errors[] = "Stock insuficiente de '{$material_name}'. Disponible: {$current_stock}, requerido: {$actual_consumption}";
                            continue;
                        }

                        // Deducir stock
                        $new_stock = $current_stock - $actual_consumption;
                        $stock_update = [
                            'current_stock' => $new_stock,
                            'updated_at' => date('Y-m-d\TH:i:s\Z')
                        ];

                        $supabase_client->patch("raw_materials?id=eq.{$raw_material_id}", [
                            'json' => $stock_update
                        ]);

                        echo "✅ Stock deducido: {$material_name} -> {$new_stock} (deducido: {$actual_consumption})\n";

                        // Registrar movimiento de salida en inventory_entries
                        $movement_data = [
                            'raw_material_id' => $raw_material_id,
                            'quantity' => $actual_consumption,
                            'entry_type' => 'out',
                            'notes' => "Consumo OT {$work_order['order_number']} - {$material_name}",
                            'movement_date' => date('Y-m-d\TH:i:s\Z')
                        ];

                        $supabase_client->post('inventory_entries', [
                            'json' => $movement_data
                        ]);
                    }
                }
            } else {
                $warnings[] = "No se proporcionaron datos de consumo para el item {$item_id}";
            }
        }

        // Verificar si todos los items están completados
        $all_completed = true;
        foreach ($items as $item) {
            if ($item['status'] !== 'completed') {
                $all_completed = false;
                break;
            }
        }

        // Si todos los items están completados, marcar la OT como completada
        if ($all_completed) {
            $wo_update_data = [
                'status' => 'completed',
                'actual_end_date' => date('Y-m-d\TH:i:s\Z'),
                'updated_at' => date('Y-m-d\TH:i:s\Z')
            ];

            $supabase_client->patch("work_orders?id=eq.{$id}", [
                'json' => $wo_update_data
            ]);

            echo "✅ Orden de trabajo completada exitosamente\n";
        }

        $data = [
            'success' => true,
            'message' => 'Orden de trabajo procesada exitosamente',
            'data' => [
                'work_order_id' => $id,
                'status' => $all_completed ? 'completed' : 'in_progress',
                'errors' => $errors,
                'warnings' => $warnings
            ]
        ];

        if (!empty($errors)) {
            $data['message'] .= ' (con errores en deducción de stock)';
        }

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al completar orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// DELETE /api/work-orders/{id} - Eliminar orden de trabajo
$app->delete('/work-orders/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $id = $args['id'];

        echo "📊 Eliminando OT ID: {$id}\n";

        // Verificar que la OT existe
        $check_response = $supabase_client->get("work_orders?id=eq.{$id}");
        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        // Verificar que no esté en progreso o completada
        if (in_array($check_data[0]['status'], ['in_progress', 'completed'])) {
            $data = [
                'success' => false,
                'message' => 'No se puede eliminar una orden de trabajo en progreso o completada'
            ];
            return $response->withJson($data, 400);
        }

        $api_response = $supabase_client->delete("work_orders?id=eq.{$id}");

        $data = [
            'success' => true,
            'message' => 'Orden de trabajo eliminada exitosamente'
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al eliminar orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

echo "✅ Rutas de órdenes de trabajo cargadas exitosamente\n";

// =========================================
// FUNCIONES DE VALIDACIÓN PARA ANÁLISIS
// =========================================

// Función helper para validar datos de análisis
function validateProductAnalysisData($data) {
    $errors = [];

    echo "🔍 Validando datos de análisis: " . print_r($data, true) . "\n";

    if (empty($data['work_order_item_id'])) {
        $errors[] = 'El item de orden de trabajo es requerido';
        echo "❌ Error: work_order_item_id vacío\n";
    } else {
        echo "✅ work_order_item_id válido: {$data['work_order_item_id']}\n";
        // Validar formato UUID
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $data['work_order_item_id'])) {
            $errors[] = 'El ID del item de orden de trabajo debe ser un UUID válido';
            echo "❌ Error: work_order_item_id no es un UUID válido\n";
        }
    }

    $valid_types = ['chemical', 'physical', 'microbiological', 'organoleptic', 'general'];
    if (empty($data['analysis_type']) || !in_array($data['analysis_type'], $valid_types)) {
        $errors[] = 'El tipo de análisis debe ser: chemical, physical, microbiological, organoleptic o general';
        echo "❌ Error: analysis_type inválido - valor: " . ($data['analysis_type'] ?? 'no definido') . "\n";
    } else {
        echo "✅ analysis_type válido: {$data['analysis_type']}\n";
    }

    if (!empty($data['analysis_date']) && !strtotime($data['analysis_date'])) {
        $errors[] = 'La fecha de análisis no es válida';
        echo "❌ Error: analysis_date inválida - valor: {$data['analysis_date']}\n";
    } else {
        echo "✅ analysis_date válida: " . ($data['analysis_date'] ?? 'no definida') . "\n";
    }

    echo "🎯 Errores de validación: " . count($errors) . "\n";
    if (!empty($errors)) {
        echo "❌ Errores encontrados: " . implode(', ', $errors) . "\n";
    }

    return ['errors' => $errors, 'data' => $data];
}

// =========================================
// RUTAS PARA ANÁLISIS DE PRODUCTOS
// =========================================

// GET /api/work-orders/{id}/analyses - Obtener análisis de una orden de trabajo
$app->get('/work-orders/{id}/analyses', function ($request, $response, $args) use ($supabase_client) {
    try {
        $work_order_id = $args['id'];

        echo "📊 Obteniendo análisis para OT: {$work_order_id}\n";

        // Verificar que la OT existe
        $wo_check = $supabase_client->get("work_orders?id=eq.{$work_order_id}");
        $wo_data = json_decode($wo_check->getBody(), true);

        if (empty($wo_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        // Obtener análisis usando la función SQL
        $query = "select * from get_work_order_analyses('{$work_order_id}')";
        echo "📊 Query SQL: {$query}\n";

        $api_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $query]
        ]);

        $result = json_decode($api_response->getBody(), true);
        echo "📊 Resultados encontrados: " . count($result) . "\n";

        $data = [
            'success' => true,
            'data' => $result,
            'count' => count($result)
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al obtener análisis de la orden de trabajo',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// POST /api/work-orders/{id}/analyses - Crear nuevo análisis para una orden de trabajo
$app->post('/work-orders/{id}/analyses', function ($request, $response, $args) use ($supabase_client) {
    try {
        $work_order_id = $args['id'];

        echo "📊 Creando análisis para OT: {$work_order_id}\n";

        // Verificar que la OT existe
        $wo_check = $supabase_client->get("work_orders?id=eq.{$work_order_id}");
        $wo_data = json_decode($wo_check->getBody(), true);

        if (empty($wo_data)) {
            $data = [
                'success' => false,
                'message' => 'Orden de trabajo no encontrada'
            ];
            return $response->withJson($data, 404);
        }

        // Verificar si es una petición multipart/form-data (con archivo)
        $uploadedFiles = $request->getUploadedFiles();
        $hasFile = !empty($uploadedFiles) && isset($uploadedFiles['file']);

        if ($hasFile) {
            echo "📊 Procesando subida de archivo\n";

            // Obtener datos del formulario
            $input_data = $request->getParsedBody();
            $file = $uploadedFiles['file'];

            if ($file->getError() !== UPLOAD_ERR_OK) {
                $data = [
                    'success' => false,
                    'message' => 'Error al subir el archivo'
                ];
                return $response->withJson($data, 400);
            }

            // Validar tipo de archivo
            $allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                           'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                           'image/jpeg', 'image/png'];
            $fileType = $file->getClientMediaType();

            if (!in_array($fileType, $allowedTypes)) {
                $data = [
                    'success' => false,
                    'message' => 'Tipo de archivo no permitido. Solo se permiten: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'
                ];
                return $response->withJson($data, 400);
            }

            // Validar tamaño del archivo (máximo 10MB)
            $maxSize = 10 * 1024 * 1024; // 10MB
            if ($file->getSize() > $maxSize) {
                $data = [
                    'success' => false,
                    'message' => 'El archivo es demasiado grande. Máximo permitido: 10MB'
                ];
                return $response->withJson($data, 400);
            }

            // Generar nombre único para el archivo
            $fileExtension = pathinfo($file->getClientFilename(), PATHINFO_EXTENSION);
            $uniqueFileName = uniqid('analysis_', true) . '.' . $fileExtension;
            $uploadPath = __DIR__ . '/../../uploads/analyses/' . $uniqueFileName;

            echo "📊 Guardando archivo en: {$uploadPath}\n";

            // Mover archivo a la carpeta de uploads
            $file->moveTo($uploadPath);

            if (!file_exists($uploadPath)) {
                $data = [
                    'success' => false,
                    'message' => 'Error al guardar el archivo en el servidor'
                ];
                return $response->withJson($data, 500);
            }

            echo "✅ Archivo guardado exitosamente\n";

            // Agregar información del archivo a los datos
            $input_data['file_name'] = $file->getClientFilename();
            $input_data['file_path'] = '/uploads/analyses/' . $uniqueFileName;

        } else {
            // Petición normal sin archivo
            $input_data = json_decode($request->getBody()->getContents(), true);
            echo "📊 Datos recibidos (sin archivo): " . print_r($input_data, true) . "\n";
        }

        // Validar datos
        $validation = validateProductAnalysisData($input_data);
        if (!empty($validation['errors'])) {
            $data = [
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validation['errors']
            ];
            return $response->withJson($data, 400);
        }

        // Verificar que el work_order_item_id pertenece a la OT
        $item_check = $supabase_client->get("work_order_items?id=eq.{$validation['data']['work_order_item_id']}&work_order_id=eq.{$work_order_id}");
        $item_data = json_decode($item_check->getBody(), true);

        if (empty($item_data)) {
            $data = [
                'success' => false,
                'message' => 'El item especificado no pertenece a esta orden de trabajo'
            ];
            return $response->withJson($data, 400);
        }

        // Generar número de análisis único
        $analysis_number_query = "select generate_analysis_number() as analysis_number";
        $number_response = $supabase_client->post('rpc/exec', [
            'json' => ['query' => $analysis_number_query]
        ]);
        $number_result = json_decode($number_response->getBody(), true);
        $analysis_number = $number_result[0]['analysis_number'] ?? null;

        if (!$analysis_number) {
            $data = [
                'success' => false,
                'message' => 'Error al generar número de análisis único'
            ];
            return $response->withJson($data, 500);
        }

        echo "📊 Número de análisis generado: {$analysis_number}\n";

        // Preparar datos para guardar
        $dataToSave = [
            'work_order_id' => $work_order_id,
            'work_order_item_id' => $validation['data']['work_order_item_id'],
            'analysis_number' => $analysis_number,
            'analysis_type' => $validation['data']['analysis_type'],
            'analysis_date' => isset($validation['data']['analysis_date']) ? date('Y-m-d', strtotime($validation['data']['analysis_date'])) : date('Y-m-d'),
            'notes' => $validation['data']['notes'] ?? null,
            'description' => $validation['data']['description'] ?? null,
            'created_by' => $validation['data']['created_by'] ?? 'Sistema'
        ];

        // Manejar archivo si se proporcionó
        if (isset($input_data['file_name']) && isset($input_data['file_path'])) {
            $dataToSave['file_name'] = $input_data['file_name'];
            $dataToSave['file_path'] = $input_data['file_path'];
        }

        echo "📊 Datos a guardar: " . print_r($dataToSave, true) . "\n";

        $api_response = $supabase_client->post('product_analyses', [
            'json' => $dataToSave
        ]);

        $created_analysis = json_decode($api_response->getBody(), true);

        $data = [
            'success' => true,
            'message' => 'Análisis creado exitosamente',
            'data' => $created_analysis[0],
            'analysis_number' => $analysis_number
        ];

        echo "✅ Análisis creado: {$analysis_number}\n";
        return $response->withJson($data, 201);

    } catch (RequestException $e) {
        $data = [
            'success' => false,
            'message' => 'Error al crear análisis',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/analyses/{id} - Obtener análisis específico por analysis_number
$app->get('/analyses/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $analysis_id = $args['id'];

        echo "📊 Obteniendo análisis por número: {$analysis_id}\n";

        // Buscar por analysis_number en lugar de id UUID
        $api_response = $supabase_client->get("product_analyses?analysis_number=eq.{$analysis_id}");

        $analyses = json_decode($api_response->getBody(), true);

        if (empty($analyses)) {
            echo "❌ No se encontró análisis con número: {$analysis_id}\n";
            $data = [
                'success' => false,
                'message' => 'Análisis no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        echo "✅ Análisis encontrado: {$analysis_id}\n";
        $data = [
            'success' => true,
            'data' => $analyses[0]
        ];

        return $response->withJson($data);

    } catch (RequestException $e) {
        echo "❌ Error al obtener análisis: " . $e->getMessage() . "\n";
        $data = [
            'success' => false,
            'message' => 'Error al obtener análisis',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// GET /api/analyses - Obtener todos los análisis
$app->get('/analyses', function ($request, $response, $args) use ($supabase_client) {
    try {
        $params = $request->getQueryParams();
        $limit = $params['limit'] ?? 10000;

        echo "📊 Petición GET /analyses - Obteniendo todos los análisis\n";
        echo "📊 Parámetros: " . print_r($params, true) . "\n";
        echo "📊 Límite establecido: {$limit}\n";

        // Obtener todos los análisis con información de orden de trabajo
        $query = "select=*,work_orders(order_number,description,status)&order=created_at.desc&limit=" . $limit;

        echo "📊 Query Supabase: {$query}\n";

        $api_response = $supabase_client->get("product_analyses?" . $query);

        echo "📊 Respuesta Supabase status: " . $api_response->getStatusCode() . "\n";

        $response_body = $api_response->getBody()->getContents();
        echo "📊 Cambio de bandera Raw response length: " . strlen($response_body) . " bytes\n";

        $analyses = json_decode($response_body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            echo "❌ Error decodificando JSON: " . json_last_error_msg() . "\n";
            echo "❌ Raw response content: {$response_body}\n";
            throw new Exception('JSON decode error: ' . json_last_error_msg());
        }

        echo "📊 Análisis encontrados: " . count($analyses) . "\n";

        foreach ($analyses as $index => $analysis) {
            echo "📊 Análisis {$index}: número {$analysis['analysis_number']}, tipo {$analysis['analysis_type']}, fecha {$analysis['analysis_date']}\n";
            if (isset($analysis['work_orders'])) {
                echo "📊 - OT: {$analysis['work_orders']['order_number']}, estado: {$analysis['work_orders']['status']}\n";
            }
        }

        $data = [
            'success' => true,
            'data' => $analyses,
            'count' => count($analyses)
        ];

        echo "✅ Respuesta enviada correctamente con " . count($analyses) . " análisis\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        echo "❌ RequestException en GET /analyses: " . $e->getMessage() . "\n";
        $data = [
            'success' => false,
            'message' => 'Error al obtener análisis',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    } catch (Exception $e) {
        echo "❌ Exception general en GET /analyses: " . $e->getMessage() . "\n";
        $data = [
            'success' => false,
            'message' => 'Error interno del servidor',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

// DELETE /api/analyses/{id} - Eliminar análisis
$app->delete('/analyses/{id}', function ($request, $response, $args) use ($supabase_client) {
    try {
        $analysis_id = $args['id'];

        echo "📊 Eliminando análisis con número: {$analysis_id}\n";

        // Verificar que el análisis existe (buscando por analysis_number)
        $check_response = $supabase_client->get("product_analyses?analysis_number=eq.{$analysis_id}");

        $check_data = json_decode($check_response->getBody(), true);

        if (empty($check_data)) {
            echo "❌ Análisis no encontrado con número: {$analysis_id}\n";
            $data = [
                'success' => false,
                'message' => 'Análisis no encontrado'
            ];
            return $response->withJson($data, 404);
        }

        // Eliminar usando el análisis ID real de la base de datos
        $actual_analysis_id = $check_data[0]['id'];
        $api_response = $supabase_client->delete("product_analyses?id=eq.{$actual_analysis_id}");

        $data = [
            'success' => true,
            'message' => 'Análisis eliminado exitosamente'
        ];

        echo "✅ Análisis eliminado correctamente: {$analysis_id}\n";
        return $response->withJson($data);

    } catch (RequestException $e) {
        echo "❌ Error al eliminar análisis: " . $e->getMessage() . "\n";
        $data = [
            'success' => false,
            'message' => 'Error al eliminar análisis',
            'error' => $e->getMessage()
        ];
        return $response->withJson($data, 500);
    }
});

echo "✅ Rutas de análisis de productos cargadas exitosamente\n";

// =========================================
// RUTAS PARA ARCHIVOS SUBIDOS
// =========================================

// GET /api/uploads/analyses/{filename} - Servir archivos de análisis
$app->get('/uploads/analyses/{filename}', function ($request, $response, $args) {
    try {
        $filename = $args['filename'];
        $filePath = __DIR__ . '/../../uploads/analyses/' . $filename;

        echo "📁 Solicitando archivo: {$filename}\n";
        echo "📁 Ruta completa: {$filePath}\n";

        // Verificar que el archivo existe
        if (!file_exists($filePath)) {
            echo "❌ Archivo no encontrado: {$filePath}\n";
            return $response->withStatus(404)->write('Archivo no encontrado');
        }

        // Verificar que es un archivo (no un directorio)
        if (!is_file($filePath)) {
            echo "❌ No es un archivo válido: {$filePath}\n";
            return $response->withStatus(404)->write('Archivo no encontrado');
        }

        // Obtener información del archivo
        $fileSize = filesize($filePath);
        $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';

        echo "✅ Archivo encontrado - Tamaño: {$fileSize} bytes, Tipo: {$mimeType}\n";

        // Configurar headers para la descarga
        $response = $response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Length', $fileSize)
            ->withHeader('Content-Disposition', 'inline; filename="' . basename($filePath) . '"')
            ->withHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora

        // Leer y enviar el archivo
        $fileHandle = fopen($filePath, 'rb');
        if ($fileHandle === false) {
            echo "❌ Error al abrir el archivo: {$filePath}\n";
            return $response->withStatus(500)->write('Error al leer el archivo');
        }

        // Leer el archivo en chunks para archivos grandes
        $response->getBody()->write(fread($fileHandle, $fileSize));
        fclose($fileHandle);

        echo "✅ Archivo enviado exitosamente\n";
        return $response;

    } catch (Exception $e) {
        echo "❌ Error sirviendo archivo: " . $e->getMessage() . "\n";
        return $response->withStatus(500)->write('Error interno del servidor');
    }
});

echo "✅ Rutas de archivos subidos cargadas exitosamente\n";
