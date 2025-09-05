-- Migración 007: Corregir estructura de análisis de productos
-- Los análisis deben ser de la formulación completa, no de productos individuales

-- Agregar columna para descripción del análisis (opcional)
ALTER TABLE product_analyses ADD COLUMN IF NOT EXISTS description TEXT;

-- Quitar la restricción de work_order_item_id ya que los análisis son de la OT completa
ALTER TABLE product_analyses DROP CONSTRAINT IF EXISTS product_analyses_work_order_item_id_fkey;
ALTER TABLE product_analyses DROP COLUMN IF EXISTS work_order_item_id;

-- Actualizar índices (quitar el índice de work_order_item_id)
DROP INDEX IF EXISTS idx_product_analyses_work_order_item_id;

-- Eliminar la función existente antes de recrearla con nueva signatura
DROP FUNCTION IF EXISTS get_work_order_analyses(UUID);

-- Función actualizada para obtener análisis de una orden de trabajo
-- Ahora sin JOIN con productos específicos
CREATE FUNCTION get_work_order_analyses(work_order_uuid UUID)
RETURNS TABLE (
  analysis_id UUID,
  analysis_number VARCHAR(6),
  analysis_type VARCHAR(50),
  file_name VARCHAR(255),
  analysis_date DATE,
  notes TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  created_by VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id as analysis_id,
    pa.analysis_number,
    pa.analysis_type,
    pa.file_name,
    pa.analysis_date,
    pa.notes,
    pa.description,
    pa.created_at,
    pa.created_by
  FROM product_analyses pa
  WHERE pa.work_order_id = work_order_uuid
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Actualizar comentarios en la tabla
COMMENT ON TABLE product_analyses IS 'Tabla de análisis de productos terminados - análisis de la formulación completa de una orden de trabajo';
COMMENT ON COLUMN product_analyses.work_order_id IS 'ID de la orden de trabajo (análisis de toda la formulación)';
COMMENT ON COLUMN product_analyses.description IS 'Descripción opcional del análisis';
