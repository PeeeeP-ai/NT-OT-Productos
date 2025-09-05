import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../types';
import { API_BASE_URL } from '../lib/supabase';
import {
  getWorkOrderAnalyses,
  createAnalysis,
  deleteAnalysis,
  getAnalysisTypeColor,
  getAnalysisTypeLabel,
  formatAnalysisNumber,
  formatAnalysisDate,
  getAnalysisTypeOptions
} from '../services/analysesService';
import './WorkOrderAnalyses.css';

interface WorkOrderAnalysesProps {
  workOrder: WorkOrder;
  isOpen: boolean;
  onClose: () => void;
}

const WorkOrderAnalyses: React.FC<WorkOrderAnalysesProps> = ({
  workOrder,
  isOpen,
  onClose
}) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Estado del formulario
  const [formData, setFormData] = useState({
    analysis_type: 'general' as const,
    analysis_date: new Date().toISOString().split('T')[0],
    notes: '',
    description: '',
    file: undefined as File | undefined
  });

  useEffect(() => {
    if (isOpen && workOrder) {
      loadAnalyses();
    }
  }, [isOpen, workOrder]);

  const loadAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getWorkOrderAnalyses(workOrder.id);

      if (result.success && result.data) {
        setAnalyses(result.data);
      } else {
        setError(result.message || 'Error al cargar análisis');
      }
    } catch (err) {
      setError('Error interno del servidor');
      console.error('Error loading analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setCreating(true);
      setError(null);

      const result = await createAnalysis(workOrder.id, formData);

      if (result.success) {
        // Mostrar mensaje de éxito con el número generado
        const analysisNumber = (result as any).analysis_number || 'N/A';
        alert(`Análisis creado exitosamente. Número: ${analysisNumber}`);

        // Limpiar formulario
        setFormData({
          analysis_type: 'general',
          analysis_date: new Date().toISOString().split('T')[0],
          notes: '',
          description: '',
          file: undefined
        });

        // Cerrar formulario
        setShowCreateForm(false);

        // Recargar lista
        await loadAnalyses();
      } else {
        setError(result.message || 'Error al crear análisis');
        if (result.errors && result.errors.length > 0) {
          console.error('Errores de creación:', result.errors);
        }
      }
    } catch (err) {
      setError('Error al crear análisis');
      console.error('Error creating analysis:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este análisis?')) {
      return;
    }

    try {
      const result = await deleteAnalysis(analysisId);

      if (result.success) {
        // Recargar lista
        await loadAnalyses();
      } else {
        alert(`Error al eliminar análisis: ${result.message}`);
      }
    } catch (err) {
      console.error('Error deleting analysis:', err);
      alert('Error al eliminar análisis');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || undefined;
    setFormData(prev => ({ ...prev, file }));
  };


  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="work-order-analyses-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>📊 Análisis de Productos</h2>
            <div className="header-actions">
              <button
                onClick={() => setShowCreateForm(true)}
                className="create-button"
                disabled={workOrder.status !== 'completed'}
              >
                ➕ Nuevo Análisis
              </button>
              <button onClick={onClose} className="close-button">×</button>
            </div>
          </div>

          <div className="modal-body">
            {/* Información de la OT */}
            <div className="work-order-info">
              <h3>Orden de Trabajo: {workOrder.order_number}</h3>
              <p>Estado: <span className={`status-${workOrder.status}`}>{workOrder.status}</span></p>
              {workOrder.status !== 'completed' && (
                <p className="warning-message">
                  ⚠️ Solo se pueden crear análisis para órdenes de trabajo completadas
                </p>
              )}
            </div>

            {loading ? (
              <div className="loading">Cargando análisis...</div>
            ) : error ? (
              <div className="error">
                <p>{error}</p>
                <button onClick={loadAnalyses} className="retry-button">
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {/* Lista de análisis */}
                <div className="analyses-list">
                  <h3>Análisis Realizados ({analyses.length})</h3>

                  {analyses.length === 0 ? (
                    <div className="empty-state">
                      <p>No hay análisis registrados para esta orden de trabajo</p>
                    </div>
                  ) : (
                    <div className="analyses-grid">
                      {analyses.map((analysis) => (
                        <div key={analysis.analysis_id} className="analysis-card">
                          <div className="analysis-header">
                            <div className="analysis-number">
                              #{formatAnalysisNumber(analysis.analysis_number)}
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

                          <div className="analysis-details">
                            <div className="detail-row">
                              <span className="label">Fecha:</span>
                              <span className="value">{formatAnalysisDate(analysis.analysis_date)}</span>
                            </div>
                            {analysis.description && (
                              <div className="detail-row">
                                <span className="label">Descripción:</span>
                                <span className="value">{analysis.description}</span>
                              </div>
                            )}
                            {analysis.file_name && (
                              <div className="detail-row">
                                <span className="label">Archivo:</span>
                                <span className="value file-link">
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
                              <div className="detail-row">
                                <span className="label">Notas:</span>
                                <span className="value">{analysis.notes}</span>
                              </div>
                            )}
                          </div>

                          <div className="analysis-actions">
                            <button
                              onClick={() => handleDeleteAnalysis(analysis.analysis_id)}
                              className="delete-button"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Formulario de creación */}
                {showCreateForm && (
                  <div className="create-analysis-form">
                    <h3>Crear Nuevo Análisis</h3>
                    <p className="form-description">
                      Este análisis será de la formulación completa de la orden de trabajo
                    </p>
                    <form onSubmit={handleCreateAnalysis}>
                      <div className="form-group">
                        <label htmlFor="analysis_type">Tipo de Análisis:</label>
                        <select
                          id="analysis_type"
                          value={formData.analysis_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, analysis_type: e.target.value as any }))}
                          required
                        >
                          {getAnalysisTypeOptions().map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="analysis_date">Fecha de Análisis:</label>
                        <input
                          type="date"
                          id="analysis_date"
                          value={formData.analysis_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, analysis_date: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="description">Descripción:</label>
                        <input
                          type="text"
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descripción del análisis..."
                          maxLength={255}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="file">Archivo de Análisis:</label>
                        <input
                          type="file"
                          id="file"
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        />
                        {formData.file && (
                          <small className="file-info">
                            Archivo seleccionado: {formData.file.name}
                          </small>
                        )}
                      </div>

                      <div className="form-group">
                        <label htmlFor="notes">Notas:</label>
                        <textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                          placeholder="Observaciones adicionales..."
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(false)}
                          className="cancel-button"
                          disabled={creating}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={creating}
                        >
                          {creating ? 'Creando...' : '✅ Crear Análisis'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderAnalyses;
