import './style.css';
import { defaultTasks, extraTasks, toolsCatalog } from './data/tasks.js';

const app = document.querySelector('#app');

const audioAntonella = new Audio('/antonella urla.mp3');
audioAntonella.preload = 'auto';

const phaseLabels = {
  1: 'Lista 1',
  2: 'Lista 2',
};

const state = {
  selectedTool: null,
  completedCount: 0,
  mobileTasksOpen: false,
  phase: 1,
  dialogQueue: [],
  activeDialog: null,
  onDialogComplete: null,
  videoPlaying: false,
  flashMessage: 'Seleziona un attrezzo e clicca i punti numerati sul mezzo.',
  flashTone: 'neutral',
  editorOpen: false,
  editorPhase: 1,
  draggingTaskId: null,
  taskSets: {
    1: defaultTasks.map((task) => ({ ...task, status: 'pending' })),
    2: extraTasks.map((task) => ({ ...task, status: 'pending' })),
  },
  tasks: defaultTasks.map((task) => ({ ...task, status: 'pending' })),
};

const toolLookup = new Map(toolsCatalog.map((tool) => [tool.id, tool]));

function cloneTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

function getVisiblePhase() {
  return state.editorOpen ? state.editorPhase : state.phase === 2 ? 2 : 1;
}

function getVisibleTasks() {
  return state.editorOpen ? state.taskSets[state.editorPhase] : state.tasks;
}

function getCompletionRatio() {
  return state.tasks.length ? (state.completedCount / state.tasks.length) * 100 : 0;
}

function updateCompletionState() {
  state.completedCount = state.tasks.filter((task) => task.status === 'completed').length;
}

function setMessage(message, tone = 'neutral') {
  state.flashMessage = message;
  state.flashTone = tone;
}

function syncCurrentTasksFromEditorIfNeeded(phaseNumber) {
  if (state.phase === phaseNumber) {
    const currentMap = new Map(state.tasks.map((task) => [task.id, task.status]));
    state.tasks = cloneTasks(state.taskSets[phaseNumber]).map((task) => ({
      ...task,
      status: currentMap.get(task.id) ?? 'pending',
    }));
    updateCompletionState();
  }
}

function playAntonellaAudio() {
  audioAntonella.currentTime = 0;
  audioAntonella.play().catch(() => {});
}

function selectTool(toolId) {
  if (state.activeDialog || state.videoPlaying) {
    return;
  }

  state.selectedTool = toolId;
  const tool = toolLookup.get(toolId);
  setMessage(`${tool.label} pronto all'uso. Seleziona il punto corrispondente sul mezzo.`, 'ready');
  renderApp();
}

function completeTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === 'completed' || state.activeDialog || state.videoPlaying || state.editorOpen) {
    return;
  }

  if (!state.selectedTool) {
    setMessage('Prima scegli un attrezzo dalla barra in basso.', 'warning');
    renderApp();
    return;
  }

  const selectedTool = toolLookup.get(state.selectedTool);
  if (task.tool !== state.selectedTool) {
    setMessage(
      `Attrezzo errato per "${task.label}". Serve: ${toolLookup.get(task.tool).label}.`,
      'error',
    );
    renderApp();
    return;
  }

  task.status = 'completed';
  updateCompletionState();

  if (state.phase === 1) {
    state.taskSets[1] = state.taskSets[1].map((item) =>
      item.id === taskId ? { ...item, status: 'completed' } : item,
    );
  } else if (state.phase === 2) {
    state.taskSets[2] = state.taskSets[2].map((item) =>
      item.id === taskId ? { ...item, status: 'completed' } : item,
    );
  }

  setMessage(`${task.label} completato con ${selectedTool.label}.`, 'success');

  if (state.completedCount === state.tasks.length) {
    if (state.phase === 1) {
      startInspectorReviewPhaseOne();
      return;
    }

    if (state.phase === 2) {
      startInspectorReviewPhaseTwo();
      return;
    }
  }

  renderApp();
}

function resetGame() {
  state.selectedTool = null;
  state.phase = 1;
  state.mobileTasksOpen = false;
  state.dialogQueue = [];
  state.activeDialog = null;
  state.onDialogComplete = null;
  state.videoPlaying = false;
  state.draggingTaskId = null;
  state.taskSets = {
    1: cloneTasks(state.taskSets[1]).map((task) => ({ ...task, status: 'pending' })),
    2: cloneTasks(state.taskSets[2]).map((task) => ({ ...task, status: 'pending' })),
  };
  state.tasks = cloneTasks(state.taskSets[1]);
  setMessage('Nuova sessione pronta. Seleziona un attrezzo e riparti.', 'neutral');
  updateCompletionState();
  renderApp();
}

function toggleMobileTasks() {
  if (state.activeDialog || state.videoPlaying) {
    return;
  }
  state.mobileTasksOpen = !state.mobileTasksOpen;
  renderApp();
}

function toggleEditor() {
  if (state.activeDialog || state.videoPlaying) {
    return;
  }
  state.editorOpen = !state.editorOpen;
  state.mobileTasksOpen = false;
  state.draggingTaskId = null;
  setMessage(
    state.editorOpen
      ? 'Modalita modifica attiva. Puoi aggiornare lavori e trascinare i punti sul bus.'
      : 'Modalita modifica chiusa. Il gioco usa i dati appena impostati.',
    state.editorOpen ? 'warning' : 'neutral',
  );
  renderApp();
}

function setEditorPhase(phaseNumber) {
  state.editorPhase = phaseNumber;
  state.draggingTaskId = null;
  renderApp();
}

function updateEditorField(phaseNumber, taskId, field, value) {
  state.taskSets[phaseNumber] = state.taskSets[phaseNumber].map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    if (field === 'x' || field === 'y') {
      const numeric = Math.max(0, Math.min(100, Number(value) || 0));
      return { ...task, [field]: Number(numeric.toFixed(1)) };
    }

    return { ...task, [field]: value };
  });

  syncCurrentTasksFromEditorIfNeeded(phaseNumber);
  renderApp();
}

function setTaskPosition(phaseNumber, taskId, x, y) {
  const safeX = Number(Math.max(0, Math.min(100, x)).toFixed(1));
  const safeY = Number(Math.max(0, Math.min(100, y)).toFixed(1));

  state.taskSets[phaseNumber] = state.taskSets[phaseNumber].map((task) =>
    task.id === taskId ? { ...task, x: safeX, y: safeY } : task,
  );

  syncCurrentTasksFromEditorIfNeeded(phaseNumber);
  renderApp();
}

function chooseDragTask(taskId) {
  state.draggingTaskId = state.draggingTaskId === taskId ? null : taskId;
  renderApp();
}

function updateDraggedTaskPosition(clientX, clientY) {
  if (!state.editorOpen || !state.draggingTaskId) {
    return;
  }

  const frame = document.querySelector('.scene-frame');
  if (!frame) {
    return;
  }

  const rect = frame.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;

  setTaskPosition(state.editorPhase, state.draggingTaskId, x, y);
}

function handleDragMove(event) {
  if (!state.draggingTaskId) {
    return;
  }

  if ('touches' in event && event.touches[0]) {
    updateDraggedTaskPosition(event.touches[0].clientX, event.touches[0].clientY);
    return;
  }

  updateDraggedTaskPosition(event.clientX, event.clientY);
}

function startHotspotDrag(taskId, event) {
  if (!state.editorOpen) {
    return;
  }

  event.preventDefault();
  state.draggingTaskId = taskId;
  renderApp();
  handleDragMove(event);
}

function stopHotspotDrag() {
  if (!state.draggingTaskId) {
    return;
  }
  state.draggingTaskId = null;
  renderApp();
}

function openDialogSequence(dialogs, onComplete) {
  state.mobileTasksOpen = false;
  state.dialogQueue = dialogs.map((dialog) => ({ ...dialog }));
  state.onDialogComplete = onComplete;
  state.activeDialog = state.dialogQueue.shift() ?? null;

  if (state.activeDialog?.playAntonellaAudio) {
    playAntonellaAudio();
  }

  renderApp();
}

