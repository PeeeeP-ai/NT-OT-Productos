# Implementation Plan - Gestión de Productos con Fórmulas

## Task Overview

Este plan implementa la funcionalidad completa de gestión de productos con fórmulas siguiendo un enfoque incremental y test-driven. Cada tarea construye sobre las anteriores, asegurando que el sistema funcione correctamente en cada paso.

## Implementation Tasks

- [x] 1. Crear estructura de base de datos para productos y fórmulas


  - Crear migración SQL con tablas products y product_formulas
  - Definir índices y constraints para optimización y integridad
  - Agregar triggers para updated_at automático
  - Crear políticas RLS básicas para acceso público
  - _Requirements: 1.1, 2.1, 7.1_





- [ ] 2. Implementar tipos TypeScript para productos
  - Actualizar archivo types/index.ts con interfaces de Product y ProductFormula
  - Definir tipos para formularios (ProductFormData, FormulaItemFormData)


  - Crear tipos extendidos como ProductWithFormula

  - Agregar tipos para respuestas de API específicas de productos



  - _Requirements: 6.5, 7.6_

- [ ] 3. Crear servicio API backend para productos
- [ ] 3.1 Implementar endpoints básicos CRUD de productos
  - Crear rutas GET, POST, PUT, PATCH, DELETE para /api/products



  - Implementar validación de datos de productos
  - Agregar manejo de errores específicos (nombre duplicado, etc.)
  - Incluir logging y debugging para desarrollo
  - _Requirements: 1.4, 3.5, 4.2_




- [ ] 3.2 Implementar endpoints para gestión de fórmulas
  - Crear rutas para /api/products/{id}/formula (GET, POST, PUT, DELETE)
  - Implementar validación de materias primas activas

  - Prevenir duplicados en fórmulas del mismo producto


  - Agregar joins para incluir información de materias primas
  - _Requirements: 2.2, 2.5, 2.6, 7.1_

- [ ] 4. Crear servicio frontend para productos
  - Implementar productsService.ts con métodos CRUD completos


  - Agregar métodos específicos para gestión de fórmulas
  - Implementar manejo de errores consistente con sistema existente
  - Configurar axios client con base URL correcta
  - _Requirements: 6.3, 3.5, 4.4_



- [ ] 5. Implementar componente ProductsList
- [ ] 5.1 Crear lista principal de productos
  - Desarrollar componente ProductsList con grid/lista de productos
  - Implementar filtros por estado activo/inactivo
  - Agregar búsqueda por nombre de producto
  - Incluir indicadores de estado y acciones por producto
  - _Requirements: 5.1, 6.1_

- [ ] 5.2 Agregar acciones CRUD en la lista
  - Implementar botones para crear, editar, ver detalles y eliminar
  - Agregar confirmaciones para acciones destructivas
  - Implementar activar/desactivar productos
  - Manejar estados de loading durante operaciones


  - _Requirements: 1.1, 3.1, 4.1, 4.4_

- [ ] 6. Implementar formulario de productos
- [ ] 6.1 Crear ProductForm para crear/editar productos
  - Desarrollar formulario con campos nombre, descripción, unidad, cantidad base


  - Implementar validaciones en tiempo real
  - Agregar dropdown con unidades predefinidas
  - Manejar modo creación vs edición
  - _Requirements: 1.2, 1.3, 3.2, 6.5_


- [ ] 6.2 Integrar validaciones y manejo de errores
  - Validar nombre único y campos requeridos
  - Mostrar errores de validación de forma clara
  - Implementar submit con loading states
  - Agregar confirmación de guardado exitoso
  - _Requirements: 1.4, 3.5, 6.3_



- [ ] 7. Implementar gestión de fórmulas
- [ ] 7.1 Crear componente ProductFormula
  - Desarrollar interfaz para mostrar fórmula actual del producto
  - Implementar lista de materias primas con cantidades
  - Agregar indicadores de stock disponible por materia prima


  - Mostrar alertas visuales para stock insuficiente
  - _Requirements: 2.1, 5.3, 5.4, 5.5_

