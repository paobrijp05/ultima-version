import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    inventario_inicial: '',
    backorder_inicial: '',
    trabajadores_iniciales: '',
    costo_mo_hora_normal: '',
    costo_mo_hora_extra: '',
    ratio_produccion_normal: '',
    ratio_produccion_extra: '',
    costo_mantenimiento_inventario: '',
    costo_backorder: '',
    costo_unitario_produccion: '',
    costo_contratar: '',
    costo_despedir: '',
    precio_de_venta: '',
    dias_laborales_por_cuartil: '',
    horas_normales_por_dia: '',
    target_inventario_final: '',
    penalidad_inventario_positivo: '',
    penalidad_inventario_negativo: ''
  });

  const [cuartiles, setCuartiles] = useState([]);
  const [pronosticos, setPronosticos] = useState([]);
  const [numCuartiles, setNumCuartiles] = useState('');
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [step, setStep] = useState(1);
  const [constantsSaved, setConstantsSaved] = useState(false);
  const [pronosticosSaved, setPronosticosSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (/^\d*\.?\d*$/.test(value)) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSaveConstants = async () => {
    try {
      const response = await fetch('https://ultima-version-19.onrender.com/api/guardar_constantes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok) {
        setConstantsSaved(true);
        setStep(2);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(`Error al guardar las constantes: ${error.message}`);
    }
  };

  const handleSaveCuartiles = () => {
    const cuartilesArray = Array.from({ length: parseInt(numCuartiles) }, () => ({
      nombre: '',
      demanda_pronosticada: ''
    }));
    setCuartiles(cuartilesArray);
    setStep(3);
    setError(null);
  };

  const handleGuardarPronosticos = async () => {
    try {
      const response = await fetch('https://ultima-version-19.onrender.com/api/guardar_pronosticos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuartiles),
      });
      const result = await response.json();
      if (response.ok) {
        setMessage('Datos guardados exitosamente');
        setPronosticosSaved(true);
        setPronosticos([...cuartiles]);
        // Reset cuartiles for real demand
        const newCuartiles = cuartiles.map(c => ({
          nombre: c.nombre,
          demanda_real: ''
        }));
        setCuartiles(newCuartiles);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(`Error al guardar pronósticos: ${error.message}`);
    }
  };

  const handleSubmitCuartil = async (index, demandaPronosticada) => {
    try {
      const cuartilData = {
        ...cuartiles[index],
        demanda_pronosticada: demandaPronosticada
      };
      
      const response = await fetch('http://127.0.0.1:5000/api/optimizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuartilData),
      });
      
      const result = await response.json();
      if (response.ok) {
        const newResultados = [...resultados];
        newResultados[index] = result.resultado;
        setResultados(newResultados);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(`Error al optimizar el cuartil: ${error.message}`);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Optimización de Recursos', 10, 10);
    
    doc.setFontSize(12);
    doc.text('Constantes:', 10, 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const constantes = Object.keys(formData).map((key) => [
      key.replace(/_/g, ' '),
      formData[key]
    ]);

    doc.autoTable({
      head: [['Constante', 'Valor']],
      body: constantes,
      startY: 25,
      theme: 'grid'
    });

    cuartiles.forEach((cuartil, index) => {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cuartil ${index + 1}:`, 10, 10);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const cuartilData = [
        ['Nombre del cuartil', cuartil.nombre], // Fix the key to access the cuartil name
        ['Demanda real', cuartil.demanda_real]
      ];
      if (resultados[index]) {
        cuartilData.push(['Resultado', resultados[index]]);
      }
      doc.autoTable({
        head: [['Campo', 'Valor']],
        body: cuartilData,
        startY: 15,
        theme: 'grid'
      });
    });

    doc.save('reporte.pdf');
  };

  return (
    <div className="container">
      <div className="entrada">
        <header className="header">
          <h1>Optimización de Recursos</h1>
          <p>Ingrese los datos necesarios para la optimización</p>
        </header>
        {step === 1 && (
          <div className="form-section">
            <h2>Constantes</h2>
            {Object.keys(formData).map((key) => (
              <div key={key}>
                <label>
                  {key === 'precio_venta_tablet' ? 'precio de venta' : key.replace(/_/g, ' ')}:
                <input
                  type="text"
                  name={key}
                  value={formData[key]}
                  onChange={handleChange}
                  className="input"
                  disabled={constantsSaved}
                />
                </label>
              </div>
            ))}
            <button onClick={handleSaveConstants} className="button" disabled={constantsSaved}>
              Guardar Constantes
            </button>
            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}
          </div>
        )}
        {step === 2 && (
          <div className="form-section">
            <h2>Cuartiles</h2>
            <label>
              Número de cuartiles:
              <input
                type="text"
                name="numCuartiles"
                value={numCuartiles}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                    setNumCuartiles(e.target.value);
                  }
                }}
                className="input"
              />
            </label>
            <button onClick={handleSaveCuartiles} className="button">
              Guardar Cuartiles
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        )}
        {step === 3 && !pronosticosSaved && (
          <div className="form-section">
            <h2>Ingrese Pronósticos</h2>
            {cuartiles.map((cuartil, index) => (
              <div key={index}>
                <h3>Cuartil {index + 1}</h3>
                <label>
                  Nombre del cuartil:
                  <input
                    type="text"
                    value={cuartil.nombre}
                    onChange={(e) => {
                      const newCuartiles = [...cuartiles];
                      newCuartiles[index] = {
                        ...newCuartiles[index],
                        nombre: e.target.value
                      };
                      setCuartiles(newCuartiles);
                    }}
                    className="input"
                  />
                </label>
                <label>
                  Demanda pronosticada:
                  <input
                    type="text"
                    value={cuartil.demanda_pronosticada}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) {
                        const newCuartiles = [...cuartiles];
                        newCuartiles[index] = {
                          ...newCuartiles[index],
                          demanda_pronosticada: e.target.value
                        };
                        setCuartiles(newCuartiles);
                      }
                    }}
                    className="input"
                  />
                </label>
              </div>
            ))}
            <button onClick={handleGuardarPronosticos} className="button">
              Guardar Pronósticos
            </button>
            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}
          </div>
        )}
        {step === 3 && pronosticosSaved && (
          <div className="form-section">
            <h2>Ingrese Demanda Real</h2>
            {cuartiles.map((cuartil, index) => (
              <div key={index} className="form-section">
                <h3>Cuartil {cuartiles[index].nombre}</h3>
                <label>
                  Demanda real:
                  <input
                    type="text"
                    value={cuartil.demanda_real}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) {
                        const newCuartiles = [...cuartiles];
                        newCuartiles[index].demanda_real = e.target.value;
                        setCuartiles(newCuartiles);
                      }
                    }}
                    className="input"
                  />
                </label>
                <button 
                  onClick={() => handleSubmitCuartil(index, pronosticos[index].demanda_pronosticada)} 
                  className="button"
                >
                  Enviar Cuartil
                </button>
                {resultados[index] && (
                  <div className="resultado-item">
                    <h3>Resultado del Cuartil {cuartil.nombre}</h3>
                    <pre>{resultados[index]}</pre>
                  </div>
                )}
              </div>
            ))}
            {resultados.length === cuartiles.length && (
              <div className="form-section">
                <button onClick={generatePDF} className="button">
                  Descargar Reporte
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
