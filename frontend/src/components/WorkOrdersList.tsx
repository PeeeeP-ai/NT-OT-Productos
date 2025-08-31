import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../types';
import { getWorkOrders, getStatusColor, getPriorityColor, formatWorkOrderNumber } from '../services/workOrdersService';
import './WorkOrdersList.css';

interface WorkOrdersListProps {
  onCreate?: () => void;
  onViewDetails?: (workOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  forceRefresh?: number;
}

const WorkOrdersList: React.FC<WorkOrdersListProps> = ({
  onCreate,
  onViewDetails,
  onEdit,
  onDelete,
  forceRefresh
}) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getWorkOrders(statusFilter || undefined);

      if (result.success && result.data) {
        setWorkOrders(result.data);
      } else {
        setError(result.message || 'Error al cargar órdenes de trabajo');
      }
    } catch (err) {
      setError('Error interno del servidor');
      console.error('Error loading work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkOrders();
  }, [statusFilter, forceRefresh]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';

    // Handle different date formats that might come from the database
    let date: Date;

    // If it's already a valid date string in YYYY-MM-DD format, parse it without timezone
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Parse as local date to avoid timezone shifts
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      // Fallback for other date formats
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return '-';
    }

    // Format manually to avoid timezone issues
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
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

  if (loading) {
    return (
      <div className="work-orders-list">
        <div className="loading">Cargando órdenes de trabajo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="work-orders-list">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadWorkOrders} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="work-orders-list">
      <div className="list-header">
        <h2>📋 Órdenes de Trabajo</h2>
        <div className="header-actions">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          {onCreate && (
            <button onClick={onCreate} className="create-button">
              ➕ Nueva OT
            </button>
          )}
        </div>
      </div>

      {workOrders.length === 0 ? (
        <div className="empty-state">
          <p>No hay órdenes de trabajo {statusFilter && `en estado ${getStatusLabel(statusFilter as WorkOrder['status'])}`}</p>
          {onCreate && (
            <button onClick={onCreate} className="create-button">
              Crear primera orden de trabajo
            </button>
          )}
        </div>
      ) : (
        <div className="work-orders-grid">
          {workOrders.map((workOrder) => {
            console.log('Work order:', workOrder.id, 'Status:', workOrder.status);
            return (
              <div key={workOrder.id} className="work-order-card">
              <div className="card-header">
                <div className="order-info">
                  <h3>{formatWorkOrderNumber(workOrder.order_number)}</h3>
                  <span className="created-date">
                    {formatDate(workOrder.created_at)}
                  </span>
                </div>
                <div className="status-badges">
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(workOrder.status) }}
                  >
                    {getStatusLabel(workOrder.status)}
                  </span>
                  <span
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(workOrder.priority) }}
                  >
                    {getPriorityLabel(workOrder.priority)}
                  </span>
                </div>
              </div>

              <div className="card-content">
                {workOrder.description && (
                  <p className="description">{workOrder.description}</p>
                )}

                <div className="dates-info">
                  {workOrder.planned_start_date && (
                    <div className="date-item">
                      <span className="label">Inicio planificado:</span>
                      <span>{formatDate(workOrder.planned_start_date)}</span>
                    </div>
                  )}
                  {workOrder.planned_end_date && (
                    <div className="date-item">
                      <span className="label">Fin planificado:</span>
                      <span>{formatDate(workOrder.planned_end_date)}</span>
                    </div>
                  )}
                  {workOrder.actual_start_date && (
                    <div className="date-item">
                      <span className="label">Inicio real:</span>
                      <span>{formatDate(workOrder.actual_start_date)}</span>
                    </div>
                  )}
                  {workOrder.actual_end_date && (
                    <div className="date-item">
                      <span className="label">Fin real:</span>
                      <span>{formatDate(workOrder.actual_end_date)}</span>
                    </div>
                  )}
                </div>

                {workOrder.notes && (
                  <div className="notes">
                    <span className="label">Notas:</span>
                    <p>{workOrder.notes}</p>
                  </div>
                )}
              </div>

              <div className="card-actions">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(workOrder)}
                    className="action-button view-button"
                  >
                    👁️ Ver Detalles
                  </button>
                )}
                {onEdit && (workOrder.status === 'pending' || workOrder.status === 'cancelled') && (
                  <button
                    onClick={() => onEdit(workOrder)}
                    className="action-button edit-button"
                  >
                    ✏️ Editar
                  </button>
                )}
                {onDelete && (workOrder.status === 'pending' || workOrder.status === 'cancelled') && (
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Estás seguro de que deseas eliminar la orden de trabajo ${formatWorkOrderNumber(workOrder.order_number)}? Esta acción no se puede deshacer.`)) {
                        onDelete(workOrder);
                      }
                    }}
                    className="action-button delete-button"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkOrdersList;
