import React, { useState, useEffect } from 'react';
import { RawMaterial, FormulaItemFormData } from '../types';
import './FormulaItemForm.css';

interface FormulaItemFormProps {
  availableRawMaterials: RawMaterial[];
  initialData?: FormulaItemFormData;
  onSubmit: (data: FormulaItemFormData) => Promise<void>;
  onCancel: () => void;
  title: string;
  isEditing?: boolean;
}

const FormulaItemForm: React.FC<FormulaItemFormProps> = ({
  availableRawMaterials,
  initialData,
  onSubmit,
  onCancel,
  title,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<FormulaItemFormData>({
    raw_material_id: '',
    quantity: 0,
    percentage: 0
  });
  
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);

  // Inicializar formulario
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        raw_material_id: '', // Iniciar sin selección para forzar al usuario a elegir
        quantity: 0,
        percentage: 0
      });
    }
    setErrors({});

    // Auto-focus en el primer campo disponible después de que el formulario se renderice
    setTimeout(() => {
      // En modo edición usar el campo de cantidad, en modo creación usar el select de materia prima
      let firstField: HTMLElement | null = null;

      if (isEditing) {
        // En edición, foco en el campo de cantidad
        firstField = document.getElementById('quantity');
      } else {
        // En creación, foco en el select de materia prima
        firstField = document.getElementById('raw_material_id');
      }

      if (firstField && firstField.offsetParent !== null) { // Verificar que esté visible
        (firstField as HTMLInputElement | HTMLSelectElement).focus();
        if (isEditing && 'select' in firstField) {
          (firstField as HTMLInputElement).select(); // Seleccionar todo el contenido si es input
        }
      }
    }, 300); // Delay para esperar que la animación del modal termine
  }, [initialData, availableRawMaterials, isEditing]);

  // Manejar cambios en los campos
  const handleChange = (field: keyof FormulaItemFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    // Validar materia prima seleccionada
    if (!formData.raw_material_id || formData.raw_material_id === '') {
      newErrors.raw_material_id = 'Debe seleccionar una materia prima';
    }

    // Validar cantidad
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor que cero';
    } else if (formData.quantity > 999999) {
      newErrors.quantity = 'La cantidad es demasiado grande';
    }

    // Validar porcentaje
    if (formData.percentage < 0) {
      newErrors.percentage = 'El porcentaje no puede ser negativo';
    } else if (formData.percentage > 100) {
      newErrors.percentage = 'El porcentaje no puede ser mayor al 100%';
    }

    // Validar que la materia prima esté disponible
    const selectedMaterial = availableRawMaterials.find(rm => rm.id === formData.raw_material_id);
    if (!selectedMaterial) {
      newErrors.raw_material_id = 'La materia prima seleccionada no está disponible';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const dataToSubmit: FormulaItemFormData = {
        raw_material_id: formData.raw_material_id,
        quantity: Number(formData.quantity),
        percentage: Number(formData.percentage)
      };

      await onSubmit(dataToSubmit);
      console.log('✅ Ingrediente guardado:', dataToSubmit);
    } catch (error: any) {
      console.error('Error saving ingredient:', error);
      
      // Extraer mensaje de error del backend
      let errorMessage = 'Error desconocido';
      if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Obtener información de la materia prima seleccionada
  const selectedMaterial = availableRawMaterials.find(rm => rm.id === formData.raw_material_id);

  return (
    <div className="formula-item-form">
      <div className="form-header">
        <h4>{title}</h4>
      </div>

      <form onSubmit={handleSubmit} className="item-form">
        {/* Error general */}
        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <div className="form-row">
          {/* Campo: Materia Prima */}
          <div className="form-group">
            <label htmlFor="raw_material_id" className="form-label required">
              Materia Prima
            </label>
            <select
              id="raw_material_id"
              value={formData.raw_material_id}
              onChange={(e) => handleChange('raw_material_id', e.target.value)}
              className={`form-select ${errors.raw_material_id ? 'error' : ''}`}
              disabled={loading || isEditing}
            >
              {!isEditing && (
                <option value="">Seleccionar materia prima...</option>
              )}
              {availableRawMaterials.map(material => (
                <option key={material.id} value={material.id}>
                  {material.name} - {material.current_stock} {material.unit}
                </option>
              ))}
            </select>
            {errors.raw_material_id && (
              <span className="error-message">{errors.raw_material_id}</span>
            )}
          </div>

          {/* Campo: Cantidad */}
          <div className="form-group">
            <label htmlFor="quantity" className="form-label required">
              Cantidad Requerida
            </label>
            <div className="quantity-input-group">
              <input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                className={`form-input ${errors.quantity ? 'error' : ''}`}
                placeholder="0.000"
                disabled={loading}
                min="0.001"
                max="999999"
                step="0.001"
              />
              {selectedMaterial && (
                <span className="unit-label">{selectedMaterial.unit}</span>
              )}
            </div>
            {errors.quantity && (
              <span className="error-message">{errors.quantity}</span>
            )}
          </div>

          {/* Campo: Porcentaje */}
          <div className="form-group full-width">
            <label htmlFor="percentage" className="form-label">
              Porcentaje del Producto
            </label>
            <div className="percentage-input-group">
              <input
                id="percentage"
                type="number"
                value={formData.percentage}
                onChange={(e) => handleChange('percentage', parseFloat(e.target.value) || 0)}
                className={`form-input ${errors.percentage ? 'error' : ''}`}
                placeholder="0.00"
                disabled={loading}
                min="0"
                max="100"
                step="0.01"
              />
              <span className="unit-label">%</span>
            </div>
            {errors.percentage && (
              <span className="error-message">{errors.percentage}</span>
            )}
            <div className="field-helper">
              💡 Indica qué porcentaje del producto final representa este material.
            </div>
          </div>
        </div>

        {/* Información de la materia prima seleccionada */}
        {selectedMaterial && (
          <div className="material-info">
            <div className="info-card">
              <div className="info-header">
                <h5>{selectedMaterial.name}</h5>
                <span className="stock-badge">
                  {selectedMaterial.current_stock} {selectedMaterial.unit} disponible
                </span>
              </div>
              
              {selectedMaterial.description && (
                <p className="material-description">{selectedMaterial.description}</p>
              )}
              
              <div className="formula-info">
                <p className="info-note">
                  💡 Aquí defines la cantidad necesaria para la fórmula. 
                  La validación de stock se realizará al crear órdenes de trabajo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !selectedMaterial}
          >
            {loading ? (
              <>
                <span className="loading-spinner small"></span>
                {isEditing ? 'Actualizando...' : 'Agregando...'}
              </>
            ) : (
              isEditing ? 'Actualizar Ingrediente' : 'Agregar Ingrediente'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormulaItemForm;