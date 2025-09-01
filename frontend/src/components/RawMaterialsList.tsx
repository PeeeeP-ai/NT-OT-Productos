import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { RawMaterial, InventoryEntry } from '../types';
import { rawMaterialsService } from '../services/rawMaterialsService';
import { useDebounce } from '../hooks/useDebounce';
import { FaRegEdit, FaRegTrashAlt, FaPowerOff, FaPlus, FaEye } from 'react-icons/fa';
import './RawMaterialsList.css';

// Cache global para stocks calculados
const stocksCache = new Map<string, { stock: number; timestamp: number }>();
const STOCKS_CACHE_DURATION = 60000; // 1 minuto

const getCachedStock = (materialId: string) => {
  const cached = stocksCache.get(materialId);
  if (cached && Date.now() - cached.timestamp < STOCKS_CACHE_DURATION) {
    return cached.stock;
  }
  return null;
};

const setCachedStock = (materialId: string, stock: number) => {
  stocksCache.set(materialId, { stock, timestamp: Date.now() });
};

const clearStocksCache = (materialId?: string) => {
  if (materialId) {
    stocksCache.delete(materialId);
  } else {
    stocksCache.clear();
  }
};

interface RawMaterialsListProps {
  onEdit: (material: RawMaterial) => void;
  onViewEntries: (material: RawMaterial) => void;
  onCreateEntry: (material: RawMaterial) => void;
  forceRefresh?: number;
}

const RawMaterialsList: React.FC<RawMaterialsListProps> = memo(({
  onEdit,
  onViewEntries,
  onCreateEntry,
  forceRefresh
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [calculatedStocks, setCalculatedStocks] = useState<{[key: string]: number}>({});
  const [stocksCalculated, setStocksCalculated] = useState(false);
  
  // Usar useRef para evitar recreaciones de callbacks
  const isCalculatingRef = useRef(false);
  
  // Debounce search term para evitar filtrado excesivo
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Declarar calculateStocksForMaterials primero
  const calculateStocksForMaterials = useCallback(async (materials: RawMaterial[]) => {
    if (isCalculatingRef.current) {
      console.log('⏸️ Ya hay un cálculo en progreso, saltando...');
      return;
    }

    isCalculatingRef.current = true;
    console.log('🔍 Calculando stocks para', materials.length, 'materiales...');

    const newCalculatedStocks: {[key: string]: number} = {};
    const materialsToCalculate: RawMaterial[] = [];

    // Primero verificar cache
    materials.forEach(material => {
      const cachedStock = getCachedStock(material.id);
      if (cachedStock !== null) {
        newCalculatedStocks[material.id] = cachedStock;
        console.log(`📋 Stock en cache para ${material.code}: ${cachedStock}`);
      } else {
        materialsToCalculate.push(material);
      }
    });

    if (materialsToCalculate.length === 0) {
      console.log('🎯 Todos los stocks están en cache');
      setCalculatedStocks(newCalculatedStocks);
      isCalculatingRef.current = false;
      return;
    }

    console.log(`🔄 Calculando stocks para ${materialsToCalculate.length} materiales (${materials.length - materialsToCalculate.length} en cache)`);

    try {
      // Procesar en lotes de 3 para evitar sobrecarga del servidor
      const batchSize = 3;
      for (let i = 0; i < materialsToCalculate.length; i += batchSize) {
        const batch = materialsToCalculate.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (material) => {
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

            const finalStock = Math.max(0, calculatedStock);
            setCachedStock(material.id, finalStock);

            return { materialId: material.id, stock: finalStock, entryCount: entries.length };
          } catch (error) {
            console.error(`❌ Error calculando stock para ${material.code}:`, error);
            return { materialId: material.id, stock: material.current_stock, entryCount: 0 };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          newCalculatedStocks[result.materialId] = result.stock;
          console.log(`✅ ${result.materialId}: ${result.stock} unidades (${result.entryCount} entradas)`);
        });

        // Pequeña pausa entre lotes para no sobrecargar
        if (i + batchSize < materialsToCalculate.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setCalculatedStocks(newCalculatedStocks);
      console.log('🎯 Stocks calculados completados:', newCalculatedStocks);

    } catch (error) {
      console.error('❌ Error general calculando stocks:', error);
    } finally {
      isCalculatingRef.current = false;
    }
  }, []); // Removemos isCalculating de las dependencias para evitar recreaciones

  const loadMaterials = useCallback(async () => {
    console.log('🔄 loadMaterials ejecutado - showInactive:', showInactive);
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
  }, [showInactive, calculateStocksForMaterials]);

  useEffect(() => {
    console.log('🔄 useEffect[showInactive] ejecutado');
    loadMaterials();
  }, [loadMaterials]);

  // Efecto separado para forceRefresh para evitar re-mount completo
  useEffect(() => {
    if (forceRefresh && forceRefresh > 0) {
      console.log('🔄 useEffect[forceRefresh] ejecutado - forceRefresh:', forceRefresh);
      loadMaterials();
    }
  }, [forceRefresh, loadMaterials]);

  // Listener para cambios de stocks
  useEffect(() => {
    const handleStocksChanged = (event: CustomEvent) => {
      const { materialId } = event.detail;
      if (materialId) {
        clearStocksCache(materialId);
        // Recalcular solo este material si está en la lista actual
        const material = materials.find(m => m.id === materialId);
        if (material) {
          calculateStocksForMaterials([material]);
        }
      }
    };

    window.addEventListener('stocksChanged', handleStocksChanged as EventListener);
    return () => {
      window.removeEventListener('stocksChanged', handleStocksChanged as EventListener);
    };
  }, [materials, calculateStocksForMaterials]);

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




  const filteredMaterials = useMemo(() => 
    materials.filter(material =>
      material.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      material.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    ), [materials, debouncedSearchTerm]
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
});

RawMaterialsList.displayName = 'RawMaterialsList';

export default RawMaterialsList;