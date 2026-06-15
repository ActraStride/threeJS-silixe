import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import Stats from 'three/addons/libs/stats.module.js';

const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);



// =====================================================================
// ESCENA BASE
// =====================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Fondo: degradado cálido oscuro tipo galería de madera
scene.background = new THREE.Color(0x1a1208);
scene.fog = new THREE.FogExp2(0x1a1208, 0.0015);

const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 3000);
camera.position.set(200, 150, 280);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// [AÑADIR ESTA LÍNEA] Desactiva el reinicio automático para que sume todos los pases de render
renderer.info.autoReset = false;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 80;
controls.maxDistance = 700;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 70, 0);


// Asegurar que el contenedor tenga posición relativa para que los elementos flotantes se alineen dentro de él
container.style.position = 'relative';

// 1. Inicializar Stats.js (Panel de FPS, MS y Memoria)
const stats = new Stats();
stats.showPanel(0); // 0: FPS, 1: MS, 2: MB (RAM)
stats.dom.style.position = 'absolute';
stats.dom.style.top = '10px';
stats.dom.style.left = '10px';
container.appendChild(stats.dom);

// 2. Crear panel personalizado para la telemetría de WebGL (Polígonos y Draw Calls)
const infoDiv = document.createElement('div');
infoDiv.style.position = 'absolute';
infoDiv.style.bottom = '10px';
infoDiv.style.left = '10px';
infoDiv.style.backgroundColor = 'rgba(26, 18, 8, 0.85)'; // Fondo oscuro a tono con tu galería
infoDiv.style.color = '#fff0d0';
infoDiv.style.fontFamily = 'monospace';
infoDiv.style.fontSize = '11px';
infoDiv.style.padding = '10px';
infoDiv.style.borderRadius = '5px';
infoDiv.style.border = '1px solid #6b4226';
infoDiv.style.pointerEvents = 'none'; // Evita interferir con los clics del mouse u OrbitControls
infoDiv.style.zIndex = '100';
container.appendChild(infoDiv);

// =====================================================================
// ENVIRONMENT MAP CÁLIDO
// =====================================================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.06);
scene.environment = envRT.texture;
pmremGenerator.dispose();

// =====================================================================
// ILUMINACIÓN TIPO GALERÍA CÁLIDA
// =====================================================================

// Ambiente muy suave, cálido
const ambientLight = new THREE.AmbientLight(0xfff0d0, 0.28);
scene.add(ambientLight);

// Key light — halógeno cálido desde arriba-izquierda
const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
keyLight.position.set(150, 280, 180);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 10;
keyLight.shadow.camera.far = 900;
keyLight.shadow.camera.left = -250;
keyLight.shadow.camera.right = 250;
keyLight.shadow.camera.top = 300;
keyLight.shadow.camera.bottom = -200;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.radius = 6;
scene.add(keyLight);

// Fill light — rebote frío muy suave desde la izquierda baja
const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.22);
fillLight.position.set(-200, 60, -80);
scene.add(fillLight);

// Rim light — cálido desde atrás
const rimLight = new THREE.PointLight(0xffcc88, 0.9, 700);
rimLight.position.set(0, 200, -240);
scene.add(rimLight);

// Spot focal central — simula spot de galería empotrado en techo
const spotFocal = new THREE.SpotLight(0xfff8e8, 2.0, 800, Math.PI / 8, 0.35, 1.5);
spotFocal.position.set(0, 360, 60);
spotFocal.castShadow = true;
spotFocal.shadow.mapSize.width = 1024;
spotFocal.shadow.mapSize.height = 1024;
spotFocal.shadow.radius = 4;
spotFocal.target.position.set(0, 60, 0);
scene.add(spotFocal);
scene.add(spotFocal.target);

// Spots laterales para profundidad — tipo galería con varios puntos
const spotIzq = new THREE.SpotLight(0xffe0c0, 0.7, 600, Math.PI / 10, 0.5, 2);
spotIzq.position.set(-160, 300, 40);
spotIzq.target.position.set(-60, 60, 0);
scene.add(spotIzq);
scene.add(spotIzq.target);

const spotDer = new THREE.SpotLight(0xffe0c0, 0.7, 600, Math.PI / 10, 0.5, 2);
spotDer.position.set(160, 300, 40);
spotDer.target.position.set(60, 60, 0);
scene.add(spotDer);
scene.add(spotDer.target);



