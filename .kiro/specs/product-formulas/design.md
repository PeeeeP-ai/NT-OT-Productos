# Design Document - Gestión de Productos con Fórmulas

## Overview

Este diseño implementa un sistema completo de gestión de productos con fórmulas que se integra perfectamente con el sistema existente de materias primas. La arquitectura seguirá los mismos patrones establecidos en el sistema actual, manteniendo consistencia en la estructura de datos, API REST, y componentes de frontend.

El sistema permitirá crear productos que tienen fórmulas compuestas por múltiples materias primas con cantidades específicas, proporcionando una base sólida para futuras funcionalidades como cálculo de costos y planificación de producción.

## Architecture

### Database Schema

```sql
-- Tabla de productos
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  unit VARCHAR(50) NOT NULL DEFAULT 'unidad',
  base_quantity DECIMAL(10,3) NOT NULL DEFAULT 1, -- Cantidad base para la fórmula (ej: 1000 litros)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de fórmulas (relación muchos a muchos entre productos y materias primas)
CREATE TABLE product_formulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL, -- Cantidad de materia prima necesaria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, raw_material_id) -- Prevenir duplicados
);
```

### API Endpoints

```
GET    /api/products                     # Listar productos
GET    /api/products/{id}                # Obtener producto por ID
POST   /api/products                     # Crear producto
PUT    /api/products/{id}                # Actualizar producto
PATCH  /api/products/{id}/disable        # Activar/desactivar producto
DELETE /api/products/{id}                # Eliminar producto

GET    /api/products/{id}/formula        # Obtener fórmula del producto
POST   /api/products/{id}/formula        # Agregar materia prima a fórmula
PUT    /api/products/{id}/formula/{formula_id}  # Actualizar cantidad en fórmula
DELETE /api/products/{id}/formula/{formula_id}  # Eliminar materia prima de fórmula
```

### Frontend Structure

```
src/
├── components/
│   ├── ProductsList.tsx              # Lista principal de productos
│   ├── ProductForm.tsx               # Formulario crear/editar producto
│   ├── ProductFormula.tsx            # Gestión de fórmula del producto
│   ├── FormulaItemForm.tsx           # Formulario para agregar/editar ingrediente
│   └── ProductDetails.tsx            # Vista detallada del producto
├── services/
│   └── productsService.ts            # Servicio API para productos
└── types/
    └── index.ts                      # Tipos TypeScript (actualizar existente)
```

## Components and Interfaces

### Data Models

```typescript
// Tipos principales
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
  quantity: number;
  created_at: string;
  raw_material?: RawMaterial; // Para joins
}

export interface ProductWithFormula extends Product {
  formula: ProductFormula[];
}

// Tipos para formularios
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
```

### Component Architecture

#### ProductsList Component
- **Responsabilidad**: Mostrar lista de productos con acciones CRUD
- **Estado**: Lista de productos, filtros, loading
- **Props**: Callbacks para editar, ver detalles, crear
- **Integración**: Reutiliza patrones de RawMaterialsList

#### ProductForm Component
- **Responsabilidad**: Crear y editar información básica del producto
- **Estado**: Datos del formulario, validaciones, loading
- **Props**: Producto a editar (opcional), callbacks
- **Validaciones**: Nombre único, campos requeridos, cantidades positivas

#### ProductFormula Component
- **Responsabilidad**: Gestionar la fórmula completa del producto
- **Estado**: Lista de ingredientes, materias primas disponibles
- **Props**: Producto, callback de actualización
- **Funcionalidades**: Agregar, editar, eliminar ingredientes

#### FormulaItemForm Component
- **Responsabilidad**: Formulario para agregar/editar un ingrediente
- **Estado**: Materia prima seleccionada, cantidad
- **Props**: Ingrediente a editar (opcional), lista de materias primas
- **Validaciones**: Materia prima válida, cantidad positiva

### API Service Layer

```typescript
export const productsService = {
  // Productos
  async getAll(showInactive?: boolean): Promise<Product[]>
  async getById(id: string): Promise<Product | null>
  async create(data: ProductFormData): Promise<Product>
  async update(id: string, data: ProductFormData): Promise<Product>
  async disable(id: string, is_active: boolean): Promise<Product>
  async delete(id: string): Promise<void>
  
  // Fórmulas
  async getFormula(productId: string): Promise<ProductFormula[]>
  async addFormulaItem(productId: string, data: FormulaItemFormData): Promise<ProductFormula>
  async updateFormulaItem(productId: string, formulaId: string, data: FormulaItemFormData): Promise<ProductFormula>
  async removeFormulaItem(productId: string, formulaId: string): Promise<void>
  
  // Utilidades
  async getProductWithFormula(id: string): Promise<ProductWithFormula | null>
}
```

## Data Models

