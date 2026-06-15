/**
 * main.js
 * Script de la tienda — delega todo el 3D a VitrinaViewer.
 * Solo responsable de: DOM, eventos, precio en pantalla.
 */

import { VitrinaViewer } from './vitrina-viewer.js';

// ─── Instanciar el motor 3D ───────────────────────────────────────────────────

const viewer = new VitrinaViewer({
    containerId: 'canvas-container',

    // Estado inicial (opcional — los valores que difieran del default)
    initialState: {
        ancho:      100,
        alto:       120,
        profundidad: 50,
        acabado:    'nogal',
        tipoVidrio: 'claro',
        entrepanos:  1,
        ledActivo:  false,
        ledTemp:    'calido',
        numPuertas:  2,
        tipoPuertas: 'abatible',
        apertura:    0,
    },

    // El viewer nos avisa cada vez que el precio cambia
    onPriceChange: (precio) => {
        const el = document.getElementById('precio-val');
        if (el) el.textContent = `$${precio.toLocaleString('es-MX')}`;
    },

    showStats: true, // false en producción
});

// ─── Referencias al DOM ───────────────────────────────────────────────────────

const q  = (id) => document.getElementById(id);
const qa = (sel) => document.querySelectorAll(sel);

// Sliders
const anchoSlider      = q('ancho-slider');
const altoSlider       = q('alto-slider');
const profSlider       = q('profundidad-slider');
const entrepanosSlider = q('entrepanos-slider');
const aberturaSlider   = q('apertura-slider');

// Displays de valor
const anchoVal      = q('ancho-val');
const altoVal       = q('alto-val');
const profVal       = q('profundidad-val');
const entrepanosVal = q('entrepanos-val');
const aberturaVal   = q('apertura-val');

// Otros controles
const ledToggle  = q('led-toggle');
const ledTempRow = q('led-temp-row');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Registra un slider: actualiza su label y llama a viewer.update()
 * @param {HTMLElement} slider
 * @param {HTMLElement} display
 * @param {string}      stateKey
 * @param {Function}   [parse]
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
 * @param {string}   selector   — Selector CSS del grupo
 * @param {string}   dataAttr   — Nombre del data-atributo con el valor
 * @param {string}   stateKey   — Clave en el estado de VitrinaViewer
 * @param {Function} [parse]    — Transformación del valor (default: string)
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

aberturaSlider.addEventListener('input', () => {
    const apertura = parseInt(aberturaSlider.value);
    aberturaVal.textContent = apertura;
    viewer.update({ apertura });
});

// ─── Grupos de botones ────────────────────────────────────────────────────────

bindButtonGroup('[data-acabado]',   'acabado',   'acabado');
bindButtonGroup('[data-vidrio]',    'vidrio',    'tipoVidrio');
bindButtonGroup('[data-npuertas]',  'npuertas',  'numPuertas', parseInt);
bindButtonGroup('[data-tipo]',      'tipo',      'tipoPuertas');
bindButtonGroup('[data-temp]',      'temp',      'ledTemp');

// ─── LED toggle ───────────────────────────────────────────────────────────────

ledToggle.addEventListener('change', () => {
    const ledActivo = ledToggle.checked;
    ledTempRow.classList.toggle('visible', ledActivo);
    viewer.update({ ledActivo });
});