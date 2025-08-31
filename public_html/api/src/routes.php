<?php

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

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