function advanceDialog() {
  if (!state.activeDialog) {
    return;
  }

  state.activeDialog = state.dialogQueue.shift() ?? null;

  if (state.activeDialog?.playAntonellaAudio) {
    playAntonellaAudio();
  }

  if (!state.activeDialog) {
    const callback = state.onDialogComplete;
    state.onDialogComplete = null;
    if (callback) {
      callback();
      return;
    }
  }

  renderApp();
}

function startInspectorReviewPhaseOne() {
  state.phase = 1.5;
  openDialogSequence(
    [
      {
        name: 'Giacomo - Ispettore ATM',
        image: '/inspector.png',
        tone: 'warning',
        text: "Hmmm... vediamo se siete stati in grado di sistemare questi capolavori di autobus.",
      },
      {
        name: 'Giacomo - Ispettore ATM',
        image: '/inspector.png',
        tone: 'danger',
        text: "Oh guarda, eh no, questo non va bene... mi dispiace ma devo scrivere... eeeeeh lo devo proprio scrivere.",
      },
      {
        name: 'Operaio officina',
        image: '/operaio.png',
        tone: 'neutral',
        text: "No dai non scrivere, guarda l'ho sistemato subito vedi? Ora e apposto.",
      },
      {
        name: 'Giacomo - Ispettore ATM',
        image: '/inspector.png',
        tone: 'danger',
        text: 'Eh lo so, ho visto, pero io lo devo scrivere comunque, mi dispiace.',
      },
    ],
    () => {
      state.phase = 2;
      state.selectedTool = null;
      state.tasks = cloneTasks(state.taskSets[2]).map((task) => ({ ...task, status: 'pending' }));
      state.taskSets[2] = cloneTasks(state.tasks);
      setMessage("L'ispettore ha aggiunto una nuova lista lavori. Si riparte.", 'warning');
      updateCompletionState();
      renderApp();
    },
  );
}

function startInspectorReviewPhaseTwo() {
  state.phase = 2.5;
  openDialogSequence(
    [
      {
        name: 'Giacomo - Ispettore ATM',
        image: '/inspector.png',
        tone: 'danger',
        text: "Ragazzi non ci siamo... io questo mezzo lo devo bocciare, mi dispiace davvero, ma ho visto che sotto al sedile in fondo c'e una vite non stretta bene anche se completamente inutile.",
      },
      {
        name: 'Antonella - Responsabile Iveco',
        image: '/antonella.png',
        tone: 'danger',
        emphasis: true,
        playAntonellaAudio: true,
        text: 'GIACOMO HAI ROTTO IL CAZZO',
      },
    ],
    () => {
      state.phase = 3;
      state.videoPlaying = true;
      setMessage('Parte il video finale del mezzo su strada.', 'success');
      renderApp();
    },
  );
}

function endFinalVideo() {
  const video = document.querySelector('.final-video');
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  resetGame();
}

