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

// =========================================
// TIPOS PARA ÓRDENES DE TRABAJO (OT)
// =========================================

export interface WorkOrder {
  id: string;
  order_number: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderItem {
  id: string;
  work_order_id: string;
  product_id: string;
  planned_quantity: number;
  produced_quantity: number;
  unit: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  product?: Product; // Para joins
}

export interface WorkOrderConsumption {
  id: string;
  work_order_item_id: string;
  raw_material_id: string;
  planned_consumption: number;
  actual_consumption: number;
  unit: string;
  created_at: string;
  updated_at: string;
  raw_material?: RawMaterial; // Para joins
}

export interface WorkOrderWithItems extends WorkOrder {
  items: WorkOrderItem[];
  warnings?: string[];
}

export interface WorkOrderItemWithConsumption extends WorkOrderItem {
  consumption: WorkOrderConsumption[];
}

export interface WorkOrderDetails extends WorkOrder {
  items: WorkOrderItemWithConsumption[];
}

export interface RawMaterialAvailability {
  raw_material_id: string;
  raw_material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  is_available: boolean;
}

// Tipos para formularios de OT
export interface WorkOrderFormData {
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;
}

export interface WorkOrderItemFormData {
  product_id: string;
  planned_quantity: number;
}

// Tipos para respuestas específicas de API de OT
export interface WorkOrderApiResponse extends ApiResponse<WorkOrder> {}
export interface WorkOrdersApiResponse extends ApiResponse<WorkOrder[]> {}
export interface WorkOrderWithItemsApiResponse extends ApiResponse<WorkOrderWithItems> {}
export interface WorkOrderDetailsApiResponse extends ApiResponse<WorkOrderDetails> {}
export interface RawMaterialAvailabilityApiResponse extends ApiResponse<RawMaterialAvailability[]> {}

// Enums y constantes para OT
export const WORK_ORDER_STATUS = [
  { value: 'pending', label: 'Pendiente', color: '#ffa726' },
  { value: 'in_progress', label: 'En Progreso', color: '#42a5f5' },
  { value: 'completed', label: 'Completada', color: '#66bb6a' },
  { value: 'cancelled', label: 'Cancelada', color: '#ef5350' }
] as const;

export const WORK_ORDER_PRIORITY = [
  { value: 'low', label: 'Baja', color: '#8bc34a' },
  { value: 'normal', label: 'Normal', color: '#ffa726' },
  { value: 'high', label: 'Alta', color: '#ff9800' },
  { value: 'urgent', label: 'Urgente', color: '#f44336' }
] as const;

export type WorkOrderStatus = typeof WORK_ORDER_STATUS[number]['value'];
export type WorkOrderPriority = typeof WORK_ORDER_PRIORITY[number]['value'];

// Tipos para validación de OT
export interface WorkOrderValidationErrors {
  description?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  items?: string;
  general?: string;
}

export interface WorkOrderItemValidationErrors {
  product_id?: string;
  planned_quantity?: string;
  general?: string;
}
