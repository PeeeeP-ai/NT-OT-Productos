const fs = require('fs');
const path = require('path');

// Leer variables de entorno
require('dotenv').config({ path: path.join(__dirname, 'public_html/api/.env') });

async function runInsertRawMaterials() {
  try {
    console.log('🚀 Insertando materias primas en la base de datos...');

    // Lista de materiales a insertar
    const materials = [
      { code: 'RM-001', name: '15-0-9', unit: 'unidad' },
      { code: 'RM-002', name: 'Acido acetico', unit: 'unidad' },
      { code: 'RM-003', name: 'Acido Ascorbico', unit: 'unidad' },
      { code: 'RM-004', name: 'Acido bórico', unit: 'unidad' },
      { code: 'RM-005', name: 'Acido Citrico anhidro Kg.', unit: 'Kg' },
      { code: 'RM-006', name: 'Acido Clorhídrico', unit: 'unidad' },
      { code: 'RM-007', name: 'Ácido Folico', unit: 'unidad' },
      { code: 'RM-008', name: 'Acido Fosforico 85%', unit: 'unidad' },
      { code: 'RM-009', name: 'Acido Fosforoso 98,5%', unit: 'unidad' },
      { code: 'RM-010', name: 'Acido Fulvico', unit: 'unidad' },
      { code: 'RM-011', name: 'Acido Glutamico', unit: 'unidad' },
      { code: 'RM-012', name: 'Acido Humico', unit: 'unidad' },
      { code: 'RM-013', name: 'Acido L-lactico', unit: 'unidad' },
      { code: 'RM-014', name: 'Acido Nitrico', unit: 'unidad' },
      { code: 'RM-015', name: 'Acido Salicílico', unit: 'unidad' },
      { code: 'RM-016', name: 'Acido Sulfurico', unit: 'unidad' },
      { code: 'RM-017', name: 'Agua', unit: 'unidad' },
      { code: 'RM-018', name: 'Alga maxicrop', unit: 'unidad' },
      { code: 'RM-019', name: 'Alga seca', unit: 'unidad' },
      { code: 'RM-020', name: 'Amoniaco', unit: 'unidad' },
      { code: 'RM-021', name: 'ANA', unit: 'unidad' },
      { code: 'RM-022', name: 'Azucar', unit: 'unidad' },
      { code: 'RM-023', name: 'Azufre', unit: 'unidad' },
      { code: 'RM-024', name: 'Base Alga', unit: 'unidad' },
      { code: 'RM-025', name: 'Benzoato de sodio', unit: 'unidad' },
      { code: 'RM-026', name: 'Borax', unit: 'unidad' },
      { code: 'RM-027', name: 'Boronatrocalcita', unit: 'unidad' },
      { code: 'RM-028', name: 'Borregro', unit: 'unidad' },
      { code: 'RM-029', name: 'Borresol', unit: 'unidad' },
      { code: 'RM-030', name: 'Caolin', unit: 'unidad' },
      { code: 'RM-031', name: 'Cloruro de Amonio', unit: 'unidad' },
      { code: 'RM-032', name: 'Cloruro de Calcio 94%', unit: 'unidad' },
      { code: 'RM-033', name: 'Cloruro de Magnesio', unit: 'unidad' },
      { code: 'RM-034', name: 'Cloruro de Potasio', unit: 'unidad' },
      { code: 'RM-035', name: 'Cloruro de Zinc', unit: 'unidad' },
      { code: 'RM-036', name: 'Colorante Amarillo', unit: 'unidad' },
      { code: 'RM-037', name: 'Colorante verde', unit: 'unidad' },
      { code: 'RM-038', name: 'Disal (Naftalen sulfonato)', unit: 'unidad' },
      { code: 'RM-039', name: 'EDTA', unit: 'unidad' },
      { code: 'RM-040', name: 'Extracto de Algas', unit: 'unidad' },
      { code: 'RM-041', name: 'Extracto de levadura', unit: 'unidad' },
      { code: 'RM-042', name: 'Formalina', unit: 'unidad' },
      { code: 'RM-043', name: 'Fosfato Monoamonico', unit: 'unidad' },
      { code: 'RM-044', name: 'Fosfato Monopotasico', unit: 'unidad' },
      { code: 'RM-045', name: 'Gluconato de sodio', unit: 'unidad' },
      { code: 'RM-046', name: 'Goma Xantato', unit: 'unidad' },
      { code: 'RM-047', name: 'Hidroxido de Amonio', unit: 'unidad' },
      { code: 'RM-048', name: 'Hidroxido de Calcio', unit: 'unidad' },
      { code: 'RM-049', name: 'Hidroxido de Potasio Escama', unit: 'unidad' },
      { code: 'RM-050', name: 'Hidroxido de Potasio Liquida', unit: 'unidad' },
      { code: 'RM-051', name: 'Hidroxido de Sodio', unit: 'unidad' },
      { code: 'RM-052', name: 'Lignosulfonato', unit: 'unidad' },
      { code: 'RM-053', name: 'Lisapol', unit: 'unidad' },
      { code: 'RM-054', name: 'Manitol', unit: 'unidad' },
      { code: 'RM-055', name: 'Molibdato de Amonio', unit: 'unidad' },
      { code: 'RM-056', name: 'Molibdato de Sodio', unit: 'unidad' },
      { code: 'RM-057', name: 'Monoetanolamina', unit: 'unidad' },
      { code: 'RM-058', name: 'Nitrato de Amonio', unit: 'unidad' },
      { code: 'RM-059', name: 'Nitrato de Amonio Agricola', unit: 'unidad' },
      { code: 'RM-060', name: 'Nitrato de Calcio', unit: 'unidad' },
      { code: 'RM-061', name: 'Nitrato de magnesio', unit: 'unidad' },
      { code: 'RM-062', name: 'Nitrato de Potasio', unit: 'unidad' },
      { code: 'RM-063', name: 'Nitrato de Sodio', unit: 'unidad' },
      { code: 'RM-064', name: 'Nitrato de Zinc', unit: 'unidad' },
      { code: 'RM-065', name: 'Oxido de Magnesio', unit: 'unidad' },
      { code: 'RM-066', name: 'Oxido de Zinc', unit: 'unidad' },
      { code: 'RM-067', name: 'Poliol', unit: 'unidad' },
      { code: 'RM-068', name: 'Propilenglicol', unit: 'unidad' },
      { code: 'RM-069', name: 'Rhenipal', unit: 'unidad' },
      { code: 'RM-070', name: 'Roca Fosforica', unit: 'unidad' },
      { code: 'RM-071', name: 'rukam', unit: 'unidad' },
      { code: 'RM-072', name: 'Sich', unit: 'unidad' },
      { code: 'RM-073', name: 'Sijo', unit: 'unidad' },
      { code: 'RM-074', name: 'Silicato de Potasio', unit: 'unidad' },
      { code: 'RM-075', name: 'Silicato de Sodio 32', unit: 'unidad' },
      { code: 'RM-076', name: 'Sorbitol 70%', unit: 'unidad' },
      { code: 'RM-077', name: 'Sulfato de Amonio', unit: 'unidad' },
      { code: 'RM-078', name: 'Sulfato de Cobre 5-HID', unit: 'unidad' },
      { code: 'RM-079', name: 'Sulfato de Magnesio 7-HID', unit: 'unidad' },
      { code: 'RM-080', name: 'Sulfato de Magnesio An', unit: 'unidad' },
      { code: 'RM-081', name: 'Sulfato de manganeso 7-HID', unit: 'unidad' },
      { code: 'RM-082', name: 'Sulfato de manganeso An', unit: 'unidad' },
      { code: 'RM-083', name: 'Sulfato de Potasio', unit: 'unidad' },
      { code: 'RM-084', name: 'Sulfato de Zinc 7-HID', unit: 'unidad' },
      { code: 'RM-085', name: 'Sulfato de Zinc An', unit: 'unidad' },
      { code: 'RM-086', name: 'Sulfato Ferroso 7-HID', unit: 'unidad' },
      { code: 'RM-087', name: 'Sulfato Ferroso Anhidro', unit: 'unidad' },
      { code: 'RM-088', name: 'Urea', unit: 'unidad' },
      { code: 'RM-089', name: 'vitamina B1', unit: 'unidad' },
      { code: 'RM-090', name: 'vitamina B2', unit: 'unidad' },
      { code: 'RM-091', name: 'vitamina B6', unit: 'unidad' },
      { code: 'RM-092', name: 'vitamina C', unit: 'unidad' },
      { code: 'RM-093', name: 'Vixil I (lignosulfonato de Na)', unit: 'unidad' },
      { code: 'RM-094', name: 'Vixileex SD', unit: 'unidad' },
      { code: 'RM-095', name: 'Tripolifosfato de Sodio', unit: 'unidad' },
      { code: 'RM-096', name: 'Antiespumante', unit: 'unidad' },
      { code: 'RM-097', name: 'Baricryl', unit: 'unidad' },
      { code: 'RM-098', name: 'Dioxido de Titanio', unit: 'unidad' },
      { code: 'RM-099', name: 'Carbonato de Calcio', unit: 'unidad' },
      { code: 'RM-100', name: 'Colanyl azul', unit: 'unidad' },
      { code: 'RM-101', name: 'Movilith DM-350', unit: 'unidad' },
      { code: 'RM-102', name: 'Texanol', unit: 'unidad' },
      { code: 'RM-103', name: 'Dietilenglicol', unit: 'unidad' },
      { code: 'RM-104', name: 'Acticide SPX (Isotiazolinonas)', unit: 'unidad' }
    ];

    console.log(`📦 Insertando ${materials.length} materias primas...`);

    let successCount = 0;
    let errorCount = 0;

    // Insertar cada material usando el proxy server
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];

      try {
        console.log(`📝 Insertando ${i + 1}/${materials.length}: ${material.name}`);

        const response = await fetch('http://localhost:4000/raw-materials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(material)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log(`✅ ${material.name} insertado exitosamente`);
          successCount++;
        } else {
          console.log(`❌ Error insertando ${material.name}:`, result.message || result.error);
          errorCount++;
        }

      } catch (error) {
        console.log(`❌ Error de conexión insertando ${material.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('🎉 Proceso completado!');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);

    if (errorCount === 0) {
      console.log('🎊 Todas las materias primas fueron insertadas exitosamente!');
    }

  } catch (error) {
    console.error('❌ Error general ejecutando inserción:', error);
  }
}

runInsertRawMaterials();
