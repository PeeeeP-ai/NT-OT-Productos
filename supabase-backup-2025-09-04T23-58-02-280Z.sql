-- Supabase Database Dump
-- Generated on 2025-09-04T23:58:02.285Z

-- Schema Migrations
-- Migration: 001_create_raw_materials_tables.sql
-- Crear tabla de materias primas
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
  current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(10,3) DEFAULT 0,
  max_stock DECIMAL(10,3) DEFAULT NULL,
  location VARCHAR(255),
  supplier VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de entradas de inventario
CREATE TABLE IF NOT EXISTS inventory_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('in', 'out')),
  movement_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  user_id VARCHAR(255), -- Para futuras implementaciones con autenticación
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento (si no existen)
CREATE INDEX IF NOT EXISTS idx_raw_materials_code ON raw_materials(code);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active ON raw_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_raw_material_id ON inventory_entries(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_created_at ON inventory_entries(created_at DESC);

-- Crear trigger para actualizar updated_at en raw_materials
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_raw_materials_updated_at BEFORE UPDATE ON raw_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular stock actual
CREATE OR REPLACE FUNCTION calculate_raw_material_stock(material_uuid UUID)
RETURNS DECIMAL(10,3) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(
      CASE
        WHEN entry_type = 'in' THEN quantity
        WHEN entry_type = 'out' THEN -quantity
      END
    ) FROM inventory_entries WHERE raw_material_id = material_uuid), 0
  );
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar stock automáticamente
CREATE OR REPLACE FUNCTION update_raw_material_stock()
RETURNS TRIGGER AS $$
DECLARE
  material_id UUID;
  old_stock DECIMAL(10,3);
  new_stock DECIMAL(10,3);
BEGIN
  material_id := COALESCE(NEW.raw_material_id, OLD.raw_material_id);

  -- Obtener stock anterior
  SELECT current_stock INTO old_stock FROM raw_materials WHERE id = material_id;

  -- Calcular nuevo stock
  new_stock := calculate_raw_material_stock(material_id);

  UPDATE raw_materials SET
    current_stock = new_stock,
    updated_at = NOW()
  WHERE id = material_id;

  RAISE NOTICE 'Trigger update_raw_material_stock: ID=% OLD_STOCK=% NEW_STOCK=%', material_id, old_stock, new_stock;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock
DROP TRIGGER IF EXISTS update_stock_after_inventory_entry ON inventory_entries;
CREATE TRIGGER update_stock_after_inventory_entry
  AFTER INSERT OR UPDATE OR DELETE ON inventory_entries
  FOR EACH ROW EXECUTE FUNCTION update_raw_material_stock();

-- Políticas RLS para raw_materials (si no existe)
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Permitir todo acceso en raw_materials" ON raw_materials FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Policy "Permitir todo acceso en raw_materials" ya existe, saltando...';
END $$;

-- Políticas RLS para inventory_entries (si no existe)
ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Permitir todo acceso en inventory_entries" ON inventory_entries FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Policy "Permitir todo acceso en inventory_entries" ya existe, saltando...';
END $$;

-- Migration: 002_fix_stock_calculation.sql
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

-- Migration: 003_create_products_tables.sql
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

-- Migration: 004_create_work_orders_tables.sql
-- Crear tablas para órdenes de trabajo (OT)
-- Migración 004: Sistema de órdenes de trabajo

-- Crear tabla de órdenes de trabajo
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_datetime TIMESTAMPTZ,
  actual_end_datetime TIMESTAMPTZ,
  -- Keep old fields for backward compatibility
  actual_start_date DATE,
  actual_end_date DATE,
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de items de órdenes de trabajo (productos a producir)
CREATE TABLE IF NOT EXISTS work_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  planned_quantity DECIMAL(10,3) NOT NULL CHECK (planned_quantity > 0),
  produced_quantity DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
  unit VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_order_id, product_id) -- Prevenir duplicados de productos en la misma OT
);

-- Crear tabla para el consumo de materias primas en OT (para seguimiento)
CREATE TABLE IF NOT EXISTS work_order_consumption (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_item_id UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  planned_consumption DECIMAL(10,3) NOT NULL CHECK (planned_consumption >= 0),
  actual_consumption DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (actual_consumption >= 0),
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_order_item_id, raw_material_id) -- Prevenir duplicados
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_planned_start ON work_orders(planned_start_date);
CREATE INDEX IF NOT EXISTS idx_work_order_items_work_order_id ON work_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_product_id ON work_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_status ON work_order_items(status);
CREATE INDEX IF NOT EXISTS idx_work_order_consumption_item_id ON work_order_consumption(work_order_item_id);
CREATE INDEX IF NOT EXISTS idx_work_order_consumption_raw_material_id ON work_order_consumption(raw_material_id);