// Caché para almacenar materiales y evitar duplicados
const cacheMaterialesMadera = {};
const cacheMaterialesCristal = {};
let cacheMaterialEntrepaño = null;

// Funciones optimizadas que buscan en el caché antes de crear uno nuevo
function obtenerMaterialMadera(key) {
    if (!cacheMaterialesMadera[key]) {
        cacheMaterialesMadera[key] = crearMaterialMadera(key);
    }
    return cacheMaterialesMadera[key];
}

function obtenerMaterialCristal(tipo) {
    if (!cacheMaterialesCristal[tipo]) {
        cacheMaterialesCristal[tipo] = crearMaterialCristal(tipo);
    }
    return cacheMaterialesCristal[tipo];
}

function obtenerMaterialEntrepaño() {
    if (!cacheMaterialEntrepaño) {
        cacheMaterialEntrepaño = crearMaterialEntrepaño();
    }
    return cacheMaterialEntrepaño;
}
// =====================================================================
// SUELO Y ENTORNO — PISO PARQUET / MADERA OSCURA
// =====================================================================
function crearTexturaParquet() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base madera oscura
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(0, 0, size, size);

    // Tablones horizontales
    const numTabletes = 12;
    const tabH = size / numTabletes;
    for (let i = 0; i < numTabletes; i++) {
        const y = i * tabH;
        const shade = (Math.random() - 0.5) * 15;
        const r = 30 + shade, g = 18 + shade * 0.5, b = 8 + shade * 0.3;
        ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        ctx.fillRect(0, y + 1, size, tabH - 2);

        // Veta interna
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

const floorGeo = new THREE.PlaneGeometry(1200, 1200);
const floorMat = new THREE.MeshStandardMaterial({
    map: crearTexturaParquet(),
    roughness: 0.45,
    metalness: 0.08,
    envMapIntensity: 0.4,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Plano de reflexión sutil (charco de luz bajo el mueble)
const reflGeo = new THREE.PlaneGeometry(1, 1);
const reflMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d8,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
});
const reflPlane = new THREE.Mesh(reflGeo, reflMat);
reflPlane.rotation.x = -Math.PI / 2;
reflPlane.position.y = 0.06;
scene.add(reflPlane);

// Pared trasera cálida — da contexto de "sala"
const wallGeo = new THREE.PlaneGeometry(900, 500);
const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2a1e12,
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.1,
});
const wall = new THREE.Mesh(wallGeo, wallMat);
wall.position.set(0, 250, -300);
wall.receiveShadow = true;
scene.add(wall);

// =====================================================================
// TEXTURA PROCEDURAL DE MADERA
// =====================================================================
function crearTexturaMaderaColor(baseColorHex) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
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

function crearTexturaMaderaNormal() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
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

function crearTexturaMaderaRoughness() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
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

const maderaNormalTex   = crearTexturaMaderaNormal();
const maderaRoughnessTex = crearTexturaMaderaRoughness();




// =====================================================================
// MATERIALES
// =====================================================================
const ACABADOS_MADERA = {
    nogal:  { color: 0x6b4226, roughness: 0.55 },
    blanco: { color: 0xf3f1ec, roughness: 0.30 },
    negro:  { color: 0x161616, roughness: 0.28 },
    encino: { color: 0xc8a978, roughness: 0.55 },
};

const maderaColorTexCache = {};
function getMaderaColorTex(key, color) {
    if (!maderaColorTexCache[key]) maderaColorTexCache[key] = crearTexturaMaderaColor(color);
    return maderaColorTexCache[key];
}

function crearMaterialMadera(key) {
    const def = ACABADOS_MADERA[key] || ACABADOS_MADERA.nogal;
    return new THREE.MeshStandardMaterial({
        map: getMaderaColorTex(key, def.color),
        normalMap: maderaNormalTex,
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughnessMap: maderaRoughnessTex,
        roughness: def.roughness,
        metalness: 0.04,
        envMapIntensity: 0.7,
    });
}

