import React, { useState, useEffect } from 'react';
import { InventoryEntry, InventoryEntryFormData, RawMaterial } from '../types';
import { rawMaterialsService } from '../services/rawMaterialsService';
import { FaPlus, FaMinus, FaSearch, FaTimes } from 'react-icons/fa';
import './InventoryEntries.css';

interface InventoryEntriesProps {
  material: RawMaterial;
  isOpen: boolean;
  onClose: () => void;
  initialShowForm?: boolean;
  onEntryCreated?: () => void;
}

const InventoryEntries: React.FC<InventoryEntriesProps> = ({
  material,
  isOpen,
  onClose,
  initialShowForm = false,
  onEntryCreated
}) => {
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => {
    if (isOpen && material) {
      loadEntries();
    }
  }, [isOpen, material]);

  useEffect(() => {
    if (isOpen) {
      setShowForm(initialShowForm);
    }
  }, [isOpen, initialShowForm]);

  const loadEntries = async () => {
    if (!material) return;

    try {
      setLoading(true);
      console.log('🔍 Cargando entradas para material:', material.id);
      const data = await rawMaterialsService.getEntries(material.id);
      console.log('📊 Entradas cargadas:', data.length, 'items');
      setEntries(data);
    } catch (error) {
      console.error('❌ Error loading entries:', error);
      alert('Error al cargar las entradas de inventario');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    // Si no hay término de búsqueda, mostrar todas las entradas que coincidan con el tipo
    const matchesSearch = !searchTerm.trim() || 
      (entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesType = filterType === 'all' ||
      (filterType === 'in' && entry.entry_type === 'in') ||
      (filterType === 'out' && entry.entry_type === 'out');

    const passesFilter = matchesSearch && matchesType;
    return passesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalByType = (type: 'in' | 'out' | null = null) => {
    const entriesToUse = type === null ? entries : filteredEntries;
    if (type === null) {
      return entries.length;
    }
    return entriesToUse
      .filter(entry => entry.entry_type === type)
      .reduce((total, entry) => total + entry.quantity, 0);
  };

  // Calcular stock actual total basado en todas las entradas
  const calculateCurrentStock = () => {
    console.log('🧮 Calculando stock actual...');
    console.log('📊 Total entradas:', entries.length);

    let totalStock = 0;
    entries.forEach((entry, index) => {
      console.log(`  🔍 Entrada ${index + 1}:`, entry.entry_type, entry.quantity);
      if (entry.entry_type === 'in') {
        totalStock += entry.quantity;
        console.log(`    ➕ Suma: ${totalStock}`);
      } else {
        totalStock -= entry.quantity;
        console.log(`    ➖ Resta: ${totalStock}`);
      }
    });

    console.log('✅ Stock calculado:', totalStock);
    return Math.max(0, totalStock); // No permitir stock negativo
  };

  // Calcular stock resultante para cada entrada en la tabla
  const getStockResultante = (targetEntry: InventoryEntry) => {
    // Ordenar entradas por fecha ascendente para calcular correctamente
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime()
    );

    // Calcular stock acumulado hasta esta entrada (inclusive)
    let accumulatedStock = 0;
    for (const entry of sortedEntries) {
      if (entry.entry_type === 'in') {
        accumulatedStock += entry.quantity;
      } else {
        accumulatedStock -= entry.quantity;
      }

      // Si llegamos a la entrada objetivo, devolver el stock en ese punto
      if (entry.id === targetEntry.id) {
        break;
      }
    }

    return Math.max(0, accumulatedStock); // No permitir stock negativo
  };

  // Stock actual calculado
  const currentStockCalculated = calculateCurrentStock();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>Entradas de Inventario - {material.name}</h2>
          <button type="button" onClick={onClose} className="close-button" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="inventory-content">
          {/* Información del material */}
          <div className="material-info">
            <div className="info-item">
              <span className="label">Código:</span>
              <span className="value">{material.code}</span>
            </div>
            <div className="info-item">
              <span className="label">Stock actual:</span>
              <span className="value stock-calculated">
                {currentStockCalculated} {material.unit}
                <span className="stock-note">(calculado)</span>
              </span>
            </div>
            <div className="info-item">
              <span className="label">Stock mínimo:</span>
              <span className="value">{material.min_stock} {material.unit}</span>
            </div>
          </div>

          {/* Controles y estadísticas */}
          <div className="controls-section">
            <div className="controls-left">
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="clear-search"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              <div className="filter-buttons">
                <button
                  onClick={() => setFilterType('all')}
                  className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                >
                  Todas ({getTotalByType(null)})
                </button>
                <button
                  onClick={() => setFilterType('in')}
                  className={`filter-btn in ${filterType === 'in' ? 'active' : ''}`}
                >
                  Entradas ({getTotalByType('in').toFixed(2)})
                </button>
                <button
                  onClick={() => setFilterType('out')}
                  className={`filter-btn out ${filterType === 'out' ? 'active' : ''}`}
                >
                  Salidas ({getTotalByType('out').toFixed(2)})
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="add-entry-btn"
            >
              <FaPlus /> Nueva Entrada
            </button>
          </div>

          {/* Tabla de entradas */}
          <div className="entries-table-container">
            {loading ? (
              <div className="loading">Cargando entradas...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="empty-state">
                <p>No se encontraron entradas de inventario</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="empty-action-btn"
                >
                  Crear primera entrada
                </button>
              </div>
            ) : (
              <table className="entries-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Notas</th>
                    <th>Stock Resultante</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries
                    .map((entry) => (
                      <tr key={entry.id}>
                        <td className="date-cell">
                          {formatDate(entry.movement_date)}
                        </td>
                        <td>
                          <span className={`entry-type ${entry.entry_type}`}>
                            {entry.entry_type === 'in' ? (
                              <>
                                <FaPlus className="type-icon" />
                                Entrada
                              </>
                            ) : (
                              <>
                                <FaMinus className="type-icon" />
                                Salida
                              </>
                            )}
                          </span>
                        </td>
                        <td className="quantity-cell">
                          <span className={`quantity ${entry.entry_type}`}>
                            {entry.entry_type === 'in' ? '+' : '-'}{entry.quantity} {material.unit}
                          </span>
                        </td>
                        <td className="notes-cell">
                          {entry.notes || <em>Sin notas</em>}
                        </td>
                        <td className="stock-cell">
                          <span className="stock-value">
                            {getStockResultante(entry)} {material.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <InventoryEntryForm
          material={material}
          onSubmit={loadEntries}
          onClose={() => setShowForm(false)}
          onEntryCreated={onEntryCreated}
        />
      )}
    </div>
  );
};

// Componente del formulario para crear entradas
interface EntryFormProps {
  material: RawMaterial;
  onSubmit: () => void;
  onClose: () => void;
  onEntryCreated?: () => void;
}

const InventoryEntryForm: React.FC<EntryFormProps> = ({
  material,
  onSubmit,
  onClose,
  onEntryCreated
}) => {
  const [formData, setFormData] = useState<InventoryEntryFormData>({
    quantity: 0,
    entry_type: 'in',
    movement_date: new Date().toISOString().slice(0, 16),
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.quantity <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor que cero';
    }

    // No validar stock en frontend - dejar que el backend maneje la validación
    // El backend tiene la información más actualizada del stock

    if (!formData.movement_date) {
      newErrors.movement_date = 'La fecha es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      await rawMaterialsService.createEntry(material.id, formData);
      
      // Recargar entradas después de crear una nueva
      onSubmit();
      
      // Llamar callback después de crear la entrada exitosamente
      if (onEntryCreated) {
        onEntryCreated();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error creating entry:', error);
      
      // Extraer mensaje de error del backend
      let errorMessage = 'Error desconocido';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="entry-form-modal">
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="form-header">
            <h3>Nueva Entrada de Inventario</h3>
            <button type="button" onClick={onClose} className="close-button">×</button>
          </div>

          {errors.general && (
            <div className="error-message">{errors.general}</div>
          )}

          <div className="form-body">
            <div className="form-group">
              <label>Tipo de Movimiento *</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="in"
                    checked={formData.entry_type === 'in'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      entry_type: e.target.value as 'in' | 'out'
                    }))}
                  />
                  <FaPlus className="radio-icon in" />
                  Entrada
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="out"
                    checked={formData.entry_type === 'out'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      entry_type: e.target.value as 'in' | 'out'
                    }))}
                  />
                  <FaMinus className="radio-icon out" />
                  Salida
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Cantidad *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  quantity: parseFloat(e.target.value) || 0
                }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={errors.quantity ? 'error' : ''}
              />
              <span className="unit-display">{material.unit}</span>
              {errors.quantity && <span className="field-error">{errors.quantity}</span>}
            </div>

            <div className="form-group">
              <label>Fecha *</label>
              <input
                type="datetime-local"
                value={formData.movement_date}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  movement_date: e.target.value
                }))}
                className={errors.movement_date ? 'error' : ''}
              />
              {errors.movement_date && <span className="field-error">{errors.movement_date}</span>}
            </div>

            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                placeholder="Notas opcionales..."
                rows={3}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryEntries;