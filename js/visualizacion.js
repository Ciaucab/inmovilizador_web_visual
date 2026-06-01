// =============================================
// CONFIGURACIÓN MQTT (idéntica a la principal)
// =============================================
const MQTT_BROKER = 'u112ff97.ala.us-east-1.emqxsl.com';
const MQTT_PORT = 8084;
const MQTT_USER = 'esp';
const MQTT_PASS = 'esp2026';
const MQTT_TOPIC_STATUS = 'inmovilizador/status';

// =============================================
// Elementos UI
// =============================================
const estadoTexto = document.getElementById('estado-texto');
const estadoLed = document.getElementById('estado-led');
const container = document.getElementById('three-container');

// =============================================
// Variables Three.js
// =============================================
let scene, camera, renderer, controls;
let modeloInyectores;
let sprayParticles = [];
let animationActive = false;  // se actualizará al recibir el primer estado
let animationId;

// =============================================
// Conexión MQTT
// =============================================
function conectarMQTT() {
  const mqttClient = mqtt.connect(`wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`, {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: 'web_viz_' + Math.random().toString(16).substr(2, 8),
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log('✅ Conectado a MQTT para visualización');
    mqttClient.subscribe(MQTT_TOPIC_STATUS);
    estadoTexto.textContent = 'Esperando estado...';
  });

  mqttClient.on('message', (topic, message) => {
    if (topic === MQTT_TOPIC_STATUS) {
      const status = message.toString().trim();
      console.log('📩 Estado recibido:', status);
      animationActive = (status === 'OFF'); // OFF = no inmovilizado
      actualizarUI();
    }
  });

  mqttClient.on('error', (err) => {
    console.error('❌ Error MQTT:', err);
    estadoTexto.textContent = 'Error de conexión';
    estadoLed.className = 'led red';
  });
}

function actualizarUI() {
  if (animationActive) {
    estadoTexto.textContent = 'Funcionando';
    estadoLed.className = 'led';  // verde
  } else {
    estadoTexto.textContent = 'Inmovilizado';
    estadoLed.className = 'led red';
  }
}

// =============================================
// Three.js
// =============================================
function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Luces
  scene.add(new THREE.AmbientLight(0x606060));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(1, 3, 2);
  scene.add(dirLight);

  // Cargar modelo GLB
  const loader = new THREE.GLTFLoader();
  loader.load(
    'inyectores.glb',   // Ruta del archivo en la raíz del repositorio
    (gltf) => {
      modeloInyectores = gltf.scene;
      modeloInyectores.scale.set(0.8, 0.8, 0.8);
      modeloInyectores.position.set(0, -0.3, 0);
      scene.add(modeloInyectores);
      setupSprays();
      console.log('✅ Modelo 3D cargado');
    },
    (xhr) => {
      console.log(`📦 Cargando modelo... ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
    },
    (error) => {
      console.error('❌ Error al cargar el modelo:', error);
    }
  );

  // Controles de órbita
  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.update();
  }

  animate();
}

function setupSprays() {
  // Limpiar anteriores si los hubiera
  sprayParticles.forEach(s => scene.remove(s));
  sprayParticles = [];

  // Posiciones de los 4 inyectores (ajusta según tu modelo)
  const posiciones = [
    { x: -1.2, y: -0.7, z: 0.3 },
    { x: -0.4, y: -0.7, z: 0.3 },
    { x:  0.4, y: -0.7, z: 0.3 },
    { x:  1.2, y: -0.7, z: 0.3 }
  ];

  posiciones.forEach(pos => {
    // Grupo de partículas
    const sprayGroup = new THREE.Group();
    sprayGroup.position.set(pos.x, pos.y, pos.z);
    for (let i = 0; i < 15; i++) {
      const droplet = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x00aaff })
      );
      droplet.position.set(
        (Math.random() - 0.5) * 0.3,
        -Math.random() * 0.6,
        (Math.random() - 0.5) * 0.3
      );
      sprayGroup.add(droplet);
    }
    scene.add(sprayGroup);
    sprayParticles.push(sprayGroup);

    // Indicador luminoso en la punta del inyector
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8
      })
    );
    indicator.position.set(pos.x, pos.y + 0.4, pos.z);
    scene.add(indicator);
    sprayGroup.userData.indicator = indicator;
  });
}

function animate() {
  animationId = requestAnimationFrame(animate);

  sprayParticles.forEach(spray => {
    if (animationActive) {
      spray.visible = true;
      // Animar gotas
      spray.children.forEach(droplet => {
        droplet.position.y -= 0.02;
        if (droplet.position.y < -0.8) {
          droplet.position.y = -0.05;
          droplet.position.x = (Math.random() - 0.5) * 0.3;
          droplet.position.z = (Math.random() - 0.5) * 0.3;
        }
      });
      // Indicador verde
      if (spray.userData.indicator) {
        spray.userData.indicator.material.color.set(0x00ff00);
        spray.userData.indicator.material.emissive.set(0x00ff00);
      }
    } else {
      spray.visible = false;
      // Indicador rojo
      if (spray.userData.indicator) {
        spray.userData.indicator.material.color.set(0xff0000);
        spray.userData.indicator.material.emissive.set(0xff0000);
      }
    }
  });

  if (controls) controls.update();
  renderer.render(scene, camera);
}

// Redimensionar al cambiar tamaño de ventana
window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
});

// =============================================
// Iniciar todo
// =============================================
window.addEventListener('DOMContentLoaded', () => {
  conectarMQTT();
  initThreeJS();
});