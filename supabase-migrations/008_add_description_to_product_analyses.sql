-- Migración 008: Agregar columna description a product_analyses
-- Soluciona problema de error 400 - columna no encontrada en schema cache

ALTER TABLE product_analyses
ADD COLUMN IF NOT EXISTS description TEXT;

-- Agregar comentario a la columna
COMMENT ON COLUMN product_analyses.description IS 'Descripción detallada del análisis de producto';

-- Crear índice para búsqueda en la descripción
CREATE INDEX IF NOT EXISTS idx_product_analyses_description ON product_analyses USING gin(to_tsvector('spanish', description));

COMMIT;