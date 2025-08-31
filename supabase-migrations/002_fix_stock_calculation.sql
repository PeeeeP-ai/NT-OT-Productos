-- Script para recalcular todos los stocks de materias primas
-- Ejecutar este script si los stocks no están actualizados correctamente

-- Actualizar todos los stocks basándose en las entradas de inventario
UPDATE raw_materials 
SET current_stock = calculate_raw_material_stock(id),
    updated_at = NOW()
WHERE id IN (SELECT DISTINCT raw_material_id FROM inventory_entries);

-- Verificar que los stocks se calcularon correctamente
SELECT 
    rm.code,
    rm.name,
    rm.current_stock as stock_bd,
    calculate_raw_material_stock(rm.id) as stock_calculado,
    (SELECT COUNT(*) FROM inventory_entries WHERE raw_material_id = rm.id) as total_entradas
FROM raw_materials rm
WHERE rm.is_active = true
ORDER BY rm.code;