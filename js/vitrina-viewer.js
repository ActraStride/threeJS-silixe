/**
 * vitrina-viewer.js
 * Motor 3D encapsulado para el configurador de vitrinas.
 * Patrón Widget/Librería — sin dependencias de UI externa.
 *
 * Arquitectura data-driven: _build() lee REGLAS_MODELOS y delega
 * en _drawBase / _drawCuerpo / _drawCorona que apilan bloques
 * matemáticamente mediante un acumulador yActual.
 *
 * La lógica de precios y las reglas de manufactura viven en reglas-negocio.js.
 * Los métodos _draw* usan el Patrón Strategy: buscan la función correspondiente
 * en un diccionario de constructores y la ejecutan, sin if/else.
 *
 * Uso:
 *   import { VitrinaViewer } from './vitrina-viewer.js';
 *   const viewer = new VitrinaViewer({ containerId: 'canvas-container', ...opts });
 *   viewer.update({ ancho: 120, ledActivo: true, modelo: 'modeloB' });
 */

import * as THREE from 'three';
import { OrbitControls }    from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment }  from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js';
import Stats                from 'three/addons/libs/stats.module.js';

import {
    ACABADOS_MADERA,
    CONFIG_VIDRIO,
    DEFAULT_STATE,
    REGLAS_MODELOS,
} from './config.js';

import {
    calcularPrecio,
    aplicarReglasDeManufactura,
} from './reglas-negocio.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DICCIONARIOS DE ESTRATEGIAS  (Patrón Strategy)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Cada diccionario mapea una variante de receta a una función constructora pura.
// Las funciones reciben (viewer, yInicio, altoBloque, state, materiales…)
// y emiten llamadas a viewer._addBox(). Devuelven la altura consumida para
// que el acumulador yActual del ensamblador siga funcionando.
//
// CRÍTICO: estas funciones deben usar EXCLUSIVAMENTE viewer._addBox() para
// piezas estructurales — nunca instanciar BoxGeometry directamente.
// Las geometrías dinámicas (tiradores, LEDs, puertas) pueden usar sus propias
// geometrías, igual que en el código original.

// ─── Constructores de Base ────────────────────────────────────────────────────

const ConstructoresBase = {

    /**
     * Base estándar con zócalo decorativo inferior.
     * @param {VitrinaViewer} viewer
     * @param {number}        yBase
     * @param {number}        altoBase
     * @param {object}        s          Estado sanitizado
     * @param {THREE.Material} matMadera
     * @returns {number} Altura consumida
     */
    estandar(viewer, yBase, altoBase, s, matMadera) {
        // Cuerpo principal de la base
        viewer._addBox(s.ancho, altoBase, s.profundidad, matMadera,
            0, yBase + altoBase / 2, 0);

        // Zócalo decorativo (rebaje inferior)
        viewer._addBox(s.ancho - 4, 4, s.profundidad - 4,
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }),
            0, yBase + 2, 0, false);

        return altoBase;
    },

    /**
     * Base con cajón de almacenamiento.
     * @param {VitrinaViewer} viewer
     * @param {number}        yBase
     * @param {number}        altoBase
     * @param {object}        s          Estado sanitizado
     * @param {THREE.Material} matMadera
     * @returns {number} Altura consumida
     */
    con_cajon(viewer, yBase, altoBase, s, matMadera) {
        // Cuerpo principal de la base
        viewer._addBox(s.ancho, altoBase, s.profundidad, matMadera,
            0, yBase + altoBase / 2, 0);

        // Línea de división del cajón
        viewer._addBox(s.ancho - 4, 0.6, s.profundidad - 4,
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }),
            0, yBase + altoBase * 0.55, 0, false);

        // Frente del cajón (plano de madera con rebaje)
        viewer._addBox(s.ancho - 6, altoBase * 0.38, s.profundidad * 0.06,
            matMadera,
            0, yBase + altoBase * 0.27, s.profundidad / 2 - 0.1);

        // Tirador central del cajón
        const tirGeo = new THREE.CylinderGeometry(0.4, 0.4, 12, 12);
        const tir    = new THREE.Mesh(tirGeo, viewer._matAluminio);
        tir.rotation.z = Math.PI / 2;
        tir.position.set(0, yBase + altoBase * 0.27, s.profundidad / 2 + 0.6);
        viewer._vitrinaGroup.add(tir);

        return altoBase;
    },
};

// ─── Constructores de Cuerpo ──────────────────────────────────────────────────

