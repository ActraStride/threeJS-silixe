/**
 * main.js
 * Controlador de UI del configurador — delega todo el 3D a VitrinaViewer.
 *
 * Responsabilidades:
 *  • Instanciar VitrinaViewer con el estado inicial.
 *  • Registrar event listeners en sliders y grupos de botones.
 *  • Actualizar el precio en pantalla vía onPriceChange.
 *  • Gestionar la visibilidad condicional del panel de temperatura LED.
 *
 * No contiene lógica 3D ni de precios. Toda la lógica vive en:
 *   - vitrina-viewer.js  (motor 3D + Strategy pattern)
 *   - reglas-negocio.js  (precios + reglas de manufactura)
 */

import { VitrinaViewer } from './vitrina-viewer.js';

// ─── Instanciar el motor 3D ───────────────────────────────────────────────────

const viewer = new VitrinaViewer({
    containerId: 'canvas-container',

    // Estado inicial (sólo los valores que difieren del DEFAULT_STATE en config.js)
    initialState: {
        ancho:       100,
        alto:        120,
        profundidad:  50,
        acabado:     'nogal',
        tipoVidrio:  'claro',
        entrepanos:   1,
        ledActivo:   false,
        ledTemp:     'calido',
        numPuertas:   2,
        tipoPuertas: 'abatible',
        apertura:     0,
        modelo:      'modeloA',
    },

    // El viewer notifica cada vez que el precio cambia
    onPriceChange: (precio) => {
        const el = document.getElementById('precio-val');
        if (el) el.textContent = `$${precio.toLocaleString('es-MX')}`;
    },

    showStats: true, // Cambiar a false en producción
});

// ─── Referencias al DOM ───────────────────────────────────────────────────────

const q  = (id)  => document.getElementById(id);
const qa = (sel) => document.querySelectorAll(sel);

// Sliders
const anchoSlider      = q('ancho-slider');
const altoSlider       = q('alto-slider');
const profSlider       = q('profundidad-slider');
const entrepanosSlider = q('entrepanos-slider');
const aberturaSlider   = q('apertura-slider');

// Displays de valor de cada slider
const anchoVal      = q('ancho-val');
const altoVal       = q('alto-val');
const profVal       = q('profundidad-val');
const entrepanosVal = q('entrepanos-val');
const aberturaVal   = q('apertura-val');

// Otros controles
const ledToggle  = q('led-toggle');
const ledTempRow = q('led-temp-row');

// ─── Helpers de binding ───────────────────────────────────────────────────────

/**
 * Registra un slider: actualiza su label y llama a viewer.update().
 *
 * @param {HTMLElement} slider    — Input type="range"
 * @param {HTMLElement} display   — Elemento donde mostrar el valor actual
 * @param {string}      stateKey  — Clave en el estado de VitrinaViewer
 * @param {Function}   [parse]    — Función de conversión del valor (default: parseInt)
 */
function bindSlider(slider, display, stateKey, parse = parseInt) {
    slider.addEventListener('input', () => {
        const value = parse(slider.value);
        display.textContent = value;
        viewer.update({ [stateKey]: value });
    });
}

/**
 * Registra un grupo de botones de selección exclusiva.
 * El botón activo recibe la clase CSS 'active'; los demás la pierden.
 *
 * @param {string}   selector  — Selector CSS que agrupa los botones
 * @param {string}   dataAttr  — Nombre del data-* atributo que contiene el valor
 * @param {string}   stateKey  — Clave en el estado de VitrinaViewer
 * @param {Function} [parse]   — Transformación del valor (default: string sin cambios)
 */
function bindButtonGroup(selector, dataAttr, stateKey, parse = (v) => v) {
    const btns = qa(selector);
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            viewer.update({ [stateKey]: parse(btn.dataset[dataAttr]) });
        });
    });
}

// ─── Sliders ──────────────────────────────────────────────────────────────────

bindSlider(anchoSlider,      anchoVal,      'ancho');
bindSlider(altoSlider,       altoVal,       'alto');
bindSlider(profSlider,       profVal,       'profundidad');
bindSlider(entrepanosSlider, entrepanosVal, 'entrepanos');

// La apertura de puertas no tiene un display aparte en los parámetros tipo,
// pero sí un label propio; se enlaza manualmente para mayor claridad.
aberturaSlider.addEventListener('input', () => {
    const apertura = parseInt(aberturaSlider.value);
    aberturaVal.textContent = apertura;
    viewer.update({ apertura });
});

// ─── Grupos de botones ────────────────────────────────────────────────────────

// Acabado de madera
bindButtonGroup('[data-acabado]',  'acabado',  'acabado');

// Tipo de vidrio
bindButtonGroup('[data-vidrio]',   'vidrio',   'tipoVidrio');

// Número de puertas
bindButtonGroup('[data-npuertas]', 'npuertas', 'numPuertas', parseInt);

// Tipo de apertura de puertas
bindButtonGroup('[data-tipo]',     'tipo',     'tipoPuertas');

// Temperatura de color LED
bindButtonGroup('[data-temp]',     'temp',     'ledTemp');

// Modelo de vitrina (nuevo — requiere botones [data-modelo] en el HTML)
bindButtonGroup('[data-modelo]',   'modelo',   'modelo');

// ─── LED toggle ───────────────────────────────────────────────────────────────

ledToggle.addEventListener('change', () => {
    const ledActivo = ledToggle.checked;
    // Mostrar/ocultar la fila de temperatura de LED según el estado
    ledTempRow.classList.toggle('visible', ledActivo);
    viewer.update({ ledActivo });
});