-- Crear trigger para actualizar updated_at en work_orders
CREATE OR REPLACE FUNCTION update_work_orders_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_work_orders_updated_at_column();

-- Crear trigger para actualizar updated_at en work_order_items
CREATE OR REPLACE FUNCTION update_work_order_items_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_order_items_updated_at
  BEFORE UPDATE ON work_order_items
  FOR EACH ROW EXECUTE FUNCTION update_work_order_items_updated_at_column();

-- Políticas RLS para work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en work_orders" ON work_orders
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Políticas RLS para work_order_items
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en work_order_items" ON work_order_items
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Políticas RLS para work_order_consumption
ALTER TABLE work_order_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en work_order_consumption" ON work_order_consumption
  FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Función para generar número de orden automáticamente
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
  year_month_pattern VARCHAR(20);
BEGIN
  -- Usar la fecha actual para determinar el año-mes
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());
  year_month_pattern := 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-%';

  -- Obtener el último número de secuencia para el año-mes actual
  -- Manejar tanto el formato antiguo (OT-YYYY-XXXX) como el nuevo (OT-YYYY-MM-XXX)
  SELECT COALESCE(MAX(
    CASE
      WHEN work_orders.order_number LIKE 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-%' THEN
        CAST(SUBSTRING(work_orders.order_number FROM '[0-9]{3}$') AS INTEGER)
      WHEN work_orders.order_number LIKE 'OT-' || current_year || '-%' AND work_orders.order_number NOT LIKE 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-%' THEN
        -- Para formato antiguo, extraer los últimos 4 dígitos
        CAST(SUBSTRING(work_orders.order_number FROM '[0-9]{4}$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_number
  FROM work_orders
  WHERE work_orders.order_number LIKE 'OT-' || current_year || '-%';

  -- Generar el número de orden con formato OT-YYYY-MM-001
  result_order_number := 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-' || LPAD(sequence_number::TEXT, 3, '0');

  RETURN result_order_number;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar disponibilidad de materias primas para una OT
CREATE OR REPLACE FUNCTION check_raw_materials_availability(work_order_uuid UUID)
RETURNS TABLE (
  raw_material_id UUID,
  raw_material_name VARCHAR(255),
  required_quantity DECIMAL(10,3),
  available_quantity DECIMAL(10,3),
  shortage_quantity DECIMAL(10,3),
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rm.id as raw_material_id,
    rm.name as raw_material_name,
    -- Calculate required quantity using rule of three instead of using stored consumption
    SUM(
      CASE
        WHEN p.base_quantity > 0 THEN (pf.quantity * woi.planned_quantity / p.base_quantity)
        ELSE pf.quantity
      END
    ) as required_quantity,
    rm.current_stock as available_quantity,
    GREATEST(0, SUM(
      CASE
        WHEN p.base_quantity > 0 THEN (pf.quantity * woi.planned_quantity / p.base_quantity)
        ELSE pf.quantity
      END
    ) - rm.current_stock) as shortage_quantity,
    (rm.current_stock >= SUM(
      CASE
        WHEN p.base_quantity > 0 THEN (pf.quantity * woi.planned_quantity / p.base_quantity)
        ELSE pf.quantity
      END
    )) as is_available
  FROM work_order_items woi
  JOIN products p ON woi.product_id = p.id
  JOIN product_formulas pf ON p.id = pf.product_id
  JOIN raw_materials rm ON pf.raw_material_id = rm.id
  WHERE woi.work_order_id = work_order_uuid
  GROUP BY rm.id, rm.name, rm.current_stock
  ORDER BY rm.name;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener OT completa con productos y fórmulas
CREATE OR REPLACE FUNCTION get_work_order_details(work_order_uuid UUID)
RETURNS TABLE (
  work_order_id UUID,
  order_number VARCHAR(50),
  work_order_description TEXT,
  work_order_status VARCHAR(20),
  work_order_priority VARCHAR(10),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_datetime TIMESTAMPTZ,
  actual_end_datetime TIMESTAMPTZ,
  -- Keep old fields for backward compatibility
  actual_start_date DATE,
  actual_end_date DATE,
  work_order_created_at TIMESTAMPTZ,
  item_id UUID,
  product_id UUID,
  product_name VARCHAR(255),
  product_unit VARCHAR(50),
  product_base_quantity DECIMAL(10,3),
  planned_quantity DECIMAL(10,3),
  produced_quantity DECIMAL(10,3),
  item_status VARCHAR(20),
  formula_raw_material_id UUID,
  raw_material_name VARCHAR(255),
  raw_material_unit VARCHAR(50),
  raw_material_current_stock DECIMAL(10,3),
  formula_quantity DECIMAL(10,3),
  consumption_planned DECIMAL(10,3),
  consumption_actual DECIMAL(10,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wo.id as work_order_id,
    wo.order_number,
    wo.description as work_order_description,
    wo.status as work_order_status,
    wo.priority as work_order_priority,
    wo.planned_start_date,
    wo.planned_end_date,
    wo.actual_start_datetime,
    wo.actual_end_datetime,
    -- Keep old fields for backward compatibility
    wo.actual_start_date,
    wo.actual_end_date,
    wo.created_at as work_order_created_at,
    woi.id as item_id,
    p.id as product_id,
    p.name as product_name,
    p.unit as product_unit,
    p.base_quantity as product_base_quantity,
    woi.planned_quantity,
    woi.produced_quantity,
    woi.status as item_status,
    rm.id as formula_raw_material_id,
    rm.name as raw_material_name,
    rm.unit as raw_material_unit,
    rm.current_stock as raw_material_current_stock,
    -- Calculate adjusted formula quantity using rule of three: (base_formula_quantity * planned_quantity) / base_quantity
    CASE
      WHEN p.base_quantity > 0 AND p.base_quantity IS NOT NULL THEN ROUND((pf.quantity * woi.planned_quantity / p.base_quantity)::numeric, 3)
      ELSE pf.quantity
    END as formula_quantity,
    -- Calculate required quantity using rule of three: (formula_quantity * planned_quantity) / base_quantity
    CASE
      WHEN p.base_quantity > 0 AND p.base_quantity IS NOT NULL THEN ROUND((pf.quantity * woi.planned_quantity / p.base_quantity)::numeric, 3)
      ELSE pf.quantity
    END as consumption_planned,
    woc.actual_consumption
  FROM work_orders wo
  LEFT JOIN work_order_items woi ON wo.id = woi.work_order_id
  LEFT JOIN products p ON woi.product_id = p.id
  LEFT JOIN product_formulas pf ON p.id = pf.product_id
  LEFT JOIN raw_materials rm ON pf.raw_material_id = rm.id
  LEFT JOIN work_order_consumption woc ON woi.id = woc.work_order_item_id AND rm.id = woc.raw_material_id
  WHERE wo.id = work_order_uuid
  ORDER BY p.name, rm.name;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular consumo planificado basado en fórmula del producto
CREATE OR REPLACE FUNCTION calculate_planned_consumption(
  p_product_id UUID,
  p_quantity DECIMAL(10,3)
)
RETURNS TABLE (
  raw_material_id UUID,
  consumption_quantity DECIMAL(10,3),
  unit VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.raw_material_id,
    (pf.quantity * p_quantity / p.base_quantity) as consumption_quantity,
    rm.unit
  FROM product_formulas pf
  JOIN products p ON pf.product_id = p.id
  JOIN raw_materials rm ON pf.raw_material_id = rm.id
  WHERE pf.product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de orden basado en fecha planificada
CREATE OR REPLACE FUNCTION generate_work_order_number_for_date(
  p_planned_start_date DATE
)
RETURNS VARCHAR(50) AS $$
DECLARE
  target_year INTEGER;
  target_month INTEGER;
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
BEGIN
  -- Usar la fecha planificada para determinar el año-mes
  target_year := EXTRACT(YEAR FROM p_planned_start_date);
  target_month := EXTRACT(MONTH FROM p_planned_start_date);

  -- Obtener el último número de secuencia para el año-mes de la fecha planificada
  -- Manejar tanto el formato antiguo (OT-YYYY-XXXX) como el nuevo (OT-YYYY-MM-XXX)
  SELECT COALESCE(MAX(
    CASE
      WHEN work_orders.order_number LIKE 'OT-' || target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-%' THEN
        CAST(SUBSTRING(work_orders.order_number FROM '[0-9]{3}$') AS INTEGER)
      WHEN work_orders.order_number LIKE 'OT-' || target_year || '-%' AND work_orders.order_number NOT LIKE 'OT-' || target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-%' THEN
        -- Para formato antiguo, extraer los últimos 4 dígitos
        CAST(SUBSTRING(work_orders.order_number FROM '[0-9]{4}$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_number
  FROM work_orders
  WHERE work_orders.order_number LIKE 'OT-' || target_year || '-%';

  -- Generar el número de orden con formato OT-YYYY-MM-001
  result_order_number := 'OT-' || target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-' || LPAD(sequence_number::TEXT, 3, '0');

  RETURN result_order_number;
END;
$$ LANGUAGE plpgsql;


-- Migration: 005_add_unit_price_to_inventory_entries.sql
-- Agregar columna unit_price a inventory_entries
ALTER TABLE inventory_entries
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0;

-- Agregar índice para mejor rendimiento en consultas por precio
CREATE INDEX IF NOT EXISTS idx_inventory_entries_unit_price ON inventory_entries(unit_price);

-- Agregar comentario a la columna para documentación
COMMENT ON COLUMN inventory_entries.unit_price IS 'Precio unitario de la materia prima en la entrada/salida de inventario (opcional)';

-- Migration: 006_create_product_analyses_tables.sql
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


-- Migration: 007_fix_product_analyses_structure.sql
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


-- Migration: 008_add_description_to_product_analyses.sql
-- Migración 008: Agregar columna description a product_analyses
-- Soluciona problema de error 400 - columna no encontrada en schema cache

ALTER TABLE product_analyses
ADD COLUMN IF NOT EXISTS description TEXT;

-- Agregar comentario a la columna
COMMENT ON COLUMN product_analyses.description IS 'Descripción detallada del análisis de producto';

-- Crear índice para búsqueda en la descripción
CREATE INDEX IF NOT EXISTS idx_product_analyses_description ON product_analyses USING gin(to_tsvector('spanish', description));

COMMIT;

-- Data
-- Data for table: raw_materials
INSERT INTO raw_materials (id, code, name, description, unit, current_stock, min_stock, max_stock, location, supplier, is_active, created_at, updated_at) VALUES ('6484b13e-e10f-4eaa-aa9f-2db118bf0dc1', 'dasdas', 'dasdas', '', 'unidad', 300, 0, 5000, 'dasd', 'dasda', true, '2025-08-31T15:35:17.186+00:00', '2025-09-04T17:23:22.068526+00:00');
INSERT INTO raw_materials (id, code, name, description, unit, current_stock, min_stock, max_stock, location, supplier, is_active, created_at, updated_at) VALUES ('39cb4672-992a-48da-b1ec-184b264acca8', 'czc', 'cxzcz', 'fsd', 'kg', -1589, 20, 7000, 'czxc', 'cxzc', true, '2025-08-31T15:27:54.356+00:00', '2025-09-04T20:50:35.065703+00:00');
INSERT INTO raw_materials (id, code, name, description, unit, current_stock, min_stock, max_stock, location, supplier, is_active, created_at, updated_at) VALUES ('c88d7765-cf12-480a-bd2b-1d3f686ee668', '43432', 'gbf dsfsdf s sfd', NULL, 'litro', 1960, 0, 70000, '33ewr', 'fsd', true, '2025-08-31T16:26:48.898+00:00', '2025-09-04T20:50:35.51781+00:00');

-- Data for table: products
INSERT INTO products (id, name, description, unit, base_quantity, is_active, created_at, updated_at) VALUES ('2fbc8353-fe32-46a4-ba18-25d68a4cf219', 'aaaa', 'aaa', 'kg', 100, true, '2025-08-31T17:27:06.604+00:00', '2025-08-31T19:12:21.50654+00:00');
INSERT INTO products (id, name, description, unit, base_quantity, is_active, created_at, updated_at) VALUES ('cbcae268-c006-439d-886b-5ef31a3025de', 'Josep Beltran', 'dssf', 'litro', 1000, true, '2025-08-31T17:14:34.767+00:00', '2025-08-31T20:38:25.197354+00:00');
INSERT INTO products (id, name, description, unit, base_quantity, is_active, created_at, updated_at) VALUES ('452a5dd5-27d4-46fd-a733-bcf5ea8a06af', 'jhgkjhgj', NULL, 'unidad', 1, true, '2025-09-04T19:48:54.641+00:00', '2025-09-04T19:48:54.641+00:00');

-- Data for table: product_formulas
INSERT INTO product_formulas (id, product_id, raw_material_id, quantity, created_at) VALUES ('0fba2104-8e46-48b2-b38f-2a6c0fb99b6c', '2fbc8353-fe32-46a4-ba18-25d68a4cf219', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, '2025-08-31T18:37:41.666974+00:00');
INSERT INTO product_formulas (id, product_id, raw_material_id, quantity, created_at) VALUES ('39252067-cb70-48e1-86b6-94b9635ffcf8', '2fbc8353-fe32-46a4-ba18-25d68a4cf219', '39cb4672-992a-48da-b1ec-184b264acca8', 200, '2025-08-31T18:38:14.504328+00:00');
INSERT INTO product_formulas (id, product_id, raw_material_id, quantity, created_at) VALUES ('cad49abd-d06c-4de0-9ede-34cd6c85e54d', 'cbcae268-c006-439d-886b-5ef31a3025de', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 10, '2025-08-31T20:38:43.483931+00:00');
INSERT INTO product_formulas (id, product_id, raw_material_id, quantity, created_at) VALUES ('50a47669-8691-4671-adce-5bd5a77050d0', '452a5dd5-27d4-46fd-a733-bcf5ea8a06af', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 500, '2025-09-04T20:30:35.952383+00:00');

-- Data for table: work_orders
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('c91cc653-d5c7-4e28-a7c6-a0ff5c0cbe27', 'OT-2025-09-006', 'bffdgdgfd', 'in_progress', 'normal', '2025-08-13', '2025-08-14', NULL, 'Sistema', '2025-09-01T03:35:46.587+00:00', '2025-09-01T03:35:57.93163+00:00', '2025-09-01T03:35:56.823+00:00', NULL, '2025-09-01T03:35:56.823+00:00', NULL);
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('186d0207-c954-4059-9c19-d71d7debf25b', 'OT-2025-09-004', 'adsdasdasdas', 'completed', 'normal', '2025-08-13', '2025-08-15', NULL, 'Sistema', '2025-09-01T03:30:44.74+00:00', '2025-09-01T03:47:53.924869+00:00', '2025-09-01T03:30:50.307+00:00', '2025-09-01T03:47:52.812+00:00', '2025-09-01T03:30:50.307+00:00', '2025-09-01T03:47:52.812+00:00');
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('c90094d5-86f0-4d69-8d0b-3c62614b24bf', 'OT-2025-09-008', 'sdfsdf', 'pending', 'normal', '2025-09-02', '2025-09-10', NULL, 'Sistema', '2025-09-04T12:18:34.538+00:00', '2025-09-04T12:18:34.538+00:00', NULL, NULL, NULL, NULL);
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('d412a091-ca22-4f2d-a820-bf01f1b6c2c0', 'OT-2025-09-001', 'dasdsadsadsa', 'completed', 'normal', '2025-08-12', '2025-08-20', NULL, 'Sistema', '2025-09-01T03:17:18.966+00:00', '2025-09-01T03:17:42.639425+00:00', '2025-09-01T03:17:30.926+00:00', '2025-09-01T03:17:41.524+00:00', NULL, NULL);
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('b27ebc9b-8794-4f91-b099-7bdd6492bb36', 'OT-2025-09-007', 'afdsfsdf', 'completed', 'normal', '2025-09-10', '2025-09-12', NULL, 'Sistema', '2025-09-04T12:16:57.33+00:00', '2025-09-04T12:21:36.50153+00:00', '2025-09-04T12:17:38.804+00:00', '2025-09-04T12:21:35.872+00:00', '2025-09-04T12:17:38.804+00:00', '2025-09-04T12:21:35.872+00:00');
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('97abfae5-18fb-415a-8328-d1ac9f6d0c6b', 'OT-2025-09-003', 'Test orden para verificar fechas', 'completed', 'normal', '2025-09-02', '2025-09-05', NULL, 'Sistema', '2025-09-01T03:19:53.657+00:00', '2025-09-01T03:21:55.620311+00:00', '2025-09-01T03:21:35.291+00:00', '2025-09-01T03:21:54.511+00:00', '2025-09-01T03:21:35.291+00:00', '2025-09-01T03:21:54.511+00:00');
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('e33f82f7-8bed-430f-98b1-bf869e1d0184', 'OT-2025-09-002', 'Test orden para verificar fechas', 'completed', 'normal', '2025-09-02', '2025-09-05', NULL, 'Sistema', '2025-09-01T03:19:36.995+00:00', '2025-09-01T03:27:55.8236+00:00', '2025-09-01T03:27:34.191+00:00', '2025-09-01T03:27:54.716+00:00', '2025-09-01T03:27:34.191+00:00', '2025-09-01T03:27:54.716+00:00');
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('e0b24ef0-7480-430f-b19b-33d5288a043f', 'OT-2025-09-005', 'sdasdsa', 'in_progress', 'normal', '2025-08-05', '2025-08-14', NULL, 'Sistema', '2025-09-01T03:32:00.825+00:00', '2025-09-01T03:32:24.707247+00:00', '2025-09-01T03:32:23.594+00:00', NULL, '2025-09-01T03:32:23.594+00:00', NULL);
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('7e51adca-00b1-4a35-b4ad-95497614027f', 'OT-2025-09-010', 'nvbnbn', 'pending', 'normal', '2025-09-16', '2025-09-25', NULL, 'Sistema', '2025-09-04T19:19:13.145+00:00', '2025-09-04T19:19:13.145+00:00', NULL, NULL, NULL, NULL);
INSERT INTO work_orders (id, order_number, description, status, priority, planned_start_date, planned_end_date, notes, created_by, created_at, updated_at, actual_start_date, actual_end_date, actual_start_datetime, actual_end_datetime) VALUES ('210f1cac-8f94-418e-a795-fcc9152eb1c6', 'OT-2025-09-009', 'fsdfdsfsd', 'completed', 'normal', '2025-09-02', '2025-09-12', NULL, 'Sistema', '2025-09-04T17:54:25.129+00:00', '2025-09-04T20:50:37.611+00:00', '2025-09-04T20:50:34.851+00:00', '2025-09-04T20:50:36.843+00:00', '2025-09-04T20:50:34.851+00:00', '2025-09-04T20:50:36.843+00:00');

-- Data for table: inventory_entries
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('7ffae53b-fe3a-4e76-9630-227791d84057', '39cb4672-992a-48da-b1ec-184b264acca8', 500, 'in', '2025-08-31T15:33:00+00:00', NULL, NULL, '2025-08-31T15:33:52.326546+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('3a105a09-abca-449d-9c2a-15c8595f8ce6', '39cb4672-992a-48da-b1ec-184b264acca8', 44, 'in', '2025-08-31T15:34:00+00:00', 'sdfs', NULL, '2025-08-31T15:34:09.086122+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('a78e2a0f-d792-4231-bd92-b6a9093f2c23', '39cb4672-992a-48da-b1ec-184b264acca8', 500, 'in', '2025-08-13T15:34:00+00:00', NULL, NULL, '2025-08-31T15:34:44.113387+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('15b42007-4dc9-493a-9e36-50f36da9b6d7', '39cb4672-992a-48da-b1ec-184b264acca8', 30, 'in', '2025-08-31T15:41:00+00:00', NULL, NULL, '2025-08-31T15:41:22.263541+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bed5c627-29d3-48ce-8c9e-0ab92e188d05', '39cb4672-992a-48da-b1ec-184b264acca8', 30, 'in', '2025-08-31T15:50:00+00:00', NULL, NULL, '2025-08-31T15:50:56.644219+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('b1c1a391-5db4-4274-b70e-a027c1c70fc9', '39cb4672-992a-48da-b1ec-184b264acca8', 44, 'in', '2025-08-31T16:02:00+00:00', NULL, NULL, '2025-08-31T16:02:45.438352+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('2ba6c279-c940-4e09-9a90-43f15f84500d', '39cb4672-992a-48da-b1ec-184b264acca8', 22, 'in', '2025-08-31T16:02:00+00:00', NULL, NULL, '2025-08-31T16:02:49.437743+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('6574e5aa-3849-480b-be93-3d52bdab0f48', '39cb4672-992a-48da-b1ec-184b264acca8', 55, 'out', '2025-08-31T16:22:00+00:00', NULL, NULL, '2025-08-31T16:23:03.61408+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('d6724af7-ae30-4ec5-8717-148d9eacd305', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 500, 'in', '2025-08-31T16:26:00+00:00', NULL, NULL, '2025-08-31T16:26:57.785986+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bafc9208-4aac-4e08-b2c7-de295c796e1a', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 20, 'in', '2025-09-01T01:20:00+00:00', NULL, NULL, '2025-09-01T01:20:36.24966+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('7952b866-9caf-472a-a285-8d3f7f16cac6', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 10, 'out', '2025-09-01T01:40:43.543+00:00', 'Salida por inicio de OT OT-2025-1770373 - gbf dsfsdf s sfd', NULL, '2025-09-01T01:40:44.619577+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('5fe88787-89fb-421a-b3e0-8f72a28c81de', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T01:42:19.475+00:00', 'Salida por inicio de OT OT-2025-8083272 - cxzcz', NULL, '2025-09-01T01:42:20.563527+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('18e329f9-14e4-4a67-a78c-4e6b42af31c5', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T01:42:19.898+00:00', 'Salida por inicio de OT OT-2025-8083272 - gbf dsfsdf s sfd', NULL, '2025-09-01T01:42:20.981674+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('dbfc4cd7-c01b-4efd-8c68-3b7956ccd5e2', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 10, 'out', '2025-09-01T02:08:57.306+00:00', 'Salida por inicio de OT OT-2025-7913872 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:08:58.38327+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('c11713a2-c0a0-43ae-bb01-8e4b4527d351', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T02:38:50.559+00:00', 'OT-2025-09-001 - cxzcz', NULL, '2025-09-01T02:38:51.658813+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('73db25ca-e5a8-4e42-b6e6-9ff225cc7aec', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T02:38:50.966+00:00', 'OT-2025-09-001 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:38:52.065142+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('4e374f6a-242f-4549-8ae8-05512405273b', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T02:45:24.681+00:00', 'OT-2025-09-002 - cxzcz', NULL, '2025-09-01T02:45:25.775027+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('c39c57c8-f0b7-497a-9784-6449b1592cd8', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T02:45:25.074+00:00', 'OT-2025-09-002 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:45:26.162177+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('4c5c08b5-d8fd-4418-a1c4-1b4594c67717', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T02:51:29.725+00:00', 'OT-2025-09-003 - cxzcz', NULL, '2025-09-01T02:51:30.825836+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('5527152d-0568-4414-b0f8-5357c8769f86', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T02:51:30.146+00:00', 'OT-2025-09-003 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:51:31.240419+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('66c6378d-c636-4833-ac0b-07bafafb9afc', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 10, 'out', '2025-09-01T02:51:56.895+00:00', 'OT-2025-09-004 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:51:57.990063+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('f665fb30-3e93-4309-bb5b-0615fdb9559f', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T02:56:48.546+00:00', 'OT-2025-09-005 - cxzcz', NULL, '2025-09-01T02:56:49.638585+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('1f461a9b-4dd9-4c0e-b0a8-72e328124a34', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T02:56:48.981+00:00', 'OT-2025-09-005 - gbf dsfsdf s sfd', NULL, '2025-09-01T02:56:50.069348+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('ba696302-3ea6-46d0-858d-a833df648065', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:06:21.201+00:00', 'OT-2025-09-006 - cxzcz', NULL, '2025-09-01T03:06:22.294137+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('2b80949e-1de7-4c56-84bf-0481fb3b5c6a', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:06:21.592+00:00', 'OT-2025-09-006 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:06:22.68482+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bc13e3e0-8d86-4423-b3e2-423c5c621a75', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:07:40.474+00:00', 'OT-2025-09-007 - cxzcz', NULL, '2025-09-01T03:07:41.571161+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bb3e6b38-c0b0-4351-b92c-531f1ed8dfc7', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:07:40.846+00:00', 'OT-2025-09-007 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:07:41.936523+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('facd4d9e-79f5-425d-a77f-c096d37a1567', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:12:06.301+00:00', 'OT-2025-09-008 - cxzcz', NULL, '2025-09-01T03:12:07.395476+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bbf0612e-5f28-48c9-b68b-3ccd251ff7e4', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:12:06.663+00:00', 'OT-2025-09-008 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:12:07.756963+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('1e5bc8ae-269b-4bad-bfc7-32c3f8a9ca2c', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:17:30.431+00:00', 'OT-2025-09-001 - cxzcz', NULL, '2025-09-01T03:17:31.524687+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('a87f9e04-6fc8-4b2b-8c9a-0b5435a2b626', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:17:30.821+00:00', 'OT-2025-09-001 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:17:31.91991+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('0fe177e4-94b8-4bca-90f0-6640c0be1a9a', '39cb4672-992a-48da-b1ec-184b264acca8', 2, 'out', '2025-09-01T03:20:11.395+00:00', 'OT-2025-09-003 - cxzcz', NULL, '2025-09-01T03:20:12.500092+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('95d6ee77-c438-43ea-ade8-ae74ee14ef4c', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 0.4, 'out', '2025-09-01T03:20:11.804+00:00', 'OT-2025-09-003 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:20:12.91172+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('56d6102c-7c98-4a08-810a-3d6bd1236561', '39cb4672-992a-48da-b1ec-184b264acca8', 2, 'out', '2025-09-01T03:21:34.836+00:00', 'OT-2025-09-003 - cxzcz', NULL, '2025-09-01T03:21:35.931936+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('5fa8d270-19d2-40bb-977c-40056d0ee568', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 0.4, 'out', '2025-09-01T03:21:35.199+00:00', 'OT-2025-09-003 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:21:36.298423+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('a78369f3-ecd0-483f-9054-0ca697c495d6', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:30:49.83+00:00', 'OT-2025-09-004 - cxzcz', NULL, '2025-09-01T03:30:50.92924+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('656d372c-dce9-49ee-881b-2baf24dffecd', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:30:50.212+00:00', 'OT-2025-09-004 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:30:51.310087+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('0fd77e05-d5da-4ab9-858e-333fc8a83287', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:32:23.097+00:00', 'OT-2025-09-005 - cxzcz', NULL, '2025-09-01T03:32:24.202861+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('1335ed94-885b-4a7a-9632-65efb0719d30', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:32:23.498+00:00', 'OT-2025-09-005 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:32:24.603683+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('96411c53-e412-4e9e-896d-5ac86b4ae81f', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-01T03:35:56.267+00:00', 'OT-2025-09-006 - cxzcz', NULL, '2025-09-01T03:35:57.384283+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('e7d92434-8526-4ed2-a866-a66fa84ac582', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-01T03:35:56.713+00:00', 'OT-2025-09-006 - gbf dsfsdf s sfd', NULL, '2025-09-01T03:35:57.824286+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('bbb5832a-3cf9-4eb0-97ed-d6e53d041141', '39cb4672-992a-48da-b1ec-184b264acca8', 100, 'out', '2025-09-04T12:17:38.233+00:00', 'OT-2025-09-007 - cxzcz', NULL, '2025-09-04T12:17:38.855135+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('9780771a-cb94-47e2-b033-5dcde9ac4809', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 20, 'out', '2025-09-04T12:17:38.69+00:00', 'OT-2025-09-007 - gbf dsfsdf s sfd', NULL, '2025-09-04T12:17:39.316878+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('4ff96171-7af8-4e7e-8a5c-c00340743e45', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 1000, 'in', '2025-09-04T12:19:00+00:00', NULL, NULL, '2025-09-04T12:19:58.292405+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('b3f82982-f4d5-4e77-b9f0-59199c7f27cf', '6484b13e-e10f-4eaa-aa9f-2db118bf0dc1', 300, 'in', '2025-09-04T17:23:00+00:00', NULL, NULL, '2025-09-04T17:23:22.068526+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('adbe40d2-7303-44b4-bc60-a494338bea11', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 1000, 'in', '2025-09-04T17:23:00+00:00', NULL, NULL, '2025-09-04T17:23:49.471282+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('99398654-6307-4638-8a69-0375902874c3', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 10.8, 'in', '2025-09-04T17:25:00+00:00', NULL, NULL, '2025-09-04T17:27:08.280254+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('f95a07cb-e5b3-4228-9d9b-5ce9ef6b6551', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 0, 'in', '2025-09-04T17:27:00+00:00', NULL, NULL, '2025-09-04T17:27:27.588083+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('f97737f9-ad32-4113-a2b3-5ccbb3e72be2', '39cb4672-992a-48da-b1ec-184b264acca8', 200, 'out', '2025-09-04T20:50:34.299+00:00', 'OT-2025-09-009 - cxzcz', NULL, '2025-09-04T20:50:35.065703+00:00', 0);
INSERT INTO inventory_entries (id, raw_material_id, quantity, entry_type, movement_date, notes, user_id, created_at, unit_price) VALUES ('1d522166-64e6-43de-820c-fc238f158a21', 'c88d7765-cf12-480a-bd2b-1d3f686ee668', 40, 'out', '2025-09-04T20:50:34.756+00:00', 'OT-2025-09-009 - gbf dsfsdf s sfd', NULL, '2025-09-04T20:50:35.51781+00:00', 0);

-- Data for table: product_analyses
INSERT INTO product_analyses (id, work_order_id, work_order_item_id, analysis_number, analysis_type, file_path, file_name, analysis_date, notes, created_by, created_at, updated_at, description) VALUES ('8f56dcd6-1718-4ff0-8f12-fa5701e94e2c', '210f1cac-8f94-418e-a795-fcc9152eb1c6', NULL, 'A14716', 'general', '/uploads/analyses/Hoja_Trabajo_OT_OT-2025-09-009 (1).pdf', 'Hoja_Trabajo_OT_OT-2025-09-009 (1).pdf', '2025-09-04', NULL, 'Usuario', '2025-09-04T23:55:15.565795+00:00', '2025-09-04T23:55:15.565795+00:00', NULL);