// Vidrio configurable
const CONFIG_VIDRIO = {
    claro: {
        color: 0xffffff, transmission: 0.95, roughness: 0.04,
        ior: 1.45, thickness: 0.5,
        attenuationColor: new THREE.Color(0xe8f4ff), attenuationDistance: 50,
        clearcoat: 0.3, tintOpacity: 0.0,
    },
    esmerilado: {
        color: 0xf0f0ee, transmission: 0.55, roughness: 0.55,
        ior: 1.45, thickness: 1.0,
        attenuationColor: new THREE.Color(0xf8f8f0), attenuationDistance: 80,
        clearcoat: 0.0, tintOpacity: 0.0,
    },
    tintado: {
        color: 0x5a8a60, transmission: 0.70, roughness: 0.08,
        ior: 1.45, thickness: 0.5,
        attenuationColor: new THREE.Color(0x608860), attenuationDistance: 30,
        clearcoat: 0.2, tintOpacity: 0.0,
    },
};

function crearMaterialCristal(tipo) {
    const c = CONFIG_VIDRIO[tipo] || CONFIG_VIDRIO.claro;
    return new THREE.MeshPhysicalMaterial({
        color: c.color,
        transmission: c.transmission,
        transparent: true,
        opacity: 1,
        roughness: c.roughness,
        metalness: 0,
        ior: c.ior,
        thickness: c.thickness,
        envMapIntensity: 1.2,
        clearcoat: c.clearcoat,
        attenuationColor: c.attenuationColor,
        attenuationDistance: c.attenuationDistance,
        side: THREE.DoubleSide,
    });
}

function crearMaterialEntrepaño() {
    return new THREE.MeshPhysicalMaterial({
        color: 0xeaf6ff,
        transmission: 0.85,
        transparent: true,
        opacity: 1,
        roughness: 0.08,
        thickness: 0.3,
        ior: 1.45,
        attenuationColor: new THREE.Color(0xd8eeff),
        attenuationDistance: 30,
        side: THREE.DoubleSide,
    });
}

const materialAluminio = new THREE.MeshStandardMaterial({
    color: 0xd2c8b8,
    metalness: 0.92,
    roughness: 0.22,
    envMapIntensity: 1.2,
});

// LED emissive — se actualiza según temperatura
function crearMaterialLED(temp) {
    const emColor = temp === 'frio' ? 0xd0eeff : 0xfff4cc;
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(emColor),
        emissiveIntensity: 1.8,
        roughness: 0.35,
    });
}

// =====================================================================
// GRUPO PRINCIPAL
// =====================================================================
const vitrinaGroup = new THREE.Group();
scene.add(vitrinaGroup);

// Referencias animación
let puertas = [];   // { group, baseX|baseAngle, lado: 'izq'|'der'|'izq2'|'der2', tipo: 'abatible'|'corrediza' }
let ledMeshes = []; // meshes con emissive para flicker
let ledPointLights = [];

// Targets de animación
let targetAngles = {};   // para abatibles: { key: ángulo }
let targetOffsets = {};  // para corredizas: { key: offset X }


