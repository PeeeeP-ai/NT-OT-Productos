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
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());

  -- Obtener el último número de secuencia para el año actual
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_orders.order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO sequence_number
  FROM work_orders
  WHERE work_orders.order_number LIKE 'OT-' || current_year || '-%';

  -- Generar el número de orden
  result_order_number := 'OT-' || current_year || '-' || LPAD(sequence_number::TEXT, 4, '0');

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
