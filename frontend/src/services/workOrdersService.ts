import axios, { AxiosResponse } from 'axios';
import { API_BASE_URL } from '../lib/supabase';
import {
  WorkOrder,
  WorkOrdersApiResponse,
  WorkOrderApiResponse,
  WorkOrderWithItemsApiResponse,
  WorkOrderDetailsApiResponse,
  RawMaterialAvailabilityApiResponse,
  WorkOrderFormData,
  WorkOrderItemFormData
} from '../types';

// Configurar axios con la URL base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =========================================
// SERVICIOS PARA ÓRDENES DE TRABAJO
// =========================================

// Obtener lista de órdenes de trabajo
export const getWorkOrders = async (status?: string): Promise<WorkOrdersApiResponse> => {
  try {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }

    const response: AxiosResponse<WorkOrdersApiResponse> = await apiClient.get(`/work-orders?${params.toString()}`);

    return response.data;
  } catch (error) {
    console.error('Error obteniendo órdenes de trabajo:', error);
    return {
      success: false,
      message: 'Error al obtener órdenes de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Obtener órdenes de trabajo pendientes y en progreso ordenadas por fecha de inicio
export const getActiveWorkOrdersSortedByStartDate = async (): Promise<WorkOrdersApiResponse> => {
  try {
    // Obtener pendentes
    const pendingResponse = await getWorkOrders('pending');

    // Obtener en progreso
    const inProgressResponse = await getWorkOrders('in_progress');

    if (!pendingResponse.success || !inProgressResponse.success) {
      return {
        success: false,
        message: 'Error al obtener órdenes de trabajo',
        errors: [
          ...(pendingResponse.errors || []),
          ...(inProgressResponse.errors || [])
        ]
      };
    }

    // Combinar resultados
    const allActiveWorkOrders = [
      ...(pendingResponse.data || []),
      ...(inProgressResponse.data || [])
    ];

    // Ordenar por fecha de inicio (planned_start_date primero, luego actual_start_datetime)
    const sortedWorkOrders = allActiveWorkOrders.sort((a, b) => {
      const dateA = a.planned_start_date || a.actual_start_datetime || a.created_at;
      const dateB = b.planned_start_date || b.actual_start_datetime || b.created_at;

      // Si alguno no tiene fecha, lo pone al final
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return {
      success: true,
      message: 'Órdenes de trabajo obtenidas exitosamente',
      data: sortedWorkOrders
    };
  } catch (error) {
    console.error('Error obteniendo órdenes de trabajo activas:', error);
    return {
      success: false,
      message: 'Error al obtener órdenes de trabajo activas',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Obtener orden de trabajo por ID
export const getWorkOrder = async (id: string): Promise<WorkOrderApiResponse> => {
  try {
    const response: AxiosResponse<WorkOrderApiResponse> = await apiClient.get(`/work-orders/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo orden de trabajo:', error);
    return {
      success: false,
      message: 'Error al obtener orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Obtener detalles completos de orden de trabajo
export const getWorkOrderDetails = async (id: string): Promise<WorkOrderDetailsApiResponse> => {
  try {
    const response: AxiosResponse<WorkOrderDetailsApiResponse> = await apiClient.get(`/work-orders/${id}/details`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles de orden de trabajo:', error);
    return {
      success: false,
      message: 'Error al obtener detalles de orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Crear nueva orden de trabajo
export const createWorkOrder = async (
  workOrderData: WorkOrderFormData,
  items: WorkOrderItemFormData[]
): Promise<WorkOrderWithItemsApiResponse> => {
  try {
    const payload = {
      description: workOrderData.description,
      priority: workOrderData.priority,
      planned_start_date: workOrderData.planned_start_date,
      planned_end_date: workOrderData.planned_end_date,
      notes: workOrderData.notes,
      items: items
    };

    const response: AxiosResponse<WorkOrderWithItemsApiResponse> = await apiClient.post('/work-orders', payload);
    return response.data;
  } catch (error) {
    console.error('Error creando orden de trabajo:', error);
    return {
      success: false,
      message: 'Error al crear orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Actualizar orden de trabajo
export const updateWorkOrder = async (
  id: string,
  updates: Partial<WorkOrderFormData>,
  items?: WorkOrderItemFormData[]
): Promise<WorkOrderApiResponse> => {
  try {
    const payload = {
      ...updates,
      ...(items && { items })
    };

    const response: AxiosResponse<WorkOrderApiResponse> = await apiClient.put(`/work-orders/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error('Error actualizando orden de trabajo:', error);
    return {
      success: false,
      message: 'Error al actualizar orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Cambiar estado de orden de trabajo
export const updateWorkOrderStatus = async (
  id: string,
  status: WorkOrder['status']
): Promise<WorkOrderApiResponse> => {
  try {
    const response: AxiosResponse<WorkOrderApiResponse> = await apiClient.patch(`/work-orders/${id}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error('Error cambiando estado de orden de trabajo:', error);

    // Handle specific stock-related errors
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      return {
        success: false,
        message: error.response.data.message || 'Error al cambiar estado de orden de trabajo',
        errors: error.response.data.errors
      };
    }

    return {
      success: false,
      message: error.response?.data?.message || 'Error al cambiar estado de orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Eliminar orden de trabajo
export const deleteWorkOrder = async (id: string): Promise<{ success: boolean; message: string }> => {
  try {
    await apiClient.delete(`/work-orders/${id}`);
    return {
      success: true,
      message: 'Orden de trabajo eliminada exitosamente'
    };
  } catch (error: any) {
    console.error('Error eliminando orden de trabajo:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al eliminar orden de trabajo'
    };
  }
};

// Verificar disponibilidad de materias primas para una orden de trabajo
export const checkRawMaterialsAvailability = async (workOrderId: string): Promise<RawMaterialAvailabilityApiResponse> => {
  try {
    const response: AxiosResponse<RawMaterialAvailabilityApiResponse> = await apiClient.get(`/work-orders/${workOrderId}/availability`);
    return response.data;
  } catch (error) {
    console.error('Error verificando disponibilidad de materias primas:', error);
    return {
      success: false,
      message: 'Error al verificar disponibilidad de materias primas',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Completar orden de trabajo con deducción de stock
export const completeWorkOrder = async (
  workOrderId: string,
  completionData: {
    items: {
      [itemId: string]: {
        produced_quantity: number;
        consumption: {
          raw_material_id: string;
          actual_consumption: number;
        }[];
      };
    };
  }
): Promise<{ success: boolean; message: string; data?: any; errors?: string[]; warnings?: string[] }> => {
  try {
    const response: AxiosResponse = await apiClient.patch(`/work-orders/${workOrderId}/complete`, completionData);
    return response.data;
  } catch (error: any) {
    console.error('Error completando orden de trabajo:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al completar orden de trabajo',
      errors: error.response?.data?.errors || [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// =========================================
// FUNCIONES UTILITARIAS
// =========================================

// Obtener color para el estado de la orden de trabajo
export const getStatusColor = (status: WorkOrder['status']): string => {
  const statusColors = {
    pending: '#ffa726',
    in_progress: '#42a5f5',
    completed: '#66bb6a',
    cancelled: '#ef5350'
  };
  return statusColors[status] || '#9e9e9e';
};

// Obtener color para la prioridad de la orden de trabajo
export const getPriorityColor = (priority: WorkOrder['priority']): string => {
  const priorityColors = {
    low: '#8bc34a',
    normal: '#ffa726',
    high: '#ff9800',
    urgent: '#f44336'
  };
  return priorityColors[priority] || '#9e9e9e';
};

// Formatear número de orden de trabajo
export const formatWorkOrderNumber = (orderNumber: string): string => {
  return orderNumber || 'N/A';
};

// Obtener opciones de prioridad para formularios
export const getWorkOrderPriorityOptions = () => [
  { value: 'low', label: 'Baja', color: '#8bc34a' },
  { value: 'normal', label: 'Normal', color: '#ffa726' },
  { value: 'high', label: 'Alta', color: '#ff9800' },
  { value: 'urgent', label: 'Urgente', color: '#f44336' }
];

// Obtener opciones de estado para formularios
export const getWorkOrderStatusOptions = () => [
  { value: 'pending', label: 'Pendiente', color: '#ffa726' },
  { value: 'in_progress', label: 'En Progreso', color: '#42a5f5' },
  { value: 'completed', label: 'Completada', color: '#66bb6a' },
  { value: 'cancelled', label: 'Cancelada', color: '#ef5350' }
];