function limpiarGrupo(grupo) {
    grupo.traverse((objeto) => {
        if (objeto.isMesh) {
            // 1. Liberar ÚNICAMENTE las geometrías
            // Como los cubos y cilindros de la vitrina son muy ligeros,
            // eliminarlos y recrearlos no afecta a los 60 FPS (no recompila shaders)
            if (objeto.geometry) {
                // Guarda de seguridad: Si implementó 'unitBoxGeo' globalmente en algún lado, 
                // evitamos destruirla para no romper el renderizado.
                const esCajaGlobal = typeof unitBoxGeo !== 'undefined' && objeto.geometry === unitBoxGeo;
                const esCilindroGlobal = typeof unitCylinderGeo !== 'undefined' && objeto.geometry === unitCylinderGeo;

                if (!esCajaGlobal && !esCilindroGlobal) {
                    objeto.geometry.dispose(); // Se elimina de forma segura de la GPU
                }
            }
            
            // [IMPORTANTE] NO llamamos a objeto.material.dispose()
            // De esta forma los materiales y shaders se quedan en caché.
        }
    });

    // 2. Retirar las luces de punto de los leds del grupo
    const luces = [];
    grupo.traverse((objeto) => {
        if (objeto.isPointLight) {
            luces.push(objeto);
        }
    });
    luces.forEach(l => {
        if (l.parent) l.parent.remove(l);
    });

    // 3. Vaciar el grupo físicamente de la escena
    while (grupo.children.length > 0) {
        grupo.remove(grupo.children[0]);
    }
}
// =====================================================================
// CONSTRUCCIÓN PARAMÉTRICA
// =====================================================================
function construirVitrina(p) {
    const { ancho, alto, profundidad, acabado, tipoVidrio, entrepanos,
            ledActivo, ledTemp, numPuertas, tipoPuertas, apertura } = p;

    // Limpiar
    limpiarGrupo(vitrinaGroup);
    puertas = [];
    ledMeshes = [];
    ledPointLights = [];
    targetAngles = {};
    targetOffsets = {};

    const matMadera    = obtenerMaterialMadera(acabado);
    const matCristal   = obtenerMaterialCristal(tipoVidrio);
    const matEntrepaño = obtenerMaterialEntrepaño();

    const altoBase   = 30;
    const altoCorona = 10;
    const altoCuerpo = Math.max(alto - altoBase - altoCorona, 20);

    // ── 1. BASE ──
    addBox(ancho, altoBase, profundidad, matMadera, 0, altoBase / 2, 0, true);

    // Zócalo metálico
    addBox(ancho - 4, 4, profundidad - 4,
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }),
        0, 2, 0, false);

    // ── 2. PANELES LATERALES opacos (madera) ──
    const espMadera = 1.8;
    addBox(espMadera, altoCuerpo, profundidad, matMadera,
        -ancho / 2 + espMadera / 2, altoBase + altoCuerpo / 2, 0, true);
    addBox(espMadera, altoCuerpo, profundidad, matMadera,
        ancho / 2 - espMadera / 2, altoBase + altoCuerpo / 2, 0, true);

    // Panel trasero
    addBox(ancho, altoCuerpo, 1.5, matMadera,
        0, altoBase + altoCuerpo / 2, -profundidad / 2 + 0.75, true);

    // Panel superior interior
    addBox(ancho, 1.5, profundidad, matMadera,
        0, altoBase + altoCuerpo - 0.75, 0, true);

    // Suelo interior
    addBox(ancho, 1.5, profundidad, matMadera,
        0, altoBase + 0.75, 0, true);

    // ── 3. VIDRIO FRONTAL (solo visible si hay puertas) — marco cristal lateral
    // El frente queda abierto — lo cierran las puertas

    // ── 4. CORONA ──
    addBox(ancho, altoCorona, profundidad, matMadera,
        0, alto - altoCorona / 2, 0, true);

    // ── 5. PERFILES DE ALUMINIO ──
    const gp = 2.0;
    const yPerfil = altoBase + altoCuerpo / 2;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
        addBox(gp, altoCuerpo, gp, materialAluminio,
            sx * (ancho / 2 - gp / 2 - 0.3),
            yPerfil,
            sz * (profundidad / 2 - gp / 2 - 0.3), true);
    });

    // ── 6. ENTREPAÑOS ──
    const nE = Math.min(entrepanos, 5);
    const espE = altoCuerpo / (nE + 1);
    const ledColor = ledTemp === 'frio' ? 0xd0eeff : 0xfff4cc;
    const ledPLColor = ledTemp === 'frio' ? 0xb0d8ff : 0xfff2cc;

    for (let i = 1; i <= nE; i++) {
        const yE = altoBase + espE * i;
        const entM = addBox(ancho - espMadera * 2 - 1, 0.8, profundidad - 2,
            matEntrepaño, 0, yE, 0, false);
        vitrinaGroup.add(entM);

        // Tira LED bajo entrepaño
        const ledM = crearLEDStrip(ancho - 8, ledColor, ledActivo);
        ledM.position.set(0, yE - 0.7, profundidad / 2 - 3);
        vitrinaGroup.add(ledM);
        ledMeshes.push(ledM);

        if (ledActivo) {
            const pl = new THREE.PointLight(ledPLColor, 0.7, profundidad * 2, 2);
            pl.position.set(0, yE - 1.5, 0);
            vitrinaGroup.add(pl);
            ledPointLights.push(pl);
        }
    }

    // LED superior
    const ledTop = crearLEDStrip(ancho - 8, ledColor, ledActivo);
    ledTop.position.set(0, alto - altoCorona - 0.8, profundidad / 2 - 3);
    vitrinaGroup.add(ledTop);
    ledMeshes.push(ledTop);
    if (ledActivo) {
        const plTop = new THREE.PointLight(ledPLColor, 1.0, profundidad * 3, 2);
        plTop.position.set(0, alto - altoCorona - 2, 0);
        vitrinaGroup.add(plTop);
        ledPointLights.push(plTop);
    }

    // ── 7. PUERTAS ──
    const altoPuerta = altoCuerpo - 2;
    const yPuerta = altoBase + altoCuerpo / 2;
    const zFront = profundidad / 2;
    const grosorV = 0.55;

    if (tipoPuertas === 'abatible') {
        construirPuertasAbatibles(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura);
    } else {
        construirPuertasCorredizas(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura);
    }

    // ── 8. SOMBRA CONTACTO ──
    reflPlane.scale.set(ancho * 1.4, profundidad * 1.7, 1);
}

