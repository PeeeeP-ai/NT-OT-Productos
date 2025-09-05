import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/supabase';
import { getAllAnalyses, deleteAnalysis, formatAnalysisNumber, getAnalysisTypeLabel, getAnalysisTypeColor, formatAnalysisDate } from '../services/analysesService';
import { ProductAnalysis } from '../types';
import './AnalysesList.css';

type ViewMode = 'cards' | 'grid';

interface AnalysesListProps {
  forceRefresh?: number;
}

console.log('📦 AnalysesList - Component initialized');

const AnalysesList: React.FC<AnalysesListProps> = ({ forceRefresh = 0 }) => {
  console.log('🎨 AnalysesList - Component render with forceRefresh:', forceRefresh);

  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');

  // Cargar todos los análisis
  const loadAnalyses = useCallback(async () => {
    try {
      console.log('🎯 AnalysesList - Iniciando carga de análisis...');
      setLoading(true);
      setError(null);

      console.log('🎯 AnalysesList - Llamando getAllAnalyses...');
      const result = await getAllAnalyses();

      console.log('🎯 AnalysesList - Resultado getAllAnalyses:', result);

      if (result.success && result.data) {
        console.log('🎯 AnalysesList - Success! Análisis encontrados:', result.data.length);
        console.log('🎯 AnalysesList - Primer análisis:', result.data[0]);
        setAnalyses(result.data);
      } else {
        console.error('⚠️ AnalysesList - Error en resultado:', result.message);
        console.error('⚠️ AnalysesList - Errores:', result.errors);
        setError(result.message || 'Error al cargar análisis');
        setAnalyses([]);
      }
    } catch (err: any) {
      console.error('❌ AnalysesList - Exception cargando análisis:', err);
      console.error('❌ AnalysesList - Exception message:', err.message);
      console.error('❌ AnalysesList - Exception stack:', err.stack);
      setError('Error interno del servidor');
      setAnalyses([]);
    } finally {
      setLoading(false);
      console.log('🎯 AnalysesList - Finalizado loading, state updated');
    }
  }, []);

  useEffect(() => {
    console.log('🔄 AnalysesList - useEffect triggered');
    console.log('🔄 AnalysesList - forceRefresh:', forceRefresh);
    loadAnalyses();
  }, [loadAnalyses, forceRefresh]);

  // Filtrar análisis basados en la búsqueda
  const filteredAnalyses = analyses.filter(analysis =>
    analysis.analysis_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    analysis.work_order?.order_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteAnalysis = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este análisis?')) {
      return;
    }

    try {
      const result = await deleteAnalysis(id);
      if (result.success) {
        // Actualizar la lista después de eliminar
        setAnalyses(prev => prev.filter(a => a.id !== id));
        alert('Análisis eliminado exitosamente');
      } else {
        alert(`Error al eliminar análisis: ${result.message}`);
      }
    } catch (error) {
      console.error('Error eliminando análisis:', error);
      alert('Error interno del servidor al eliminar análisis');
    }
  };

  const handleRetry = () => {
    loadAnalyses();
  };

  return (
    <div className="analyses-list">
      <div className="list-header">
        <h2>📊 Análisis de Productos Terminados ({filteredAnalyses.length})</h2>
        <div className="header-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="Buscar por número de análisis o nombre de OT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
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
        </div>
      </div>
      <div className="analyses-description">
        <p>Gestión completa de análisis de productos de órdenes de trabajo</p>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando análisis...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={handleRetry} className="retry-button">
            Reintentar
          </button>
        </div>
      )}

      {/* Mostrar análisis */}
      {!loading && !error && (
        filteredAnalyses.length === 0 ? (
          <div className="empty-state">
            <p>📭 No hay análisis disponibles</p>
            <p>Crea el primer análisis para comenzar</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="analyses-grid">
            {filteredAnalyses.map((analysis) => (
              <div key={analysis.id} className="analysis-card">
                <div className="analysis-header">
                  <div className="analysis-number">
                    <span className="number">{formatAnalysisNumber(analysis.analysis_number)}</span>
                  </div>
                  <div className="analysis-type">
                    <span
                      className="type-badge"
                      style={{ backgroundColor: getAnalysisTypeColor(analysis.analysis_type) }}
                    >
                      {getAnalysisTypeLabel(analysis.analysis_type)}
                    </span>
                  </div>
                </div>

                <div className="analysis-body">
                  <div className="analysis-info">
                    <div className="info-item">
                      <span className="label">Fecha:</span>
                      <span className="value">
                        {formatAnalysisDate(analysis.analysis_date)}
                      </span>
                    </div>
                    {analysis.description && (
                      <div className="info-item">
                        <span className="label">Descripción:</span>
                        <span className="value">{analysis.description}</span>
                      </div>
                    )}
                    {analysis.file_name && (
                      <div className="info-item">
                        <span className="label">Archivo:</span>
                        <span className="value file-name">
                          {analysis.file_path ? (
                            <a
                              href={`${API_BASE_URL}${analysis.file_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="file-download-link"
                            >
                              📎 {analysis.file_name}
                            </a>
                          ) : (
                            analysis.file_name
                          )}
                        </span>
                      </div>
                    )}
                    {analysis.notes && (
                      <div className="info-item notes">
                        <span className="label">Notas:</span>
                        <span className="value">{analysis.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="analysis-footer">
                  <div className="analysis-date">
                    <small>
                      Creado: {formatAnalysisDate(analysis.created_at)}
                    </small>
                  </div>
                  <div className="analysis-actions">
                    <button
                      onClick={() => handleDeleteAnalysis(analysis.id)}
                      className="delete-btn"
                      title="Eliminar análisis"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="analyses-table-container">
            <div className="analyses-table-wrapper">
              <table className="analyses-table">
                <thead>
                  <tr>
                    <th>N° Análisis</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Archivo</th>
                    <th>Notas</th>
                    <th>Creado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyses.map((analysis) => (
                    <tr key={analysis.id}>
                      <td className="analysis-number">{formatAnalysisNumber(analysis.analysis_number)}</td>
                      <td>
                        <span
                          className="type-badge"
                          style={{ backgroundColor: getAnalysisTypeColor(analysis.analysis_type) }}
                        >
                          {getAnalysisTypeLabel(analysis.analysis_type)}
                        </span>
                      </td>
                      <td>{formatAnalysisDate(analysis.analysis_date)}</td>
                      <td className="description-cell">
                        {analysis.description || '-'}
                      </td>
                      <td className="file-cell">
                        {analysis.file_name ? (
                          analysis.file_path ? (
                            <a
                              href={`${API_BASE_URL}${analysis.file_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="file-download-link"
                            >
                              📎 {analysis.file_name}
                            </a>
                          ) : (
                            <span className="file-name">{analysis.file_name}</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="notes-cell">
                        {analysis.notes || '-'}
                      </td>
                      <td>{formatAnalysisDate(analysis.created_at)}</td>
                      <td className="actions-cell">
                        <button
                          onClick={() => handleDeleteAnalysis(analysis.id)}
                          className="action-button delete-button table-action"
                          title="Eliminar análisis"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

    </div>
  );
};

export default AnalysesList;
