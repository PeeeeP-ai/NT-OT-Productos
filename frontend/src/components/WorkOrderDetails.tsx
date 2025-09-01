import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderDetails as WorkOrderDetailsType } from '../types';
import { getWorkOrderDetails, updateWorkOrderStatus, completeWorkOrder, getStatusColor, getPriorityColor } from '../services/workOrdersService';
import './WorkOrderDetails.css';

interface WorkOrderDetailsProps {
  workOrder: WorkOrder;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const WorkOrderDetails: React.FC<WorkOrderDetailsProps> = ({
  workOrder,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [details, setDetails] = useState<WorkOrderDetailsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState<{
    [itemId: string]: {
      produced_quantity: number;
      consumption: {
        [rawMaterialId: string]: number;
      };
    };
  }>({});

  useEffect(() => {
    if (isOpen && workOrder) {
      loadDetails();
    }
  }, [isOpen, workOrder]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getWorkOrderDetails(workOrder.id);

      if (result.success && result.data) {
        console.log('🔍 WorkOrderDetails - Datos recibidos del servidor:', result.data);
        console.log('🔍 actual_start_datetime:', result.data.actual_start_datetime);
        console.log('🔍 actual_start_date:', result.data.actual_start_date);
        setDetails(result.data);
      } else {
        setError(result.message || 'Error al cargar detalles');
      }
    } catch (err) {
      setError('Error interno del servidor');
      console.error('Error loading work order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: WorkOrder['status']) => {
    try {
      setUpdating(true);
      setError(null);
      setWarnings([]);

      const result = await updateWorkOrderStatus(workOrder.id, newStatus);

      if (result.success) {
        // Clear any previous warnings/errors
        setWarnings([]);

        // Check if there are warnings in the response
        if (result.warnings && result.warnings.length > 0) {
          setWarnings(result.warnings);
        }

        // Recargar detalles
        await loadDetails();
        onUpdate?.();
      } else {
        // Handle errors (shouldn't happen with new logic, but just in case)
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors.length === 1
            ? result.errors[0]
            : `${result.message}\n\nDetalles:\n${result.errors.join('\n')}`;
          setError(errorMessage);
        } else {
          setError(result.message || 'Error al cambiar estado');
        }
      }
    } catch (err) {
      setError('Error al cambiar estado');
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string | undefined, isActualDate: boolean = false) => {
    if (!dateString) return '-';

    // Debug log para ver qué datos llegan
    if (isActualDate) {
      console.log('🕐 WorkOrderDetails formatDate - dateString:', dateString, 'isActualDate:', isActualDate);
    }

    try {
      // Handle different date formats that might come from the database
      let date: Date;

      // If it's a datetime string (contains 'T'), parse it directly
      if (typeof dateString === 'string' && dateString.includes('T')) {
        // Parse the ISO string directly - JavaScript handles timezone conversion automatically
        date = new Date(dateString);
      } else if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        // Parse as local date to avoid timezone shifts
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // Fallback for other date formats
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '-';
      }

      // Format manually to avoid timezone issues
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      // For actual dates (with time), show time as well
      if (isActualDate || (dateString && dateString.includes('T'))) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
      }

      // For planned dates or date-only strings, show only date
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '-';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const getStatusLabel = (status: WorkOrder['status']) => {
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: WorkOrder['priority']) => {
    const labels = {
      low: 'Baja',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  };

  const getItemStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const handleCompleteWorkOrder = async (completionData: {
    items: {
      [itemId: string]: {
        produced_quantity: number;
        consumption: {
          raw_material_id: string;
          actual_consumption: number;
        }[];
      };
    };
  }) => {
    try {
      setUpdating(true);
      setError(null);

      const result = await completeWorkOrder(workOrder.id, completionData);

      if (result.success) {
        // Close completion modal
        setShowCompletionModal(false);
        // Reset completion data
        setCompletionData({});
        // Reload details
        await loadDetails();
        // Notify parent component
        onUpdate?.();
      } else {
        setError(result.message || 'Error al completar orden de trabajo');
        if (result.errors && result.errors.length > 0) {
          console.error('Errores de completación:', result.errors);
        }
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Advertencias de completación:', result.warnings);
        }
      }
    } catch (err) {
      setError('Error al completar orden de trabajo');
      console.error('Error completing work order:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="work-order-details-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>📋 Detalles de Orden de Trabajo</h2>
            <button onClick={onClose} className="close-button">×</button>
          </div>
          <div className="modal-body">
            {loading ? (
            <div className="loading">Cargando detalles...</div>
          ) : error ? (
            <div className="error">
              <p>{error}</p>
              <button onClick={loadDetails} className="retry-button">
                Reintentar
              </button>
            </div>
          ) : details ? (
            <>
              {/* Advertencias */}
              {warnings.length > 0 && (
                <div className="warnings-section">
                  <div className="warning-banner">
                    <h4>⚠️ Advertencias de Stock</h4>
                    <ul>
                      {warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setWarnings([])}
                      className="dismiss-warning-button"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Información General */}
              <div className="details-section">
                <h3>Información General</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Número de Orden:</label>
                    <span className="order-number">{details.order_number}</span>
                  </div>
                  <div className="info-item">
                    <label>Estado:</label>
                    <div className="status-controls">
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(details.status) }}
                      >
                        {getStatusLabel(details.status)}
                      </span>
                      {details.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange('in_progress')}
                          className="status-action-button"
                          disabled={updating}
                        >
                          {updating ? '...' : '▶️ Iniciar'}
                        </button>
                      )}
                      {details.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange('completed')}
                          className="status-action-button"
                          disabled={updating}
                        >
                          {updating ? '...' : 'completar'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="info-item">
                    <label>Prioridad:</label>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(details.priority) }}
                    >
                      {getPriorityLabel(details.priority)}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Creado:</label>
                    <span>{formatDate(details.created_at)}</span>
                  </div>
                </div>

                {details.description && (
                  <div className="description-section">
                    <label>Descripción:</label>
                    <p>{details.description}</p>
                  </div>
                )}

                {details.notes && (
                  <div className="notes-section">
                    <label>Notas:</label>
                    <p>{details.notes}</p>
                  </div>
                )}
              </div>

              {/* Fechas */}
              <div className="details-section">
                <h3>Fechas</h3>
                <div className="dates-grid">
                  <div className="date-item">
                    <label>Inicio Planificado:</label>
                    <span>{formatDate(details.planned_start_date)}</span>
                  </div>
                  <div className="date-item">
                    <label>Fin Planificado:</label>
                    <span>{formatDate(details.planned_end_date)}</span>
                  </div>
                  <div className="date-item">
                    <label>Inicio Real:</label>
                    <span>{formatDate(details.actual_start_datetime, true)}</span>
                  </div>
                  <div className="date-item">
                    <label>Fin Real:</label>
                    <span>{formatDate(details.actual_end_datetime, true)}</span>
                  </div>
                </div>
              </div>

              {/* Fórmulas */}
              <div className="details-section">
                <h3>Fórmulas</h3>
                {!(details as any).items || (details as any).items.length === 0 ? (
                  <p className="empty-message">No hay productos definidos</p>
                ) : (
                  <div className="products-list">
                    {/* Iterate through work order items - each has its own formula */}
                    {(details as any).items.map((item: any, index: number) => (
                      <div key={item.id || index} className="product-card">
                        <div className="product-header">
                          <h4>{item.product_name}</h4>
                          <span className="product-status">
                            {getItemStatusLabel(item.status)}
                          </span>
                        </div>

                        <div className="product-details">
                          <div className="detail-row">
                            <span className="label">Cantidad Planificada:</span>
                            <span className="value">
                              {formatNumber(item.planned_quantity)} {item.product_unit}
                            </span>
                          </div>
                          <div className="detail-row">
                            <span className="label">Cantidad Producida:</span>
                            <span className="value">
                              {formatNumber(item.produced_quantity)} {item.product_unit}
                            </span>
                          </div>
                        </div>

                        {/* Fórmula y Materias Primas */}
                        {item.formula && item.formula.length > 0 && (
                          <div className="formula-section">
                            <h5>Fórmula de Producción:</h5>
                            <div className="materials-list">
                              {item.formula.map((material: any, matIndex: number) => {
                                // Use calculated consumption_planned if available, otherwise fall back to base quantity
                                // This implements the rule of three: required = (base_quantity * planned_quantity) / base_quantity
                                const requiredQuantity = material.consumption_planned || material.quantity || 0;

                                return (
                                  <div key={matIndex} className="material-item">
                                    <div className="material-info">
                                      <span className="material-name">{material.raw_material_name}</span>
                                      <span className="material-unit">({material.raw_material_unit})</span>
                                    </div>
                                    <div className="material-quantities">
                                      <div className="quantity-detail">
                                        <span className="label">Necesario:</span>
                                        <span className="value">
                                          {formatNumber(requiredQuantity)}
                                        </span>
                                      </div>
                                      <div className="quantity-detail">
                                        <span className="label">Consumido:</span>
                                        <span className="value">
                                          {formatNumber(material.actual_consumption || 0)}
                                        </span>
                                      </div>
                                      <div className="quantity-detail">
                                        <span className="label">Stock Disponible:</span>
                                        <span className={`value ${material.raw_material_current_stock < requiredQuantity ? 'insufficient' : ''}`}>
                                          {formatNumber(material.raw_material_current_stock)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No se pudieron cargar los detalles</p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && details && (
        <CompletionModal
          details={details}
          completionData={completionData}
          onCompletionDataChange={setCompletionData}
          onComplete={handleCompleteWorkOrder}
          onCancel={() => setShowCompletionModal(false)}
          updating={updating}
        />
      )}
    </div>
  );
};

// Completion Modal Component
interface CompletionModalProps {
  details: WorkOrderDetailsType;
  completionData: {
    [itemId: string]: {
      produced_quantity: number;
      consumption: {
        [rawMaterialId: string]: number;
      };
    };
  };
  onCompletionDataChange: (data: {
    [itemId: string]: {
      produced_quantity: number;
      consumption: {
        [rawMaterialId: string]: number;
      };
    };
  }) => void;
  onComplete: (completionData: {
    items: {
      [itemId: string]: {
        produced_quantity: number;
        consumption: {
          raw_material_id: string;
          actual_consumption: number;
        }[];
      };
    };
  }) => void;
  onCancel: () => void;
  updating: boolean;
}

const CompletionModal: React.FC<CompletionModalProps> = ({
  details,
  completionData,
  onCompletionDataChange,
  onComplete,
  onCancel,
  updating
}) => {
  const handleProducedQuantityChange = (itemId: string, quantity: number) => {
    const newData = { ...completionData };
    if (!newData[itemId]) {
      newData[itemId] = { produced_quantity: quantity, consumption: {} };
    } else {
      newData[itemId].produced_quantity = quantity;
    }
    onCompletionDataChange(newData);
  };

  const handleConsumptionChange = (itemId: string, rawMaterialId: string, quantity: number) => {
    const newData = { ...completionData };
    if (!newData[itemId]) {
      newData[itemId] = { produced_quantity: 0, consumption: {} };
    }
    newData[itemId].consumption[rawMaterialId] = quantity;
    onCompletionDataChange(newData);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const handleSubmit = () => {
    // Convert completion data to the format expected by the API
    const apiData: {
      items: {
        [itemId: string]: {
          produced_quantity: number;
          consumption: {
            raw_material_id: string;
            actual_consumption: number;
          }[];
        };
      };
    } = { items: {} };

    Object.entries(completionData).forEach(([itemId, itemData]) => {
      apiData.items[itemId] = {
        produced_quantity: itemData.produced_quantity,
        consumption: Object.entries(itemData.consumption).map(([rawMaterialId, quantity]) => ({
          raw_material_id: rawMaterialId,
          actual_consumption: quantity
        }))
      };
    });

    onComplete(apiData);
  };

  return (
    <div className="modal-overlay">
      <div className="completion-modal">
        <div className="modal-header">
          <h2>🏭 Completar Orden de Trabajo</h2>
          <button onClick={onCancel} className="close-button">×</button>
        </div>

        <div className="modal-body">
          <p className="completion-instructions">
            Registre las cantidades producidas y el consumo real de materias primas para completar la orden de trabajo.
          </p>

          <div className="completion-items">
            {(details as any).items?.map((item: any) => (
              <div key={item.id} className="completion-item">
                <h4>{item.product_name}</h4>

                <div className="completion-inputs">
                  <div className="input-group">
                    <label>Cantidad Producida:</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={completionData[item.id]?.produced_quantity || item.planned_quantity}
                        onChange={(e) => handleProducedQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                        placeholder={`Planificado: ${formatNumber(item.planned_quantity)}`}
                      />
                      <span className="unit">{item.product_unit}</span>
                    </div>
                  </div>

                  {item.formula && item.formula.length > 0 && (
                    <div className="consumption-section">
                      <h5>Consumo de Materias Primas:</h5>
                      {item.formula.map((material: any) => {
                        const requiredQuantity = material.consumption_planned || material.quantity || 0;
                        const currentConsumption = completionData[item.id]?.consumption[material.raw_material_id] || requiredQuantity;

                        return (
                          <div key={material.raw_material_id} className="consumption-input">
                            <label>{material.raw_material_name}:</label>
                            <div className="input-with-unit">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={currentConsumption}
                                onChange={(e) => handleConsumptionChange(item.id, material.raw_material_id, parseFloat(e.target.value) || 0)}
                                placeholder={`Necesario: ${formatNumber(requiredQuantity)}`}
                              />
                              <span className="unit">{material.raw_material_unit}</span>
                            </div>
                            <span className="stock-info">
                              Stock: {formatNumber(material.raw_material_current_stock)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="completion-actions">
            <button
              onClick={onCancel}
              className="cancel-button"
              disabled={updating}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="complete-button"
              disabled={updating}
            >
              {updating ? 'Completando...' : '✅ Completar Orden de Trabajo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderDetails;