const ConstructoresCuerpo = {

    /**
     * Cuerpo con paneles laterales de vidrio (expositor de lujo).
     * @param {VitrinaViewer} viewer
     * @param {number}        yCuerpo
     * @param {number}        altoCuerpo
     * @param {object}        s               Estado sanitizado (con reglas aplicadas)
     * @param {THREE.Material} matMadera
     * @param {THREE.Material} matCristal
     * @param {THREE.Material} matEntrepaño
     * @param {string}        tipoPuertas     Ya sanitizado por reglas de manufactura
     * @param {number}        numPuertas      Ya sanitizado por reglas de manufactura
     * @returns {number} Altura consumida
     */
    vidrio_completo(viewer, yCuerpo, altoCuerpo, s, matMadera, matCristal, matEntrepaño, tipoPuertas, numPuertas) {
        return _construirCuerpo(viewer, yCuerpo, altoCuerpo, s, matMadera, matCristal, matEntrepaño, tipoPuertas, numPuertas, matCristal);
    },

    /**
     * Cuerpo con paneles laterales de madera (vitrina clásica/minimalista).
     * @param {VitrinaViewer} viewer
     * @param {number}        yCuerpo
     * @param {number}        altoCuerpo
     * @param {object}        s               Estado sanitizado
     * @param {THREE.Material} matMadera
     * @param {THREE.Material} matCristal
     * @param {THREE.Material} matEntrepaño
     * @param {string}        tipoPuertas
     * @param {number}        numPuertas
     * @returns {number} Altura consumida
     */
    costados_madera(viewer, yCuerpo, altoCuerpo, s, matMadera, matCristal, matEntrepaño, tipoPuertas, numPuertas) {
        return _construirCuerpo(viewer, yCuerpo, altoCuerpo, s, matMadera, matCristal, matEntrepaño, tipoPuertas, numPuertas, matMadera);
    },
};

/**
 * Implementación compartida del cuerpo.
 * La única diferencia entre variantes es el material del panel lateral (matLateral).
 * Extraída como función privada del módulo para evitar duplicación.
 *
 * @param {VitrinaViewer} viewer
 * @param {number}        yCuerpo
 * @param {number}        altoCuerpo
 * @param {object}        s
 * @param {THREE.Material} matMadera
 * @param {THREE.Material} matCristal
 * @param {THREE.Material} matEntrepaño
 * @param {string}        tipoPuertas
 * @param {number}        numPuertas
 * @param {THREE.Material} matLateral — matCristal o matMadera según variante
 * @returns {number}
 */
function _construirCuerpo(viewer, yCuerpo, altoCuerpo, s, matMadera, matCristal, matEntrepaño, tipoPuertas, numPuertas, matLateral) {
    const em      = 1.8;   // grosor de montante lateral
    const yCentro = yCuerpo + altoCuerpo / 2;

    // Paneles laterales
    viewer._addBox(em, altoCuerpo, s.profundidad, matLateral,
        -s.ancho / 2 + em / 2, yCentro, 0);
    viewer._addBox(em, altoCuerpo, s.profundidad, matLateral,
         s.ancho / 2 - em / 2, yCentro, 0);

    // Panel trasero (siempre madera — soporte estructural)
    viewer._addBox(s.ancho, altoCuerpo, 1.5, matMadera,
        0, yCentro, -s.profundidad / 2 + 0.75);

    // Techo interior
    viewer._addBox(s.ancho, 1.5, s.profundidad, matMadera,
        0, yCuerpo + altoCuerpo - 0.75, 0);

    // Suelo interior
    viewer._addBox(s.ancho, 1.5, s.profundidad, matMadera,
        0, yCuerpo + 0.75, 0);

    // Perfiles de aluminio en las cuatro esquinas del cuerpo
    const gp = 2.0;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
        viewer._addBox(gp, altoCuerpo, gp, viewer._matAluminio,
            sx * (s.ancho / 2 - gp / 2 - 0.3),
            yCentro,
            sz * (s.profundidad / 2 - gp / 2 - 0.3));
    });

    // Entrepaños y LEDs
    const nE       = Math.min(s.entrepanos, 5);
    const espE     = altoCuerpo / (nE + 1);
    const ledColor   = s.ledTemp === 'frio' ? 0xd0eeff : 0xfff4cc;
    const ledPLColor = s.ledTemp === 'frio' ? 0xb0d8ff : 0xfff2cc;

    for (let i = 1; i <= nE; i++) {
        const yE = yCuerpo + espE * i;
        viewer._addBox(s.ancho - em * 2 - 1, 0.8, s.profundidad - 2,
            matEntrepaño, 0, yE, 0, false);

        const ledM = viewer._crearLEDStrip(s.ancho - 8, ledColor, s.ledActivo);
        ledM.position.set(0, yE - 0.7, s.profundidad / 2 - 3);
        viewer._vitrinaGroup.add(ledM);
        viewer._ledMeshes.push(ledM);

        if (s.ledActivo) {
            const pl = new THREE.PointLight(ledPLColor, 0.7, s.profundidad * 2, 2);
            pl.position.set(0, yE - 1.5, 0);
            viewer._vitrinaGroup.add(pl);
            viewer._ledPointLights.push(pl);
        }
    }

    // LED superior (bajo el techo interior)
    const ledTop = viewer._crearLEDStrip(s.ancho - 8, ledColor, s.ledActivo);
    ledTop.position.set(0, yCuerpo + altoCuerpo - 0.8, s.profundidad / 2 - 3);
    viewer._vitrinaGroup.add(ledTop);
    viewer._ledMeshes.push(ledTop);
    if (s.ledActivo) {
        const plTop = new THREE.PointLight(ledPLColor, 1.0, s.profundidad * 3, 2);
        plTop.position.set(0, yCuerpo + altoCuerpo - 2, 0);
        viewer._vitrinaGroup.add(plTop);
        viewer._ledPointLights.push(plTop);
    }

    // Puertas
    const altoPuerta = altoCuerpo - 2;
    const yPuerta    = yCuerpo + altoCuerpo / 2;
    const zFront     = s.profundidad / 2;

    if (tipoPuertas === 'abatible') {
        viewer._construirPuertasAbatibles(
            numPuertas, s.ancho, altoPuerta, yPuerta, zFront, 0.55, matCristal, s.apertura);
    } else {
        viewer._construirPuertasCorredizas(
            numPuertas, s.ancho, altoPuerta, yPuerta, zFront, 0.55, matCristal, s.apertura);
    }

    return altoCuerpo;
}