- [ ] 7.2 Implementar FormulaItemForm para agregar ingredientes
  - Crear formulario para seleccionar materia prima y cantidad
  - Implementar dropdown con materias primas activas disponibles


  - Validar cantidades positivas y formato decimal
  - Prevenir agregar materias primas ya existentes en fórmula
  - _Requirements: 2.2, 2.3, 2.6, 7.2_

- [x] 7.3 Agregar funcionalidad de edición de fórmula

  - Implementar edición inline de cantidades existentes

  - Agregar botones para eliminar materias primas de fórmula
  - Incluir confirmaciones para eliminación de ingredientes
  - Actualizar totales y validaciones en tiempo real
  - _Requirements: 3.3, 3.4, 2.5_

- [x] 8. Crear vista detallada de productos

- [ ] 8.1 Implementar ProductDetails
  - Desarrollar vista completa con información del producto
  - Mostrar fórmula completa con materias primas y cantidades
  - Incluir información de stock actual de cada materia prima
  - Agregar navegación fácil para editar producto o fórmula
  - _Requirements: 5.2, 5.3, 5.4_


- [ ] 8.2 Agregar cálculos y validaciones de stock
  - Calcular y mostrar si es posible producir con stock actual
  - Indicar visualmente materias primas con stock insuficiente
  - Mostrar cantidad máxima producible basada en stock limitante
  - Agregar tooltips explicativos para cálculos
  - _Requirements: 5.5, 7.3, 7.5_


- [ ] 9. Integrar productos en navegación principal
- [ ] 9.1 Agregar sección de productos al App principal
  - Crear nueva pestaña/sección en la navegación principal
  - Integrar ProductsList como componente principal
  - Implementar routing entre productos y materias primas
  - Mantener consistencia visual con sección existente

  - _Requirements: 6.1, 6.2_

- [ ] 9.2 Conectar modales y flujos de navegación
  - Integrar ProductForm como modal desde ProductsList
  - Conectar ProductFormula como modal desde ProductDetails
  - Implementar callbacks para refrescar listas después de operaciones


  - Agregar breadcrumbs o indicadores de navegación
  - _Requirements: 6.4, 3.6_

- [ ] 10. Implementar estilos CSS y responsividad
- [ ] 10.1 Crear estilos para componentes de productos
  - Desarrollar ProductsList.css con grid responsivo
  - Crear ProductForm.css consistente con RawMaterialForm
  - Implementar ProductFormula.css para gestión de ingredientes
  - Agregar ProductDetails.css para vista detallada
  - _Requirements: 6.1, 6.6_

- [ ] 10.2 Optimizar para dispositivos móviles
  - Adaptar grids y formularios para pantallas pequeñas
  - Implementar navegación táctil amigable
  - Optimizar modales para dispositivos móviles
  - Probar usabilidad en diferentes tamaños de pantalla
  - _Requirements: 6.6_

- [ ] 11. Agregar validaciones avanzadas y optimizaciones
- [ ] 11.1 Implementar validaciones de integridad
  - Validar que materias primas en fórmulas estén activas
  - Mostrar advertencias cuando materias primas se desactivan
  - Implementar validación de cantidades con límites razonables
  - Agregar validación de unicidad de nombres en tiempo real
  - _Requirements: 7.1, 7.4, 7.6_

- [ ] 11.2 Optimizar rendimiento y UX
  - Implementar lazy loading para fórmulas grandes
  - Agregar debouncing en búsquedas y filtros
  - Optimizar consultas con eager loading en backend
  - Implementar caching de materias primas para selección
  - _Requirements: 6.4, 6.5_

- [ ] 12. Testing y validación final
- [ ] 12.1 Crear tests unitarios para componentes
  - Escribir tests para ProductsList, ProductForm, ProductFormula
  - Probar validaciones y manejo de errores
  - Testear integración con servicios API
  - Verificar comportamiento de formularios y modales
  - _Requirements: Todos los requirements_

- [ ] 12.2 Realizar testing de integración completo
  - Probar flujo completo de creación de producto con fórmula
  - Testear edición y eliminación de productos y fórmulas
  - Verificar integración con sistema de materias primas
  - Validar responsividad y usabilidad en diferentes dispositivos
  - _Requirements: Todos los requirements_