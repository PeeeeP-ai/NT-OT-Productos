export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  location?: string;
  supplier?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryEntry {
  id: string;
  raw_material_id: string;
  quantity: number;
  entry_type: 'in' | 'out';
  movement_date: string;
  notes?: string;
  user_id?: string;
  created_at: string;
  raw_material?: Partial<RawMaterial>; // Para joins
}

export interface RawMaterialFormData {
  code: string;
  name: string;
  description?: string;
  unit: string;
  min_stock: number;
  max_stock?: number;
  location?: string;
  supplier?: string;
}

export interface InventoryEntryFormData {
  quantity: number;
  entry_type: 'in' | 'out';
  movement_date?: string;
  notes?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
  count?: number;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  errors?: string[];
}

// =========================================
// TIPOS PARA PRODUCTOS Y FÓRMULAS
// =========================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  unit: string;
  base_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormula {
  id: string;
  product_id: string;
  raw_material_id: string;
  raw_material_name: string; // Nombre de la materia prima para mostrar
  raw_material_unit?: string; // Unidad de la materia prima
  raw_material_current_stock?: number; // Stock actual de la materia prima
  quantity: number;
  created_at: string;
  raw_material?: RawMaterial; // Para joins con información de materia prima
}

export interface ProductWithFormula extends Product {
  formula: ProductFormula[];
}

// Tipos para formularios de productos
export interface ProductFormData {
  name: string;
  description?: string;
  unit: string;
  base_quantity: number;
}

export interface FormulaItemFormData {
  raw_material_id: string;
  quantity: number;
}

// Tipos extendidos para cálculos y visualización
export interface ProductFormulaWithStock extends ProductFormula {
  raw_material: RawMaterial;
  available_stock: number;
  max_producible_from_this_material: number;
}

export interface ProductWithCalculations extends ProductWithFormula {
  total_formula_items: number;
  max_producible_quantity: number;
  can_produce: boolean;
  limiting_material?: RawMaterial;
}

// Tipos para respuestas específicas de API de productos
export interface ProductApiResponse extends ApiResponse<Product> {}
export interface ProductsApiResponse extends ApiResponse<Product[]> {}
export interface ProductFormulaApiResponse extends ApiResponse<ProductFormula> {}
export interface ProductFormulasApiResponse extends ApiResponse<ProductFormula[]> {}
export interface ProductWithFormulaApiResponse extends ApiResponse<ProductWithFormula> {}

// Enums y constantes para productos
export const PRODUCT_UNITS = [
  'unidad',
  'kg',
  'litro',
  'metro',
  'm2',
  'm3',
  'tonelada',
  'galón'
] as const;

export type ProductUnit = typeof PRODUCT_UNITS[number];

// Tipos para validación
export interface ProductValidationErrors {
  name?: string;
  description?: string;
  unit?: string;
  base_quantity?: string;
  general?: string;
}

export interface FormulaItemValidationErrors {
  raw_material_id?: string;
  quantity?: string;
  general?: string;
}

// Tipos adicionales para el sistema (ya no necesario, todos los IDs son string)