import React, { useState, useEffect, useMemo } from 'react';
import { RawMaterial, InventoryEntry } from '../types';
import { rawMaterialsService } from '../services/rawMaterialsService';
import { FaRegEdit, FaRegTrashAlt, FaPowerOff, FaPlus, FaEye } from 'react-icons/fa';
import './RawMaterialsList.css';

interface RawMaterialsListProps {
  onEdit: (material: RawMaterial) => void;
  onViewEntries: (material: RawMaterial) => void;
  onCreateEntry: (material: RawMaterial) => void;
}

const RawMaterialsList: React.FC<RawMaterialsListProps> = ({
  onEdit,
  onViewEntries,
  onCreateEntry
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [calculatedStocks, setCalculatedStocks] = useState<{[key: string]: number}>({});
  const [stocksCalculated, setStocksCalculated] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, [showInactive]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setStocksCalculated(false);
      const data = await rawMaterialsService.getAll(showInactive);
      setMaterials(data);

      // Calcular stocks para todos los materiales
      if (data.length > 0) {
        await calculateStocksForMaterials(data);
        setStocksCalculated(true);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
      alert('Error al cargar las materias primas');
    } finally {
      setLoading(false);
    }
  };

  const calculateStocksForMaterials = async (materials: RawMaterial[]) => {
    console.log('🔍 Calculando stocks para', materials.length, 'materiales...');

    const newCalculatedStocks: {[key: string]: number} = {};

    try {
      // Calcular stock para cada material (en paralelo)
      const stockPromises = materials.map(async (material) => {
        try {
          console.log('📊 Cargando entradas para:', material.code);
          const entries = await rawMaterialsService.getEntries(material.id);

          // Calcular stock basado en entradas
          let calculatedStock = 0;
          entries.forEach((entry: InventoryEntry) => {
            if (entry.entry_type === 'in') {
              calculatedStock += entry.quantity;
            } else {
              calculatedStock -= entry.quantity;
            }
          });

          return { materialId: material.id, stock: Math.max(0, calculatedStock), entryCount: entries.length };
        } catch (error) {
          console.error(`❌ Error calculando stock para ${material.code}:`, error);
          return { materialId: material.id, stock: material.current_stock, entryCount: 0 };
        }
      });

      const results = await Promise.all(stockPromises);

      results.forEach(result => {
        newCalculatedStocks[result.materialId] = result.stock;
        console.log(`✅ ${result.materialId}: ${result.stock} unidades (${result.entryCount} entradas)`);
      });

      setCalculatedStocks(newCalculatedStocks);
      console.log('🎯 Stocks calculados completados:', newCalculatedStocks);

    } catch (error) {
      console.error('❌ Error general calculando stocks:', error);
    }
  };

  const getCurrentStock = useMemo(() => {
    return (material: RawMaterial) => {
      // Si ya calculamos los stocks, usar el calculado, sino usar el de la BD
      if (stocksCalculated && calculatedStocks[material.id] !== undefined) {
        return calculatedStocks[material.id];
      }
      return material.current_stock;
    };
  }, [calculatedStocks, stocksCalculated]);

  const handleDisable = async (material: RawMaterial) => {
    if (window.confirm(
      `¿${material.is_active ? 'Deshabilitar' : 'Habilitar'} ${material.name}?`
    )) {
      try {
        await rawMaterialsService.disable(material.id, !material.is_active);
        await loadMaterials();
      } catch (error) {
        console.error('Error changing material status:', error);
        alert('Error al cambiar el estado de la materia prima');
      }
    }
  };

  const handleDelete = async (material: RawMaterial) => {
    if (window.confirm(`¿Eliminar permanentemente ${material.name}?`)) {
      try {
        await rawMaterialsService.delete(material.id);
        await loadMaterials();
      } catch (error) {
        console.error('Error deleting material:', error);
        alert('Error al eliminar la materia prima');
      }
    }
  };




  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = useMemo(() => {
    return (material: RawMaterial) => {
      const currentStock = getCurrentStock(material);

      if (currentStock <= 0) {
        return { class: 'out-of-stock', text: 'Agotado' };
      }
      if (currentStock <= material.min_stock) {
        return { class: 'low-stock', text: 'Stock Bajo' };
      }
      if (material.max_stock && currentStock >= material.max_stock) {
        return { class: 'high-stock', text: 'Sobrestock' };
      }
      return { class: 'normal-stock', text: 'Normal' };
    };
  }, [getCurrentStock]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="raw-materials-list">
      <div className="header">
        <h1>Materias Primas</h1>
        <div className="controls">
          <input
            type="text"
            placeholder="Buscar..."
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
            Mostrar inactivas
          </label>
        </div>
      </div>

      <div className="materials-grid">
        {filteredMaterials.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron materias primas</p>
          </div>
        ) : (
          filteredMaterials.map(material => {
            const stockStatus = getStockStatus(material);
            return (
              <div key={material.id} className={`material-card ${!material.is_active ? 'inactive' : ''}`}>
                <div className="card-header">
                  <h3>{material.name}</h3>
                  <div className="status-indicator">
                    <span className={`badge ${stockStatus.class}`}>
                      {stockStatus.text}
                    </span>
                    {!material.is_active && (
                      <span className="badge inactive">Inactiva</span>
                    )}
                  </div>
                </div>

                <div className="card-content">
                  <div className="info-row">
                    <span className="label">Código:</span>
                    <span className="value">{material.code}</span>
                  </div>

                  <div className="info-row">
                    <span className="label">Stock actual:</span>
                    <span className="value stock-value">
                      {stocksCalculated ? getCurrentStock(material) : '...'} {material.unit}
                      <span className="stock-calculated-badge">
                        {stocksCalculated ? '(calculado)' : '(calculando...)'}
                      </span>
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="label">Stock mínimo:</span>
                    <span className="value">{material.min_stock} {material.unit}</span>
                  </div>

                  {material.max_stock && (
                    <div className="info-row">
                      <span className="label">Stock máximo:</span>
                      <span className="value">{material.max_stock} {material.unit}</span>
                    </div>
                  )}

                  {material.location && (
                    <div className="info-row">
                      <span className="label">Ubicación:</span>
                      <span className="value">{material.location}</span>
                    </div>
                  )}

                  {material.supplier && (
                    <div className="info-row">
                      <span className="label">Proveedor:</span>
                      <span className="value">{material.supplier}</span>
                    </div>
                  )}

                  {material.description && (
                    <div className="description">
                      <span className="value">{material.description}</span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    onClick={() => onViewEntries(material)}
                    aria-label="Ver entradas"
                    title="Ver entradas de inventario"
                  >
                    <FaEye />
                  </button>

                  <button
                    onClick={() => onCreateEntry(material)}
                    aria-label="Nueva entrada"
                    title="Crear nueva entrada"
                  >
                    <FaPlus />
                  </button>

                  <button
                    onClick={() => onEdit(material)}
                    aria-label="Editar"
                    title="Editar materia prima"
                  >
                    <FaRegEdit />
                  </button>

                  <button
                    onClick={() => handleDisable(material)}
                    aria-label={material.is_active ? 'Deshabilitar' : 'Habilitar'}
                    title={material.is_active ? 'Deshabilitar' : 'Habilitar'}
                    className={material.is_active ? 'warning' : 'success'}
                  >
                    <FaPowerOff />
                  </button>

                  {showInactive && (
                    <button
                      onClick={() => handleDelete(material)}
                      aria-label="Eliminar"
                      title="Eliminar permanentemente"
                      className="danger"
                    >
                      <FaRegTrashAlt />
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

export default RawMaterialsList;