function renderHeader() {
  const phaseLabel =
    state.phase < 2 ? 'Prima lista lavori' : state.phase < 3 ? 'Seconda lista lavori' : 'Finale';

  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Officina digitale</p>
        <h1>IVECO ORECCHIA</h1>
      </div>
      <div class="topbar-status">
        <span class="status-dot"></span>
        ${phaseLabel}
      </div>
    </header>
  `;
}

function renderScenePanel() {
  const selectedToolName = state.selectedTool
    ? toolLookup.get(state.selectedTool).label
    : 'Nessun attrezzo selezionato';
  const visibleTasks = getVisibleTasks();
  const visiblePhase = getVisiblePhase();

  return `
    <section class="scene-panel panel">
      <div class="panel-heading">
        <div>
          <p class="panel-kicker">Veicolo in lavorazione</p>
          <h2>${state.editorOpen ? `Anteprima ${phaseLabels[visiblePhase]}` : 'Intervieni direttamente sul mezzo'}</h2>
        </div>
        <div class="vehicle-chip">
          <span>Urbanway 12M</span>
          <strong>Bus 3634</strong>
        </div>
      </div>
      <div class="mobile-tasks-entry">
        <button
          class="mobile-tasks-toggle"
          data-action="toggle-mobile-tasks"
          aria-expanded="${state.mobileTasksOpen ? 'true' : 'false'}"
        >
          <span>Lista riparazioni</span>
          <strong>${state.completedCount}/${state.tasks.length} completate</strong>
        </button>
      </div>

      <div class="scene-card">
        <div class="scene-frame">
          <img class="scene-image" src="/bus.png" alt="Autobus Iveco in officina con operai" />
          <div class="scene-gradient"></div>
          <div class="scene-hotspots">
            ${visibleTasks
              .map((task) => {
                const tool = toolLookup.get(task.tool);
                return `
                  <button
                    class="hotspot ${task.status} ${state.editorOpen ? 'editor-hotspot' : ''} ${state.draggingTaskId === task.id ? 'dragging' : ''}"
                    style="left:${task.x}%; top:${task.y}%; --accent:${tool.accent};"
                    data-task-id="${task.id}"
                    aria-label="Intervento ${task.id}: ${task.label}"
                  >
                    <span class="hotspot-number">${task.id}</span>
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="toolbelt-shell">
            <div class="toolbelt-label">
              <span class="toolbelt-title">Attrezzatura ai piedi degli operai</span>
              <span class="toolbelt-subtitle">${selectedToolName}</span>
            </div>
            <div class="toolbelt">
              ${toolsCatalog
                .map(
                  (tool) => `
                    <button
                      class="tool-card ${state.selectedTool === tool.id ? 'active' : ''}"
                      data-tool-id="${tool.id}"
                      style="--accent:${tool.accent};"
                      aria-pressed="${state.selectedTool === tool.id ? 'true' : 'false'}"
                    >
                      <img src="${tool.image}" alt="${tool.label}" />
                      <span>${tool.label}</span>
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="scene-footer">
        <div class="info-card">
          <span>Flusso</span>
          <strong>${state.editorOpen ? `Modifica ${phaseLabels[visiblePhase]}` : state.phase < 2 ? 'Prima revisione ATM' : state.phase < 3 ? 'Seconda revisione ATM' : 'Video finale'}</strong>
        </div>
        <div class="info-card">
          <span>Selezione attiva</span>
          <strong>${state.draggingTaskId ? `Stai spostando il punto ${state.draggingTaskId}` : selectedToolName}</strong>
        </div>
        <div class="info-card ${state.flashTone}">
          <span>Assistente officina</span>
          <strong>${state.flashMessage}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderTasksMarkup(tasks) {
  return tasks
    .map((task) => {
      const tool = toolLookup.get(task.tool);
      const isDone = task.status === 'completed';
      return `
        <li class="task-item ${task.status}">
          <div class="task-index">${task.id}</div>
          <div class="task-copy">
            <strong>${task.label}</strong>
            <span>${task.area}</span>
            <small>Attrezzo richiesto: ${tool.label}</small>
          </div>
          <div class="task-state">
            ${isDone ? '<span class="checkmark">Completato</span>' : '<span>In attesa</span>'}
          </div>
        </li>
      `;
    })
    .join('');
}

function renderChecklistPanel() {
  return `
    <aside class="checklist-panel panel">
      <div class="panel-heading checklist-heading">
        <div>
          <p class="panel-kicker">Lista lavori</p>
          <h2>Riparazioni da completare</h2>
        </div>
        <div class="progress-copy">
          <strong>${state.completedCount}/${state.tasks.length}</strong>
          <span>chiuse</span>
        </div>
      </div>

      <div class="progress-block">
        <div class="progress-meta">
          <span>Avanzamento pratica</span>
          <span>${Math.round(getCompletionRatio())}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${getCompletionRatio()}%"></div>
        </div>
      </div>

      <ol class="task-list">
        ${renderTasksMarkup(state.tasks)}
      </ol>

      <div class="checklist-note">
        <p>I numeri sopra l'autobus corrispondono alla lista qui a destra.</p>
      </div>
    </aside>
  `;
}

function renderMobileTasksDrawer() {
  return `
    <div class="mobile-tasks-drawer ${state.mobileTasksOpen ? 'open' : ''}">
      <div class="mobile-tasks-backdrop" data-action="toggle-mobile-tasks"></div>
      <div class="mobile-tasks-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-tasks-title">
        <div class="mobile-tasks-header">
          <div>
            <p class="panel-kicker">Lista lavori</p>
            <h2 id="mobile-tasks-title">Riparazioni del mezzo</h2>
          </div>
          <button class="mobile-tasks-close" data-action="toggle-mobile-tasks" aria-label="Chiudi lista">
            Chiudi
          </button>
        </div>
        <div class="mobile-tasks-progress">
          <span>Avanzamento</span>
          <strong>${state.completedCount}/${state.tasks.length}</strong>
        </div>
        <ol class="task-list mobile-task-list">
          ${renderTasksMarkup(state.tasks)}
        </ol>
      </div>
    </div>
  `;
}

function renderEditorRow(task) {
  return `
    <article class="editor-row ${state.draggingTaskId === task.id ? 'active' : ''}">
      <div class="editor-row-top">
        <strong>Punto ${task.id}</strong>
        <button class="editor-move-btn" data-action="pick-drag-task" data-task-id="${task.id}">
          ${state.draggingTaskId === task.id ? 'Sposta sul bus: attivo' : 'Sposta sul bus'}
        </button>
      </div>
      <label class="editor-field">
        <span>Lavoro</span>
        <input data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="label" value="${task.label}" />
      </label>
      <label class="editor-field">
        <span>Area</span>
        <input data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="area" value="${task.area}" />
      </label>
      <label class="editor-field">
        <span>Hint</span>
        <input data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="hint" value="${task.hint}" />
      </label>
      <div class="editor-grid">
        <label class="editor-field">
          <span>Attrezzo</span>
          <select data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="tool">
            ${toolsCatalog
              .map(
                (tool) =>
                  `<option value="${tool.id}" ${tool.id === task.tool ? 'selected' : ''}>${tool.label}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="editor-field">
          <span>X</span>
          <input type="number" step="0.1" min="0" max="100" data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="x" value="${task.x}" />
        </label>
        <label class="editor-field">
          <span>Y</span>
          <input type="number" step="0.1" min="0" max="100" data-action="edit-field" data-phase="${state.editorPhase}" data-task-id="${task.id}" data-field="y" value="${task.y}" />
        </label>
      </div>
    </article>
  `;
}

function renderEditorPanel() {
  const tasks = state.taskSets[state.editorPhase];
  return `
    <section class="editor-panel panel">
      <div class="panel-heading editor-heading">
        <div>
          <p class="panel-kicker">Editor lavori</p>
          <h2>Modifica liste e hotspot</h2>
        </div>
        <button class="editor-toggle-btn" data-action="toggle-editor">
          ${state.editorOpen ? 'Chiudi editor' : 'Apri editor'}
        </button>
      </div>
      <p class="editor-note">
        Qui puoi modificare i testi dei lavori e spostare i punti sul bus. Quando mi dirai che hai finito, rendero permanenti questi valori.
      </p>
      ${state.editorOpen
        ? `
          <div class="editor-tabs">
            <button class="editor-tab ${state.editorPhase === 1 ? 'active' : ''}" data-action="set-editor-phase" data-phase="1">Lista n1</button>
            <button class="editor-tab ${state.editorPhase === 2 ? 'active' : ''}" data-action="set-editor-phase" data-phase="2">Lista n2</button>
          </div>
          <div class="editor-summary">
            <strong>Anteprima attiva: ${phaseLabels[state.editorPhase]}</strong>
            <span>${state.draggingTaskId ? `Trascina sul bus il punto ${state.draggingTaskId}.` : 'Premi "Sposta sul bus" su una riga per riposizionare un hotspot.'}</span>
          </div>
          <div class="editor-list">
            ${tasks.map((task) => renderEditorRow(task)).join('')}
          </div>
        `
        : ''}
    </section>
  `;
}

function renderVideoOverlay() {
  if (!state.videoPlaying) {
    return '';
  }

  return `
    <div class="video-overlay" role="dialog" aria-modal="true" aria-labelledby="video-title">
      <div class="video-card">
        <div class="video-copy">
          <p class="panel-kicker">Finale</p>
          <h2 id="video-title">Autobus in strada</h2>
          <p>Finito il video, il gioco ripartira automaticamente dalla prima lista.</p>
        </div>
        <video class="final-video" src="/autobus in strada.mp4" autoplay playsinline controls></video>
      </div>
    </div>
  `;
}

function renderDialogOverlay() {
  if (!state.activeDialog) {
    return '';
  }

  return `
    <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="dialog-card ${state.activeDialog.tone ?? 'neutral'}">
        <div class="dialog-media">
          <img src="${state.activeDialog.image}" alt="${state.activeDialog.name}" />
        </div>
        <div class="dialog-content">
          <p class="panel-kicker">Controllo officina</p>
          <h2 id="dialog-title">${state.activeDialog.name}</h2>
          <p class="dialog-text ${state.activeDialog.emphasis ? 'emphasis' : ''}">
            ${state.activeDialog.text}
          </p>
          <div class="dialog-actions">
            <button class="primary-btn" data-action="advance-dialog">Continua</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderApp() {
  app.innerHTML = `
    <div class="shell">
      ${renderHeader()}
      <main class="layout">
        ${renderScenePanel()}
        ${renderChecklistPanel()}
      </main>
      ${renderEditorPanel()}
      ${renderMobileTasksDrawer()}
      ${renderDialogOverlay()}
      ${renderVideoOverlay()}
    </div>
  `;

  app.querySelectorAll('[data-tool-id]').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.toolId));
  });

  app.querySelectorAll('.hotspot[data-task-id]').forEach((button) => {
    const taskId = Number(button.dataset.taskId);
    button.addEventListener('click', () => {
      if (!state.editorOpen) {
        completeTask(taskId);
      }
    });

    button.addEventListener('pointerdown', (event) => startHotspotDrag(taskId, event));
    button.addEventListener('touchstart', (event) => startHotspotDrag(taskId, event), { passive: false });
  });

  app.querySelectorAll('[data-action="toggle-mobile-tasks"]').forEach((button) => {
    button.addEventListener('click', toggleMobileTasks);
  });

  app.querySelectorAll('[data-action="advance-dialog"]').forEach((button) => {
    button.addEventListener('click', advanceDialog);
  });

  app.querySelectorAll('[data-action="toggle-editor"]').forEach((button) => {
    button.addEventListener('click', toggleEditor);
  });

  app.querySelectorAll('[data-action="set-editor-phase"]').forEach((button) => {
    button.addEventListener('click', () => setEditorPhase(Number(button.dataset.phase)));
  });

  app.querySelectorAll('[data-action="pick-drag-task"]').forEach((button) => {
    button.addEventListener('click', () => chooseDragTask(Number(button.dataset.taskId)));
  });

  app.querySelectorAll('[data-action="edit-field"]').forEach((field) => {
    field.addEventListener('change', () => {
      updateEditorField(
        Number(field.dataset.phase),
        Number(field.dataset.taskId),
        field.dataset.field,
        field.value,
      );
    });
  });

  const video = app.querySelector('.final-video');
  if (video) {
    video.addEventListener('ended', endFinalVideo, { once: true });
    video.play().catch(() => {});
  }
}

window.addEventListener('pointermove', handleDragMove);
window.addEventListener('pointerup', stopHotspotDrag);
window.addEventListener('touchmove', handleDragMove, { passive: false });
window.addEventListener('touchend', stopHotspotDrag);

updateCompletionState();
renderApp();
