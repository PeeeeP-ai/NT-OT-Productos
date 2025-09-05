-- Crear tabla para análisis de productos terminados
-- Migración 006: Sistema de análisis de productos

-- Crear tabla de análisis de productos
CREATE TABLE IF NOT EXISTS product_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_item_id UUID,
  analysis_number VARCHAR(6) NOT NULL UNIQUE,
  analysis_type VARCHAR(50) NOT NULL DEFAULT 'general',
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_analyses_work_order_id ON product_analyses(work_order_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_work_order_item_id ON product_analyses(work_order_item_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_analysis_number ON product_analyses(analysis_number);
CREATE INDEX IF NOT EXISTS idx_product_analyses_analysis_date ON product_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_analyses_analysis_type ON product_analyses(analysis_type);

-- Eliminar trigger si existe antes de crearlo
DROP TRIGGER IF EXISTS update_product_analyses_updated_at ON product_analyses;
DROP TRIGGER IF EXISTS update_product_analyses_updated_at_column ON product_analyses;

-- Crear trigger para actualizar updated_at en product_analyses
CREATE OR REPLACE FUNCTION update_product_analyses_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_analyses_updated_at
  BEFORE UPDATE ON product_analyses
  FOR EACH ROW EXECUTE FUNCTION update_product_analyses_updated_at_column();

-- Políticas RLS para product_analyses
ALTER TABLE product_analyses ENABLE ROW LEVEL SECURITY;

-- Eliminar política si existe antes de crearla
DROP POLICY IF EXISTS "Permitir todo acceso en product_analyses" ON product_analyses;

CREATE POLICY "Permitir todo acceso en product_analyses" ON product_analyses
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Función para generar número de análisis único de 6 dígitos
CREATE OR REPLACE FUNCTION generate_analysis_number()
RETURNS VARCHAR(6) AS $$
DECLARE
  result_number VARCHAR(6);
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  -- Intentar generar un número único hasta max_attempts veces
  WHILE attempts < max_attempts LOOP
    -- Generar número aleatorio de 6 dígitos (100000-999999)
    result_number := LPAD((100000 + floor(random() * 900000))::TEXT, 6, '0');

    -- Verificar si ya existe
    IF NOT EXISTS (SELECT 1 FROM product_analyses WHERE analysis_number = result_number) THEN
      RETURN result_number;
    END IF;

    attempts := attempts + 1;
  END LOOP;

  -- Si no se pudo generar un número único después de max_attempts, usar timestamp
  result_number := LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER % 1000000, 6, '0');
  RETURN result_number;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener análisis de una orden de trabajo
CREATE OR REPLACE FUNCTION get_work_order_analyses(work_order_uuid UUID)
RETURNS TABLE (
  analysis_id UUID,
  analysis_number VARCHAR(6),
  analysis_type VARCHAR(50),
  file_name VARCHAR(255),
  analysis_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ,
  work_order_item_id UUID,
  product_name VARCHAR(255),
  product_unit VARCHAR(50)
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
    pa.created_at,
    pa.work_order_item_id,
    p.name as product_name,
    p.unit as product_unit
  FROM product_analyses pa
  JOIN work_order_items woi ON pa.work_order_item_id = woi.id
  JOIN products p ON woi.product_id = p.id
  WHERE pa.work_order_id = work_order_uuid
  ORDER BY pa.created_at DESC;
END;
$$ LANGUAGE plpgsql;
