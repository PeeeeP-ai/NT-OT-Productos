import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { productsService } from '../services/productsService';
import { FaRegEdit, FaRegTrashAlt, FaPowerOff, FaEye, FaFlask } from 'react-icons/fa';
import './ProductsList.css';

interface ProductsListProps {
  onEdit: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManageFormula?: (product: Product) => void;
  onCreate?: () => void;
  forceRefresh?: number;
}

const ProductsList: React.FC<ProductsListProps> = ({
  onEdit,
  onViewDetails,
  onManageFormula,
  onCreate: _onCreate, // Renombrar para evitar warning
  forceRefresh
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [showInactive]);

  useEffect(() => {
    if (forceRefresh) {
      loadProducts();
    }
  }, [forceRefresh]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await productsService.getAll(showInactive);
      setProducts(data);
      console.log('📦 Productos cargados:', data.length);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (product: Product) => {
    const action = product.is_active ? 'deshabilitar' : 'habilitar';
    const confirmMessage = `¿Está seguro que desea ${action} "${product.name}"?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setActionLoading(`disable-${product.id}`);
        await productsService.disable(product.id, !product.is_active);
        await loadProducts();
        
        // Mostrar mensaje de éxito
        const successMessage = `Producto ${product.is_active ? 'deshabilitado' : 'habilitado'} exitosamente`;
        console.log('✅', successMessage);
      } catch (error: any) {
        console.error('Error changing product status:', error);
        const errorMessage = error.message || 'Error al cambiar el estado del producto';
        alert(errorMessage);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmMessage = `¿Eliminar permanentemente "${product.name}"?\n\nEsta acción no se puede deshacer y eliminará también su fórmula asociada.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setActionLoading(`delete-${product.id}`);
        await productsService.delete(product.id);
        await loadProducts();
        
        console.log('✅ Producto eliminado exitosamente');
      } catch (error: any) {
        console.error('Error deleting product:', error);
        const errorMessage = error.message || 'Error al eliminar el producto';
        alert(errorMessage);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getProductStatus = (product: Product) => {
    if (!product.is_active) {
      return { class: 'inactive', text: 'Inactivo' };
    }
    return { class: 'active', text: 'Activo' };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="products-list">
      <div className="header">
        <h1>Productos</h1>
        <div className="controls">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron productos</p>
            <p className="empty-subtitle">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea tu primer producto para comenzar'}
            </p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const status = getProductStatus(product);
            return (
              <div key={product.id} className={`product-card ${!product.is_active ? 'inactive' : ''}`}>
                <div className="card-header">
                  <h3>{product.name}</h3>
                  <div className="status-indicator">
                    <span className={`badge ${status.class}`}>
                      {status.text}
                    </span>
                  </div>
                </div>

                <div className="card-content">
                  {product.description && (
                    <div className="description">
                      <span className="value">{product.description}</span>
                    </div>
                  )}

                  <div className="info-row">
                    <span className="label">Unidad:</span>
                    <span className="value">{product.unit}</span>
                  </div>

                  <div className="info-row">
                    <span className="label">Cantidad base:</span>
                    <span className="value">{product.base_quantity} {product.unit}</span>
                  </div>

                  <div className="info-row">
                    <span className="label">Creado:</span>
                    <span className="value">
                      {new Date(product.created_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>

                  {product.updated_at !== product.created_at && (
                    <div className="info-row">
                      <span className="label">Actualizado:</span>
                      <span className="value">
                        {new Date(product.updated_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    onClick={() => onViewDetails(product)}
                    aria-label="Ver detalles"
                    title="Ver detalles del producto"
                    className="action-btn view"
                  >
                    <FaEye />
                  </button>

                  {onManageFormula && (
                    <button
                      onClick={() => onManageFormula(product)}
                      aria-label="Gestionar fórmula"
                      title="Gestionar fórmula del producto"
                      className="action-btn formula"
                    >
                      <FaFlask />
                    </button>
                  )}

                  <button
                    onClick={() => onEdit(product)}
                    aria-label="Editar"
                    title="Editar producto"
                    className="action-btn edit"
                  >
                    <FaRegEdit />
                  </button>

                  <button
                    onClick={() => handleDisable(product)}
                    aria-label={product.is_active ? 'Deshabilitar' : 'Habilitar'}
                    title={product.is_active ? 'Deshabilitar' : 'Habilitar'}
                    className={`action-btn ${product.is_active ? 'warning' : 'success'}`}
                    disabled={actionLoading === `disable-${product.id}`}
                  >
                    {actionLoading === `disable-${product.id}` ? (
                      <div className="loading-spinner" />
                    ) : (
                      <FaPowerOff />
                    )}
                  </button>

                  {showInactive && (
                    <button
                      onClick={() => handleDelete(product)}
                      aria-label="Eliminar"
                      title="Eliminar permanentemente"
                      className="action-btn danger"
                      disabled={actionLoading === `delete-${product.id}`}
                    >
                      {actionLoading === `delete-${product.id}` ? (
                        <div className="loading-spinner" />
                      ) : (
                        <FaRegTrashAlt />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProductsList;