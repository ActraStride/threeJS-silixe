import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

// =====================================================================
// CONFIGURACIÓN BÁSICA DE LA ESCENA
// =====================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1320);
scene.fog = new THREE.Fog(0x0d1320, 400, 900);

const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
camera.position.set(180, 140, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 80;
controls.maxDistance = 600;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.target.set(0, 70, 0);

// =====================================================================
// ILUMINACIÓN TIPO SHOWROOM
// =====================================================================
const ambientLight = new THREE.AmbientLight(0x8899bb, 0.35);
scene.add(ambientLight);

// Luz principal (key light)
const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
keyLight.position.set(180, 260, 160);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 10;
keyLight.shadow.camera.far = 800;
keyLight.shadow.camera.left = -300;
keyLight.shadow.camera.right = 300;
keyLight.shadow.camera.top = 300;
keyLight.shadow.camera.bottom = -300;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Luz de relleno (fill light) - tono frío para contraste
const fillLight = new THREE.DirectionalLight(0x6fb3ff, 0.5);
fillLight.position.set(-200, 120, -100);
scene.add(fillLight);

// Luz de contorno (rim light) trasera
const rimLight = new THREE.PointLight(0x4fd1ff, 0.8, 600);
rimLight.position.set(0, 180, -220);
scene.add(rimLight);

// Spot focal sobre la vitrina
const spotLight = new THREE.SpotLight(0xffffff, 1.2, 700, Math.PI / 7, 0.4, 1.2);
spotLight.position.set(0, 320, 80);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
spotLight.target.position.set(0, 60, 0);
scene.add(spotLight);
scene.add(spotLight.target);

// =====================================================================
// SUELO Y ENTORNO
// =====================================================================
const floorGeo = new THREE.PlaneGeometry(1000, 1000);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e18,
    roughness: 0.35,
    metalness: 0.15,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Rejilla sutil tipo "grid" cyberpunk
const grid = new THREE.GridHelper(800, 40, 0x2a3a55, 0x16203a);
grid.position.y = 0.05;
scene.add(grid);

// =====================================================================
// MATERIALES
// =====================================================================

// Paleta de acabados de madera/melamina
const ACABADOS_MADERA = {
    nogal:  { color: 0x6b4226, roughness: 0.55, name: 'Nogal' },
    blanco: { color: 0xf3f1ec, roughness: 0.35, name: 'Blanco' },
    negro:  { color: 0x161616, roughness: 0.30, name: 'Negro Mate' },
    encino: { color: 0xc8a978, roughness: 0.55, name: 'Encino' },
};

function crearMaterialMadera(key) {
    const def = ACABADOS_MADERA[key] || ACABADOS_MADERA.nogal;
    return new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: def.roughness,
        metalness: 0.05,
    });
}

// Vidrio realista con transmisión (requiere WebGL2, soportado por three r128 vía MeshPhysicalMaterial)
const materialCristal = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.95,
    transparent: true,
    opacity: 1,
    roughness: 0.05,
    metalness: 0,
    ior: 1.45,
    thickness: 0.5,
    envMapIntensity: 1.2,
    clearcoat: 0.3,
    side: THREE.DoubleSide,
});

const materialEntrepaño = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff,
    transmission: 0.85,
    transparent: true,
    opacity: 1,
    roughness: 0.08,
    thickness: 0.3,
    ior: 1.45,
    side: THREE.DoubleSide,
});

// Aluminio anodizado
const materialAluminio = new THREE.MeshStandardMaterial({
    color: 0xd8dadd,
    metalness: 0.95,
    roughness: 0.18,
});

// Tira LED (emissive)
const materialLED = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff4cc,
    emissiveIntensity: 1.6,
    roughness: 0.4,
});

// =====================================================================
// GRUPO PRINCIPAL DE LA VITRINA
// =====================================================================
const vitrinaGroup = new THREE.Group();
scene.add(vitrinaGroup);

// Referencias para animación de puertas
let puertaIzqGroup = null;
let puertaDerGroup = null;
let ledLights = [];

