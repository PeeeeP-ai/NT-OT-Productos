import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import jsPDF from 'jspdf';
import { WorkOrder } from '../types';
import { getWorkOrders, getActiveWorkOrdersSortedByStartDate, getWorkOrderDetails, getStatusColor, getPriorityColor, formatWorkOrderNumber } from '../services/workOrdersService';
import './WorkOrdersList.css';

type ViewMode = 'cards' | 'grid';

// Componente memoizado para las tarjetas de órdenes de trabajo
const WorkOrderCard = memo(({ 
  workOrder, 
  onViewDetails, 
  onEdit, 
  onDelete,
  formatDate,
  getStatusLabel,
  getPriorityLabel
}: {
  workOrder: WorkOrder;
  onViewDetails?: (workOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  formatDate: (dateString: string | undefined, isActualDate?: boolean) => string;
  getStatusLabel: (status: WorkOrder['status']) => string;
  getPriorityLabel: (priority: WorkOrder['priority']) => string;
}) => (
  <div className="work-order-card">
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
        {(workOrder.actual_start_datetime || workOrder.actual_start_date) && (
          <div className="date-item">
            <span className="label">Inicio real:</span>
            <span>{formatDate(workOrder.actual_start_datetime || workOrder.actual_start_date, true)}</span>
          </div>
        )}
        {(workOrder.actual_end_datetime || workOrder.actual_end_date) && (
          <div className="date-item">
            <span className="label">Fin real:</span>
            <span>{formatDate(workOrder.actual_end_datetime || workOrder.actual_end_date, true)}</span>
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
));

interface WorkOrdersListProps {
  onCreate?: () => void;
  onViewDetails?: (workOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: (workOrder: WorkOrder) => void;
  forceRefresh?: number;
}

const WorkOrdersList: React.FC<WorkOrdersListProps> = memo(({
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
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const loadWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getWorkOrders(statusFilter || undefined);

      if (result.success && result.data) {
        console.log('🔍 WorkOrdersList - Datos recibidos del servidor:', result.data);
        if (result.data.length > 0) {
          console.log('🔍 Primer elemento - actual_start_datetime:', result.data[0].actual_start_datetime);
          console.log('🔍 Primer elemento - actual_start_date:', result.data[0].actual_start_date);
        }
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
  }, [statusFilter]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders, forceRefresh]);

  const formatDate = useCallback((dateString: string | undefined, isActualDate: boolean = false) => {
    if (!dateString) return '-';

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
  }, []);

  const getStatusLabel = useCallback((status: WorkOrder['status']) => {
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  }, []);

  const getPriorityLabel = useCallback((priority: WorkOrder['priority']) => {
    const labels = {
      low: 'Baja',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return labels[priority] || priority;
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => {
      let aValue: any = a[sortField as keyof WorkOrder];
      let bValue: any = b[sortField as keyof WorkOrder];

      // Handle different field types
      if (sortField === 'order_number') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      } else if (sortField === 'status') {
        const statusOrder: Record<WorkOrder['status'], number> = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
        aValue = statusOrder[aValue as WorkOrder['status']] || 0;
        bValue = statusOrder[bValue as WorkOrder['status']] || 0;
      } else if (sortField === 'priority') {
        const priorityOrder: Record<WorkOrder['priority'], number> = { low: 1, normal: 2, high: 3, urgent: 4 };
        aValue = priorityOrder[aValue as WorkOrder['priority']] || 0;
        bValue = priorityOrder[bValue as WorkOrder['priority']] || 0;
      } else if (sortField.includes('date') || sortField === 'created_at') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [workOrders, sortField, sortDirection]);

  const generateWorkOrdersReportPDF = useCallback(async () => {
    // Función para formatear números
    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true, // Habilitar separador de miles
        minimumIntegerDigits: 1
      }).format(num);
    };
  
    try {
      // Obtener todas las OT pendientes y en progreso ordenadas por fecha
      const response = await getActiveWorkOrdersSortedByStartDate();
  
      if (!response.success || !response.data) {
        alert('Error al obtener órdenes de trabajo para el reporte: ' + response.message);
        return;
      }
  
      const workOrders = response.data;
  
      // Obtener detalles completos de cada OT para mostrar productos y materiales
      const workOrdersWithDetails = [];
      for (const workOrder of workOrders) {
        try {
          const detailsResponse = await getWorkOrderDetails(workOrder.id);
          if (detailsResponse.success && detailsResponse.data) {
            workOrdersWithDetails.push({
              ...workOrder,
              details: detailsResponse.data
            });
          } else {
            // Si no se puede obtener detalles, añadir sin detalles
            workOrdersWithDetails.push({
              ...workOrder,
              details: null
            });
          }
        } catch (error) {
          console.warn(`Error obteniendo detalles de OT ${workOrder.order_number}:`, error);
          workOrdersWithDetails.push({
            ...workOrder,
            details: null
          });
        }
      }
  
      const pdf = new jsPDF({ orientation: 'landscape' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin + 30; // Inicia después del header

      // Agregar logo
      try {
        pdf.addImage('/img/logont.png', 'PNG', 20, 20, 30, 15);
      } catch (error) {
        pdf.setFillColor(63, 81, 181);
        pdf.rect(20, 20, 30, 15, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text('LOGO', 35, 30, { align: 'center' });
      }
      pdf.setTextColor(0, 0, 0);

      // Título principal
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REPORTE DE ÓRDENES DE TRABAJO', pageWidth / 2, margin + 15, { align: 'center' });

      // Fecha del reporte
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const fechaGeneracion = new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES');
      pdf.text(`Generado: ${fechaGeneracion}`, pageWidth - margin, margin + 15, { align: 'right' });

      // Información resumen
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Total de OT pendientes/en proceso: ${workOrders.length}`, margin, yPos);

      if (workOrders.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(14);
        pdf.text('No hay órdenes de trabajo pendientes o en proceso', pageWidth / 2, yPos + 30, { align: 'center' });
      } else {
        // Encabezados de la grilla
        yPos += 20;
        const headers = ['N° OT', 'Estado', 'Prioridad', 'Descripción', 'Producto', 'Cantidad', 'Materias Primas', 'Inicio Planificado', 'Fin Planificado'];
        const columnWidths = [18, 20, 18, 35, 30, 20, 55, 30, 30];
        const startX = margin;

        pdf.setFillColor(240, 240, 240);
        pdf.rect(startX, yPos, pageWidth - 2 * margin, 10, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);

        let xPos = startX + 3;
        headers.forEach((header, index) => {
          const maxWidth = columnWidths[index] - 2; // Margen interno para texto
          const text = pdf.splitTextToSize(header, maxWidth);
          pdf.text(text[0] || header, xPos, yPos + 6, { maxWidth: maxWidth });
          xPos += columnWidths[index];
        });

        // Líneas de la grilla
        yPos += 12;
        pdf.setFontSize(6); // Tamaño más compacto para que quepa todo
        pdf.setFont('helvetica', 'normal');

        workOrdersWithDetails.forEach((workOrder) => {
          // Calcula la altura necesaria para esta fila
          let rowHeight = 15; // Altura mínima

          if (workOrder.details && (workOrder.details as any).items) {
            let maxMaterials = 0;
            (workOrder.details as any).items.forEach((item: any) => {
              if (item.formula && item.formula.length > 0) {
                maxMaterials = Math.max(maxMaterials, item.formula.length);
              }
            });
            // Altura = altura base + (número de líneas de materiales - 1) * altura por línea
            rowHeight = Math.max(rowHeight, 12 + (maxMaterials - 1) * 5);
          }

          // Verificar si necesitamos nueva página considerando la altura variable
          if (yPos + rowHeight > pageHeight - margin) {
            pdf.addPage('landscape');
            yPos = margin;

            // Repetir headers en nueva página
            pdf.setFillColor(240, 240, 240);
            pdf.rect(startX, yPos, pageWidth - 2 * margin, 10, 'F');

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            xPos = startX + 3;
            headers.forEach((header, headerIndex) => {
              const maxWidth = columnWidths[headerIndex] - 2; // Margen interno para texto
              const text = pdf.splitTextToSize(header, maxWidth);
              pdf.text(text[0] || header, xPos, yPos + 6, { maxWidth: maxWidth });
              xPos += columnWidths[headerIndex];
            });

            yPos += 12;
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
          }

          // Dibujar fila
          xPos = startX;
          pdf.rect(xPos, yPos, pageWidth - 2 * margin, rowHeight);

          // Líneas verticales para columnas
          columnWidths.slice(0, -1).forEach((width) => {
            xPos += width;
            pdf.line(xPos, yPos, xPos, yPos + rowHeight);
          });

          // Preparar información de productos y materiales
          let productoText = '-';
          let cantidadText = '-';
          let todasLasMateriasPrimas: string[] = [];

          if (workOrder.details && (workOrder.details as any).items && (workOrder.details as any).items.length > 0) {
            // Recopilar productos
            const productos = (workOrder.details as any).items.map((item: any) => item.product_name || 'Sin nombre');
            productoText = productos.join(', ');

            // Recopilar cantidades
            const cantidades = (workOrder.details as any).items.map((item: any) =>
              `${formatNumber(item.planned_quantity || 0)} ${item.product_unit || ''}`
            );
            cantidadText = cantidades.join(', ');

            // Recopilar TODAS las materias primas (sin límite)
            (workOrder.details as any).items.forEach((item: any) => {
              if (item.formula && item.formula.length > 0) {
                item.formula.forEach((material: any) => {
                  const requiredQuantity = material.consumption_planned || material.quantity || 0;
                  if (requiredQuantity > 0) {
                    todasLasMateriasPrimas.push(`${material.raw_material_name}: ${formatNumber(requiredQuantity)} ${material.raw_material_unit}`);
                  }
                });
              }
            });
          }

          // Dibujar fila con altura variable
          xPos = startX;
          pdf.rect(xPos, yPos, pageWidth - 2 * margin, rowHeight);

          // Líneas verticales para columnas
          columnWidths.slice(0, -1).forEach((width) => {
            xPos += width;
            pdf.line(xPos, yPos, xPos, yPos + rowHeight);
          });

          // Datos de la fila
          xPos = startX + 3;
          const rowData = [
            formatWorkOrderNumber(workOrder.order_number),
            getStatusLabel(workOrder.status),
            getPriorityLabel(workOrder.priority),
            workOrder.description || '-',
            productoText,
            cantidadText,
            '', // Espacio vacío para la columna de Materias Primas - lo dibujamos manualmente
            formatDate(workOrder.planned_start_date),
            formatDate(workOrder.planned_end_date)
          ];

          // Dibujar cada columna
          rowData.forEach((data, colIndex) => {
            const maxWidth = columnWidths[colIndex] - 6; // Margen interno

            if (colIndex === 6) { // Columna de Materias Primas
              // Dibujar cada materia prima en una línea separada
              let materialYPos = yPos + 5;
              todasLasMateriasPrimas.forEach((material) => {
                if (materialYPos - yPos < rowHeight - 4) { // Asegurar que quepa en la fila
                  const materialParts = pdf.splitTextToSize(material, maxWidth);
                  pdf.text(materialParts[0] || material, xPos, materialYPos, { maxWidth: maxWidth });
                  materialYPos += 4.5; // Espacio entre líneas
                }
              });
              if (todasLasMateriasPrimas.length === 0) {
                pdf.text('-', xPos, yPos + 6, { maxWidth: maxWidth });
              }
            } else {
              // Para otras columnas
              const text = pdf.splitTextToSize(data, maxWidth);
              pdf.text(text[0] || '-', xPos, yPos + 6, { maxWidth: maxWidth });
            }

            xPos += columnWidths[colIndex];
          });

          yPos += rowHeight;

          // Línea horizontal entre filas
          pdf.line(startX, yPos, pageWidth - margin, yPos);
        });
      }

      // Footer común
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Total de registros: ${workOrders.length}`, margin, pageHeight - 10);

      // Guardar PDF
      const fileName = `Reporte_OT_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      alert('Reporte de órdenes de trabajo generado exitosamente');

    } catch (error) {
      console.error('Error generando reporte PDF:', error);
      alert('Error al generar el reporte PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }, [formatDate, getStatusLabel, getPriorityLabel]);

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
          <div className="view-selector">
            <button
              onClick={() => setViewMode('cards')}
              className={`view-button ${viewMode === 'cards' ? 'active' : ''}`}
              title="Vista de tarjetas"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              title="Vista de grilla"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18"></path>
                <path d="M3 12h18"></path>
                <path d="M3 18h18"></path>
              </svg>
            </button>
          </div>
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
          <button onClick={generateWorkOrdersReportPDF} className="print-button" title="Generar reporte PDF de OT pendientes/en proceso">
            🖨️ Imprimir Reporte
          </button>
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
      ) : viewMode === 'cards' ? (
        <div className="work-orders-grid">
          {getSortedWorkOrders.map((workOrder) => (
            <WorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onDelete={onDelete}
              formatDate={formatDate}
              getStatusLabel={getStatusLabel}
              getPriorityLabel={getPriorityLabel}
            />
          ))}
        </div>
      ) : (
        <div className="work-orders-table-container">
          <div className="work-orders-table-wrapper">
            <table className="work-orders-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('order_number')} style={{ cursor: 'pointer' }}>
                    N° OT {sortField === 'order_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    Estado {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer' }}>
                    Prioridad {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Descripción</th>
                  <th onClick={() => handleSort('planned_start_date')} style={{ cursor: 'pointer' }}>
                    Inicio Planificado {sortField === 'planned_start_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('planned_end_date')} style={{ cursor: 'pointer' }}>
                    Fin Planificado {sortField === 'planned_end_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('actual_start_date')} style={{ cursor: 'pointer' }}>
                    Inicio Real {sortField === 'actual_start_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('actual_end_date')} style={{ cursor: 'pointer' }}>
                    Fin Real {sortField === 'actual_end_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getSortedWorkOrders.map((workOrder) => (
                  <tr key={workOrder.id}>
                    <td className="order-number">{formatWorkOrderNumber(workOrder.order_number)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(workOrder.status) }}
                      >
                        {getStatusLabel(workOrder.status)}
                      </span>
                    </td>
                    <td>
                      <span
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(workOrder.priority) }}
                      >
                        {getPriorityLabel(workOrder.priority)}
                      </span>
                    </td>
                    <td className="description-cell">
                      {workOrder.description || '-'}
                    </td>
                    <td>{formatDate(workOrder.planned_start_date)}</td>
                    <td>{formatDate(workOrder.planned_end_date)}</td>
                    <td>{formatDate(workOrder.actual_start_datetime || workOrder.actual_start_date, true)}</td>
                    <td>{formatDate(workOrder.actual_end_datetime || workOrder.actual_end_date, true)}</td>
                    <td className="actions-cell">
                      {onViewDetails && (
                        <button
                          onClick={() => onViewDetails(workOrder)}
                          className="action-button view-button table-action"
                          title="Ver Detalles"
                        >
                          👁️
                        </button>
                      )}
                      {onEdit && (workOrder.status === 'pending' || workOrder.status === 'cancelled') && (
                        <button
                          onClick={() => onEdit(workOrder)}
                          className="action-button edit-button table-action"
                          title="Editar"
                        >
                          ✏️
                        </button>
                      )}
                      {onDelete && (workOrder.status === 'pending' || workOrder.status === 'cancelled') && (
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de que deseas eliminar la orden de trabajo ${formatWorkOrderNumber(workOrder.order_number)}? Esta acción no se puede deshacer.`)) {
                              onDelete(workOrder);
                            }
                          }}
                          className="action-button delete-button table-action"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

WorkOrdersList.displayName = 'WorkOrdersList';

export default WorkOrdersList;
