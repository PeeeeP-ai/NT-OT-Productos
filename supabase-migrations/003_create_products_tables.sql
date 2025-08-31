-- Crear tablas para productos y fórmulas
-- Migración 003: Sistema de productos con fórmulas

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
  base_quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de fórmulas (relación muchos a muchos entre productos y materias primas)
CREATE TABLE IF NOT EXISTS product_formulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, raw_material_id) -- Prevenir duplicados
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_formulas_product_id ON product_formulas(product_id);
CREATE INDEX IF NOT EXISTS idx_product_formulas_raw_material_id ON product_formulas(raw_material_id);

-- Crear trigger para actualizar updated_at en products
CREATE OR REPLACE FUNCTION update_products_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_products_updated_at_column();

-- Políticas RLS para products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en products" ON products 
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Políticas RLS para product_formulas
ALTER TABLE product_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en product_formulas" ON product_formulas 
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Función para obtener productos con sus fórmulas (útil para consultas optimizadas)
CREATE OR REPLACE FUNCTION get_product_with_formula(product_uuid UUID)
RETURNS TABLE (
  product_id UUID,
  product_name VARCHAR(255),
  product_description TEXT,
  product_unit VARCHAR(50),
  product_base_quantity DECIMAL(10,3),
  product_is_active BOOLEAN,
  product_created_at TIMESTAMPTZ,
  product_updated_at TIMESTAMPTZ,
  formula_id UUID,
  raw_material_id UUID,
  raw_material_name VARCHAR(255),
  raw_material_unit VARCHAR(50),
  raw_material_current_stock DECIMAL(10,3),
  formula_quantity DECIMAL(10,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    p.unit as product_unit,
    p.base_quantity as product_base_quantity,
    p.is_active as product_is_active,
    p.created_at as product_created_at,
    p.updated_at as product_updated_at,
    pf.id as formula_id,
    rm.id as raw_material_id,
    rm.name as raw_material_name,
    rm.unit as raw_material_unit,
    rm.current_stock as raw_material_current_stock,
    pf.quantity as formula_quantity
  FROM products p
  LEFT JOIN product_formulas pf ON p.id = pf.product_id
  LEFT JOIN raw_materials rm ON pf.raw_material_id = rm.id
  WHERE p.id = product_uuid
  ORDER BY rm.name;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular cuántas unidades de un producto se pueden producir
CREATE OR REPLACE FUNCTION calculate_producible_quantity(product_uuid UUID)
RETURNS DECIMAL(10,3) AS $$
DECLARE
  min_possible DECIMAL(10,3) := NULL;
  formula_record RECORD;
  possible_from_material DECIMAL(10,3);
BEGIN
  -- Iterar sobre cada materia prima en la fórmula
  FOR formula_record IN 
    SELECT pf.quantity, rm.current_stock
    FROM product_formulas pf
    JOIN raw_materials rm ON pf.raw_material_id = rm.id
    WHERE pf.product_id = product_uuid AND rm.is_active = true
  LOOP
    -- Calcular cuántas unidades se pueden hacer con esta materia prima
    IF formula_record.quantity > 0 THEN
      possible_from_material := FLOOR(formula_record.current_stock / formula_record.quantity);
      
      -- Mantener el mínimo (factor limitante)
      IF min_possible IS NULL OR possible_from_material < min_possible THEN
        min_possible := possible_from_material;
      END IF;
    END IF;
  END LOOP;
  
  -- Si no hay fórmula o no se puede producir nada, retornar 0
  RETURN COALESCE(min_possible, 0);
END;
$$ LANGUAGE plpgsql;

-- Insertar datos de ejemplo para testing (opcional - comentar en producción)
/*
INSERT INTO products (name, description, unit, base_quantity) VALUES 
('Agrocup', 'Fertilizante líquido premium para cultivos', 'litro', 1000),
('Nutrimix', 'Mezcla nutritiva para plantas ornamentales', 'kg', 50),
('Calciomax', 'Suplemento de calcio para suelos ácidos', 'kg', 25);

-- Ejemplo de fórmulas (requiere que existan las materias primas)
-- INSERT INTO product_formulas (product_id, raw_material_id, quantity) VALUES 
-- ((SELECT id FROM products WHERE name = 'Agrocup'), (SELECT id FROM raw_materials WHERE code = 'CALC'), 200),
-- ((SELECT id FROM products WHERE name = 'Agrocup'), (SELECT id FROM raw_materials WHERE code = 'COBR'), 150),
-- ((SELECT id FROM products WHERE name = 'Agrocup'), (SELECT id FROM raw_materials WHERE code = 'AGUA'), 20);
*/