from flask import Flask, request, jsonify
import os
from flask_cors import CORS
from model import optimizar_desde_api

app = Flask(__name__)
CORS(app)

# Variables globales
constantes = {}
cuartiles = []
inventario_actual = 0
backorder_actual = 0
trabajadores_actuales = 0

@app.route('/api/guardar_constantes', methods=['POST'])
def guardar_constantes():
    global constantes, inventario_actual, backorder_actual, trabajadores_actuales
    data = request.json

    # Validar datos de entrada
    try:
        constantes = {key.upper(): float(data[key]) for key in data}
        constantes['PRECIO_VENTA_TABLET'] = constantes.pop('PRECIO_DE_VENTA')  # Cambiar la clave a 'PRECIO_VENTA_TABLET'
        inventario_actual = constantes['INVENTARIO_INICIAL']
        backorder_actual = constantes['BACKORDER_INICIAL']
        trabajadores_actuales = constantes['TRABAJADORES_INICIALES']
    except ValueError as e:
        return jsonify({"message": f"Error: Todos los valores deben ser numéricos. Detalles: {str(e)}"}), 400
    except KeyError as e:
        return jsonify({"message": f"Error: Falta la clave {str(e)} en los datos de entrada."}), 400
    except Exception as e:
        return jsonify({"message": f"Error inesperado: {str(e)}"}), 500

    return jsonify({"message": "Constantes guardadas correctamente"})

@app.route('/api/optimizar', methods=['POST'])
def optimizar():
    global constantes, inventario_actual, backorder_actual, trabajadores_actuales, cuartiles
    data = request.json
    cuartil = data['cuartil']
    demanda_real = float(data['demanda_real'])

    # Optimización
    resultado = optimizar_desde_api(
        cuartil=cuartil,
        demanda_real=demanda_real,
        inventario_actual=inventario_actual,
        backorder_actual=backorder_actual,
        trabajadores_actuales=trabajadores_actuales,
        constantes=constantes
    )

    # Actualizar valores globales
    inventario_actual = resultado['inventario_disponible_final']
    backorder_actual = resultado['backorders_pendientes_finales']
    trabajadores_actuales = trabajadores_actuales + resultado['trabajadores_contratados'] - resultado['trabajadores_despedidos']

    # Crear salida detallada
    salida = f"""
    --- Cálculos para {cuartil} ---
    Ingrese la demanda real para {cuartil}: {demanda_real}

    --- Optimización para {cuartil} ---
    Demanda real: {demanda_real}

    --- Resultados de la Optimización ---
    Cantidad producida: {resultado['cantidad_produccion']}
    Trabajadores contratados: {resultado['trabajadores_contratados']}
    Trabajadores despedidos: {resultado['trabajadores_despedidos']}
    Inventario final: {resultado['inventario_disponible_final']}
    Backorders finales: {resultado['backorders_pendientes_finales']}
    Horas extra por día: {resultado['horas_extra_por_dia']}

    --- Resumen Financiero ---
    Utilidad sin penalizaciones: {resultado['utilidad_sin_penalizacion']}
    Penalización por exceso de inventario: {resultado['penalizacion_positiva']}
    Penalización por falta de inventario: {resultado['penalizacion_negativa']}
    Penalización total: {resultado['penalizacion_total']}
    Utilidad total (incluyendo penalizaciones): {resultado['utilidad_total']}

    --- Resumen de Decisiones para {cuartil} ---
    Cantidad produccion: {resultado['cantidad_produccion']}
    Trabajadores contratados: {resultado['trabajadores_contratados']}
    Trabajadores despedidos: {resultado['trabajadores_despedidos']}
    Inventario disponible final: {resultado['inventario_disponible_final']}
    Backorders pendientes finales: {resultado['backorders_pendientes_finales']}
    Horas extra por dia: {resultado['horas_extra_por_dia']}
    Utilidad sin penalizacion: {resultado['utilidad_sin_penalizacion']}
    Utilidad total: {resultado['utilidad_total']}
    """
    
    return jsonify({"resultado": salida})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