// ─── Constructores de Corona ──────────────────────────────────────────────────

const ConstructoresCorona = {

    /**
     * Sin corona — no añade geometría, consume 0 altura.
     * @returns {number} 0
     */
    ninguna(viewer, yCorona, altoCorona, s, matMadera) {
        return 0;
    },

    /**
     * Tapa plana sin vuelo — misma huella que el cuerpo, perfil mínimo.
     * @param {VitrinaViewer} viewer
     * @param {number}        yCorona
     * @param {number}        altoCorona
     * @param {object}        s
     * @param {THREE.Material} matMadera
     * @returns {number} Altura consumida
     */
    tapa_plana_madera(viewer, yCorona, altoCorona, s, matMadera) {
        viewer._addBox(s.ancho, altoCorona, s.profundidad, matMadera,
            0, yCorona + altoCorona / 2, 0);
        return altoCorona;
    },

    /**
     * Corona decorativa con vuelo lateral y frontal + moldura de aluminio.
     * @param {VitrinaViewer} viewer
     * @param {number}        yCorona
     * @param {number}        altoCorona
     * @param {object}        s
     * @param {THREE.Material} matMadera
     * @returns {number} Altura consumida
     */
    corona_madera(viewer, yCorona, altoCorona, s, matMadera) {
        const vuelo = 2.5;

        viewer._addBox(s.ancho + vuelo * 2, altoCorona, s.profundidad + vuelo, matMadera,
            0, yCorona + altoCorona / 2, vuelo / 2);

        // Perfil inferior de la corona (moldura)
        viewer._addBox(s.ancho + vuelo * 2 + 0.5, 1.5, s.profundidad + vuelo + 0.5,
            viewer._matAluminio,
            0, yCorona + 0.75, vuelo / 2);

        return altoCorona;
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export class VitrinaViewer {

    /**
     * @param {object}   options
     * @param {string}   options.containerId    — ID del div contenedor del canvas
     * @param {object}  [options.initialState]  — Sobreescribe valores de DEFAULT_STATE
     * @param {Function}[options.onPriceChange] — cb(precio:number) al cambiar precio
     * @param {boolean} [options.showStats]     — Muestra panel FPS + telemetría WebGL
     */
    constructor(options = {}) {
        const {
            containerId,
            initialState = {},
            onPriceChange = () => {},
            showStats = false,
        } = options;

        // Estado interno privado — pasar por reglas antes de guardar
        this.state = aplicarReglasDeManufactura({ ...DEFAULT_STATE, ...initialState });

        // Callback de precio
        this._onPriceChange = onPriceChange;

        // Referencias de animación
        this._puertas        = [];
        this._ledMeshes      = [];
        this._ledPointLights = [];
        this._targetAngles   = {};
        this._targetOffsets  = {};

        // ── Cachés de materiales (viven mientras la instancia vive) ──
        this._cacheMadera        = {};
        this._cacheCristal       = {};
        this._cacheEntrepaño     = null;
        this._cacheMaderaColorTex = {};

        // ── Inicializar escena ──
        this._initContainer(containerId);
        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initControls();
        this._initEnvironment();
        this._initLights();
        this._initFloor();
        this._initSharedGeometries();
        this._initSharedMaterials();
        this._initPostprocessing();
        if (showStats) this._initStats();

        // Grupo principal de la vitrina
        this._vitrinaGroup = new THREE.Group();
        this._scene.add(this._vitrinaGroup);

        // Primer build
        this._build();
        this._onPriceChange(calcularPrecio(this.state));

        // Resize
        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);

        // Loop
        this._clock  = new THREE.Clock();
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    // ─── API Pública ──────────────────────────────────────────────────────────

    /**
     * Actualiza el estado con un objeto parcial, aplica reglas de manufactura
     * y reconstruye la vitrina.
     * @param {object} newState — Sólo las claves que cambiaron
     */
    update(newState = {}) {
        // Fusionar y sanitizar en una sola operación
        this.state = aplicarReglasDeManufactura({ ...this.state, ...newState });

        // Ajuste de bloom según temperatura de LED
        if ('ledTemp' in newState) {
            this._bloomPass.strength = newState.ledTemp === 'frio' ? 0.45 : 0.30;
        }

        this._build();
        this._onPriceChange(calcularPrecio(this.state));
    }

    /** Libera todos los recursos WebGL y listeners. */
    destroy() {
        window.removeEventListener('resize', this._onResize);
        this._renderer.dispose();
        this._composer.dispose?.();
    }

    // ─── Inicialización ───────────────────────────────────────────────────────

    _initContainer(id) {
        this._container = document.getElementById(id);
        if (!this._container) throw new Error(`VitrinaViewer: contenedor #${id} no encontrado`);
        this._container.style.position = 'relative';
    }

    _initRenderer() {
        this._renderer = new THREE.WebGLRenderer({ antialias: true });
        this._renderer.setSize(this._container.clientWidth, this._container.clientHeight);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.shadowMap.enabled = true;
        this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this._renderer.toneMapping       = THREE.ACESFilmicToneMapping;
        this._renderer.toneMappingExposure = 1.3;
        this._renderer.outputColorSpace  = THREE.SRGBColorSpace;
        // Acumulación manual para telemetría multi-pass
        this._renderer.info.autoReset    = false;
        this._container.appendChild(this._renderer.domElement);
    }

    _initScene() {
        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0x1a1208);
        this._scene.fog = new THREE.FogExp2(0x1a1208, 0.0015);
    }

    _initCamera() {
        const { clientWidth: w, clientHeight: h } = this._container;
        const aspect = w / h;

        // FOV base pensado para contenedores ~cuadrados/verticales (configurador full).
        // En contenedores anchos y bajos (widgets embebidos) el frustum vertical
        // se vuelve muy estrecho y la vitrina se corta arriba/abajo.
        // Compensamos abriendo el FOV vertical cuando aspect > 1.3.
        const baseFov = 38;
        const fov = aspect > 1.3
            ? Math.min(baseFov * (aspect / 1.3), 58)
            : baseFov;

        this._camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 3000);
        this._camera.position.set(200, 150, 280);
    }

    _initControls() {
        this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.05;
        this._controls.minDistance   = 80;
        this._controls.maxDistance   = 700;
        this._controls.maxPolarAngle = Math.PI / 2 - 0.02;
        this._controls.target.set(0, 70, 0);
    }

    _initEnvironment() {
        const pmrem = new THREE.PMREMGenerator(this._renderer);
        pmrem.compileEquirectangularShader();
        const envRT = pmrem.fromScene(new RoomEnvironment(), 0.06);
        this._scene.environment = envRT.texture;
        pmrem.dispose();
    }

    _initLights() {
        // Ambiente
        this._scene.add(new THREE.AmbientLight(0xfff0d0, 0.28));

        // Key light
        const key = new THREE.DirectionalLight(0xfff5e0, 1.6);
        key.position.set(150, 280, 180);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near   = 10;
        key.shadow.camera.far    = 900;
        key.shadow.camera.left   = -250;
        key.shadow.camera.right  = 250;
        key.shadow.camera.top    = 300;
        key.shadow.camera.bottom = -200;
        key.shadow.bias   = -0.0004;
        key.shadow.radius = 6;
        this._scene.add(key);

        // Fill light
        const fill = new THREE.DirectionalLight(0xd0e8ff, 0.22);
        fill.position.set(-200, 60, -80);
        this._scene.add(fill);

        // Rim light
        const rim = new THREE.PointLight(0xffcc88, 0.9, 700);
        rim.position.set(0, 200, -240);
        this._scene.add(rim);

        // Spot focal (animado)
        this._spotFocal = new THREE.SpotLight(0xfff8e8, 2.0, 800, Math.PI / 8, 0.35, 1.5);
        this._spotFocal.position.set(0, 360, 60);
        this._spotFocal.castShadow = true;
        this._spotFocal.shadow.mapSize.set(1024, 1024);
        this._spotFocal.shadow.radius = 4;
        this._spotFocal.target.position.set(0, 60, 0);
        this._scene.add(this._spotFocal);
        this._scene.add(this._spotFocal.target);

        // Spots laterales
        const makeSpot = (x, tx) => {
            const s = new THREE.SpotLight(0xffe0c0, 0.7, 600, Math.PI / 10, 0.5, 2);
            s.position.set(x, 300, 40);
            s.target.position.set(tx, 60, 0);
            this._scene.add(s);
            this._scene.add(s.target);
        };
        makeSpot(-160, -60);
        makeSpot( 160,  60);
    }

    _initFloor() {
        // Suelo parquet
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(1200, 1200),
            new THREE.MeshStandardMaterial({
                map: this._crearTexturaParquet(),
                roughness: 0.45, metalness: 0.08, envMapIntensity: 0.4,
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this._scene.add(floor);

        // Plano de reflexión
        this._reflPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshStandardMaterial({
                color: 0xfff4d8, roughness: 0.1, metalness: 0.3,
                transparent: true, opacity: 0.08, depthWrite: false,
            })
        );
        this._reflPlane.rotation.x = -Math.PI / 2;
        this._reflPlane.position.y = 0.06;
        this._scene.add(this._reflPlane);

        // Pared trasera
        const wall = new THREE.Mesh(
            new THREE.PlaneGeometry(900, 500),
            new THREE.MeshStandardMaterial({
                color: 0x2a1e12, roughness: 0.85, metalness: 0, envMapIntensity: 0.1,
            })
        );
        wall.position.set(0, 250, -300);
        wall.receiveShadow = true;
        this._scene.add(wall);
    }

    _initSharedGeometries() {
        // Geometría caja unitaria reutilizada en toda la vitrina
        // CRÍTICO: _addBox escala esta geometría con mesh.scale.set() para
        // minimizar Draw Calls. No sustituir por instancias independientes.
        this._unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    }

    _initSharedMaterials() {
        this._matAluminio = new THREE.MeshStandardMaterial({
            color: 0xd2c8b8, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.2,
        });
    }

    _initPostprocessing() {
        const { clientWidth: w, clientHeight: h } = this._container;
        this._composer = new EffectComposer(this._renderer);
        this._composer.addPass(new RenderPass(this._scene, this._camera));

        this._bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.35, 0.80);
        this._composer.addPass(this._bloomPass);
        this._composer.addPass(new OutputPass());
    }

    _initStats() {
        // Panel FPS
        this._stats = new Stats();
        this._stats.showPanel(0);
        Object.assign(this._stats.dom.style, {
            position: 'absolute', top: '10px', left: '10px',
        });
        this._container.appendChild(this._stats.dom);

        // Panel telemetría WebGL
        this._infoDiv = document.createElement('div');
        Object.assign(this._infoDiv.style, {
            position: 'absolute', bottom: '10px', left: '10px',
            backgroundColor: 'rgba(26,18,8,0.85)', color: '#fff0d0',
            fontFamily: 'monospace', fontSize: '11px',
            padding: '10px', borderRadius: '5px',
            border: '1px solid #6b4226', pointerEvents: 'none', zIndex: '100',
        });
        this._container.appendChild(this._infoDiv);
    }

    // ─── Caché de materiales ─────────────────────────────────────────────────
    // Cada _get* devuelve una instancia existente o la crea una sola vez.
    // CRÍTICO: nunca llamar dispose() sobre estos materiales desde _build().

    _getMaterialMadera(key) {
        if (!this._cacheMadera[key]) this._cacheMadera[key] = this._crearMaterialMadera(key);
        return this._cacheMadera[key];
    }

    _getMaterialCristal(tipo) {
        if (!this._cacheCristal[tipo]) this._cacheCristal[tipo] = this._crearMaterialCristal(tipo);
        return this._cacheCristal[tipo];
    }

    _getMaterialEntrepaño() {
        if (!this._cacheEntrepaño) this._cacheEntrepaño = this._crearMaterialEntrepaño();
        return this._cacheEntrepaño;
    }

    // ─── Texturas procedurales ────────────────────────────────────────────────
    // CRÍTICO: estos métodos deben mantenerse intactos. Son el núcleo del
    // aspecto fotorrealista. No resumir, no simplificar.

    _crearTexturaParquet() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e1208';
        ctx.fillRect(0, 0, size, size);

        const numTabletes = 12;
        const tabH = size / numTabletes;
        for (let i = 0; i < numTabletes; i++) {
            const y = i * tabH;
            const shade = (Math.random() - 0.5) * 15;
            const r = 30 + shade, g = 18 + shade * 0.5, b = 8 + shade * 0.3;
            ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
            ctx.fillRect(0, y + 1, size, tabH - 2);
            for (let j = 0; j < 8; j++) {
                const vy = y + Math.random() * tabH;
                ctx.strokeStyle = `rgba(${Math.round(r+10)},${Math.round(g+5)},${Math.round(b+2)},0.25)`;
                ctx.lineWidth = 0.5 + Math.random();
                ctx.beginPath();
                ctx.moveTo(0, vy);
                ctx.lineTo(size, vy + (Math.random() - 0.5) * 3);
                ctx.stroke();
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 6);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    _crearTexturaMaderaColor(baseColorHex) {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const base = new THREE.Color(baseColorHex);
        ctx.fillStyle = `#${base.getHexString()}`;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 50; i++) {
            const y = Math.random() * size;
            const h = 0.8 + Math.random() * 4;
            const shade = (Math.random() - 0.5) * 0.2;
            const c = base.clone().offsetHSL(0, 0, shade);
            ctx.fillStyle = `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${0.2 + Math.random() * 0.4})`;
            ctx.fillRect(0, y, size, h);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    _crearTexturaMaderaNormal() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(128,128,255)';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 70; i++) {
            const y = Math.random() * size;
            const h = 0.5 + Math.random() * 2.5;
            const o = (Math.random() - 0.5) * 25;
            ctx.fillStyle = `rgb(${128 + o},${128 + o * 0.4},255)`;
            ctx.fillRect(0, y, size, h);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    _crearTexturaMaderaRoughness() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(145,145,145)';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 60; i++) {
            const y = Math.random() * size;
            const h = 0.5 + Math.random() * 3;
            const v = 90 + Math.round(Math.random() * 90);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(0, y, size, h);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // Las texturas de normal/roughness son compartidas entre todos los materiales
    // para evitar duplicados en VRAM.
    _getNormalTex() {
        if (!this._normalTex) this._normalTex = this._crearTexturaMaderaNormal();
        return this._normalTex;
    }

    _getRoughnessTex() {
        if (!this._roughnessTex) this._roughnessTex = this._crearTexturaMaderaRoughness();
        return this._roughnessTex;
    }

    _getMaderaColorTex(key, color) {
        if (!this._cacheMaderaColorTex[key])
            this._cacheMaderaColorTex[key] = this._crearTexturaMaderaColor(color);
        return this._cacheMaderaColorTex[key];
    }

    // ─── Fábricas de materiales ───────────────────────────────────────────────

    _crearMaterialMadera(key) {
        const def = ACABADOS_MADERA[key] || ACABADOS_MADERA.nogal;
        return new THREE.MeshStandardMaterial({
            map:          this._getMaderaColorTex(key, def.color),
            normalMap:    this._getNormalTex(),
            normalScale:  new THREE.Vector2(0.4, 0.4),
            roughnessMap: this._getRoughnessTex(),
            roughness:    def.roughness,
            metalness:    0.04,
            envMapIntensity: 0.7,
        });
    }

    _crearMaterialCristal(tipo) {
        const c = CONFIG_VIDRIO[tipo] || CONFIG_VIDRIO.claro;
        return new THREE.MeshPhysicalMaterial({
            color:        c.color,
            transmission: c.transmission,
            transparent:  true,
            opacity:      1,
            roughness:    c.roughness,
            metalness:    0,
            ior:          c.ior,
            thickness:    c.thickness,
            envMapIntensity: 1.2,
            clearcoat:    c.clearcoat,
            attenuationColor:    c.attenuationColor,
            attenuationDistance: c.attenuationDistance,
            side: THREE.DoubleSide,
        });
    }

    _crearMaterialEntrepaño() {
        return new THREE.MeshPhysicalMaterial({
            color:        0xeaf6ff,
            transmission: 0.85,
            transparent:  true,
            opacity:      1,
            roughness:    0.08,
            thickness:    0.3,
            ior:          1.45,
            attenuationColor:    new THREE.Color(0xd8eeff),
            attenuationDistance: 30,
            side: THREE.DoubleSide,
        });
    }

    // ─── Construcción principal ───────────────────────────────────────────────

    /**
     * Ensamblador de bloques paramétrico.
     *
     * Flujo:
     *  1. Leer receta del modelo activo.
     *  2. El estado ya está sanitizado por aplicarReglasDeManufactura() en update().
     *  3. Calcular alturas de cada bloque.
     *  4. Apilar bloques con acumulador yActual usando Strategy pattern.
     *  5. Colocar sombra de contacto dinámica.
     *
     * CRÍTICO: utiliza _unitBoxGeo escalado vía mesh.scale.set() —
     * nunca crear BoxGeometry independientes para piezas estructurales.
     */
    _build() {
        const s = this.state;
        this._limpiarGrupo();
        this._puertas        = [];
        this._ledMeshes      = [];
        this._ledPointLights = [];
        this._targetAngles   = {};
        this._targetOffsets  = {};

        // 1. Receta del modelo
        const receta = REGLAS_MODELOS[s.modelo] || REGLAS_MODELOS.modeloA;

        // 2. Altura de cada bloque
        //    (las reglas de manufactura ya aplicaron tipoPuertas/numPuertas en update())
        const altoBase   = receta.base === 'con_cajon' ? 40 : 30;
        const altoCorona = receta.corona === 'ninguna'          ?  0
                         : receta.corona === 'tapa_plana_madera' ? 5
                         : 10;
        const altoCuerpo = Math.max(s.alto - altoBase - altoCorona, 20);

        // Materiales
        const matMadera    = this._getMaterialMadera(s.acabado);
        const matCristal   = this._getMaterialCristal(s.tipoVidrio);
        const matEntrepaño = this._getMaterialEntrepaño();

        // 3. Acumulador de posición vertical
        let yActual = 0;

        // Bloque base — Strategy
        const estrategiaBase = ConstructoresBase[receta.base] || ConstructoresBase.estandar;
        yActual += estrategiaBase(this, yActual, altoBase, s, matMadera);

        // Bloque cuerpo — Strategy
        const estrategiaCuerpo = ConstructoresCuerpo[receta.cuerpo] || ConstructoresCuerpo.costados_madera;
        yActual += estrategiaCuerpo(
            this, yActual, altoCuerpo, s,
            matMadera, matCristal, matEntrepaño,
            s.tipoPuertas, s.numPuertas          // ya sanitizados en update()
        );

        // Bloque corona — Strategy
        const estrategiaCorona = ConstructoresCorona[receta.corona] || ConstructoresCorona.ninguna;
        estrategiaCorona(this, yActual, altoCorona, s, matMadera);

        // 4. Sombra de contacto dinámica
        this._reflPlane.scale.set(s.ancho * 1.4, s.profundidad * 1.7, 1);
    }

    // ─── Limpieza de escena ───────────────────────────────────────────────────

    _limpiarGrupo() {
        this._vitrinaGroup.traverse(obj => {
            if (!obj.isMesh) return;
            if (obj.geometry && obj.geometry !== this._unitBoxGeo) {
                obj.geometry.dispose(); // Libera VRAM de geometrías dinámicas
            }
            // NO: obj.material.dispose() — protegemos el caché de shaders
        });

        // Retirar PointLights de LEDs
        const luces = [];
        this._vitrinaGroup.traverse(obj => { if (obj.isPointLight) luces.push(obj); });
        luces.forEach(l => l.parent?.remove(l));

        while (this._vitrinaGroup.children.length > 0)
            this._vitrinaGroup.remove(this._vitrinaGroup.children[0]);
    }

    // ─── Helpers geométricos ──────────────────────────────────────────────────

    /**
     * Crea un Mesh usando _unitBoxGeo escalado.
     * CRÍTICO: este es el único método permitido para crear cajas estructurales.
     * Escalar _unitBoxGeo mantiene un solo draw call por material en toda la vitrina.
     */
    _addBox(w, h, d, mat, x, y, z, shadow = true) {
        const mesh = new THREE.Mesh(this._unitBoxGeo, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, y, z);
        if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
        this._vitrinaGroup.add(mesh);
        return mesh;
    }

    _crearLEDStrip(ancho, color, visible) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: new THREE.Color(color),
            emissiveIntensity: 1.8,
            roughness: 0.35,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.35, 1.0), mat);
        mesh.visible = visible;
        return mesh;
    }

    _crearTirador(anchoPuerta, lado) {
        const geo = new THREE.CylinderGeometry(0.38, 0.38, 10, 12);
        const mesh = new THREE.Mesh(geo, this._matAluminio);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set((anchoPuerta / 2 - 2.5) * (lado === 'izq' ? 1 : -1), 0, 0.6);
        return mesh;
    }

    // ─── Puertas abatibles ────────────────────────────────────────────────────

    _construirPuertasAbatibles(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura) {
        const anchoPuerta = ancho / numPuertas - 0.5;
        const anguloRad   = THREE.MathUtils.degToRad(apertura);

        for (let i = 0; i < numPuertas; i++) {
            const esIzq = i < numPuertas / 2;
            const dir   = esIzq ? 1 : -1;

            const xCentroBase = -ancho / 2 + anchoPuerta / 2 + i * (anchoPuerta + 0.5);
            const xBisagra    = xCentroBase - dir * anchoPuerta / 2;

            const pGroup = new THREE.Group();
            pGroup.position.set(xBisagra, yPuerta, zFront);

            // Panel de vidrio
            const pMesh = new THREE.Mesh(
                new THREE.BoxGeometry(anchoPuerta, altoPuerta, grosorV), matCristal);
            pMesh.position.set(dir * anchoPuerta / 2, 0, 0);
            pGroup.add(pMesh);

            // Tirador
            const tir = this._crearTirador(anchoPuerta, esIzq ? 'izq' : 'der');
            tir.position.x = dir * anchoPuerta / 2;
            pGroup.add(tir);

            // Marcos horizontales (arriba y abajo)
            [0.5, -0.5].forEach(sign => {
                const mh = new THREE.Mesh(
                    new THREE.BoxGeometry(anchoPuerta + 0.5, 1.0, grosorV + 0.3), this._matAluminio);
                mh.position.set(dir * anchoPuerta / 2, sign * altoPuerta / 2, 0);
                pGroup.add(mh);
            });

            // Marco lateral exterior
            const ml = new THREE.Mesh(
                new THREE.BoxGeometry(1.0, altoPuerta, grosorV + 0.3), this._matAluminio);
            ml.position.set(dir * anchoPuerta, 0, 0);
            pGroup.add(ml);

            this._vitrinaGroup.add(pGroup);

            const key = `p${i}`;
            pGroup.rotation.y = -dir * anguloRad;
            this._targetAngles[key] = -dir * anguloRad;
            this._puertas.push({ group: pGroup, key, dir, tipo: 'abatible' });
        }
    }

    // ─── Puertas corredizas ───────────────────────────────────────────────────

    _construirPuertasCorredizas(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura) {
        const anchoPuerta = ancho / numPuertas - 0.3;
        const offset = (apertura / 120) * anchoPuerta * 0.9;

        for (let i = 0; i < numPuertas; i++) {
            const esIzq   = i < numPuertas / 2;
            const dir     = esIzq ? -1 : 1;
            const zOffset = (i % 2 === 0) ? 0 : grosorV + 0.3;
            const xBase   = -ancho / 2 + anchoPuerta / 2 + i * (anchoPuerta + 0.3);

            const pGroup = new THREE.Group();
            pGroup.position.set(xBase + dir * offset, yPuerta, zFront + zOffset);

            const pMesh = new THREE.Mesh(
                new THREE.BoxGeometry(anchoPuerta, altoPuerta, grosorV), matCristal);
            pGroup.add(pMesh);

            // Tirador
            const tirGeo = new THREE.CylinderGeometry(0.38, 0.38, 10, 12);
            const tir    = new THREE.Mesh(tirGeo, this._matAluminio);
            tir.rotation.z = Math.PI / 2;
            tir.position.set((esIzq ? 1 : -1) * (anchoPuerta / 2 - 3), 0, 0.6);
            pGroup.add(tir);

            // Riel superior
            const riel = new THREE.Mesh(
                new THREE.BoxGeometry(anchoPuerta, 0.8, 0.8), this._matAluminio);
            riel.position.set(0, altoPuerta / 2 + 0.4, 0);
            pGroup.add(riel);

            this._vitrinaGroup.add(pGroup);

            const key = `p${i}`;
            this._targetOffsets[key] = xBase + dir * offset;
            this._puertas.push({ group: pGroup, key, xBase, dir, tipo: 'corrediza' });
        }
    }

    // ─── Resize ───────────────────────────────────────────────────────────────

    _onResize() {
        const w = this._container.clientWidth;
        const h = this._container.clientHeight;
        const aspect = w / h;

        const baseFov = 38;
        this._camera.fov = aspect > 1.3
            ? Math.min(baseFov * (aspect / 1.3), 58)
            : baseFov;

        this._camera.aspect = aspect;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h);
        this._composer.setSize(w, h);
    }

    // ─── Loop de animación ────────────────────────────────────────────────────

    _animate(timestamp) {
        requestAnimationFrame(this._animate);

        this._controls.update();

        // Flicker LED
        if (this.state.ledActivo) {
            const flicker = 1.7 + Math.sin(timestamp * 0.004) * 0.08 + Math.sin(timestamp * 0.013) * 0.04;
            this._ledMeshes.forEach(m => {
                if (m.material?.emissiveIntensity !== undefined)
                    m.material.emissiveIntensity = flicker;
            });
            const intensidad = this.state.ledTemp === 'frio' ? 0.65 : 0.75;
            this._ledPointLights.forEach(pl => {
                pl.intensity = intensidad + Math.sin(timestamp * 0.004) * 0.05;
            });
        }

        // Respiración del spot focal
        this._spotFocal.intensity = 2.0 + Math.sin(timestamp * 0.0007) * 0.05;

        // Render
        this._renderer.info.reset();
        this._composer.render();

        // Stats opcionales
        if (this._stats) {
            this._stats.update();
            const info = this._renderer.info;
            this._infoDiv.innerHTML =
                `<strong>TELEMETRÍA WEBGL:</strong><br/>
                 • Draw Calls: ${info.render.calls}<br/>
                 • Triángulos: ${info.render.triangles.toLocaleString()}<br/>
                 • Texturas en Memoria: ${info.memory.textures}<br/>
                 • Geometrías: ${info.memory.geometries}`;
        }
    }
}