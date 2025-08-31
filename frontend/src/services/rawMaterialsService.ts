import axios, { AxiosResponse } from 'axios';
import { RawMaterial, InventoryEntry, ApiResponse, RawMaterialFormData, InventoryEntryFormData } from '../types';
import { API_BASE_URL } from '../lib/supabase';

// Configurar axios con la URL base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Servicio para Materias Primas
export const rawMaterialsService = {
  // Obtener todas las materias primas
  async getAll(showInactive: boolean = false, includeOptions: boolean = true): Promise<RawMaterial[]> {
    try {
      const params = new URLSearchParams();
      params.append('inactive', showInactive.toString());
      params.append('options', includeOptions.toString());

      const response: AxiosResponse<ApiResponse<RawMaterial[]>> = await apiClient.get(`/raw-materials?${params}`);
      return response.data.success ? response.data.data || [] : [];
    } catch (error) {
      console.error('Error fetching raw materials:', error);
      throw error;
    }
  },

  // Obtener materia prima por ID
  async getById(id: string): Promise<RawMaterial | null> {
    try {
      const response: AxiosResponse<ApiResponse<RawMaterial>> = await apiClient.get(`/raw-materials/${id}`);
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      console.error('Error fetching raw material:', error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Crear nueva materia prima
  async create(data: RawMaterialFormData): Promise<RawMaterial> {
    try {
      const response: AxiosResponse<ApiResponse<RawMaterial>> = await apiClient.post('/raw-materials', data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error creando materia prima');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error creating raw material:', error);
      throw error;
    }
  },

  // Actualizar materia prima
  async update(id: string, data: RawMaterialFormData): Promise<RawMaterial> {
    try {
      const response: AxiosResponse<ApiResponse<RawMaterial>> = await apiClient.put(`/raw-materials/${id}`, data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error actualizando materia prima');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error updating raw material:', error);
      throw error;
    }
  },

  // Deshabilitar/habilitar materia prima
  async disable(id: string, is_active: boolean): Promise<RawMaterial> {
    try {
      const response: AxiosResponse<ApiResponse<RawMaterial>> = await apiClient.patch(`/raw-materials/${id}/disable`, { is_active });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error cambiando estado de materia prima');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error disabling raw material:', error);
      throw error;
    }
  },

  // Eliminar materia prima
  async delete(id: string): Promise<void> {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.delete(`/raw-materials/${id}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error eliminando materia prima');
      }
    } catch (error) {
      console.error('Error deleting raw material:', error);
      throw error;
    }
  },

  // Obtener entradas de inventario de una materia prima
  async getEntries(materialId: string, type?: 'in' | 'out'): Promise<InventoryEntry[]> {
    try {
      const params = new URLSearchParams();
      params.append('order', 'movement_date.desc');
      params.append('limit', '10000');
      if (type) {
        params.append('type', type);
      }

      console.log('🔍 Query usada:', params.toString());
      const response: AxiosResponse<ApiResponse<InventoryEntry[]>> = await apiClient.get(
        `/raw-materials/${materialId}/entries?${params}`
      );
      return response.data.success ? response.data.data || [] : [];
    } catch (error) {
      console.error('Error fetching inventory entries:', error);
      throw error;
    }
  },

  // Crear entrada/salida de inventario
  async createEntry(materialId: string, data: InventoryEntryFormData): Promise<InventoryEntry> {
    try {
      const response: AxiosResponse<ApiResponse<InventoryEntry>> = await apiClient.post(
        `/raw-materials/${materialId}/entries`,
        data
      );
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error creando entrada de inventario');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error creating inventory entry:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  }
};

export default rawMaterialsService;