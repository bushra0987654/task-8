// ===== Study Planner =====

const STORAGE_KEY = "studyPlanner.tasks";
const THEME_KEY = "studyPlanner.theme";
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

// ----- State -----
let tasks = loadTasks();
const filters = { search: "", status: "all", category: "all", sort: "manual" };
let editingId = null;
let dragId = null;

// ----- DOM references -----
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const dueInput = document.getElementById("task-due");
const priorityInput = document.getElementById("task-priority");
const categoryInput = document.getElementById("task-category");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("filter-category");
const sortSelect = document.getElementById("sort");
const statusButtons = document.querySelectorAll(".seg");
const listEl = document.getElementById("task-list");
const emptyEl = document.getElementById("empty");
const emptyText = document.getElementById("empty-text");
const hintEl = document.getElementById("hint");
const themeToggle = document.getElementById("theme-toggle");
const clearBtn = document.getElementById("clear-completed");

// ----- Storage -----
function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Could not save tasks:", e);
  }
}

// ----- Date helpers -----
function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isOverdue(task) {
  return !task.completed && task.due && task.due < todayString();
}

function dueLabel(task) {
  const today = parseDate(todayString());
  const due = parseDate(task.due);
  const days = Math.round((due - today) / 86400000);
  const pretty = due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (task.completed) return `Due ${pretty}`;
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"} (${pretty})`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${pretty}`;
}

// ----- Task operations -----
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addTask(title, due, priority, category) {
  tasks.push({
    id: newId(),
    title,
    due, // "" or "YYYY-MM-DD"
    priority,
    category,
    completed: false,
    createdAt: Date.now()
  });
  saveTasks();
  render();
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.completed = !t.completed; saveTasks(); render(); }
}

function renameTask(id, title) {
  const t = tasks.find(t => t.id === id);
  title = title.trim();
  if (t && title) t.title = title;
  editingId = null;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (editingId === id) editingId = null;
  saveTasks();
  render();
}

function moveTask(fromId, toId) {
  if (fromId === toId) return;
  const fromIdx = tasks.findIndex(t => t.id === fromId);
  const toIdxOriginal = tasks.findIndex(t => t.id === toId);
  if (fromIdx < 0 || toIdxOriginal < 0) return;
  const [moved] = tasks.splice(fromIdx, 1);
  const targetIdx = tasks.findIndex(t => t.id === toId);
  // Dragging down drops after the target; dragging up drops before it.
  tasks.splice(fromIdx < toIdxOriginal ? targetIdx + 1 : targetIdx, 0, moved);
  saveTasks();
  render();
}

// ----- Filtering and sorting -----
function getVisibleTasks() {
  const q = filters.search.trim().toLowerCase();
  let result = tasks.filter(t => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (filters.status === "completed" && !t.completed) return false;
    if (filters.status === "pending" && t.completed) return false;
    if (filters.category !== "all" && t.category !== filters.category) return false;
    return true;
  });

  const byDue = (a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1; // tasks without a date go last
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  };
  const byPriority = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  if (filters.sort === "due") {
    result = [...result].sort((a, b) => byDue(a, b) || byPriority(a, b));
  } else if (filters.sort === "priority") {
    result = [...result].sort((a, b) => byPriority(a, b) || byDue(a, b));
  }
  return result;
}

// ----- Rendering -----
function render() {
  renderStats();

  const visible = getVisibleTasks();
  listEl.innerHTML = "";
  visible.forEach(t => listEl.appendChild(createTaskItem(t)));
  emptyEl.hidden = visible.length > 0;
  emptyText.textContent = tasks.length === 0
    ? "No tasks yet. Add your first one above."
    : "No tasks match your search or filters.";

  hintEl.textContent = filters.sort === "manual"
    ? "Drag tasks to reorder them."
    : "Set sorting to “Manual order” to reorder tasks by dragging.";
}

function renderStats() {
  const completed = tasks.filter(t => t.completed).length;
  document.getElementById("stat-total").textContent = tasks.length;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-pending").textContent = tasks.length - completed;

  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  document.getElementById("progress-bar").style.width = percent + "%";
  document.getElementById("progress-text").textContent = percent + "%";
}

function makeBadge(text, extraClass) {
  const span = document.createElement("span");
  span.className = "badge" + (extraClass ? " " + extraClass : "");
  span.textContent = text;
  return span;
}

function makeButton(text, className, onClick, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = text;
  if (label) btn.setAttribute("aria-label", label);
  btn.addEventListener("click", onClick);
  return btn;
}

function createTaskItem(task) {
  const li = document.createElement("li");
  li.className = "task";
  if (task.completed) li.classList.add("completed");
  if (isOverdue(task)) li.classList.add("overdue");
  li.classList.add("prio-" + task.priority);
  li.dataset.id = task.id;

  const canDrag = filters.sort === "manual" && editingId !== task.id;
  if (canDrag) {
    li.draggable = true;
    li.classList.add("draggable");
    attachDragEvents(li);
  }

  const handle = document.createElement("span");
  handle.className = "handle";
  handle.setAttribute("aria-hidden", "true");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark "${task.title}" as completed`);
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const body = document.createElement("div");
  body.className = "task-body";

  const actions = document.createElement("div");
  actions.className = "task-actions";

  if (editingId === task.id) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = task.title;
    input.maxLength = 120;
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") renameTask(task.id, input.value);
      if (e.key === "Escape") { editingId = null; render(); }
    });
    body.appendChild(input);
    actions.appendChild(makeButton("Save", "icon-btn", () => renameTask(task.id, input.value)));
    actions.appendChild(makeButton("Cancel", "icon-btn", () => { editingId = null; render(); }));
    setTimeout(() => { input.focus(); input.select(); }, 0);
  } else {
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.appendChild(makeBadge(task.category, "cat-" + task.category));
    meta.appendChild(makeBadge(task.priority + " priority", "p-" + task.priority));
    if (task.due) {
      meta.appendChild(makeBadge(dueLabel(task), isOverdue(task) ? "overdue" : ""));
    }
    body.appendChild(meta);

    actions.appendChild(makeButton("Edit", "icon-btn", () => { editingId = task.id; render(); }, `Edit "${task.title}"`));
    actions.appendChild(makeButton("Delete", "icon-btn delete", () => deleteTask(task.id), `Delete "${task.title}"`));
  }

  li.append(handle, checkbox, body, actions);
  return li;
}

// ----- Drag and drop -----
function attachDragEvents(li) {
  li.addEventListener("dragstart", e => {
    dragId = li.dataset.id;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });

  li.addEventListener("dragover", e => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    li.classList.add("drag-over");
  });

  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));

  li.addEventListener("drop", e => {
    e.preventDefault();
    li.classList.remove("drag-over");
    if (dragId) moveTask(dragId, li.dataset.id);
    dragId = null;
  });

  li.addEventListener("dragend", () => {
    dragId = null;
    li.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
  });
}

// ----- Dark mode -----
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
});

// ----- Event listeners -----
form.addEventListener("submit", e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  addTask(title, dueInput.value, priorityInput.value, categoryInput.value);
  titleInput.value = "";
  dueInput.value = "";
  priorityInput.value = "Medium";
  titleInput.focus();
});

searchInput.addEventListener("input", () => { filters.search = searchInput.value; render(); });

categoryFilter.addEventListener("change", () => { filters.category = categoryFilter.value; render(); });

sortSelect.addEventListener("change", () => { filters.sort = sortSelect.value; render(); });

statusButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filters.status = btn.dataset.status;
    statusButtons.forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

clearBtn.addEventListener("click", () => {
  const done = tasks.filter(t => t.completed).length;
  if (done === 0) return;
  if (confirm(`Delete ${done} completed task${done === 1 ? "" : "s"}?`)) {
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
  }
});

// ----- Start -----
document.getElementById("today-label").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
initTheme();
render();
