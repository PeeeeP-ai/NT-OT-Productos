import React, { useState, useEffect } from 'react';
import { RawMaterial, RawMaterialFormData } from '../types';
import { rawMaterialsService } from '../services/rawMaterialsService';
import './RawMaterialForm.css';

interface RawMaterialFormProps {
  material?: RawMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const RawMaterialForm: React.FC<RawMaterialFormProps> = ({
  material,
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<RawMaterialFormData>({
    code: '',
    name: '',
    description: '',
    unit: 'unidad',
    min_stock: 0,
    max_stock: 0,
    location: '',
    supplier: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (material) {
      setFormData({
        code: material.code,
        name: material.name,
        description: material.description || '',
        unit: material.unit,
        min_stock: material.min_stock,
        max_stock: material.max_stock || 0,
        location: material.location || '',
        supplier: material.supplier || ''
      });
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        unit: 'unidad',
        min_stock: 0,
        max_stock: 0,
        location: '',
        supplier: ''
      });
    }
    setErrors({});
  }, [material, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (formData.code.length < 2) {
      newErrors.code = 'El código debe tener al menos 2 caracteres';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'La unidad es requerida';
    }

    if (formData.min_stock < 0) {
      newErrors.min_stock = 'El stock mínimo no puede ser negativo';
    }

    if (formData.max_stock !== undefined && formData.max_stock < 0) {
      newErrors.max_stock = 'El stock máximo no puede ser negativo';
    }

    if (formData.max_stock !== undefined && formData.max_stock > 0 && formData.max_stock <= formData.min_stock) {
      newErrors.max_stock = 'El stock máximo debe ser mayor que el mínimo';
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

      if (material) {
        await rawMaterialsService.update(material.id, formData);
      } else {
        await rawMaterialsService.create(formData);
      }

      onSubmit();
      onClose();
    } catch (error) {
      console.error('Error saving material:', error);
      // Mostrar error al usuario
      if (error instanceof Error) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Error desconocido al guardar la materia prima' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof RawMaterialFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar error del campo cuando el usuario escribe
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  if (!isOpen) return null;

  const isEdit = !!material;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Materia Prima' : 'Nueva Materia Prima'}</h2>
          <button type="button" onClick={onClose} className="close-button" aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="material-form">
          {errors.general && (
            <div className="error-message general-error">
              {errors.general}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="code">Código *</label>
              <input
                type="text"
                id="code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                className={errors.code ? 'error' : ''}
                placeholder="Ingresa código único"
              />
              {errors.code && <span className="field-error">{errors.code}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="name">Nombre *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Nombre de la materia prima"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="unit">Unidad *</label>
              <select
                id="unit"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className={errors.unit ? 'error' : ''}
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="metro">Metro</option>
                <option value="m2">Metro cuadrado</option>
                <option value="m3">Metro cúbico</option>
              </select>
              {errors.unit && <span className="field-error">{errors.unit}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Descripción</label>
              <input
                type="text"
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="location">Ubicación</label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Ej: Almacén A, Estantería 3"
              />
            </div>

            <div className="form-group">
              <label htmlFor="supplier">Proveedor</label>
              <input
                type="text"
                id="supplier"
                value={formData.supplier}
                onChange={(e) => handleInputChange('supplier', e.target.value)}
                placeholder="Nombre del proveedor"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="min_stock">Stock Mínimo *</label>
              <input
                type="number"
                id="min_stock"
                value={formData.min_stock}
                onChange={(e) => handleInputChange('min_stock', parseInt(e.target.value) || 0)}
                className={errors.min_stock ? 'error' : ''}
                min="0"
                step="0.01"
              />
              {errors.min_stock && <span className="field-error">{errors.min_stock}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="max_stock">Stock Máximo</label>
              <input
                type="number"
                id="max_stock"
                value={formData.max_stock}
                onChange={(e) => handleInputChange('max_stock', parseInt(e.target.value) || 0)}
                className={errors.max_stock ? 'error' : ''}
                min="0"
                step="0.01"
                placeholder="Opcional"
              />
              {errors.max_stock && <span className="field-error">{errors.max_stock}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RawMaterialForm;