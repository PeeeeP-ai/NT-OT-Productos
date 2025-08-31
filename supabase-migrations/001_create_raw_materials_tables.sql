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

-- Índices para mejor rendimiento
CREATE INDEX idx_raw_materials_code ON raw_materials(code);
CREATE INDEX idx_raw_materials_active ON raw_materials(is_active);
CREATE INDEX idx_inventory_entries_raw_material_id ON inventory_entries(raw_material_id);
CREATE INDEX idx_inventory_entries_created_at ON inventory_entries(created_at DESC);

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
BEGIN
  UPDATE raw_materials SET
    current_stock = calculate_raw_material_stock(COALESCE(NEW.raw_material_id, OLD.raw_material_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.raw_material_id, OLD.raw_material_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_after_inventory_entry
  AFTER INSERT OR UPDATE OR DELETE ON inventory_entries
  FOR EACH ROW EXECUTE FUNCTION update_raw_material_stock();

-- Políticas RLS para raw_materials
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en raw_materials" ON raw_materials FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- Políticas RLS para inventory_entries
ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso en inventory_entries" ON inventory_entries FOR ALL TO PUBLIC USING (true) WITH CHECK (true);