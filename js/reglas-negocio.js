/**
 * reglas-negocio.js
 * Fuente única de verdad para la lógica de negocio y precios del configurador.
 *
 * Responsabilidades:
 *  • Diccionario de costos (COSTOS) — fuente única, sin hardcodeo en viewer.
 *  • calcularPrecio(state)           — función pura; recibe estado, devuelve número.
 *  • aplicarReglasDeManufactura(state)— función pura; recibe estado crudo, devuelve
 *                                       estado sanitizado con reglas aplicadas.
 *
 * Ninguna función de este módulo tiene efectos secundarios ni depende de Three.js.
 * Importar REGLAS_MODELOS desde config.js para mantener la receta como fuente única.
 */

import { REGLAS_MODELOS } from './config.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DICCIONARIO DE COSTOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Todos los valores monetarios del configurador viven aquí.
 * Ajustar precios en este objeto; ningún otro archivo debe tener números de costo.
 *
 * Convención de claves:
 *  • BASE_FIJA          — precio base de cualquier vitrina
 *  • DIM_*              — costo por unidad de dimensión (cm)
 *  • OPT_*              — costo por opción del usuario
 *  • MODELO_*           — modificadores por receta del modelo activo
 */
export const COSTOS = {
    // Precio base fijo
    BASE_FIJA: 1800,

    // Dimensiones (costo por cm)
    DIM_ANCHO:        14,
    DIM_ALTO:         18,
    DIM_PROFUNDIDAD:   6,
    DIM_ENTREPANO:   350,

    // Opciones del usuario
    OPT_LED_ACTIVO:        650,
    OPT_VIDRIO_ESMERILADO: 400,
    OPT_VIDRIO_TINTADO:    300,
    OPT_4_PUERTAS:         900,
    OPT_PUERTAS_ABATIBLE:  200,

    // Modificadores por receta del modelo
    MODELO_BASE_CON_CAJON:          1200,   // mecanismo de cajón
    MODELO_CUERPO_VIDRIO_COMPLETO:   600,   // laterales acristalados
    MODELO_CORONA_NINGUNA:          -200,   // ahorro de material
    MODELO_CORONA_CORONA_MADERA:     150,   // moldura con vuelo
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGLAS DE MANUFACTURA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evalúa las restricciones de manufactura y devuelve un estado sanitizado.
 *
 * Reglas aplicadas:
 *  1. Ancho > 150 cm → forzar puertas corredizas (las abatibles no caben).
 *  2. Cuerpo 'vidrio_completo' con menos de 2 puertas → forzar 2 puertas mínimo.
 *
 * @param  {object} state — Estado crudo tal como viene de la UI o initialState.
 * @returns {object}       Nuevo objeto de estado con las reglas aplicadas.
 *                         NUNCA muta el objeto recibido.
 */
export function aplicarReglasDeManufactura(state) {
    const receta = REGLAS_MODELOS[state.modelo] || REGLAS_MODELOS.modeloA;

    // Clonar para no mutar la fuente
    const sanitizado = { ...state };

    // Regla 1: anchos grandes obligan a puertas corredizas
    if (sanitizado.ancho > 150) {
        sanitizado.tipoPuertas = 'corrediza';
    }

    // Regla 2: cuerpo totalmente acristalado requiere mínimo 2 puertas
    if (receta.cuerpo === 'vidrio_completo' && sanitizado.numPuertas < 2) {
        sanitizado.numPuertas = 2;
    }

    return sanitizado;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO DE PRECIO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el precio total de la vitrina a partir del estado sanitizado.
 *
 * Función pura — sin efectos secundarios, sin acceso a DOM ni a Three.js.
 * El estado recibido ya debe haber pasado por aplicarReglasDeManufactura()
 * si se quiere que el precio refleje las restricciones de manufactura,
 * aunque el resultado es coherente con cualquier estado válido.
 *
 * @param  {object} state — Estado (idealmente sanitizado) de la vitrina.
 * @returns {number}       Precio redondeado al múltiplo de $10 más cercano.
 */
export function calcularPrecio(state) {
    const receta = REGLAS_MODELOS[state.modelo] || REGLAS_MODELOS.modeloA;
    const C = COSTOS;

    let precio = C.BASE_FIJA;

    // ── Dimensiones ──────────────────────────────────────────────────────────
    precio += state.ancho       * C.DIM_ANCHO;
    precio += state.alto        * C.DIM_ALTO;
    precio += state.profundidad * C.DIM_PROFUNDIDAD;
    precio += state.entrepanos  * C.DIM_ENTREPANO;

    // ── Opciones del usuario ─────────────────────────────────────────────────
    if (state.ledActivo)                    precio += C.OPT_LED_ACTIVO;
    if (state.tipoVidrio === 'esmerilado')  precio += C.OPT_VIDRIO_ESMERILADO;
    if (state.tipoVidrio === 'tintado')     precio += C.OPT_VIDRIO_TINTADO;
    if (state.numPuertas === 4)             precio += C.OPT_4_PUERTAS;
    if (state.tipoPuertas === 'abatible')   precio += C.OPT_PUERTAS_ABATIBLE;

    // ── Modificadores por receta del modelo ──────────────────────────────────
    if (receta.base   === 'con_cajon')         precio += C.MODELO_BASE_CON_CAJON;
    if (receta.cuerpo === 'vidrio_completo')   precio += C.MODELO_CUERPO_VIDRIO_COMPLETO;
    if (receta.corona === 'ninguna')           precio += C.MODELO_CORONA_NINGUNA;
    if (receta.corona === 'corona_madera')     precio += C.MODELO_CORONA_CORONA_MADERA;

    return Math.round(precio / 10) * 10;
}