// =====================================================================
// CONSTRUCCIÓN PARAMÉTRICA DEL APARADOR
// =====================================================================
function construirVitrina(params) {
    const { ancho, alto, profundidad, acabado, entrepanos, ledActivo, puertasAbiertas } = params;

    // Limpiar grupo anterior
    while (vitrinaGroup.children.length > 0) {
        const obj = vitrinaGroup.children[0];
        vitrinaGroup.remove(obj);
    }
    ledLights = [];
    puertaIzqGroup = null;
    puertaDerGroup = null;

    const materialMadera = crearMaterialMadera(acabado);

    const altoBase = 30;
    const altoCorona = 10;
    const altoCristal = Math.max(alto - altoBase - altoCorona, 20);

    // -----------------------------------------------------------
    // 1. BASE (mueble inferior)
    // -----------------------------------------------------------
    const baseGeo = new THREE.BoxGeometry(ancho, altoBase, profundidad);
    const baseMesh = new THREE.Mesh(baseGeo, materialMadera);
    baseMesh.position.y = altoBase / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    vitrinaGroup.add(baseMesh);

    // Patas / zoclo
    const zocaloGeo = new THREE.BoxGeometry(ancho - 4, 4, profundidad - 4);
    const zocaloMesh = new THREE.Mesh(zocaloGeo, new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }));
    zocaloMesh.position.y = 2;
    zocaloMesh.castShadow = true;
    vitrinaGroup.add(zocaloMesh);

    // -----------------------------------------------------------
    // 2. CUERPO DE CRISTAL (carcasa exterior)
    // -----------------------------------------------------------
    const cristalGeo = new THREE.BoxGeometry(ancho - 1, altoCristal, profundidad - 1);
    const cristalMesh = new THREE.Mesh(cristalGeo, materialCristal);
    cristalMesh.position.y = altoBase + altoCristal / 2;
    cristalMesh.castShadow = false;
    vitrinaGroup.add(cristalMesh);

    // -----------------------------------------------------------
    // 3. CORONA (mueble superior)
    // -----------------------------------------------------------
    const coronaGeo = new THREE.BoxGeometry(ancho, altoCorona, profundidad);
    const coronaMesh = new THREE.Mesh(coronaGeo, materialMadera);
    coronaMesh.position.y = alto - altoCorona / 2;
    coronaMesh.castShadow = true;
    coronaMesh.receiveShadow = true;
    vitrinaGroup.add(coronaMesh);

    // -----------------------------------------------------------
    // 4. PERFILES DE ALUMINIO (4 esquinas verticales)
    // -----------------------------------------------------------
    const grosorPerfil = 2.2;
    const perfilGeo = new THREE.BoxGeometry(grosorPerfil, altoCristal, grosorPerfil);

    const posX = ancho / 2 - grosorPerfil / 2 - 0.5;
    const posZ = profundidad / 2 - grosorPerfil / 2 - 0.5;
    const posYPerfil = altoBase + altoCristal / 2;

    const esquinas = [
        { x: posX, z: posZ },
        { x: -posX, z: posZ },
        { x: posX, z: -posZ },
        { x: -posX, z: -posZ },
    ];

    esquinas.forEach((esq) => {
        const perfil = new THREE.Mesh(perfilGeo, materialAluminio);
        perfil.position.set(esq.x, posYPerfil, esq.z);
        perfil.castShadow = true;
        perfil.receiveShadow = true;
        vitrinaGroup.add(perfil);
    });

    // -----------------------------------------------------------
    // 5. ENTREPAÑOS DE CRISTAL (cantidad configurable)
    // -----------------------------------------------------------
    const numEntrepanos = Math.max(0, Math.min(entrepanos, 5));
    const espacioEntrepanos = altoCristal / (numEntrepanos + 1);

    for (let i = 1; i <= numEntrepanos; i++) {
        const entrepañoGeo = new THREE.BoxGeometry(ancho - 5, 0.8, profundidad - 5);
        const entrepaño = new THREE.Mesh(entrepañoGeo, materialEntrepaño);
        entrepaño.position.y = altoBase + espacioEntrepanos * i;
        entrepaño.castShadow = true;
        entrepaño.receiveShadow = true;
        vitrinaGroup.add(entrepaño);

        // ---------------------------------------------------
        // 5b. TIRA LED bajo cada entrepaño
        // ---------------------------------------------------
        const ledGeo = new THREE.BoxGeometry(ancho - 6, 0.4, 1.2);
        const ledStrip = new THREE.Mesh(ledGeo, materialLED.clone());
        ledStrip.position.set(0, entrepaño.position.y - 0.6, profundidad / 2 - 2);
        ledStrip.visible = ledActivo;
        vitrinaGroup.add(ledStrip);
        ledLights.push(ledStrip);

        // Punto de luz real para el efecto LED
        if (ledActivo) {
            const pl = new THREE.PointLight(0xfff2cc, 0.6, profundidad * 1.5, 2);
            pl.position.copy(ledStrip.position);
            pl.position.y -= 1;
            vitrinaGroup.add(pl);
            ledLights.push(pl);
        }
    }

    // Tira LED superior (bajo la corona) — siempre presente si LED activo
    const ledTopGeo = new THREE.BoxGeometry(ancho - 6, 0.4, 1.2);
    const ledTop = new THREE.Mesh(ledTopGeo, materialLED.clone());
    ledTop.position.set(0, alto - altoCorona - 0.5, profundidad / 2 - 2);
    ledTop.visible = ledActivo;
    vitrinaGroup.add(ledTop);
    ledLights.push(ledTop);
    if (ledActivo) {
        const plTop = new THREE.PointLight(0xfff2cc, 0.8, profundidad * 2, 2);
        plTop.position.copy(ledTop.position);
        plTop.position.y -= 1;
        vitrinaGroup.add(plTop);
        ledLights.push(plTop);
    }

    // -----------------------------------------------------------
    // 6. PUERTAS CORREDIZAS DE VIDRIO (frontales)
    // -----------------------------------------------------------
    const grosorVidrioPuerta = 0.6;
    const altoPuerta = altoCristal - 2;
    const anchoPuerta = (ancho / 2) - 1.5;

    const puertaGeo = new THREE.BoxGeometry(anchoPuerta, altoPuerta, grosorVidrioPuerta);

    // Puerta izquierda
    puertaIzqGroup = new THREE.Group();
    const puertaIzq = new THREE.Mesh(puertaGeo, materialCristal);
    puertaIzq.castShadow = false;
    // tirador
    const tiradorGeo = new THREE.CylinderGeometry(0.4, 0.4, 12, 12);
    const tiradorIzq = new THREE.Mesh(tiradorGeo, materialAluminio);
    tiradorIzq.rotation.z = Math.PI / 2;
    tiradorIzq.position.set(anchoPuerta / 2 - 2, 0, grosorVidrioPuerta);
    puertaIzqGroup.add(puertaIzq, tiradorIzq);
    puertaIzqGroup.position.set(-anchoPuerta / 2, posYPerfil, profundidad / 2 - 1.5);
    vitrinaGroup.add(puertaIzqGroup);

    // Puerta derecha
    puertaDerGroup = new THREE.Group();
    const puertaDer = new THREE.Mesh(puertaGeo, materialCristal);
    puertaDer.castShadow = false;
    const tiradorDer = new THREE.Mesh(tiradorGeo, materialAluminio);
    tiradorDer.rotation.z = Math.PI / 2;
    tiradorDer.position.set(-(anchoPuerta / 2 - 2), 0, grosorVidrioPuerta);
    puertaDerGroup.add(puertaDer, tiradorDer);
    puertaDerGroup.position.set(anchoPuerta / 2, posYPerfil, profundidad / 2 - 1.5);
    vitrinaGroup.add(puertaDerGroup);

    // Estado inicial de apertura (offsets aplicados en updatePuertas)
    actualizarPosicionPuertas(puertasAbiertas, anchoPuerta);
}

let targetPuertaIzqX = 0;
let targetPuertaDerX = 0;

// Anima/posiciona las puertas corredizas
function actualizarPosicionPuertas(abiertas, anchoPuertaActual) {
    if (!puertaIzqGroup || !puertaDerGroup) return;

    // Guardar posiciones base (cerradas) la primera vez que se construye
    if (puertaIzqGroup.userData.baseX === undefined) {
        puertaIzqGroup.userData.baseX = puertaIzqGroup.position.x;
        puertaDerGroup.userData.baseX = puertaDerGroup.position.x;
        // Inicializar posición actual a la base para que no "salten" al primer frame
        puertaIzqGroup.position.x = puertaIzqGroup.userData.baseX;
        puertaDerGroup.position.x = puertaDerGroup.userData.baseX;
    }

    const desplazamiento = abiertas ? anchoPuertaActual * 0.85 : 0;
    targetPuertaIzqX = puertaIzqGroup.userData.baseX - desplazamiento;
    targetPuertaDerX = puertaDerGroup.userData.baseX + desplazamiento;
}

// =====================================================================
// ESTADO INICIAL DE PARÁMETROS
// =====================================================================
const state = {
    ancho: 100,
    alto: 120,
    profundidad: 50,
    acabado: 'nogal',
    entrepanos: 1,
    ledActivo: false,
    puertasAbiertas: false,
};

construirVitrina(state);

// =====================================================================
// REFERENCIAS DOM
// =====================================================================
const anchoSlider = document.getElementById('ancho-slider');
const altoSlider = document.getElementById('alto-slider');
const profSlider = document.getElementById('profundidad-slider');
const entrepanosSlider = document.getElementById('entrepanos-slider');

const anchoVal = document.getElementById('ancho-val');
const altoVal = document.getElementById('alto-val');
const profVal = document.getElementById('profundidad-val');
const entrepanosVal = document.getElementById('entrepanos-val');

const precioVal = document.getElementById('precio-val');
const ledToggle = document.getElementById('led-toggle');
const puertasToggle = document.getElementById('puertas-toggle');
const acabadoButtons = document.querySelectorAll('.acabado-btn');

// =====================================================================
// CÁLCULO DE PRECIO ESTIMADO
// =====================================================================
function calcularPrecio() {
    const { ancho, alto, profundidad, entrepanos, ledActivo, puertasAbiertas } = state;

    let precio = 1800;
    precio += ancho * 14;
    precio += alto * 18;
    precio += profundidad * 6;
    precio += entrepanos * 350;
    if (ledActivo) precio += 650;
    // puertas siempre incluidas en este modelo, sin costo extra por abrir/cerrar

    return Math.round(precio / 10) * 10;
}

function actualizarPrecio() {
    const precio = calcularPrecio();
    precioVal.textContent = `$${precio.toLocaleString('es-MX')}`;
}

// =====================================================================
// MANEJO DE EVENTOS
// =====================================================================
function actualizarParametros() {
    state.ancho = parseInt(anchoSlider.value);
    state.alto = parseInt(altoSlider.value);
    state.profundidad = parseInt(profSlider.value);
    state.entrepanos = parseInt(entrepanosSlider.value);

    anchoVal.textContent = state.ancho;
    altoVal.textContent = state.alto;
    profVal.textContent = state.profundidad;
    entrepanosVal.textContent = state.entrepanos;

    construirVitrina(state);
    actualizarPrecio();
}

anchoSlider.addEventListener('input', actualizarParametros);
altoSlider.addEventListener('input', actualizarParametros);
profSlider.addEventListener('input', actualizarParametros);
entrepanosSlider.addEventListener('input', actualizarParametros);

// Selector de acabado (botones de color)
acabadoButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        acabadoButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.acabado = btn.dataset.acabado;
        construirVitrina(state);
        actualizarPrecio();
    });
});

// Toggle LED
ledToggle.addEventListener('click', () => {
    state.ledActivo = !state.ledActivo;
    ledToggle.classList.toggle('active', state.ledActivo);
    ledToggle.textContent = state.ledActivo ? 'Iluminación LED: ON' : 'Iluminación LED: OFF';
    construirVitrina(state);
    actualizarPrecio();
});

// Toggle Puertas (animado)
puertasToggle.addEventListener('click', () => {
    state.puertasAbiertas = !state.puertasAbiertas;
    puertasToggle.classList.toggle('active', state.puertasAbiertas);
    puertasToggle.textContent = state.puertasAbiertas ? 'Puertas: Abiertas' : 'Puertas: Cerradas';

    const anchoPuertaActual = (state.ancho / 2) - 1.5;
    actualizarPosicionPuertas(state.puertasAbiertas, anchoPuertaActual);
});

// =====================================================================
// REDIMENSIONADO DE VENTANA
// =====================================================================
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// =====================================================================
// BUCLE DE ANIMACIÓN
// =====================================================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    controls.update();

    // Animación suave de apertura/cierre de puertas
    if (puertaIzqGroup && puertaDerGroup) {
        puertaIzqGroup.position.x += (targetPuertaIzqX - puertaIzqGroup.position.x) * Math.min(delta * 6, 1);
        puertaDerGroup.position.x += (targetPuertaDerX - puertaDerGroup.position.x) * Math.min(delta * 6, 1);
    }

    // Parpadeo sutil del LED para sensación "encendido"
    if (state.ledActivo) {
        const flicker = 1.5 + Math.sin(performance.now() * 0.005) * 0.1;
        ledLights.forEach((l) => {
            if (l.material && l.material.emissiveIntensity !== undefined) {
                l.material.emissiveIntensity = flicker;
            }
        });
    }

    renderer.render(scene, camera);
}

actualizarPrecio();
animate();