### Database Relationships

```
products (1) ←→ (N) product_formulas (N) ←→ (1) raw_materials
```

### Data Flow

1. **Creación de Producto**:
   ```
   Usuario → ProductForm → productsService.create() → API → Database
   ```

2. **Gestión de Fórmula**:
   ```
   Usuario → ProductFormula → FormulaItemForm → productsService.addFormulaItem() → API → Database
   ```

3. **Visualización**:
   ```
   Database → API → productsService.getProductWithFormula() → ProductDetails → Usuario
   ```

### Validation Rules

#### Product Validation
- `name`: Requerido, único, 2-255 caracteres
- `unit`: Requerido, valores predefinidos
- `base_quantity`: Requerido, número positivo, máximo 3 decimales
- `description`: Opcional, máximo 1000 caracteres

#### Formula Validation
- `raw_material_id`: Debe existir y estar activa
- `quantity`: Requerido, número positivo, máximo 3 decimales
- Unicidad: No duplicar materias primas en la misma fórmula

## Error Handling

### Frontend Error Handling
```typescript
// Manejo consistente con el sistema existente
try {
  await productsService.create(formData);
  showSuccessMessage('Producto creado exitosamente');
} catch (error) {
  if (error.response?.data?.message) {
    showErrorMessage(error.response.data.message);
  } else {
    showErrorMessage('Error desconocido al crear producto');
  }
}
```

### Backend Error Responses
```json
{
  "success": false,
  "message": "Error descriptivo para el usuario",
  "errors": ["Lista de errores específicos"],
  "error_code": "PRODUCT_NAME_DUPLICATE" // Para manejo programático
}
```

### Common Error Scenarios
- Nombre de producto duplicado
- Materia prima no encontrada o inactiva
- Cantidades inválidas (negativas, formato incorrecto)
- Producto no encontrado
- Fórmula vacía al intentar guardar
- Materia prima ya existe en la fórmula

## Testing Strategy

### Unit Tests
```typescript
// Servicios
describe('productsService', () => {
  test('should create product with valid data')
  test('should handle API errors gracefully')
  test('should validate formula items correctly')
})

// Componentes
describe('ProductForm', () => {
  test('should validate required fields')
  test('should submit form with correct data')
  test('should display validation errors')
})

describe('ProductFormula', () => {
  test('should add formula items correctly')
  test('should prevent duplicate raw materials')
  test('should calculate total ingredients')
})
```

### Integration Tests
```typescript
describe('Product Management Flow', () => {
  test('should create product and add formula items')
  test('should edit product and update formula')
  test('should delete product and clean up formula')
  test('should handle raw material deactivation in formulas')
})
```

### API Tests
```php
// Backend API tests
class ProductsApiTest extends TestCase {
  public function test_create_product_with_valid_data()
  public function test_create_product_with_duplicate_name_fails()
  public function test_add_formula_item_with_valid_data()
  public function test_add_duplicate_formula_item_fails()
}
```

## Performance Considerations

### Database Optimization
```sql
-- Índices para mejorar rendimiento
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_product_formulas_product_id ON product_formulas(product_id);
CREATE INDEX idx_product_formulas_raw_material_id ON product_formulas(raw_material_id);
```

### Frontend Optimization
- **Lazy Loading**: Cargar fórmulas solo cuando se necesiten
- **Memoization**: Usar `useMemo` para cálculos de fórmulas
- **Debouncing**: En búsquedas y filtros
- **Pagination**: Para listas grandes de productos

### API Optimization
- **Eager Loading**: Incluir materias primas en consultas de fórmulas
- **Caching**: Headers de cache apropiados
- **Batch Operations**: Para operaciones múltiples en fórmulas

## Security Considerations

### Input Validation
- Sanitización de strings en nombres y descripciones
- Validación de tipos numéricos
- Prevención de inyección SQL con prepared statements
- Validación de UUIDs en parámetros de ruta

### Authorization (Futuro)
- Roles de usuario (admin, operador, solo lectura)
- Permisos granulares por operación
- Audit trail para cambios en productos y fórmulas

### Data Integrity
- Constraints de base de datos para prevenir datos inválidos
- Transacciones para operaciones complejas
- Validación en múltiples capas (frontend, backend, database)

## Integration Points

### Existing System Integration
- **Raw Materials**: Reutilizar componentes de selección y validación
- **UI Components**: Mantener consistencia visual y de UX
- **API Patterns**: Seguir mismos patrones de respuesta y error handling
- **Database**: Usar mismas convenciones de naming y estructura

### Future Integrations
- **Production Planning**: Calcular materias primas necesarias para producción
- **Cost Calculation**: Integrar precios de materias primas
- **Inventory Management**: Reservar materias primas para producción
- **Reporting**: Análisis de uso de materias primas por producto