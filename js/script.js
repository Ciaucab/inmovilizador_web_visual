// ==================================================
// CONFIGURACIÓN DEL ESP32 (BLE + MQTT EMQX Cloud)
// ==================================================
const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// Datos de EMQX Cloud (ya reemplazados con tus valores)
const MQTT_BROKER = 'u112ff97.ala.us-east-1.emqxsl.com';
const MQTT_PORT = 8084;               // Puerto WebSocket seguro (WSS)
const MQTT_USER = 'esp';
const MQTT_PASS = 'esp2026';
const MQTT_TOPIC_COMMAND = 'inmovilizador/command';

// ==================================================
// PREGUNTAS DEL CUESTIONARIO (con imágenes de Dropbox)
// ==================================================
const questions = [
  {
    title: 'Código OBD2 más común en inyectores',
    image: 'https://www.dropbox.com/scl/fi/prtwkc8w32xtrmhz8fgth/93325238-BRUCK_6d428a9e-9b16-4cdf-800e-f5bbb5975691_1024x1024.jpg?rlkey=u1tstjps9mgloh2jvrozlcm98&st=z1a8sdkn&raw=1',
    options: ['P0201', 'P0301', 'P0171', 'P0420'],
    correct: 0,
    feedback: 'El código P0201 indica falla en el circuito del inyector del cilindro 1. Los códigos P020X están relacionados con los inyectores.'
  },
  {
    title: 'Código OBD2 más común en bomba de combustible',
    image: 'https://www.dropbox.com/scl/fi/4q9y0gfqd6zm89v7lj2ml/41tAHzcY7XL._AC_SX522_.jpg?rlkey=blarofue9ls4sifq52t3pnrif&st=s6plbr90&raw=1',
    options: ['P0230', 'P0231', 'P0232', 'P0627'],
    correct: 0,
    feedback: 'El código P0230 es el más común para falla en el circuito primario de la bomba de combustible.'
  }
];

// ==================================================
// VARIABLES GLOBALES DE UI
// ==================================================
let connectionMode = null;   // 'ble' o 'mqtt'
let bleDevice = null;
let bleCharacteristic = null;
let mqttClient = null;

let currentAction = null;    // 'activar' o 'desactivar'
let currentQuestion = 0;
let selectedOption = null;

const screens = {
  connection: document.getElementById('connection-screen'),
  main: document.getElementById('main-screen'),
  quiz: document.getElementById('quiz-screen'),
  command: document.getElementById('command-screen')
};

const statusBar = document.getElementById('status-bar');
const elements = {
  btnBle: document.getElementById('btn-ble'),
  btnWifi: document.getElementById('btn-wifi'),
  btnActivar: document.getElementById('btn-activar'),
  btnDesactivar: document.getElementById('btn-desactivar'),
  btnDisconnect: document.getElementById('btn-disconnect'),
  quizTitle: document.getElementById('quiz-title'),
  quizImage: document.getElementById('quiz-image'),
  optionsContainer: document.getElementById('options-container'),
  btnEvaluate: document.getElementById('btn-evaluate'),
  btnRetry: document.getElementById('btn-retry'),
  feedback: document.getElementById('feedback'),
  commandMessage: document.getElementById('command-message'),
  btnSendCommand: document.getElementById('btn-send-command'),
  btnBackMain: document.getElementById('btn-back-main')
};

// ==================================================
// FUNCIONES DE NAVEGACIÓN
// ==================================================
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// ==================================================
// CONEXIÓN BLE
// ==================================================
async function connectBLE() {
  try {
    statusBar.textContent = 'Estado: Buscando dispositivo BLE...';
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE_UUID] }]
    });
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    bleCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
    connectionMode = 'ble';
    statusBar.textContent = 'Estado: Conectado por Bluetooth';
    bleDevice.addEventListener('gattserverdisconnected', onDisconnect);
    showScreen('main');
  } catch (error) {
    alert('Error al conectar Bluetooth: ' + error.message);
    statusBar.textContent = 'Estado: Desconectado';
  }
}

// ==================================================
// CONEXIÓN MQTT (Internet) – CORREGIDO CON /mqtt
// ==================================================
function connectMQTT() {
  statusBar.textContent = 'Estado: Conectando al servidor...';

  const options = {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: 'web_' + Math.random().toString(16).substr(2, 8),
    clean: true,
    keepalive: 60,
    reconnectPeriod: 3000,
    connectTimeout: 10000
  };

  // **** AQUÍ ESTABA EL FALLO: FALTA EL PATH /mqtt ****
  mqttClient = mqtt.connect(`wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`, options);

  mqttClient.on('connect', () => {
    connectionMode = 'mqtt';
    statusBar.textContent = 'Estado: Conectado por Internet (MQTT)';
    showScreen('main');
  });

  mqttClient.on('error', (err) => {
    console.error('Error MQTT:', err);
    alert('Error al conectar MQTT: ' + err.message);
    statusBar.textContent = 'Estado: Error de conexión';
    mqttClient = null;
  });

  mqttClient.on('close', () => {
    if (connectionMode === 'mqtt') onDisconnect();
  });
}

function onDisconnect() {
  connectionMode = null;
  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
  }
  bleDevice = null;
  bleCharacteristic = null;
  if (mqttClient) {
    mqttClient.end(true);
    mqttClient = null;
  }
  statusBar.textContent = 'Estado: Desconectado';
  showScreen('connection');
}

function sendCommand(command) {
  if (connectionMode === 'ble' && bleCharacteristic) {
    const encoder = new TextEncoder();
    bleCharacteristic.writeValue(encoder.encode(command))
      .catch(e => alert('Error al enviar comando BLE: ' + e));
  } else if (connectionMode === 'mqtt' && mqttClient) {
    mqttClient.publish(MQTT_TOPIC_COMMAND, command, { qos: 1 }, (err) => {
      if (err) alert('Error al enviar comando MQTT: ' + err.message);
    });
  } else {
    alert('No hay conexión activa. Reconecte.');
  }
}

// ==================================================
// LÓGICA DEL CUESTIONARIO (sin cambios)
// ==================================================
function startQuiz(action) {
  currentAction = action;
  currentQuestion = 0;
  selectedOption = null;
  showScreen('quiz');
  loadQuestion(currentQuestion);
}

function loadQuestion(index) {
  const q = questions[index];
  elements.quizTitle.textContent = q.title;
  elements.quizImage.src = q.image;

  elements.optionsContainer.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => selectOption(i, btn));
    elements.optionsContainer.appendChild(btn);
  });

  selectedOption = null;
  elements.btnEvaluate.classList.remove('hidden');
  elements.btnRetry.classList.add('hidden');
  elements.feedback.classList.add('hidden');
  elements.feedback.textContent = '';
}

function selectOption(index, button) {
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
  selectedOption = index;
}

function evaluateAnswer() {
  if (selectedOption === null) {
    alert('Selecciona una opción antes de evaluar.');
    return;
  }
  const q = questions[currentQuestion];
  if (selectedOption === q.correct) {
    if (currentQuestion < questions.length - 1) {
      currentQuestion++;
      loadQuestion(currentQuestion);
    } else {
      showCommandScreen();
    }
  } else {
    elements.feedback.textContent = q.feedback;
    elements.feedback.classList.remove('hidden');
    elements.btnEvaluate.classList.add('hidden');
    elements.btnRetry.classList.remove('hidden');
  }
}

function retryQuestion() {
  selectedOption = null;
  elements.btnEvaluate.classList.remove('hidden');
  elements.btnRetry.classList.add('hidden');
  elements.feedback.classList.add('hidden');
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
}

function showCommandScreen() {
  showScreen('command');
  if (currentAction === 'activar') {
    elements.commandMessage.textContent = 'Listo para inmovilizar';
    elements.btnSendCommand.textContent = 'Inmovilizar';
    elements.btnSendCommand.className = 'big-btn action';
  } else {
    elements.commandMessage.textContent = 'Listo para desactivar inmovilizador';
    elements.btnSendCommand.textContent = 'Desactivar inmovilizador';
    elements.btnSendCommand.className = 'big-btn';
  }
}

function executeCommand() {
  const cmd = (currentAction === 'activar') ? 'IMMOBILIZE_ON' : 'IMMOBILIZE_OFF';
  sendCommand(cmd);
  alert('Comando enviado.');
  showScreen('main');
}

// ==================================================
// EVENT LISTENERS
// ==================================================
elements.btnBle.addEventListener('click', connectBLE);
elements.btnWifi.addEventListener('click', connectMQTT);
elements.btnDisconnect.addEventListener('click', onDisconnect);
elements.btnActivar.addEventListener('click', () => startQuiz('activar'));
elements.btnDesactivar.addEventListener('click', () => startQuiz('desactivar'));
elements.btnEvaluate.addEventListener('click', evaluateAnswer);
elements.btnRetry.addEventListener('click', retryQuestion);
elements.btnSendCommand.addEventListener('click', executeCommand);
elements.btnBackMain.addEventListener('click', () => showScreen('main'));

window.addEventListener('DOMContentLoaded', () => {
  showScreen('connection');
});