import { useState } from 'react';
import RawMaterialsList from './components/RawMaterialsList';
import RawMaterialForm from './components/RawMaterialForm';
import InventoryEntries from './components/InventoryEntries';
import ProductsList from './components/ProductsList';
import ProductForm from './components/ProductForm';
import ProductDetails from './components/ProductDetails';
import { Product } from './types';
import './App.css';

type AppSection = 'materials' | 'products';

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


  return (
    <div className="App">
      {/* Header con navegación */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
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
                🏭 Productos
              </button>
            </nav>
          </div>
          <div className="header-right">
            {currentSection === 'materials' && (
              <button onClick={handleCreateMaterial} className="create-button">
                ➕ Nueva Materia Prima
              </button>
            )}
            {currentSection === 'products' && (
              <button onClick={handleCreateProduct} className="create-button">
                ➕ Nuevo Producto
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="main-content">
        {currentSection === 'materials' && (
          <RawMaterialsList
            key={`materials-${forceRefreshMaterials}`}
            onEdit={handleEditMaterial}
            onViewEntries={handleViewEntries}
            onCreateEntry={handleCreateEntry}
          />
        )}
        
        {currentSection === 'products' && (
          <ProductsList
            key={`products-${forceRefreshProducts}`}
            onEdit={handleEditProduct}
            onViewDetails={handleViewProductDetails}
            onCreate={handleCreateProduct}
            forceRefresh={forceRefreshProducts}
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
    </div>
  );
}

export default App;