import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductFormula, RawMaterial } from '../types';
import productsService from '../services/productsService';
import rawMaterialsService from '../services/rawMaterialsService';
import ProductForm from './ProductForm';
import ProductFormulaModal from './ProductFormula';
import './ProductDetails.css';

interface ProductDetailsProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Callback para recargar lista de productos
}

const ProductDetails: React.FC<ProductDetailsProps> = ({
  product,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [formula, setFormula] = useState<ProductFormula[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // Cargar datos del producto
  const loadProductData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando detalles del producto:', product.name);
      
      const [formulaData, rawMaterialsData] = await Promise.all([
        productsService.getFormula(product.id),
        rawMaterialsService.getAll(true) // Solo activas
      ]);
      
      console.log('📊 Datos cargados - Fórmula:', formulaData.length, 'ingredientes');
      console.log('📦 Materias primas disponibles:', rawMaterialsData.length);
      
      setFormula(formulaData);
      setRawMaterials(rawMaterialsData);
    } catch (error) {
      console.error('Error loading product data:', error);
      alert('Error al cargar los datos de la fórmula');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando se abre el modal o cambia el producto
  useEffect(() => {
    if (isOpen) {
      loadProductData();
    }
  }, [isOpen, product.id]);

  // Manejar actualización del producto
  const handleProductUpdate = () => {
    onUpdate(); // Recargar lista principal
    loadProductData(); // Recargar datos locales
    setShowEditForm(false);
  };

  // Manejar actualización de fórmula
  const handleFormulaUpdate = () => {
    loadProductData(); // Recargar datos locales
    setShowFormulaModal(false);
  };

  // Calcular estadísticas de producción
  const productionStats = useMemo(() => {
    if (formula.length === 0) {
      return {
        hasFormula: false,
        canProduce: false,
        maxProducible: 0,
        totalIngredients: 0,
        insufficientStock: 0,
        limitingMaterial: null
      };
    }

    let maxProducible = Infinity;
    let limitingMaterial: string | null = null;
    let insufficientStock = 0;

    formula.forEach(item => {
      const rawMaterial = rawMaterials.find(rm => rm.id === item.raw_material_id);
      if (rawMaterial && item.quantity > 0) {
        const possibleBatches = Math.floor(rawMaterial.current_stock / item.quantity);
        
        if (possibleBatches < maxProducible) {
          maxProducible = possibleBatches;
          limitingMaterial = rawMaterial.name;
        }
        
        if (rawMaterial.current_stock < item.quantity) {
          insufficientStock++;
        }
      }
    });

    if (maxProducible === Infinity) {
      maxProducible = 0;
    }

    return {
      hasFormula: true,
      canProduce: maxProducible > 0,
      maxProducible,
      totalIngredients: formula.length,
      insufficientStock,
      limitingMaterial
    };
  }, [formula, rawMaterials]);

  // Manejar cierre del modal
  const handleClose = () => {
    if (!loading && !showEditForm && !showFormulaModal) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content product-details-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header del modal */}
          <div className="modal-header">
            <div className="header-info">
              <div className="product-title-section">
                <h2>{product.name}</h2>
                <span className={`status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                  {product.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {product.description && (
                <p className="product-description">{product.description}</p>
              )}
            </div>
            <div className="header-actions">
              <button
                className="btn btn-secondary btn-edit"
                onClick={() => setShowEditForm(true)}
                disabled={loading}
              >
                ✏️ Editar Fórmula
              </button>
              <button 
                className="modal-close-btn"
                onClick={handleClose}
                disabled={loading}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Información básica del producto */}
          <div className="product-basic-info">
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Cantidad Base</span>
                <span className="value">{product.base_quantity} {product.unit}</span>
              </div>
              <div className="info-item">
                <span className="label">Unidad</span>
                <span className="value">{product.unit}</span>
              </div>
              <div className="info-item">
                <span className="label">Creado</span>
                <span className="value">
                  {new Date(product.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Última Actualización</span>
                <span className="value">
                  {new Date(product.updated_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Estadísticas de producción */}
          <div className="production-stats">
            <h3>Estado de Producción</h3>
            <div className="stats-grid">
              <div className={`stat-card ${productionStats.hasFormula ? 'success' : 'warning'}`}>
                <span className="stat-icon">{productionStats.hasFormula ? '📝' : '❓'}</span>
                <div className="stat-content">
                  <span className="stat-number">{productionStats.totalIngredients}</span>
                  <span className="stat-label">Ingredientes</span>
                </div>
              </div>
              
              <div className={`stat-card ${productionStats.canProduce ? 'success' : 'error'}`}>
                <span className="stat-icon">{productionStats.canProduce ? '✅' : '❌'}</span>
                <div className="stat-content">
                  <span className="stat-number">{productionStats.maxProducible}</span>
                  <span className="stat-label">Lotes Posibles</span>
                </div>
              </div>
              
              <div className={`stat-card ${productionStats.insufficientStock === 0 ? 'success' : 'warning'}`}>
                <span className="stat-icon">{productionStats.insufficientStock === 0 ? '📦' : '⚠️'}</span>
                <div className="stat-content">
                  <span className="stat-number">{productionStats.insufficientStock}</span>
                  <span className="stat-label">Stock Insuficiente</span>
                </div>
              </div>
              
              <div className={`stat-card ${productionStats.canProduce ? 'success' : 'info'}`}>
                <span className="stat-icon">🏭</span>
                <div className="stat-content">
                  <span className="stat-status">
                    {productionStats.canProduce ? 'Listo' : 'No Disponible'}
                  </span>
                  <span className="stat-label">Estado Producción</span>
                </div>
              </div>
            </div>
            
            {productionStats.limitingMaterial && (
              <div className="limiting-factor">
                <span className="limiting-icon">🔗</span>
                <span className="limiting-text">
                  Material limitante: <strong>{productionStats.limitingMaterial}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Contenido principal */}
          <div className="details-content">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Cargando detalles de la fórmula...</p>
              </div>
            ) : (
              <>
                {/* Sección de fórmula */}
                <div className="formula-section">
                  <div className="section-header">
                    <h3>Fórmula</h3>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowFormulaModal(true)}
                    >
                      {formula.length > 0 ? '✏️ Gestionar Fórmula' : '➕ Crear Fórmula'}
                    </button>
                  </div>

                  {formula.length === 0 ? (
                    <div className="no-formula">
                      <div className="empty-state">
                        <span className="empty-icon">📝</span>
                        <h4>Sin Fórmula Definida</h4>
                        <p>Esta fórmula aún no tiene ingredientes definidos.</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => setShowFormulaModal(true)}
                        >
                          Crear Primera Fórmula
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="formula-preview">
                      <div className="formula-summary">
                        <p>
                          <strong>Produce:</strong> {product.base_quantity} {product.unit} usando {formula.length} ingrediente{formula.length !== 1 ? 's' : ''}
                        </p>
                        {productionStats.canProduce ? (
                          <p className="production-ready">
                            ✅ <strong>Listo para producir</strong> hasta {productionStats.maxProducible} lote{productionStats.maxProducible !== 1 ? 's' : ''}
                          </p>
                        ) : (
                          <p className="production-blocked">
                            ❌ <strong>Producción bloqueada</strong> por falta de materias primas
                          </p>
                        )}
                      </div>

                      <div className="ingredients-preview">
                        {formula.map((item) => {
                          const rawMaterial = rawMaterials.find(rm => rm.id === item.raw_material_id);
                          const hasStock = rawMaterial && rawMaterial.current_stock >= item.quantity;
                          
                          return (
                            <div 
                              key={item.raw_material_id} 
                              className={`ingredient-preview ${!hasStock ? 'insufficient' : ''}`}
                            >
                              <div className="ingredient-info">
                                <span className="ingredient-name">{item.raw_material_name}</span>
                                <span className="ingredient-quantity">
                                  {item.quantity} {rawMaterial?.unit || 'unidad'}
                                </span>
                              </div>
                              <div className="stock-status">
                                <span className={`stock-indicator ${hasStock ? 'ok' : 'warning'}`}>
                                  {hasStock ? '✅' : '⚠️'}
                                </span>
                                <span className="stock-text">
                                  {rawMaterial?.current_stock || 0} disponible
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer con acciones */}
          <div className="details-footer">
            <div className="footer-actions">
              <button
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cerrar
              </button>
              {formula.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowFormulaModal(true)}
                  disabled={loading}
                >
                  Gestionar Fórmula Completa
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de edición de producto */}
      {showEditForm && (
        <ProductForm
          product={product}
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          onSubmit={handleProductUpdate}
        />
      )}

      {/* Modal de gestión de fórmula */}
      {showFormulaModal && (
        <ProductFormulaModal
          product={product}
          isOpen={showFormulaModal}
          onClose={() => setShowFormulaModal(false)}
          onUpdate={handleFormulaUpdate}
        />
      )}
    </>
  );
};

export default ProductDetails;
