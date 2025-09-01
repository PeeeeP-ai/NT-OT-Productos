import React, { useState, useEffect } from 'react';
import { Product, ProductFormData, PRODUCT_UNITS, ProductValidationErrors } from '../types';
import productsService from '../services/productsService';
import './ProductForm.css';

interface ProductFormProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    unit: 'unidad',
    base_quantity: 1
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ProductValidationErrors>({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        unit: product.unit,
        base_quantity: product.base_quantity
      });
    } else {
      setFormData({
        name: '',
        description: '',
        unit: 'unidad',
        base_quantity: 1
      });
    }
    setErrors({});
  }, [product, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: ProductValidationErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    } else if (formData.name.trim().length > 255) {
      newErrors.name = 'El nombre no puede exceder 255 caracteres';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'La unidad es requerida';
    }

    if (!formData.base_quantity || formData.base_quantity <= 0) {
      newErrors.base_quantity = 'La cantidad base debe ser mayor que cero';
    } else if (formData.base_quantity > 999999) {
      newErrors.base_quantity = 'La cantidad base no puede exceder 999,999';
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'La descripción no puede exceder 1000 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Limpiar datos antes de enviar
      const cleanData: ProductFormData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        unit: formData.unit,
        base_quantity: Number(formData.base_quantity)
      };

      if (product) {
        await productsService.update(product.id, cleanData);
        console.log('✅ Producto actualizado:', cleanData.name);
      } else {
        await productsService.create(cleanData);
        console.log('✅ Producto creado:', cleanData.name);
      }

      onSubmit();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      // Mostrar error específico del servidor
      if (error.message) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Error desconocido al guardar el producto' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProductFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error del campo cuando el usuario escribe
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  if (!isOpen) return null;

  const isEdit = !!product;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Fórmula' : 'Nueva Fórmula'}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="close-button"
            aria-label="Cerrar"
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          {errors.general && (
            <div className="error-message general-error">
              {errors.general}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Nombre de la Fórmula *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Ej: Agrocup, Fertilizante Premium..."
                maxLength={255}
                disabled={loading}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={errors.description ? 'error' : ''}
                placeholder="Descripción opcional del producto..."
                rows={3}
                maxLength={1000}
                disabled={loading}
              />
              <div className="char-count">
                {formData.description?.length || 0}/1000 caracteres
              </div>
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="unit">Unidad de Medida *</label>
              <select
                id="unit"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className={errors.unit ? 'error' : ''}
                disabled={loading}
              >
                {PRODUCT_UNITS.map(unit => (
                  <option key={unit} value={unit}>
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </option>
                ))}
              </select>
              {errors.unit && <span className="field-error">{errors.unit}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="base_quantity">Cantidad Base *</label>
              <input
                type="number"
                id="base_quantity"
                value={formData.base_quantity}
                onChange={(e) => handleInputChange('base_quantity', parseFloat(e.target.value) || 0)}
                className={errors.base_quantity ? 'error' : ''}
                placeholder="1"
                min="0.001"
                max="999999"
                step="0.001"
                disabled={loading}
              />
              <div className="input-help">
                Cantidad que produce la fórmula (ej: 1000 litros)
              </div>
              {errors.base_quantity && <span className="field-error">{errors.base_quantity}</span>}
            </div>
          </div>

          <div className="form-info">
            <div className="info-box">
              <h4>💡 Información sobre la cantidad base</h4>
              <p>
                La cantidad base define cuántas unidades produce la fórmula del producto. 
                Por ejemplo, si tu fórmula produce 1000 litros de Agrocup, la cantidad base sería 1000.
              </p>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleClose} 
              className="cancel-button"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner" />
                  {isEdit ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                isEdit ? 'Actualizar Fórmula' : 'Crear Fórmula'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
