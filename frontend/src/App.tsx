import { useState } from 'react';
import RawMaterialsList from './components/RawMaterialsList';
import RawMaterialForm from './components/RawMaterialForm';
import InventoryEntries from './components/InventoryEntries';
import ProductsList from './components/ProductsList';
import ProductForm from './components/ProductForm';
import ProductDetails from './components/ProductDetails';
import WorkOrdersList from './components/WorkOrdersList';
import WorkOrderForm from './components/WorkOrderForm';
import WorkOrderDetails from './components/WorkOrderDetails';
import WorkOrderAnalyses from './components/WorkOrderAnalyses';
import AnalysesList from './components/AnalysesList';
import { Product, WorkOrder } from './types';
import { deleteWorkOrder } from './services/workOrdersService';
import './App.css';

type AppSection = 'materials' | 'products' | 'workorders' | 'analyses';

function App() {
  // Estado de navegación
  const [currentSection, setCurrentSection] = useState<AppSection>('materials');
  
  // Estados para materias primas
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [inventoryEntriesMaterial, setInventoryEntriesMaterial] = useState<any | null>(null);
  const [isInventoryEntriesOpen, setIsInventoryEntriesOpen] = useState(false);
  const [initialShowForm, setInitialShowForm] = useState(false);
  const [forceRefreshMaterials, setForceRefreshMaterials] = useState(0);
  
  // Estados para productos
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [forceRefreshProducts, setForceRefreshProducts] = useState(0);

  // Estados para órdenes de trabajo
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [viewingWorkOrder, setViewingWorkOrder] = useState<WorkOrder | null>(null);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [showWorkOrderAnalyses, setShowWorkOrderAnalyses] = useState(false);
  const [analysingWorkOrder, setAnalysingWorkOrder] = useState<WorkOrder | null>(null);
  const [forceRefreshWorkOrders, setForceRefreshWorkOrders] = useState(0);

  // Estados para análisis
  const [forceRefreshAnalyses] = useState(0);

  // =========================================
  // HANDLERS PARA MATERIAS PRIMAS
  // =========================================
  
  const handleCreateMaterial = () => {
    setEditingMaterial(null);
    setShowMaterialForm(true);
  };

  const handleEditMaterial = (material: any) => {
    setEditingMaterial(material);
    setShowMaterialForm(true);
  };

  const handleMaterialFormSubmit = () => {
    // Refrescar la lista después de crear/editar material
    refreshMaterialsList();
    console.log('Material actualizado/creado');
  };

  const handleCloseMaterialForm = () => {
    setShowMaterialForm(false);
    setEditingMaterial(null);
  };

  const handleViewEntries = (material: any) => {
    setInventoryEntriesMaterial(material);
    setInitialShowForm(false);
    setIsInventoryEntriesOpen(true);
  };

  const handleCreateEntry = (material: any) => {
    setInventoryEntriesMaterial(material);
    setInitialShowForm(true);
    setIsInventoryEntriesOpen(true);
  };

  const handleCloseInventoryEntries = () => {
    setIsInventoryEntriesOpen(false);
    setInventoryEntriesMaterial(null);
    setInitialShowForm(false);
    // Refrescar la lista al cerrar el modal de entradas
    refreshMaterialsList();
  };

  // Función para refrescar la lista de materiales (llamada después de operaciones)
  const refreshMaterialsList = () => {
    console.log('Refrescando lista de materiales...');
    setForceRefreshMaterials(prev => prev + 1); // Fuerzar refresco del componente RawMaterialsList
  };

  // =========================================
  // HANDLERS PARA PRODUCTOS
  // =========================================
  
  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowProductForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleViewProductDetails = (product: Product) => {
    setViewingProduct(product);
    setShowProductDetails(true);
  };

  const handleProductFormSubmit = () => {
    // Refrescar la lista después de crear/editar producto
    refreshProductsList();
    console.log('Producto actualizado/creado');
  };

  const handleCloseProductForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleCloseProductDetails = () => {
    setShowProductDetails(false);
    setViewingProduct(null);
  };

  const handleProductDetailsUpdate = () => {
    // Refrescar la lista cuando se actualiza desde detalles
    refreshProductsList();
  };

  // Función para refrescar la lista de productos (llamada después de operaciones)
  const refreshProductsList = () => {
    console.log('Refrescando lista de productos...');
    setForceRefreshProducts(prev => prev + 1); // Fuerzar refresco del componente ProductsList
  };

  // =========================================
  // HANDLERS PARA ÓRDENES DE TRABAJO
  // =========================================

  const handleCreateWorkOrder = () => {
    setShowWorkOrderForm(true);
  };

  const handleViewWorkOrderDetails = (workOrder: WorkOrder) => {
    setViewingWorkOrder(workOrder);
    // TODO: Implementar vista de detalles cuando esté lista
  };

  const handleViewWorkOrderAnalyses = (workOrder: WorkOrder) => {
    setAnalysingWorkOrder(workOrder);
    setShowWorkOrderAnalyses(true);
  };

  const handleCloseWorkOrderAnalyses = () => {
    setShowWorkOrderAnalyses(false);
    setAnalysingWorkOrder(null);
  };

  const handleEditWorkOrder = (workOrder: WorkOrder) => {
    setEditingWorkOrder(workOrder);
    setShowWorkOrderForm(true);
  };

  const handleWorkOrderFormSubmit = () => {
    // Refrescar la lista después de crear/editar OT
    refreshWorkOrdersList();
    console.log('Orden de trabajo actualizada/creada');
  };

  const handleCloseWorkOrderForm = () => {
    setShowWorkOrderForm(false);
    setEditingWorkOrder(null);
  };

  const handleDeleteWorkOrder = async (workOrder: WorkOrder) => {
    try {
      const result = await deleteWorkOrder(workOrder.id);
      if (result.success) {
        // Refrescar la lista después de eliminar
        refreshWorkOrdersList();
        console.log('Orden de trabajo eliminada exitosamente');
      } else {
        alert(`Error al eliminar la orden de trabajo: ${result.message}`);
      }
    } catch (error) {
      console.error('Error eliminando orden de trabajo:', error);
      alert('Error interno del servidor al eliminar la orden de trabajo');
    }
  };

  // Función para refrescar la lista de órdenes de trabajo
  const refreshWorkOrdersList = () => {
    console.log('Refrescando lista de órdenes de trabajo...');
    setForceRefreshWorkOrders(prev => prev + 1);
  };


  return (
    <div className="App">
      {/* Header con navegación */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            {/* Logo */}
            <div className="app-logo">
              <img src="/img/logont.png" alt="Logo Empresa" className="logo-image" />
            </div>
            <div className="header-title-nav">
              <h1>Sistema de Gestión</h1>
              <nav className="main-navigation">
                <button
                  className={`nav-button ${currentSection === 'materials' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('materials')}
                >
                  📦 Materias Primas
                </button>
                <button
                  className={`nav-button ${currentSection === 'products' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('products')}
                >
                  🧪 Fórmulas
                </button>
                <button
                  className={`nav-button ${currentSection === 'workorders' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('workorders')}
                >
                  📋 Órdenes de Trabajo
                </button>
                <button
                  className={`nav-button ${currentSection === 'analyses' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('analyses')}
                >
                  🔬 Análisis
                </button>
              </nav>
            </div>
          </div>
          <div className="header-right">
            {currentSection === 'materials' && (
              <button onClick={handleCreateMaterial} className="create-button">
                ➕ Nueva Materia Prima
              </button>
            )}
            {currentSection === 'products' && (
              <button onClick={handleCreateProduct} className="create-button">
                ➕ Nueva Fórmula
              </button>
            )}
            {currentSection === 'workorders' && (
              <button onClick={handleCreateWorkOrder} className="create-button">
                ➕ Nueva Orden de Trabajo
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="main-content">
        {currentSection === 'materials' && (
          <RawMaterialsList
            onEdit={handleEditMaterial}
            onViewEntries={handleViewEntries}
            onCreateEntry={handleCreateEntry}
            forceRefresh={forceRefreshMaterials}
          />
        )}
        
        {currentSection === 'products' && (
          <ProductsList
            onEdit={handleEditProduct}
            onViewDetails={handleViewProductDetails}
            onCreate={handleCreateProduct}
            forceRefresh={forceRefreshProducts}
          />
        )}

        {currentSection === 'workorders' && (
          <WorkOrdersList
            onCreate={handleCreateWorkOrder}
            onViewDetails={handleViewWorkOrderDetails}
            onEdit={handleEditWorkOrder}
            onDelete={handleDeleteWorkOrder}
            forceRefresh={forceRefreshWorkOrders}
          />
        )}

        {currentSection === 'analyses' && (
          <AnalysesList
            forceRefresh={forceRefreshAnalyses}
          />
        )}
      </main>

      {/* Modales para Materias Primas */}
      {showMaterialForm && (
        <RawMaterialForm
          material={editingMaterial}
          isOpen={showMaterialForm}
          onClose={handleCloseMaterialForm}
          onSubmit={handleMaterialFormSubmit}
        />
      )}

      {isInventoryEntriesOpen && inventoryEntriesMaterial && (
        <InventoryEntries
          material={inventoryEntriesMaterial}
          isOpen={isInventoryEntriesOpen}
          onClose={handleCloseInventoryEntries}
          initialShowForm={initialShowForm}
          onEntryCreated={refreshMaterialsList}
        />
      )}

      {/* Modales para Productos */}
      {showProductForm && (
        <ProductForm
          product={editingProduct}
          isOpen={showProductForm}
          onClose={handleCloseProductForm}
          onSubmit={handleProductFormSubmit}
        />
      )}

      {showProductDetails && viewingProduct && (
        <ProductDetails
          product={viewingProduct}
          isOpen={showProductDetails}
          onClose={handleCloseProductDetails}
          onUpdate={handleProductDetailsUpdate}
        />
      )}

      {/* Modal para Órdenes de Trabajo */}
      <WorkOrderForm
        isOpen={showWorkOrderForm}
        onClose={handleCloseWorkOrderForm}
        onSubmit={handleWorkOrderFormSubmit}
        workOrder={editingWorkOrder}
      />

      {/* Modal de Detalles de Orden de Trabajo */}
      {viewingWorkOrder && (
        <WorkOrderDetails
          workOrder={viewingWorkOrder}
          isOpen={!!viewingWorkOrder}
          onClose={() => setViewingWorkOrder(null)}
          onUpdate={refreshWorkOrdersList}
          onViewAnalyses={handleViewWorkOrderAnalyses}
        />
      )}

      {/* Modal de Análisis de Orden de Trabajo */}
      {showWorkOrderAnalyses && analysingWorkOrder && (
        <WorkOrderAnalyses
          workOrder={analysingWorkOrder}
          isOpen={showWorkOrderAnalyses}
          onClose={handleCloseWorkOrderAnalyses}
        />
      )}
    </div>
  );
}

export default App;
