import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductFormula as FormulaType, RawMaterial, FormulaItemFormData } from '../types';
import productsService from '../services/productsService';
import rawMaterialsService from '../services/rawMaterialsService';
import FormulaItemForm from './FormulaItemForm';
import './ProductFormula.css';

interface ProductFormulaProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Callback para recargar datos del producto
}

const ProductFormula: React.FC<ProductFormulaProps> = ({
  product,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [formula, setFormula] = useState<FormulaType[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<FormulaType | null>(null);

  // Cargar fórmula y materias primas
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando fórmula para producto:', product.name);
      
      const [formulaData, rawMaterialsData] = await Promise.all([
        productsService.getFormula(product.id),
        rawMaterialsService.getAll(true) // Solo activas
      ]);
      
      console.log('📊 Fórmula cargada:', formulaData.length, 'ingredientes');
      console.log('📦 Materias primas disponibles:', rawMaterialsData.length);
      
      // LOG DETALLADO: Mostrar datos de fórmula en el componente
      console.log('📊 FÓRMULA EN COMPONENTE:', formulaData);
      formulaData.forEach((item, index) => {
        console.log(`📊 Componente - Ingrediente ${index + 1}:`, {
          name: item.raw_material_name,
          stock: item.raw_material_current_stock,
          unit: item.raw_material_unit
        });
      });
      
      // LOG DETALLADO: Mostrar materias primas disponibles
      console.log('📦 MATERIAS PRIMAS EN COMPONENTE:', rawMaterialsData);
      rawMaterialsData.forEach((material, index) => {
        console.log(`📦 Componente - Material ${index + 1}:`, {
          name: material.name,
          stock: material.current_stock,
          unit: material.unit
        });
      });
      
      setFormula(formulaData);
      setRawMaterials(rawMaterialsData);
    } catch (error) {
      console.error('Error loading formula data:', error);
      alert('Error al cargar los datos de la fórmula');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, product.id]);

  // Manejar agregar ingrediente
  const handleAddIngredient = async (data: FormulaItemFormData) => {
    try {
      await productsService.addFormulaItem(product.id, data);
      console.log('✅ Ingrediente agregado:', data.raw_material_id, data.quantity);
      await loadData();
      setShowAddForm(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error adding ingredient:', error);
      throw error; // Re-lanzar para que FormulaItemForm maneje el error
    }
  };

  // Manejar editar ingrediente
  const handleEditIngredient = async (data: FormulaItemFormData) => {
    if (!editingItem) return;
    
    try {
      await productsService.updateFormulaItem(product.id, editingItem.raw_material_id, data);
      console.log('✅ Ingrediente actualizado:', data.raw_material_id, data.quantity);
      await loadData();
      setEditingItem(null);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating ingredient:', error);
      throw error;
    }
  };

  // Manejar eliminar ingrediente
  const handleDeleteIngredient = async (rawMaterialId: string) => {
    const ingredient = formula.find(f => f.raw_material_id === rawMaterialId);
    if (!ingredient) return;

    if (window.confirm(
      `¿Eliminar "${ingredient.raw_material_name}" de la fórmula?\n\n` +
      `Esta acción no se puede deshacer.`
    )) {
      try {
        await productsService.removeFormulaItem(product.id, rawMaterialId);
        console.log('✅ Ingrediente eliminado:', rawMaterialId);
        await loadData();
        onUpdate();
      } catch (error) {
        console.error('Error deleting ingredient:', error);
        alert('Error al eliminar el ingrediente');
      }
    }
  };

  // Calcular totales y estadísticas
  const stats = useMemo(() => {
    const totalIngredients = formula.length;
    const totalQuantity = formula.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calcular ingredientes con stock insuficiente usando los datos de la fórmula
    const insufficientStock = formula.filter(item => {
      const currentStock = item.raw_material_current_stock || 0;
      return currentStock < item.quantity;
    }).length;

    // Calcular cantidad máxima producible usando los datos de la fórmula
    let maxProducible = Infinity;
    formula.forEach(item => {
      const currentStock = item.raw_material_current_stock || 0;
      if (item.quantity > 0) {
        const possibleBatches = Math.floor(currentStock / item.quantity);
        maxProducible = Math.min(maxProducible, possibleBatches);
      }
    });

    if (maxProducible === Infinity || formula.length === 0) {
      maxProducible = 0;
    }

    return {
      totalIngredients,
      totalQuantity,
      insufficientStock,
      maxProducible,
      canProduce: maxProducible > 0
    };
  }, [formula]);

  // Obtener materias primas disponibles para agregar (no ya en fórmula)
  const availableRawMaterials = useMemo(() => {
    const usedIds = formula.map(f => f.raw_material_id);
    return rawMaterials.filter(rm => !usedIds.includes(rm.id));
  }, [rawMaterials, formula]);

  // Manejar cierre del modal
  const handleClose = () => {
    if (!loading) {
      setShowAddForm(false);
      setEditingItem(null);
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content formula-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header del modal */}
        <div className="modal-header">
          <div className="header-info">
            <h2>Fórmula: {product.name}</h2>
            <div className="product-info">
              <span className="product-unit">
                Produce {product.base_quantity} {product.unit}
              </span>
              <span className={`production-status ${stats.canProduce ? 'can-produce' : 'low-stock'}`}>
                {stats.canProduce ? 
                  `✅ Stock para ${stats.maxProducible} lote${stats.maxProducible !== 1 ? 's' : ''}` :
                  '📊 Revisar stock para producción'
                }
              </span>
            </div>
          </div>
          <button 
            className="modal-close-btn"
            onClick={handleClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Estadísticas de la fórmula */}
        <div className="formula-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.totalIngredients}</span>
            <span className="stat-label">Ingredientes</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalQuantity.toFixed(2)}</span>
            <span className="stat-label">Total Cantidad</span>
          </div>
          <div className={`stat-card ${stats.insufficientStock > 0 ? 'info' : 'success'}`}>
            <span className="stat-number">{stats.insufficientStock}</span>
            <span className="stat-label">Stock Bajo</span>
          </div>
          <div className={`stat-card ${stats.canProduce ? 'success' : 'info'}`}>
            <span className="stat-number">{stats.maxProducible}</span>
            <span className="stat-label">Lotes Posibles</span>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="formula-content">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Cargando fórmula...</p>
            </div>
          ) : (
            <>
              {/* Formulario para agregar ingrediente - MOVIDO ARRIBA */}
              {showAddForm && (
                <div className="add-form-section">
                  <FormulaItemForm
                    availableRawMaterials={availableRawMaterials}
                    onSubmit={handleAddIngredient}
                    onCancel={() => setShowAddForm(false)}
                    title="Agregar Ingrediente"
                  />
                </div>
              )}

              {/* Formulario para editar ingrediente - MOVIDO ARRIBA */}
              {editingItem && (
                <div className="edit-form-section">
                  <FormulaItemForm
                    availableRawMaterials={rawMaterials} // Todas las materias primas para edición
                    initialData={{
                      raw_material_id: editingItem.raw_material_id,
                      quantity: editingItem.quantity
                    }}
                    onSubmit={handleEditIngredient}
                    onCancel={() => setEditingItem(null)}
                    title={`Editar: ${editingItem.raw_material_name}`}
                    isEditing={true}
                  />
                </div>
              )}

              {/* Lista de ingredientes */}
              <div className="ingredients-section">
                <div className="section-header">
                  <h3>Ingredientes de la Fórmula</h3>
                  {availableRawMaterials.length > 0 && !showAddForm && !editingItem && (
                    <button
                      className="btn btn-primary btn-add"
                      onClick={() => setShowAddForm(true)}
                    >
                      <span className="btn-icon">+</span>
                      Agregar Ingrediente
                    </button>
                  )}
                </div>

                {formula.length === 0 ? (
                  <div className="no-ingredients">
                    <div className="empty-state">
                      <span className="empty-icon">📝</span>
                      <h4>Fórmula vacía</h4>
                      <p>Este producto aún no tiene ingredientes definidos.</p>
                      {availableRawMaterials.length > 0 ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => setShowAddForm(true)}
                        >
                          Agregar Primer Ingrediente
                        </button>
                      ) : (
                        <p className="no-materials-warning">
                          No hay materias primas activas disponibles.
                          <br />
                          Primero debes crear materias primas en el inventario.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ingredients-list">
                    {formula.map((item) => {
                      // Usar los datos de stock que vienen directamente de la fórmula
                      const currentStock = item.raw_material_current_stock || 0;
                      const hasStock = currentStock >= item.quantity;
                      const stockPercentage = item.quantity > 0 ? 
                        Math.min(100, (currentStock / item.quantity) * 100) : 0;

                      return (
                        <div 
                          key={item.raw_material_id} 
                          className={`ingredient-card ${!hasStock ? 'low-stock' : ''}`}
                        >
                          <div className="ingredient-info">
                            <div className="ingredient-header">
                              <h4 className="ingredient-name">
                                {item.raw_material_name}
                              </h4>
                              <div className="ingredient-actions">
                                <button
                                  className="btn btn-icon btn-edit"
                                  onClick={() => setEditingItem(item)}
                                  disabled={showAddForm || !!editingItem}
                                  title="Editar cantidad"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn btn-icon btn-delete"
                                  onClick={() => handleDeleteIngredient(item.raw_material_id)}
                                  disabled={showAddForm || !!editingItem}
                                  title="Eliminar ingrediente"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            <div className="ingredient-details">
                              <div className="quantity-info">
                                <span className="quantity">
                                  {item.quantity} {item.raw_material_unit || 'unidad'}
                                </span>
                                <span className="quantity-label">Requerido</span>
                              </div>

                              <div className="stock-info">
                                <span className={`stock ${hasStock ? 'sufficient' : 'insufficient'}`}>
                                  {currentStock} {item.raw_material_unit || 'unidad'}
                                </span>
                                <span className="stock-label">Disponible</span>
                              </div>

                              <div className="status-info">
                                <span className={`status ${hasStock ? 'ok' : 'info'}`}>
                                  {hasStock ? '✅ Stock OK' : '📊 Stock bajo'}
                                </span>
                              </div>
                            </div>

                            {/* Barra de progreso de stock */}
                            <div className="stock-progress">
                              <div 
                                className={`progress-bar ${hasStock ? 'sufficient' : 'low'}`}
                                style={{ width: `${Math.min(100, stockPercentage)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


            </>
          )}
        </div>

        {/* Footer con información adicional */}
        {!loading && formula.length > 0 && (
          <div className="formula-footer">
            <div className="footer-info">
              <p>
                <strong>Producción:</strong> Esta fórmula produce {product.base_quantity} {product.unit} 
                {stats.canProduce && ` (máximo ${stats.maxProducible} lotes con stock actual)`}
              </p>
              {stats.insufficientStock > 0 && (
                <p className="info-text">
                  📊 {stats.insufficientStock} ingrediente{stats.insufficientStock !== 1 ? 's' : ''} 
                  {stats.insufficientStock === 1 ? ' tiene' : ' tienen'} stock bajo para producción
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductFormula;