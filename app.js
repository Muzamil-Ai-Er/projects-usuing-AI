const storageKey = "daymark-state-v1";

const defaults = {
  tasks: [
    { id: 1, name: "Finish the portfolio case study", priority: "high", done: false },
    { id: 2, name: "Outline the next personal project", priority: "medium", done: false },
    { id: 3, name: "Take a proper break outside", priority: "low", done: false },
    { id: 4, name: "Reply to the messages that matter", priority: "medium", done: true }
  ],
  agenda: [
    { id: 1, time: "11:30", name: "Deep work block", detail: "Portfolio" },
    { id: 2, time: "15:00", name: "Planning session", detail: "Next week" },
    { id: 3, time: "18:30", name: "Evening reset", detail: "Personal" }
  ],
  notes: "",
  intention: "One considered step at a time.",
  focusMinutes: 0,
  darkMode: false,
  streak: 12
};

let state = loadState();
let timerId = null;
let isTimerRunning = false;
let selectedMinutes = 25;
let remainingSeconds = selectedMinutes * 60;
let toastTimeout;
let quoteIndex = 0;

const quotes = [
  "“Small disciplines repeated with consistency lead to great achievements.”",
  "“Attention is the beginning of devotion.”",
  "“The work is not to see the whole staircase, but to take the first step.”",
  "“A little progress each day adds up to big results.”"
];

const refs = {
  taskList: document.querySelector("#taskList"),
  agendaList: document.querySelector("#agendaList"),
  taskMetric: document.querySelector("#taskMetric"),
  focusMetric: document.querySelector("#focusMetric"),
  scoreMetric: document.querySelector("#scoreMetric"),
  taskProgress: document.querySelector("#taskProgress"),
  progressText: document.querySelector("#progressText"),
  notesInput: document.querySelector("#notesInput"),
  noteStatus: document.querySelector("#noteStatus"),
  dailyIntention: document.querySelector("#dailyIntention"),
  intentionInput: document.querySelector("#intentionInput"),
  timerDisplay: document.querySelector("#timerDisplay"),
  timerState: document.querySelector("#timerState"),
  timerToggle: document.querySelector("#timerToggle"),
  resetTimer: document.querySelector("#resetTimer"),
  sessionMinutes: document.querySelector("#sessionMinutes"),
  taskDialog: document.querySelector("#taskDialog"),
  eventDialog: document.querySelector("#eventDialog"),
  intentionDialog: document.querySelector("#intentionDialog"),
  taskForm: document.querySelector("#taskForm"),
  eventForm: document.querySelector("#eventForm"),
  intentionForm: document.querySelector("#intentionForm"),
  toast: document.querySelector("#toast"),
  sidebar: document.querySelector(".sidebar"),
  menuToggle: document.querySelector("#menuToggle"),
  themeToggle: document.querySelector("#themeToggle"),
  quoteText: document.querySelector("#quoteText")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved ? { ...defaults, ...saved } : structuredClone(defaults);
  } catch {
    return structuredClone(defaults);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function renderTasks() {
  refs.taskList.innerHTML = state.tasks.map((task) => `
    <article class="task-item ${task.done ? "done" : ""}" data-id="${task.id}">
      <button type="button" class="task-check" data-action="toggle" aria-label="Mark ${escapeHtml(task.name)} as ${task.done ? "not done" : "done"}">${icon("check")}</button>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="priority-tag priority-${task.priority}">${task.priority}</span>
      <button type="button" class="delete-task" data-action="delete" aria-label="Delete ${escapeHtml(task.name)}" title="Delete task">${icon("trash-2")}</button>
    </article>
  `).join("") || '<p class="empty-list">Nothing on the list. Keep the space open.</p>';
  updateProgress();
  hydrateIcons();
}

function renderAgenda() {
  const ordered = [...state.agenda].sort((a, b) => a.time.localeCompare(b.time));
  refs.agendaList.innerHTML = ordered.map((item) => `
    <article class="agenda-item" data-id="${item.id}">
      <span class="agenda-time">${formatTime(item.time)}</span>
      <span class="agenda-detail">${escapeHtml(item.name)}<small>${escapeHtml(item.detail || "Personal")}</small></span>
      <span class="agenda-dot"></span>
      <button type="button" class="agenda-remove" data-action="delete-event" aria-label="Remove ${escapeHtml(item.name)}" title="Remove item">${icon("x")}</button>
    </article>
  `).join("") || '<p class="empty-list">A little unplanned time.</p>';
  hydrateIcons();
}

function updateProgress() {
  const total = state.tasks.length;
  const complete = state.tasks.filter((task) => task.done).length;
  const percent = total ? Math.round((complete / total) * 100) : 0;
  const dayScore = Math.min(100, Math.round(percent * 0.8 + Math.min(state.focusMinutes, 60) / 3));
  refs.taskMetric.textContent = `${complete} of ${total}`;
  refs.focusMetric.textContent = `${state.focusMinutes}m`;
  refs.scoreMetric.textContent = `${dayScore}%`;
  refs.taskProgress.style.width = `${percent}%`;
  refs.progressText.textContent = `${percent}% complete`;
}

function updateTimerUI() {
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  refs.timerDisplay.textContent = `${minutes}:${seconds}`;
  refs.timerState.textContent = isTimerRunning ? "In focus" : remainingSeconds === selectedMinutes * 60 ? "Ready" : "Paused";
  refs.timerToggle.innerHTML = isTimerRunning ? `${icon("pause")}<span>Pause focus</span>` : `${icon("play")}<span>${remainingSeconds === selectedMinutes * 60 ? "Start focus" : "Resume focus"}</span>`;
  document.querySelectorAll(".timer-option").forEach((button) => button.classList.toggle("active", Number(button.dataset.minutes) === selectedMinutes));
  hydrateIcons();
}

function toggleTimer() {
  if (isTimerRunning) {
    stopTimer();
    return;
  }
  isTimerRunning = true;
  updateTimerUI();
  timerId = window.setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      completeFocusSession();
      return;
    }
    updateTimerUI();
  }, 1000);
}

function stopTimer() {
  isTimerRunning = false;
  window.clearInterval(timerId);
  timerId = null;
  updateTimerUI();
}

function resetTimer() {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  updateTimerUI();
}

function completeFocusSession() {
  stopTimer();
  state.focusMinutes += selectedMinutes;
  state.streak += 1;
  document.querySelector("#streakCount").textContent = state.streak;
  saveState();
  remainingSeconds = selectedMinutes * 60;
  updateProgress();
  updateTimerUI();
  showToast(`Beautiful. ${selectedMinutes} focused minutes are yours.`);
}

function setTimerDuration(minutes) {
  if (isTimerRunning) {
    showToast("Pause the current session before changing the duration.");
    return;
  }
  selectedMinutes = minutes;
  remainingSeconds = minutes * 60;
  updateTimerUI();
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => refs.toast.classList.remove("show"), 2800);
}

function hydrateIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function updateDate() {
  const now = new Date();
  document.querySelector("#dayName").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);
  document.querySelector("#fullDate").textContent = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(now);
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  document.querySelector("#greeting").textContent = `Good ${part}, Alex`;
}

function applyTheme() {
  document.body.classList.toggle("dark", state.darkMode);
  refs.themeToggle.innerHTML = state.darkMode ? icon("sun") : icon("moon");
  hydrateIcons();
}

function openDialog(dialog, focusTarget) {
  dialog.showModal();
  window.setTimeout(() => focusTarget?.focus(), 0);
}

function setupEvents() {
  document.querySelector("#openTaskDialog").addEventListener("click", () => openDialog(refs.taskDialog, document.querySelector("#taskName")));
  document.querySelector("#openTaskDialogSecondary").addEventListener("click", () => openDialog(refs.taskDialog, document.querySelector("#taskName")));
  document.querySelector("#addEventButton").addEventListener("click", () => openDialog(refs.eventDialog, document.querySelector("#eventName")));
  document.querySelector("#editIntention").addEventListener("click", () => {
    refs.intentionInput.value = state.intention;
    openDialog(refs.intentionDialog, refs.intentionInput);
  });
  document.querySelector("#cancelTaskDialog").addEventListener("click", () => refs.taskDialog.close());
  document.querySelector("#cancelEventDialog").addEventListener("click", () => refs.eventDialog.close());
  document.querySelector("#cancelIntentionDialog").addEventListener("click", () => refs.intentionDialog.close());
  document.querySelectorAll(".dialog-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

  refs.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(refs.taskForm);
    const name = form.get("taskName").trim();
    if (!name) return;
    state.tasks.unshift({ id: Date.now(), name, priority: form.get("priority"), done: false });
    saveState(); renderTasks(); refs.taskForm.reset(); refs.taskDialog.close(); showToast("Task added to today.");
  });

  refs.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(refs.eventForm);
    const name = form.get("eventName").trim();
    if (!name) return;
    state.agenda.push({ id: Date.now(), name, time: form.get("eventTime"), detail: "Personal" });
    saveState(); renderAgenda(); refs.eventForm.reset(); refs.eventDialog.close(); showToast("Added to your horizon.");
  });

  refs.intentionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = new FormData(refs.intentionForm).get("intentionInput").trim();
    if (!text) return;
    state.intention = text; refs.dailyIntention.textContent = text; saveState(); refs.intentionDialog.close(); showToast("Direction set for today.");
  });

  refs.taskList.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    const item = event.target.closest(".task-item");
    if (!action || !item) return;
    const id = Number(item.dataset.id);
    if (action === "toggle") {
      const task = state.tasks.find((entry) => entry.id === id);
      task.done = !task.done;
      saveState(); renderTasks();
      if (task.done) showToast("Nice. That one is done.");
    }
    if (action === "delete") {
      state.tasks = state.tasks.filter((task) => task.id !== id);
      saveState(); renderTasks(); showToast("Task removed.");
    }
  });

  refs.agendaList.addEventListener("click", (event) => {
    if (event.target.closest("button")?.dataset.action !== "delete-event") return;
    const id = Number(event.target.closest(".agenda-item").dataset.id);
    state.agenda = state.agenda.filter((item) => item.id !== id);
    saveState(); renderAgenda(); showToast("Planner item removed.");
  });

  document.querySelector("#clearCompleted").addEventListener("click", () => {
    const initialLength = state.tasks.length;
    state.tasks = state.tasks.filter((task) => !task.done);
    if (state.tasks.length === initialLength) { showToast("Nothing finished to clear just yet."); return; }
    saveState(); renderTasks(); showToast("Finished tasks cleared.");
  });

  refs.notesInput.addEventListener("input", () => {
    state.notes = refs.notesInput.value; saveState();
    refs.noteStatus.innerHTML = `${icon("cloud-check")} Saved locally`;
    hydrateIcons();
  });

  refs.timerToggle.addEventListener("click", toggleTimer);
  refs.resetTimer.addEventListener("click", resetTimer);
  document.querySelectorAll(".timer-option").forEach((button) => button.addEventListener("click", () => setTimerDuration(Number(button.dataset.minutes))));

  refs.themeToggle.addEventListener("click", () => { state.darkMode = !state.darkMode; saveState(); applyTheme(); });
  refs.menuToggle.addEventListener("click", () => refs.sidebar.classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((entry) => entry.classList.remove("active"));
    link.classList.add("active"); refs.sidebar.classList.remove("open");
  }));
  document.querySelector("#quoteRefresh").addEventListener("click", () => {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    refs.quoteText.textContent = quotes[quoteIndex];
  });
  document.querySelector("#profileButton").addEventListener("click", () => showToast("This is your space. Make it count."));
}

function initialize() {
  updateDate();
  refs.notesInput.value = state.notes;
  refs.dailyIntention.textContent = state.intention;
  document.querySelector("#streakCount").textContent = state.streak;
  renderTasks(); renderAgenda(); updateTimerUI(); applyTheme(); setupEvents(); hydrateIcons();
}

initialize();
