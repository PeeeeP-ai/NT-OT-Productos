-- Agregar columna unit_price a inventory_entries
ALTER TABLE inventory_entries
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0;

-- Agregar índice para mejor rendimiento en consultas por precio
CREATE INDEX IF NOT EXISTS idx_inventory_entries_unit_price ON inventory_entries(unit_price);

-- Agregar comentario a la columna para documentación
COMMENT ON COLUMN inventory_entries.unit_price IS 'Precio unitario de la materia prima en la entrada/salida de inventario (opcional)';