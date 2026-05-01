const phaseLabel = document.getElementById('phase-label');
const taskListEl = document.getElementById('task-list');
const progressBar = document.getElementById('repair-progress');
const dialogOverlay = document.getElementById('dialog-overlay');
const dialogCharImg = document.getElementById('dialog-character-img');
const dialogName = document.getElementById('dialog-name');
const dialogText = document.getElementById('dialog-text');
const dialogBtn = document.getElementById('dialog-btn');
const hotspotsContainer = document.getElementById('hotspots');
const tools = document.querySelectorAll('.tool');
const selectedToolLabel = document.getElementById('selected-tool-label');
const victoryOverlay = document.getElementById('victory-overlay');

let currentPhase = 1;
let currentTool = null;

let tasks = [
  { id: 1, name: "Sostituzione Filtro Olio", status: "pending", tool: "oil", x: 20, y: 70 },
  { id: 2, name: "Controllo Freni a Disco", status: "pending", tool: "wrench", x: 30, y: 85 },
  { id: 3, name: "Rabbocco Liquido Tergicristalli", status: "pending", tool: "liquid", x: 85, y: 60 },
  { id: 4, name: "Sostituzione Cinghia Distribuzione", status: "pending", tool: "wrench", x: 15, y: 60 }
];

let extraTasks = [
  { id: 5, name: "Sostituzione Luci Posteriori", status: "pending", tool: "bulb", x: 5, y: 50 },
  { id: 6, name: "Pulizia Interni Abitacolo", status: "pending", tool: "sponge", x: 60, y: 40 }
];

// --- Tool Selection ---
tools.forEach(toolEl => {
  toolEl.addEventListener('click', () => {
    tools.forEach(t => t.classList.remove('active'));
    toolEl.classList.add('active');
    currentTool = toolEl.dataset.tool;
    selectedToolLabel.innerText = `Attrezzo in mano: ${toolEl.querySelector('img').alt}`;
  });
});

// --- Render UI ---
function renderTasks() {
  taskListEl.innerHTML = '';
  hotspotsContainer.innerHTML = '';
  let completedCount = 0;

  tasks.forEach(task => {
    // 1. Render task in list
    const li = document.createElement('li');
    li.className = `task-item ${task.status}`;
    li.dataset.id = task.id;
    if (task.status === 'completed') completedCount++;

    li.innerHTML = `
      <span class="task-name">${task.name}</span>
      <div class="task-status"></div>
    `;

    li.addEventListener('click', () => handleTaskCheck(task));
    taskListEl.appendChild(li);

    // 2. Render hotspot on bus (if pending or failed)
    if (task.status === 'pending' || task.status === 'failed') {
      const hotspot = document.createElement('div');
      hotspot.className = 'hotspot';
      hotspot.style.left = `${task.x}%`;
      hotspot.style.top = `${task.y}%`;
      hotspot.addEventListener('click', () => handleHotspotClick(task, hotspot));
      hotspotsContainer.appendChild(hotspot);
    }
  });

  const progress = (completedCount / tasks.length) * 100;
  progressBar.style.width = `${progress}%`;

  checkPhaseCompletion(completedCount, tasks.length);
}

// --- Interaction Logic ---
function handleHotspotClick(task, hotspotEl) {
  if (currentPhase !== 1 && currentPhase !== 3) return; // Only repair in proper phases
  if (!currentTool) {
    alert("Seleziona prima un attrezzo dalla cassetta!");
    return;
  }

  if (currentTool === task.tool) {
    // Repair successful
    hotspotEl.classList.add('fixed');
    setTimeout(() => {
      task.status = 'repaired_on_bus'; // Fixed on bus, now needs check off
      renderTasks();
    }, 500);
  } else {
    // Wrong tool
    hotspotEl.style.borderColor = "black";
    setTimeout(() => hotspotEl.style.borderColor = "", 300);
  }
}

function handleTaskCheck(task) {
  if (task.status === 'repaired_on_bus') {
    task.status = 'completed';
    renderTasks();
  }
}

function checkPhaseCompletion(completed, total) {
  if (completed === total && total > 0) {
    if (currentPhase === 1) {
      setTimeout(() => startPhase2(), 500);
    } else if (currentPhase === 3) {
      setTimeout(() => startPhase4(), 500);
    }
  }
}

function showDialog(character, name, text, btnText = "Continua", btnClass = "", callback) {
  dialogCharImg.src = `/${character}.png`;
  dialogName.innerText = name;
  dialogText.innerText = `"${text}"`;
  dialogBtn.innerText = btnText;
  dialogBtn.className = `action-btn ${btnClass}`;
  
  dialogOverlay.classList.remove('hidden');
  
  dialogBtn.onclick = () => {
    dialogOverlay.classList.add('hidden');
    if (callback) callback();
  };
}

// --- Phases ---

function startPhase1() {
  currentPhase = 1;
  phaseLabel.innerHTML = "<strong>Stato:</strong> Accettazione Officina";
  renderTasks();
}

function startPhase2() {
  currentPhase = 2;
  phaseLabel.innerHTML = "<strong>Stato:</strong> Primo Collaudo ATM";
  
  showDialog("inspector", "Ispettore ATM", "Vediamo un po' come avete lavorato su questo mezzo...", "Ispeziona", "", () => {
    
    // Inspector fails items
    tasks[0].status = 'failed';
    tasks[2].status = 'failed';
    renderTasks();
    document.querySelector('.checklist-view').classList.add('shake');
    setTimeout(() => document.querySelector('.checklist-view').classList.remove('shake'), 500);

    setTimeout(() => {
      showDialog("inspector", "Ispettore ATM", "No, no, mi dispiace ma lo devo scrivere, eh sì lo devo scrivere questo... Ci sono altre cose che non vanno! (Guarda i nuovi difetti)", "Oh no...", "red", () => {
        // Inspector adds items
        tasks = [...tasks, ...extraTasks];
        startPhase3();
      });
    }, 1000);

  });
}

function startPhase3() {
  currentPhase = 3;
  phaseLabel.innerHTML = "<strong>Stato:</strong> Riparazione Extra";
  
  tasks.forEach(t => {
    if (t.status === 'failed') t.status = 'pending';
  });
  
  renderTasks();
}

function startPhase4() {
  currentPhase = 4;
  phaseLabel.innerHTML = "<strong>Stato:</strong> Secondo Collaudo ATM";

  showDialog("inspector", "Ispettore ATM", "Ancora non ci siamo! È tutto uno schifo! Ora vi boccio l'intero autobus!", "Ferma", "red", () => {
    
    // Fail ALL
    tasks.forEach(t => t.status = 'failed');
    renderTasks();
    document.querySelector('.checklist-view').classList.add('shake');
    
    setTimeout(() => {
      startPhase5();
    }, 1500);

  });
}

function startPhase5() {
  currentPhase = 5;
  phaseLabel.innerHTML = "<strong>Stato:</strong> Scontro Finale";

  showDialog("antonella", "Antonella (Direttrice Iveco)", "SIGNOR ATM MI HAI ROTTO IL CAZZO!", "Vittoria!", "", () => {
    phaseLabel.innerHTML = "<strong>Stato:</strong> Vittoria! Autobus Consegnato.";
    tasks.forEach(t => t.status = 'completed');
    renderTasks();
    setTimeout(() => {
      victoryOverlay.classList.remove('hidden');
    }, 1000);
  });
}

// Start Game
startPhase1();
