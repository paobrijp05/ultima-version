from pulp import LpMaximize, LpProblem, LpVariable
from pulp import PULP_CBC_CMD

solver = PULP_CBC_CMD(msg=False)

def optimizar_desde_api(cuartil, demanda_real, inventario_actual, backorder_actual, trabajadores_actuales, constantes):
    modelo = LpProblem(name=f"optimizacion-{cuartil}", sense=LpMaximize)

    # Variables de decisión
    cantidad_produccion = LpVariable("Cantidad_Produccion", lowBound=0, cat="Integer")
    trabajadores_contratados = LpVariable("Trabajadores_Contratados", lowBound=0, cat="Integer")
    trabajadores_despedidos = LpVariable("Trabajadores_Despedidos", lowBound=0, cat="Integer")
    inventario_disponible_final = LpVariable("Inventario_Disponible_Final", lowBound=0, cat="Integer")
    backorders_pendientes_finales = LpVariable("Backorders_Pendientes_Finales", lowBound=0, cat="Integer")
    horas_extra_por_dia = LpVariable("Horas_Extra_Por_Dia", lowBound=0, upBound=4, cat="Integer")

    # Ingresos totales
    ingresos_totales = demanda_real * constantes['PRECIO_VENTA_TABLET']  # Asegúrate de que este campo se use correctamente

    # Costos
    costo_produccion_total = cantidad_produccion * constantes['COSTO_UNITARIO_PRODUCCION']
    costo_mantenimiento_inventario = inventario_disponible_final * constantes['COSTO_MANTENIMIENTO_INVENTARIO']
    costo_backorder_total = backorders_pendientes_finales * constantes['COSTO_BACKORDER']
    costo_contratacion_total = trabajadores_contratados * constantes['COSTO_CONTRATAR']
    costo_despido_total = trabajadores_despedidos * constantes['COSTO_DESPEDIR']
    costo_mano_obra_normal = (
        trabajadores_actuales
        * constantes['DIAS_LABORALES_POR_CUARTIL']
        * constantes['HORAS_NORMALES_POR_DIA']
        * constantes['COSTO_MO_HORA_NORMAL']
    )
    costo_mano_obra_extra = (
        trabajadores_actuales
        * constantes['DIAS_LABORALES_POR_CUARTIL']
        * horas_extra_por_dia
        * constantes['COSTO_MO_HORA_EXTRA']
    )

    costos_totales = (
        costo_produccion_total
        + costo_mantenimiento_inventario
        + costo_backorder_total
        + costo_contratacion_total
        + costo_despido_total
        + costo_mano_obra_normal
        + costo_mano_obra_extra
    )

    # Función objetivo
    modelo += ingresos_totales - costos_totales, "Utilidad_Total"

    # Restricciones
    capacidad_produccion_maxima = trabajadores_actuales * constantes['DIAS_LABORALES_POR_CUARTIL'] * (
        constantes['HORAS_NORMALES_POR_DIA'] * constantes['RATIO_PRODUCCION_NORMAL']
        + horas_extra_por_dia * constantes['RATIO_PRODUCCION_EXTRA']
    )
    modelo += cantidad_produccion <= capacidad_produccion_maxima, "Restriccion_Capacidad_Produccion"
    modelo += inventario_disponible_final == (
        inventario_actual + cantidad_produccion - demanda_real - backorder_actual
    ), "Restriccion_Inventario"
    modelo += backorders_pendientes_finales >= 0, "Restriccion_Backorders"

    modelo.solve(solver)

    # Resultados
    utilidad_sin_penalizacion = modelo.objective.value()

    # Penalización por exceso o falta de inventario
    penalizacion_positiva = max(0, inventario_disponible_final.value() - constantes['TARGET_INVENTARIO_FINAL']) * constantes['PENALIDAD_INVENTARIO_POSITIVO']
    penalizacion_negativa = max(0, constantes['TARGET_INVENTARIO_FINAL'] - inventario_disponible_final.value()) * constantes['PENALIDAD_INVENTARIO_NEGATIVO']
    penalizacion_total = penalizacion_positiva + penalizacion_negativa

    # Utilidad total considerando penalizaciones
    utilidad_total = utilidad_sin_penalizacion - penalizacion_total

    # Retornar todos los datos necesarios
    return {
        "cantidad_produccion": cantidad_produccion.value(),
        "trabajadores_contratados": trabajadores_contratados.value(),
        "trabajadores_despedidos": trabajadores_despedidos.value(),
        "inventario_disponible_final": inventario_disponible_final.value(),
        "backorders_pendientes_finales": backorders_pendientes_finales.value(),
        "horas_extra_por_dia": horas_extra_por_dia.value(),
        "utilidad_sin_penalizacion": utilidad_sin_penalizacion,
        "penalizacion_positiva": penalizacion_positiva,
        "penalizacion_negativa": penalizacion_negativa,
        "penalizacion_total": penalizacion_total,
        "utilidad_total": utilidad_total,
    }