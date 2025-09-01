import React, { useState, useEffect } from 'react';
import { Product, WorkOrderFormData, WorkOrderItemFormData } from '../types';
import { productsService } from '../services/productsService';
import { createWorkOrder, getWorkOrderPriorityOptions, getWorkOrderDetails, updateWorkOrder } from '../services/workOrdersService';
import './WorkOrderForm.css';

interface WorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  workOrder?: any; // Work order being edited
}

interface ProductSelection {
  product: Product;
  quantity: number;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  workOrder
}) => {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    description: '',
    priority: 'normal',
    planned_start_date: '',
    planned_end_date: '',
    notes: ''
  });

  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Cargar productos disponibles
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  // Cargar datos de la orden de trabajo cuando se está editando
  useEffect(() => {
    if (isOpen && workOrder) {
      loadWorkOrderData();
    } else if (isOpen && !workOrder) {
      resetForm();
    }
  }, [isOpen, workOrder]);

  const loadWorkOrderData = async () => {
    if (!workOrder) return;

    try {
      setLoading(true);
      const result = await getWorkOrderDetails(workOrder.id);

      if (result.success && result.data) {

        // Función helper para formatear fechas de manera robusta para date input (planned dates)
        const formatDateForInput = (dateString: string | null | undefined): string => {
          if (!dateString) return '';
          try {
            // If it's already a valid date string in YYYY-MM-DD format, use it directly
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
              return dateString;
            }

            // If it's a datetime string, extract just the date part
            if (typeof dateString === 'string' && dateString.includes('T')) {
              return dateString.split('T')[0];
            }

            // Handle Date objects and other date strings
            let dateObj: Date;

            if (typeof dateString === 'string') {
              // Parse date string, assuming it's in ISO format or other standard format
              dateObj = new Date(dateString);
            } else {
              return '';
            }

            if (isNaN(dateObj.getTime())) {
              console.error('Invalid date format:', dateString);
              return '';
            }

            // Get date components in local timezone to avoid timezone shifts
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error parsing date:', dateString, error);
            return '';
          }
        };

        // Cargar datos básicos de la orden de trabajo
        setFormData({
          description: result.data.description || '',
          priority: result.data.priority,
          planned_start_date: formatDateForInput(result.data.planned_start_date),
          planned_end_date: formatDateForInput(result.data.planned_end_date),
          notes: result.data.notes || ''
        });

        // Debug: Show received data structure
        console.log('WorkOrderForm - Received data:', result.data);
        console.log('WorkOrderForm - Items:', result.data.items);

        // Cargar productos de la orden de trabajo
        if (result.data.items && result.data.items.length > 0) {
          // Transform flat server response to nested structure expected by frontend
          const transformedItems = result.data.items.map((item: any) => ({
            ...item,
            product: item.product || {
              id: item.product_id,
              name: item.product_name,
              unit: item.product_unit,
              base_quantity: 1, // Default base quantity
              description: '',
              is_active: true,
              created_at: item.work_order_created_at,
              updated_at: item.work_order_created_at
            }
          }));

          const productsSelection = transformedItems
            .filter(item => item.product) // Only include items that have a product
            .map(item => ({
              product: item.product,
              quantity: item.planned_quantity
            }));

          setSelectedProducts(productsSelection);

          // Debug: Show processed products
          console.log('WorkOrderForm - Raw items:', result.data.items);
          console.log('WorkOrderForm - Transformed items:', transformedItems);
          console.log('WorkOrderForm - Processed products:', productsSelection);
        } else {
          setSelectedProducts([]);
        }
      } else {
        console.error('Failed to load work order data:', result.message);
        setErrors([result.message || 'Error al cargar datos de la orden de trabajo']);
      }
    } catch (error) {
      console.error('Error loading work order data:', error);
      setErrors(['Error al cargar datos de la orden de trabajo']);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const products = await productsService.getAll(false); // Solo productos activos
      setAvailableProducts(products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      priority: 'normal',
      planned_start_date: '',
      planned_end_date: '',
      notes: ''
    });
    setSelectedProducts([]);
    setErrors([]);
    setWarnings([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddProduct = () => {
    if (availableProducts.length > 0) {
      const firstAvailableProduct = availableProducts.find(product =>
        !selectedProducts.some(selected => selected.product.id === product.id)
      );

      if (firstAvailableProduct) {
        setSelectedProducts(prev => [...prev, {
          product: firstAvailableProduct,
          quantity: firstAvailableProduct.base_quantity
        }]);
      }
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product) {
      setSelectedProducts(prev => prev.map((item, i) =>
        i === index ? { ...item, product, quantity: product.base_quantity } : item
      ));
    } else {
      console.error('Product not found in available products:', productId);
    }
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity > 0) {
      setSelectedProducts(prev => prev.map((item, i) =>
        i === index ? { ...item, quantity } : item
      ));
    }
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.description && !formData.notes) {
      newErrors.push('Debe proporcionar una descripción o notas para la orden de trabajo');
    }

    if (selectedProducts.length === 0) {
      newErrors.push('Debe seleccionar al menos un producto');
    }

    // Validar fechas
    if (formData.planned_start_date && formData.planned_end_date) {
      const startDate = new Date(formData.planned_start_date);
      const endDate = new Date(formData.planned_end_date);
      if (startDate >= endDate) {
        newErrors.push('La fecha de inicio debe ser anterior a la fecha de fin');
      }
    }

    // Validar productos duplicados
    const productIds = selectedProducts.map(item => item.product.id);
    const uniqueProductIds = new Set(productIds);
    if (productIds.length !== uniqueProductIds.size) {
      newErrors.push('No puede seleccionar el mismo producto más de una vez');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setErrors([]);
      setWarnings([]);

      let result;

      if (workOrder) {
        // Actualizar orden de trabajo existente
        // Convertir productos seleccionados al formato esperado por la API
        const items: WorkOrderItemFormData[] = selectedProducts.map(item => ({
          product_id: item.product.id,
          planned_quantity: item.quantity
        }));

        result = await updateWorkOrder(workOrder.id, formData, items);
      } else {
        // Crear nueva orden de trabajo
        // Convertir productos seleccionados al formato esperado por la API
        const items: WorkOrderItemFormData[] = selectedProducts.map(item => ({
          product_id: item.product.id,
          planned_quantity: item.quantity
        }));

        result = await createWorkOrder(formData, items);
      }

      if (result.success) {
        // Mostrar advertencias si las hay (solo para creación)
        if (!workOrder && result.data && 'warnings' in result.data && Array.isArray(result.data.warnings) && result.data.warnings.length > 0) {
          setWarnings(result.data.warnings);
          // No cerramos el modal automáticamente si hay advertencias
          return;
        }

        // Éxito completo
        onSubmit();
        handleClose();
      } else {
        const action = workOrder ? 'actualizar' : 'crear';
        setErrors(result.errors || [result.message || `Error al ${action} la orden de trabajo`]);
      }
    } catch (error) {
      console.error('Error submitting work order:', error);
      setErrors(['Error interno del servidor']);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmWithWarnings = () => {
    onSubmit();
    handleClose();
  };

  if (!isOpen) return null;

  const priorityOptions = getWorkOrderPriorityOptions();

  return (
    <div className="modal-overlay">
      <div className="work-order-form-modal">
        <div className="modal-header">
          <h2>📋 {workOrder ? 'Editar Orden de Trabajo' : 'Crear Nueva Orden de Trabajo'}</h2>
          <button onClick={handleClose} className="close-button">×</button>
        </div>

        <form onSubmit={handleSubmit} className="work-order-form">
          <div className="form-section">
            <h3>Información General</h3>

            <div className="form-group">
              <label htmlFor="description">Descripción *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe el propósito de esta orden de trabajo"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="priority">Prioridad</label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="planned_start_date">Fecha Inicio Planificada</label>
                <input
                  type="date"
                  id="planned_start_date"
                  name="planned_start_date"
                  value={formData.planned_start_date}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="planned_end_date">Fecha Fin Planificada</label>
                <input
                  type="date"
                  id="planned_end_date"
                  name="planned_end_date"
                  value={formData.planned_end_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notas Adicionales</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Notas adicionales sobre la orden de trabajo"
                rows={2}
              />
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Productos a Producir</h3>
              <button
                type="button"
                onClick={handleAddProduct}
                className="add-product-button"
                disabled={loading || availableProducts.length === 0}
              >
                ➕ Agregar Producto
              </button>
            </div>

            {loading ? (
              <div className="loading">Cargando productos...</div>
            ) : selectedProducts.length === 0 ? (
              <div className="empty-products">
                <p>No hay productos seleccionados</p>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="add-product-button"
                >
                  Agregar primer producto
                </button>
              </div>
            ) : (
              <div className="products-list">
                {selectedProducts.map((item, index) => (
                  <div key={index} className="product-item">
                    <div className="product-info">
                      <select
                        value={item.product.id}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="product-select"
                      >
                        {availableProducts
                          .filter(product =>
                            !selectedProducts.some((selected, selectedIndex) =>
                              selectedIndex !== index && selected.product.id === product.id
                            )
                          )
                          .map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.unit})
                            </option>
                          ))
                        }
                      </select>

                      <div className="quantity-input">
                        <label>Cantidad:</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value))}
                          placeholder={`Base: ${item.product.base_quantity}`}
                        />
                        <span className="unit">{item.product.unit}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(index)}
                      className="remove-product-button"
                      title="Remover producto"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="errors-section">
              <h4>Errores:</h4>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="warnings-section">
              <h4>⚠️ Advertencias de Disponibilidad:</h4>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <p className="warning-note">
                La orden de trabajo se puede crear de todas formas, pero revise la disponibilidad de materias primas.
              </p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={handleClose}
              className="cancel-button"
              disabled={submitting}
            >
              Cancelar
            </button>

            {warnings.length > 0 ? (
              <button
                type="button"
                onClick={handleConfirmWithWarnings}
                className="confirm-button"
                disabled={submitting}
              >
                {submitting ? (workOrder ? 'Actualizando...' : 'Creando...') : (workOrder ? 'Actualizar con Advertencias' : 'Crear con Advertencias')}
              </button>
            ) : (
              <button
                type="submit"
                className="submit-button"
                disabled={submitting}
              >
                {submitting ? (workOrder ? 'Actualizando...' : 'Creando...') : (workOrder ? 'Actualizar Orden de Trabajo' : 'Crear Orden de Trabajo')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkOrderForm;
