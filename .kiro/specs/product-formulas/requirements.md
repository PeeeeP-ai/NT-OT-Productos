# Requirements Document - Gestión de Productos con Fórmulas

## Introduction

Esta funcionalidad permitirá crear y gestionar productos que se fabrican utilizando múltiples materias primas en cantidades específicas. Cada producto tendrá una fórmula que define exactamente qué materias primas se necesitan y en qué cantidades para producir una unidad base del producto (ej: 1000 litros de Agrocup).

El sistema debe permitir crear, editar y eliminar productos, así como gestionar sus fórmulas de manera intuitiva. Esta funcionalidad se integrará con el sistema existente de materias primas para validar disponibilidad y calcular costos de producción.

## Requirements

### Requirement 1

**User Story:** Como administrador del sistema, quiero crear nuevos productos con sus fórmulas, para poder definir qué materias primas se necesitan para fabricar cada producto.

#### Acceptance Criteria

1. WHEN accedo a la sección de productos THEN el sistema SHALL mostrar una lista de productos existentes con opciones para crear, editar y eliminar
2. WHEN hago clic en "Nuevo Producto" THEN el sistema SHALL mostrar un formulario para crear un producto
3. WHEN completo el formulario de producto THEN el sistema SHALL permitir ingresar nombre, descripción, unidad de medida y cantidad base de producción
4. WHEN guardo un producto THEN el sistema SHALL validar que el nombre sea único y los campos requeridos estén completos
5. WHEN un producto se crea exitosamente THEN el sistema SHALL mostrar el producto en la lista y permitir agregar su fórmula

### Requirement 2

**User Story:** Como administrador del sistema, quiero definir la fórmula de un producto agregando materias primas con sus cantidades, para especificar exactamente qué se necesita para fabricar el producto.

#### Acceptance Criteria

1. WHEN selecciono "Editar Fórmula" en un producto THEN el sistema SHALL mostrar la interfaz de gestión de fórmula
2. WHEN agrego una materia prima a la fórmula THEN el sistema SHALL permitir seleccionar de una lista de materias primas activas
3. WHEN selecciono una materia prima THEN el sistema SHALL permitir especificar la cantidad necesaria respetando la unidad de medida de la materia prima
4. WHEN agrego múltiples materias primas THEN el sistema SHALL permitir gestionar una lista completa de ingredientes
5. WHEN guardo la fórmula THEN el sistema SHALL validar que las cantidades sean positivas y que no haya materias primas duplicadas
6. WHEN una materia prima ya está en la fórmula THEN el sistema SHALL prevenir agregarla nuevamente o permitir actualizar su cantidad

### Requirement 3

**User Story:** Como administrador del sistema, quiero editar productos existentes y sus fórmulas, para poder actualizar recetas y corregir información cuando sea necesario.

#### Acceptance Criteria

1. WHEN selecciono "Editar" en un producto THEN el sistema SHALL mostrar el formulario pre-llenado con la información actual
2. WHEN modifico los datos del producto THEN el sistema SHALL permitir cambiar nombre, descripción, unidad y cantidad base
3. WHEN modifico la fórmula THEN el sistema SHALL permitir agregar, editar o eliminar materias primas de la receta
4. WHEN elimino una materia prima de la fórmula THEN el sistema SHALL solicitar confirmación antes de proceder
5. WHEN guardo los cambios THEN el sistema SHALL validar la información y actualizar el producto
6. WHEN hay errores de validación THEN el sistema SHALL mostrar mensajes claros indicando qué corregir

### Requirement 4

**User Story:** Como administrador del sistema, quiero eliminar productos que ya no se fabrican, para mantener la lista de productos actualizada y relevante.

#### Acceptance Criteria

1. WHEN selecciono "Eliminar" en un producto THEN el sistema SHALL solicitar confirmación antes de proceder
2. WHEN confirmo la eliminación THEN el sistema SHALL eliminar el producto y su fórmula asociada
3. WHEN un producto tiene historial de producción THEN el sistema SHALL permitir desactivar en lugar de eliminar (funcionalidad futura)
4. WHEN se elimina un producto THEN el sistema SHALL actualizar la lista automáticamente
5. IF la eliminación falla THEN el sistema SHALL mostrar un mensaje de error explicativo

### Requirement 5

**User Story:** Como usuario del sistema, quiero ver información detallada de cada producto incluyendo su fórmula, para entender qué materias primas se necesitan y en qué cantidades.

#### Acceptance Criteria

1. WHEN veo la lista de productos THEN el sistema SHALL mostrar nombre, descripción, unidad base y estado de cada producto
2. WHEN selecciono "Ver Detalles" de un producto THEN el sistema SHALL mostrar la información completa del producto
3. WHEN veo los detalles THEN el sistema SHALL mostrar la fórmula completa con todas las materias primas y cantidades
4. WHEN veo la fórmula THEN el sistema SHALL mostrar el stock disponible de cada materia prima requerida
5. WHEN una materia prima tiene stock insuficiente THEN el sistema SHALL indicar visualmente esta situación
6. WHEN calculo el costo THEN el sistema SHALL mostrar el costo total estimado basado en las materias primas (funcionalidad futura)

### Requirement 6

**User Story:** Como usuario del sistema, quiero que la interfaz de productos se integre naturalmente con el sistema existente, para tener una experiencia de usuario consistente.

#### Acceptance Criteria

1. WHEN navego entre secciones THEN el sistema SHALL mantener el mismo estilo visual y patrones de interacción
2. WHEN selecciono materias primas para la fórmula THEN el sistema SHALL usar los mismos componentes y validaciones del sistema existente
3. WHEN hay errores o mensajes THEN el sistema SHALL usar el mismo sistema de notificaciones
4. WHEN cargo datos THEN el sistema SHALL mostrar indicadores de carga consistentes
5. WHEN uso formularios THEN el sistema SHALL mantener los mismos patrones de validación y UX
6. WHEN accedo desde dispositivos móviles THEN el sistema SHALL mantener la responsividad del diseño existente

### Requirement 7

**User Story:** Como administrador del sistema, quiero que el sistema valide la disponibilidad de materias primas al trabajar con fórmulas, para asegurar que las recetas sean factibles con el inventario actual.

#### Acceptance Criteria

1. WHEN agrego una materia prima a una fórmula THEN el sistema SHALL verificar que la materia prima esté activa
2. WHEN especifico cantidades THEN el sistema SHALL validar que sean números positivos y respeten los decimales permitidos
3. WHEN veo una fórmula THEN el sistema SHALL mostrar el stock actual de cada materia prima requerida
4. WHEN una materia prima se desactiva THEN el sistema SHALL indicar en las fórmulas que la contienen que hay un problema
5. WHEN calculo producción posible THEN el sistema SHALL determinar cuántas unidades se pueden producir con el stock actual (funcionalidad futura)
6. IF una materia prima no existe THEN el sistema SHALL prevenir guardar la fórmula hasta que se corrija