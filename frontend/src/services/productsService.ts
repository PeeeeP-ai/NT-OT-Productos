import axios, { AxiosResponse } from 'axios';
import { 
  Product, 
  ProductFormula, 
  ProductWithFormula,
  ProductFormData, 
  FormulaItemFormData,
  ApiResponse 
} from '../types';
import { API_BASE_URL } from '../lib/supabase';

// Configurar axios con la URL base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Servicio para Productos
export const productsService = {
  // =========================================
  // MÉTODOS CRUD PARA PRODUCTOS
  // =========================================

  // Obtener todos los productos
  async getAll(showInactive: boolean = false): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      params.append('inactive', showInactive.toString());

      const response: AxiosResponse<ApiResponse<Product[]>> = await apiClient.get(`/products?${params}`);
      return response.data.success ? response.data.data || [] : [];
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  // Obtener producto por ID
  async getById(id: string): Promise<Product | null> {
    try {
      const response: AxiosResponse<ApiResponse<Product>> = await apiClient.get(`/products/${id}`);
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      console.error('Error fetching product:', error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Crear nuevo producto
  async create(data: ProductFormData): Promise<Product> {
    try {
      const response: AxiosResponse<ApiResponse<Product>> = await apiClient.post('/products', data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error creando producto');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error creating product:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // Actualizar producto
  async update(id: string, data: ProductFormData): Promise<Product> {
    try {
      const response: AxiosResponse<ApiResponse<Product>> = await apiClient.put(`/products/${id}`, data);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error actualizando producto');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error updating product:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // Deshabilitar/habilitar producto
  async disable(id: string, is_active: boolean): Promise<Product> {
    try {
      const response: AxiosResponse<ApiResponse<Product>> = await apiClient.patch(`/products/${id}/disable`, { is_active });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error cambiando estado del producto');
      }
      return response.data.data!;
    } catch (error) {
      console.error('Error disabling product:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // Eliminar producto
  async delete(id: string): Promise<void> {
    try {
      const response: AxiosResponse<ApiResponse> = await apiClient.delete(`/products/${id}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error eliminando producto');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // =========================================
  // MÉTODOS PARA GESTIÓN DE FÓRMULAS
  // =========================================

  // Obtener fórmula de un producto
  async getFormula(productId: string): Promise<ProductFormula[]> {
    try {
      console.log('🔍 Cargando fórmula para producto:', productId);
      const response: AxiosResponse<ApiResponse<ProductFormula[]>> = await apiClient.get(
        `/products/${productId}/formula`
      );
      const formula = response.data.success ? response.data.data || [] : [];
      console.log('📊 Fórmula cargada:', formula.length, 'ingredientes');
      
      // LOG DETALLADO: Mostrar datos recibidos del servidor
      console.log('📊 DATOS COMPLETOS DE FÓRMULA RECIBIDOS:', JSON.stringify(formula, null, 2));
      
      // LOG DETALLADO: Mostrar stocks específicamente
      formula.forEach((item, index) => {
        console.log(`📊 Ingrediente ${index + 1}:`, {
          name: item.raw_material_name,
          stock: item.raw_material_current_stock,
          unit: item.raw_material_unit,
          id: item.raw_material_id
        });
      });
      
      return formula;
    } catch (error) {
      console.error('Error fetching product formula:', error);
      throw error;
    }
  },

  // Agregar materia prima a fórmula
  async addFormulaItem(productId: string, data: FormulaItemFormData): Promise<ProductFormula> {
    try {
      console.log('➕ Agregando ingrediente a fórmula:', productId);
      console.log('📊 Datos a enviar:', JSON.stringify(data, null, 2));
      console.log('📊 Tipos de datos:', {
        raw_material_id: typeof data.raw_material_id,
        quantity: typeof data.quantity
      });
      
      const response: AxiosResponse<ApiResponse<ProductFormula>> = await apiClient.post(
        `/products/${productId}/formula`,
        data
      );
      
      console.log('📊 Respuesta del servidor:', response.status, response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error agregando ingrediente a la fórmula');
      }
      console.log('✅ Ingrediente agregado exitosamente');
      return response.data.data!;
    } catch (error) {
      console.error('Error adding formula item:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // Actualizar cantidad de materia prima en fórmula
  async updateFormulaItem(productId: string, rawMaterialId: string, data: FormulaItemFormData): Promise<ProductFormula> {
    try {
      console.log('✏️ Actualizando ingrediente de fórmula:', rawMaterialId, data);
      const response: AxiosResponse<ApiResponse<ProductFormula>> = await apiClient.put(
        `/products/${productId}/formula/${rawMaterialId}`,
        data
      );
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error actualizando ingrediente de fórmula');
      }
      console.log('✅ Ingrediente actualizado exitosamente');
      return response.data.data!;
    } catch (error) {
      console.error('Error updating formula item:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // Eliminar materia prima de fórmula
  async removeFormulaItem(productId: string, rawMaterialId: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando ingrediente de fórmula:', rawMaterialId);
      const response: AxiosResponse<ApiResponse> = await apiClient.delete(
        `/products/${productId}/formula/${rawMaterialId}`
      );
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error eliminando ingrediente de fórmula');
      }
      console.log('✅ Ingrediente eliminado exitosamente');
    } catch (error) {
      console.error('Error removing formula item:', error);
      
      // Si es un error de axios con respuesta del servidor, extraer el mensaje
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      throw error;
    }
  },

  // =========================================
  // MÉTODOS UTILITARIOS
  // =========================================

  // Obtener producto completo con fórmula
  async getProductWithFormula(id: string): Promise<ProductWithFormula | null> {
    try {
      console.log('🔍 Cargando producto completo con fórmula:', id);
      const response: AxiosResponse<ApiResponse<ProductWithFormula>> = await apiClient.get(
        `/products/${id}/with-formula`
      );
      const productWithFormula = response.data.success ? response.data.data || null : null;
      
      if (productWithFormula) {
        console.log('📊 Producto cargado:', productWithFormula.name, 'con', productWithFormula.formula?.length || 0, 'ingredientes');
      }
      
      return productWithFormula;
    } catch (error) {
      console.error('Error fetching product with formula:', error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Validar si se puede producir un producto (basado en stock de materias primas)
  async canProduce(productId: string, quantity: number = 1): Promise<{
    canProduce: boolean;
    maxProducible: number;
    limitingMaterial?: string;
    missingMaterials: string[];
  }> {
    try {
      const productWithFormula = await this.getProductWithFormula(productId);
      
      if (!productWithFormula || !productWithFormula.formula || productWithFormula.formula.length === 0) {
        return {
          canProduce: false,
          maxProducible: 0,
          missingMaterials: ['Producto sin fórmula definida']
        };
      }

      let maxProducible = Infinity;
      let limitingMaterial: string | undefined;
      const missingMaterials: string[] = [];

      for (const item of productWithFormula.formula) {
        if (!item.raw_material || !item.raw_material.is_active) {
          missingMaterials.push(item.raw_material?.name || 'Materia prima desconocida');
          continue;
        }

        const availableStock = item.raw_material.current_stock;
        const requiredPerUnit = item.quantity;
        const possibleFromThis = Math.floor(availableStock / requiredPerUnit);

        if (possibleFromThis < maxProducible) {
          maxProducible = possibleFromThis;
          limitingMaterial = item.raw_material.name;
        }

        if (availableStock < requiredPerUnit * quantity) {
          missingMaterials.push(
            `${item.raw_material.name} (disponible: ${availableStock}, necesario: ${requiredPerUnit * quantity})`
          );
        }
      }

      const finalMaxProducible = maxProducible === Infinity ? 0 : maxProducible;

      return {
        canProduce: finalMaxProducible >= quantity && missingMaterials.length === 0,
        maxProducible: finalMaxProducible,
        limitingMaterial,
        missingMaterials
      };
    } catch (error) {
      console.error('Error checking if product can be produced:', error);
      throw error;
    }
  }
};

export default productsService;