// ──────────────────────────────────────────────────────────────────────
// HELPERS GEOMÉTRICOS
// ──────────────────────────────────────────────────────────────────────
function addBox(w, h, d, mat, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(unitBoxGeo, mat); // Usamos la misma geometría global de 1x1x1
    mesh.scale.set(w, h, d);                      // La escalamos al tamaño real deseado
    mesh.position.set(x, y, z);
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    vitrinaGroup.add(mesh);
    return mesh;
}

function crearLEDStrip(ancho, color, visible) {
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

function crearTirador(anchoPuerta, lado, matAl) {
    const tirGeo = new THREE.CylinderGeometry(0.38, 0.38, 10, 12);
    const tir = new THREE.Mesh(tirGeo, matAl);
    tir.rotation.z = Math.PI / 2;
    const offsetX = (anchoPuerta / 2 - 2.5) * (lado === 'izq' ? 1 : -1);
    tir.position.set(offsetX, 0, 0.6);
    return tir;
}

// ──────────────────────────────────────────────────────────────────────
// PUERTAS ABATIBLES — bisagra en el borde lateral, giro en Y
// ──────────────────────────────────────────────────────────────────────
function construirPuertasAbatibles(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura) {
    const divs = numPuertas;   // 2 o 4
    const anchoPuerta = ancho / divs - 0.5;
    const anguloRad = THREE.MathUtils.degToRad(apertura);

    for (let i = 0; i < divs; i++) {
        const esIzquierda = i < divs / 2;
        // Centro de la puerta cuando cerrada
        // La bisagra está en el borde exterior de cada puerta
        // Puertas izq abren hacia la izquierda (giran en +Y), der hacia derecha (-Y)
        const dir = esIzquierda ? 1 : -1;

        // Posición X del borde de bisagra (exterior de la puerta)
        const col = esIzquierda ? i : (divs - 1 - (i - divs / 2));
        const xBisagra = -ancho / 2 + (esIzquierda ? col : divs / 2 + (divs / 2 - 1 - col)) * (anchoPuerta + 0.5) + (esIzquierda ? 0 : ancho / 2);

        // Reajuste: distribuir uniformemente
        const xCentroBase = -ancho / 2 + anchoPuerta / 2 + i * (anchoPuerta + 0.5);
        const xBisagraReal = xCentroBase - dir * anchoPuerta / 2;

        const pGroup = new THREE.Group();
        pGroup.position.set(xBisagraReal, yPuerta, zFront);

        // La puerta cuelga del borde de bisagra → centro en +dir * anchoPuerta/2
        const pMesh = new THREE.Mesh(
            new THREE.BoxGeometry(anchoPuerta, altoPuerta, grosorV),
            matCristal
        );
        pMesh.position.set(dir * anchoPuerta / 2, 0, 0);
        pGroup.add(pMesh);

        // Tirador
        const tir = crearTirador(anchoPuerta, esIzquierda ? 'izq' : 'der', materialAluminio);
        tir.position.x = dir * anchoPuerta / 2;
        pGroup.add(tir);

        // Marco de aluminio alrededor de la puerta
        const marcoMat = materialAluminio;
        // Horizontal top/bottom
        [0.5, -0.5].forEach(sign => {
            const mh = new THREE.Mesh(new THREE.BoxGeometry(anchoPuerta + 0.5, 1.0, grosorV + 0.3), marcoMat);
            mh.position.set(dir * anchoPuerta / 2, sign * altoPuerta / 2, 0);
            pGroup.add(mh);
        });
        // Lateral exterior
        const ml = new THREE.Mesh(new THREE.BoxGeometry(1.0, altoPuerta, grosorV + 0.3), marcoMat);
        ml.position.set(dir * anchoPuerta, 0, 0);
        pGroup.add(ml);

        vitrinaGroup.add(pGroup);

        const key = `p${i}`;
        targetAngles[key] = -dir * anguloRad;
        pGroup.rotation.y = -dir * anguloRad;

        puertas.push({ group: pGroup, key, dir, tipo: 'abatible' });
    }
}

// ──────────────────────────────────────────────────────────────────────
// PUERTAS CORREDIZAS — se desplazan en X
// ──────────────────────────────────────────────────────────────────────
function construirPuertasCorredizas(numPuertas, ancho, altoPuerta, yPuerta, zFront, grosorV, matCristal, apertura) {
    const divs = numPuertas;
    const anchoPuerta = ancho / divs - 0.3;
    // apertura 0-120 → offset 0 a anchoPuerta*0.9
    const offset = (apertura / 120) * anchoPuerta * 0.9;

    for (let i = 0; i < divs; i++) {
        const esIzquierda = i < divs / 2;
        const dir = esIzquierda ? -1 : 1;
        const zOffset = (i % 2 === 0) ? 0 : grosorV + 0.3; // capas alternas

        const xBase = -ancho / 2 + anchoPuerta / 2 + i * (anchoPuerta + 0.3);

        const pGroup = new THREE.Group();
        pGroup.position.set(xBase + dir * offset, yPuerta, zFront + zOffset);

        const pMesh = new THREE.Mesh(
            new THREE.BoxGeometry(anchoPuerta, altoPuerta, grosorV),
            matCristal
        );
        pGroup.add(pMesh);

        // Tirador centrado
        const tirGeo = new THREE.CylinderGeometry(0.38, 0.38, 10, 12);
        const tir = new THREE.Mesh(tirGeo, materialAluminio);
        tir.rotation.z = Math.PI / 2;
        tir.position.set((esIzquierda ? 1 : -1) * (anchoPuerta / 2 - 3), 0, 0.6);
        pGroup.add(tir);

        // Riel superior
        const rielGeo = new THREE.BoxGeometry(anchoPuerta, 0.8, 0.8);
        const riel = new THREE.Mesh(rielGeo, materialAluminio);
        riel.position.set(0, altoPuerta / 2 + 0.4, 0);
        pGroup.add(riel);

        vitrinaGroup.add(pGroup);

        const key = `p${i}`;
        targetOffsets[key] = xBase + dir * offset;
        puertas.push({ group: pGroup, key, xBase, dir, tipo: 'corrediza' });
    }
}

// =====================================================================
// ESTADO
// =====================================================================
const state = {
    ancho: 100,
    alto: 120,
    profundidad: 50,
    acabado: 'nogal',
    tipoVidrio: 'claro',
    entrepanos: 1,
    ledActivo: false,
    ledTemp: 'calido',
    numPuertas: 2,
    tipoPuertas: 'abatible',
    apertura: 0,
};

construirVitrina(state);

// =====================================================================
// POSTPROCESADO
// =====================================================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.35, 0.55, 0.80
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// =====================================================================
// DOM
// =====================================================================
const anchoSlider    = document.getElementById('ancho-slider');
const altoSlider     = document.getElementById('alto-slider');
const profSlider     = document.getElementById('profundidad-slider');
const entrepanosSlider = document.getElementById('entrepanos-slider');
const aberturaSlider = document.getElementById('apertura-slider');

const anchoVal    = document.getElementById('ancho-val');
const altoVal     = document.getElementById('alto-val');
const profVal     = document.getElementById('profundidad-val');
const entrepanosVal = document.getElementById('entrepanos-val');
const aberturaVal = document.getElementById('apertura-val');
const precioVal   = document.getElementById('precio-val');

const ledToggle   = document.getElementById('led-toggle');
const ledTempRow  = document.getElementById('led-temp-row');

const acabadoBtns  = document.querySelectorAll('[data-acabado]');
const vidrioBtns   = document.querySelectorAll('[data-vidrio]');
const npuertasBtns = document.querySelectorAll('[data-npuertas]');
const tipoBtns     = document.querySelectorAll('[data-tipo]');
const ledTempBtns  = document.querySelectorAll('[data-temp]');

// =====================================================================
// PRECIO
// =====================================================================
function calcularPrecio() {
    let p = 1800;
    p += state.ancho * 14;
    p += state.alto * 18;
    p += state.profundidad * 6;
    p += state.entrepanos * 350;
    if (state.ledActivo) p += 650;
    if (state.tipoVidrio === 'esmerilado') p += 400;
    if (state.tipoVidrio === 'tintado')    p += 300;
    if (state.numPuertas === 4) p += 900;
    if (state.tipoPuertas === 'abatible') p += 200;
    return Math.round(p / 10) * 10;
}

function actualizarPrecio() {
    precioVal.textContent = `$${calcularPrecio().toLocaleString('es-MX')}`;
}

// =====================================================================
// REBUILD HELPER
// =====================================================================
function rebuild() {
    construirVitrina(state);
    actualizarPrecio();
}

// =====================================================================
// EVENTOS
// =====================================================================
function bindSlider(el, valEl, key, parse = parseInt) {
    el.addEventListener('input', () => {
        state[key] = parse(el.value);
        valEl.textContent = state[key];
        rebuild();
    });
}

bindSlider(anchoSlider,    anchoVal,    'ancho');
bindSlider(altoSlider,     altoVal,     'alto');
bindSlider(profSlider,     profVal,     'profundidad');
bindSlider(entrepanosSlider, entrepanosVal, 'entrepanos');

aberturaSlider.addEventListener('input', () => {
    state.apertura = parseInt(aberturaSlider.value);
    aberturaVal.textContent = state.apertura;
    rebuild();
});

// Selector acabado madera
acabadoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        acabadoBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.acabado = btn.dataset.acabado;
        rebuild();
    });
});

// Selector vidrio
vidrioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        vidrioBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tipoVidrio = btn.dataset.vidrio;
        rebuild();
    });
});

// Número de puertas
npuertasBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        npuertasBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.numPuertas = parseInt(btn.dataset.npuertas);
        rebuild();
    });
});

// Tipo de puerta
tipoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tipoBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tipoPuertas = btn.dataset.tipo;
        rebuild();
    });
});

// LED toggle
ledToggle.addEventListener('change', () => {
    state.ledActivo = ledToggle.checked;
    ledTempRow.classList.toggle('visible', state.ledActivo);
    rebuild();
});

// LED temperatura
ledTempBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        ledTempBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.ledTemp = btn.dataset.temp;

        // Actualizar bloom según temp: frío = más azul/blanco, cálido = suave
        if (state.ledTemp === 'frio') {
            bloomPass.strength = 0.45;
        } else {
            bloomPass.strength = 0.30;
        }
        rebuild();
    });
});

// =====================================================================
// RESIZE
// =====================================================================
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);
});

// =====================================================================
// LOOP
// =====================================================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const t = performance.now();

    controls.update();

    // Flicker LED
    if (state.ledActivo) {
        const flicker = 1.7 + Math.sin(t * 0.004) * 0.08 + Math.sin(t * 0.013) * 0.04;
        ledMeshes.forEach(m => {
            if (m.material && m.material.emissiveIntensity !== undefined) {
                m.material.emissiveIntensity = flicker;
            }
        });
        const intensidadPL = state.ledTemp === 'frio' ? 0.65 : 0.75;
        ledPointLights.forEach(pl => {
            pl.intensity = intensidadPL + Math.sin(t * 0.004) * 0.05;
        });
    }

    // Animar luz spot — movimiento suave muy sutil tipo respiración
    spotFocal.intensity = 2.0 + Math.sin(t * 0.0007) * 0.05;
    
    renderer.info.reset(); 

    // Renderizamos con el composer
    composer.render();
    
    stats.update();

    // [NUEVO] Actualizar telemetría de WebGL
    infoDiv.innerHTML = `
        <strong>TELEMETRÍA WEBGL:</strong><br/>
        • Draw Calls: ${renderer.info.render.calls}<br/>
        • Triángulos: ${renderer.info.render.triangles.toLocaleString()}<br/>
        • Texturas en Memoria: ${renderer.info.memory.textures}<br/>
        • Geometrías: ${renderer.info.memory.geometries}
    `;

}

actualizarPrecio();
animate();