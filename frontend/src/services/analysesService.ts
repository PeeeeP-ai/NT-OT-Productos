import axios, { AxiosResponse } from 'axios';
import { API_BASE_URL } from '../lib/supabase';
import {
  ProductAnalysis,
  ProductAnalysesApiResponse,
  ProductAnalysisApiResponse,
  ProductAnalysisFormData
} from '../types';

// Configurar axios con la URL base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =========================================
// SERVICIOS PARA ANÁLISIS DE PRODUCTOS
// =========================================

// Obtener análisis de una orden de trabajo
export const getWorkOrderAnalyses = async (workOrderId: string): Promise<ProductAnalysesApiResponse> => {
  try {
    const response: AxiosResponse<ProductAnalysesApiResponse> = await apiClient.get(`/work-orders/${workOrderId}/analyses`);

    return response.data;
  } catch (error) {
    console.error('Error obteniendo análisis de orden de trabajo:', error);
    return {
      success: false,
      message: 'Error al obtener análisis de orden de trabajo',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Obtener análisis específico
export const getAnalysis = async (analysisId: string): Promise<ProductAnalysisApiResponse> => {
  try {
    const response: AxiosResponse<ProductAnalysisApiResponse> = await apiClient.get(`/analyses/${analysisId}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo análisis:', error);
    return {
      success: false,
      message: 'Error al obtener análisis',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Crear nuevo análisis
export const createAnalysis = async (
  workOrderId: string,
  analysisData: ProductAnalysisFormData
): Promise<ProductAnalysisApiResponse> => {
  try {
    // Si hay archivo, usar FormData para multipart/form-data
    if (analysisData.file) {
      const formData = new FormData();

      // Agregar datos del formulario
      formData.append('analysis_type', analysisData.analysis_type);
      formData.append('analysis_date', analysisData.analysis_date || new Date().toISOString().split('T')[0]);
      formData.append('notes', analysisData.notes || '');
      formData.append('description', analysisData.description || '');
      formData.append('created_by', 'Usuario'); // TODO: Obtener del contexto de autenticación

      // Agregar archivo
      formData.append('file', analysisData.file);

      // Obtener work_order_item_id del primer item de la OT (simplificación)
      // En una implementación completa, esto debería venir del formulario
      const workOrderResponse = await apiClient.get(`/work-orders/${workOrderId}`);
      if (workOrderResponse.data.success && workOrderResponse.data.data.items && workOrderResponse.data.data.items.length > 0) {
        formData.append('work_order_item_id', workOrderResponse.data.data.items[0].id);
      } else {
        return {
          success: false,
          message: 'No se pudo obtener el item de la orden de trabajo',
          errors: ['La orden de trabajo no tiene items válidos']
        };
      }

      const response: AxiosResponse<ProductAnalysisApiResponse> = await apiClient.post(
        `/work-orders/${workOrderId}/analyses`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } else {
      // Petición normal sin archivo
      const payload: any = {
        analysis_type: analysisData.analysis_type,
        analysis_date: analysisData.analysis_date || new Date().toISOString().split('T')[0],
        notes: analysisData.notes,
        description: analysisData.description,
        created_by: 'Usuario' // TODO: Obtener del contexto de autenticación
      };

      // Obtener work_order_item_id del primer item de la OT
      const workOrderResponse = await apiClient.get(`/work-orders/${workOrderId}`);
      if (workOrderResponse.data.success && workOrderResponse.data.data.items && workOrderResponse.data.data.items.length > 0) {
        payload.work_order_item_id = workOrderResponse.data.data.items[0].id;
      } else {
        return {
          success: false,
          message: 'No se pudo obtener el item de la orden de trabajo',
          errors: ['La orden de trabajo no tiene items válidos']
        };
      }

      const response: AxiosResponse<ProductAnalysisApiResponse> = await apiClient.post(`/work-orders/${workOrderId}/analyses`, payload);
      return response.data;
    }
  } catch (error) {
    console.error('Error creando análisis:', error);
    return {
      success: false,
      message: 'Error al crear análisis',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// Eliminar análisis
export const deleteAnalysis = async (analysisId: string): Promise<{ success: boolean; message: string }> => {
  try {
    await apiClient.delete(`/analyses/${analysisId}`);
    return {
      success: true,
      message: 'Análisis eliminado exitosamente'
    };
  } catch (error: any) {
    console.error('Error eliminando análisis:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al eliminar análisis'
    };
  }
};

// Obtener todos los análisis
export const getAllAnalyses = async (): Promise<ProductAnalysesApiResponse> => {
  try {
    console.log('🌐 AnálisisService - Iniciando petición GET /analyses...');
    console.log('🌐 AnálisisService - URL base:', API_BASE_URL);
    console.log('🌐 AnálisisService - Full URL:', apiClient.defaults.baseURL + '/analyses');

    const response: AxiosResponse<ProductAnalysesApiResponse> = await apiClient.get('/analyses');

    console.log('🌐 AnálisisService - Respuesta exitosa:');
    console.log('🌐 AnálisisService - Status:', response.status);
    console.log('🌐 AnálisisService - Headers:', response.headers);
    console.log('🌐 AnálisisService - Data success:', response.data.success);

    if (response.data.success && response.data.data) {
      console.log('🌐 AnálisisService - Análisis encontrados:', response.data.data.length);
      console.log('🌐 AnálisisService - Primer análisis:', response.data.data[0]);
    }

    return response.data;
  } catch (error: any) {
    console.error('❌ AnálisisService - Error obteniendo todos los análisis:', error);
    console.error('❌ AnálisisService - Error message:', error.message);
    console.error('❌ AnálisisService - Error config:', error.config);
    console.error('❌ AnálisisService - Error status:', error.response?.status);
    console.error('❌ AnálisisService - Error data:', error.response?.data);
    console.error('❌ AnálisisService - Error headers:', error.response?.headers);

    return {
      success: false,
      message: 'Error al obtener análisis',
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// =========================================
// FUNCIONES UTILITARIAS
// =========================================

// Obtener color para el tipo de análisis
export const getAnalysisTypeColor = (analysisType: ProductAnalysis['analysis_type']): string => {
  const typeColors = {
    chemical: '#4caf50',
    physical: '#2196f3',
    microbiological: '#ff9800',
    organoleptic: '#9c27b0',
    general: '#607d8b'
  };
  return typeColors[analysisType] || '#9e9e9e';
};

// Obtener etiqueta para el tipo de análisis
export const getAnalysisTypeLabel = (analysisType: ProductAnalysis['analysis_type']): string => {
  const typeLabels = {
    chemical: 'Químico',
    physical: 'Físico',
    microbiological: 'Microbiológico',
    organoleptic: 'Organoléptico',
    general: 'General'
  };
  return typeLabels[analysisType] || analysisType;
};

// Formatear número de análisis
export const formatAnalysisNumber = (analysisNumber: string): string => {
  return analysisNumber || 'N/A';
};

// Obtener opciones de tipo de análisis para formularios
export const getAnalysisTypeOptions = () => [
  { value: 'chemical', label: 'Químico', color: '#4caf50' },
  { value: 'physical', label: 'Físico', color: '#2196f3' },
  { value: 'microbiological', label: 'Microbiológico', color: '#ff9800' },
  { value: 'organoleptic', label: 'Organoléptico', color: '#9c27b0' },
  { value: 'general', label: 'General', color: '#607d8b' }
];

// Formatear fecha de análisis
export const formatAnalysisDate = (dateString: string): string => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formateando fecha de análisis:', error);
    return '-';
  }
};
