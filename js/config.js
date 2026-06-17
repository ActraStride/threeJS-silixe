/**
 * config.js
 * Fuente única de verdad para el configurador de vitrinas.
 * Exporta: acabados, vidrio, estado por defecto y recetas de modelos.
 */
import * as THREE from 'three';

// ─── Acabados de madera ───────────────────────────────────────────────────────
export const ACABADOS_MADERA = {
    nogal:  { color: 0x6b4226, roughness: 0.55 },
    blanco: { color: 0xf3f1ec, roughness: 0.30 },
    negro:  { color: 0x161616, roughness: 0.28 },
    encino: { color: 0xc8a978, roughness: 0.55 },
};

// ─── Configuración de vidrio ──────────────────────────────────────────────────
export const CONFIG_VIDRIO = {
    claro: {
        color: 0xffffff, transmission: 0.95, roughness: 0.04,
        ior: 1.45, thickness: 0.5,
        attenuationColor: new THREE.Color(0xe8f4ff), attenuationDistance: 50,
        clearcoat: 0.3,
    },
    esmerilado: {
        color: 0xf0f0ee, transmission: 0.55, roughness: 0.55,
        ior: 1.45, thickness: 1.0,
        attenuationColor: new THREE.Color(0xf8f8f0), attenuationDistance: 80,
        clearcoat: 0.0,
    },
    tintado: {
        color: 0x5a8a60, transmission: 0.70, roughness: 0.08,
        ior: 1.45, thickness: 0.5,
        attenuationColor: new THREE.Color(0x608860), attenuationDistance: 30,
        clearcoat: 0.2,
    },
};

// ─── Estado por defecto ───────────────────────────────────────────────────────
export const DEFAULT_STATE = {
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
};

// ─── Recetas de modelos ───────────────────────────────────────────────────────
//
// Cada receta define qué "variante" renderiza cada bloque constructor.
// Los diccionarios ConstructoresBase / ConstructoresCuerpo / ConstructoresCorona
// en vitrina-viewer.js usan estas claves para seleccionar la estrategia correcta.
//
// Claves disponibles:
//   base     → 'estandar' | 'con_cajon'
//   cuerpo   → 'vidrio_completo' | 'costados_madera'
//   corona   → 'corona_madera' | 'tapa_plana_madera' | 'ninguna'
//
// Impacto en precio (ver COSTOS en reglas-negocio.js):
//   base 'con_cajon'         → +$1 200
//   cuerpo 'vidrio_completo' → +$600
//   corona 'ninguna'         → −$200 (ahorro de material)
//   corona 'corona_madera'   → +$150 (moldura con vuelo)
//
export const REGLAS_MODELOS = {
    /**
     * Modelo A — Vitrina clásica:
     * Base sólida, cuerpo con laterales de madera y frente de vidrio,
     * corona decorativa de madera.
     */
    modeloA: {
        base:   'estandar',
        cuerpo: 'costados_madera',
        corona: 'corona_madera',
    },

    /**
     * Modelo B — Expositor de lujo:
     * Base con cajón de almacenamiento, cuerpo totalmente acristalado
     * (cuatro caras de vidrio para máxima visibilidad), sin corona.
     */
    modeloB: {
        base:   'con_cajon',
        cuerpo: 'vidrio_completo',
        corona: 'ninguna',
    },

    /**
     * Modelo C — Vitrina minimalista:
     * Base estándar, cuerpo con costados de madera,
     * remate superior de tapa plana (perfil bajo).
     */
    modeloC: {
        base:   'estandar',
        cuerpo: 'costados_madera',
        corona: 'tapa_plana_madera',
    },
};