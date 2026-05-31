const API_BASE = "https://jsonplaceholder.typicode.com/todos";

const elements = {
  form: document.getElementById("task-form"),
  input: document.getElementById("task-input"),
  addBtn: document.getElementById("add-btn"),
  list: document.getElementById("task-list"),
  loader: document.getElementById("loader"),
  counter: document.getElementById("counter"),
  message: document.getElementById("message"),
  search: document.getElementById("search-input"),
  filters: document.querySelectorAll(".filter-btn"),
};

let tasks = [];
let filter = "all";
let searchQuery = "";

function showLoader() {
  elements.loader.style.display = "block";
}

function hideLoader() {
  elements.loader.style.display = "none";
}

function showMessage(text, timeout = 4000) {
  elements.message.textContent = text;

  if (timeout)
    setTimeout(() => {
      elements.message.textContent = "";
    }, timeout);
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.id = task.id;

  if (task.completed) li.classList.add("completed");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.className = "task-checkbox";

  const span = document.createElement("span");
  span.className = "task-title";
  span.textContent = task.title;

  const del = document.createElement("button");
  del.className = "task-delete";
  del.textContent = "Видалити";

  li.append(checkbox, span, del);

  return li;
}

function renderTasks(list = tasks) {
  elements.list.innerHTML = "";

  const visible = list
    .filter((t) => {
      if (filter === "active") return !t.completed;
      if (filter === "completed") return t.completed;
      return true;
    })
    .filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  visible.forEach((t) => elements.list.append(createTaskElement(t)));

  updateCounter();
}

function updateCounter() {
  const active = tasks.filter((t) => !t.completed).length;
  elements.counter.textContent = `${active} активних`;
}

async function loadInitialData() {
  showLoader();

  try {
    const res = await fetch(`${API_BASE}?_limit=20`);

    if (!res.ok) throw new Error("HTTP " + res.status);
    tasks = await res.json();

    renderTasks();
  } catch (err) {
    showMessage("Не вдалося завантажити завдання. Спробуйте пізніше.");
    console.error(err);
  } finally {
    hideLoader();
  }
}

async function addTask(title) {
  showLoader();

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, completed: false, userId: 1 }),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    const newTask = await res.json();

    tasks.unshift({
      id: newTask.id || Date.now(),
      title: newTask.title,
      completed: false,
    });

    renderTasks();

    elements.input.value = "";
    elements.addBtn.disabled = true;
  } catch (err) {
    showMessage("Не вдалося створити завдання.");
    console.error(err);
  } finally {
    hideLoader();
  }
}

async function updateTask(
  id,
  changes,
  errorMsg = "Не вдалося оновити завдання.",
) {
  const idx = tasks.findIndex((t) => Number(t.id) === Number(id));

  if (idx === -1) return;

  const original = {};
  for (const k in changes) original[k] = tasks[idx][k];

  Object.assign(tasks[idx], changes);

  renderTasks();

  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(changes),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch (err) {
    Object.assign(tasks[idx], original);

    renderTasks();

    showMessage(errorMsg);
    console.error(err);
  }
}

async function toggleTask(id, completed) {
  await updateTask(id, { completed }, "Не вдалося оновити завдання.");
}

async function editTask(id, newTitle) {
  await updateTask(
    id,
    { title: newTitle },
    "Не вдалося оновити назву завдання.",
  );
}

async function deleteTask(id) {
  const idx = tasks.findIndex((t) => Number(t.id) === Number(id));
  if (idx === -1) return;

  const removed = tasks.splice(idx, 1)[0];

  renderTasks();
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });

    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch (err) {
    tasks.splice(idx, 0, removed);

    renderTasks();

    showMessage("Не вдалося видалити завдання.");
    console.error(err);
  }
}

// Event delegation for list (checkbox & delete)
elements.list.addEventListener("click", (e) => {
  const target = e.target;
  const item = target.closest(".task-item");

  if (!item) return;
  const id = item.dataset.id;

  if (target.classList.contains("task-delete")) {
    deleteTask(id);
  }
});

elements.list.addEventListener("change", (e) => {
  const target = e.target;

  if (target.classList.contains("task-checkbox")) {
    const item = target.closest(".task-item");
    const id = item.dataset.id;

    toggleTask(id, target.checked);
  }
});

// Inline edit: double-click title to edit
elements.list.addEventListener("dblclick", (e) => {
  const target = e.target;

  if (!target.classList.contains("task-title")) return;
  const item = target.closest(".task-item");

  if (!item) return;
  const id = item.dataset.id;
  const originalTitle = target.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "task-edit-input";
  input.value = originalTitle;

  // Replace title span with input
  target.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  function finish(save) {
    const newTitle = input.value.trim();
    const span = document.createElement("span");

    span.className = "task-title";
    span.textContent = save && newTitle ? newTitle : originalTitle;

    input.replaceWith(span);

    if (save && newTitle && newTitle !== originalTitle) {
      editTask(id, newTitle);
    }
  }

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      finish(true);
    } else if (ev.key === "Escape") {
      finish(false);
    }
  });

  input.addEventListener("blur", () => {
    finish(true);
  });
});

// Form submit
elements.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = elements.input.value.trim();

  if (!val) return;

  addTask(val);
});

// Input handlers: disable add when empty; Enter/Escape
elements.input.addEventListener("input", (e) => {
  elements.addBtn.disabled = e.target.value.trim() === "";
});
elements.input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") elements.input.value = "";
});

// Filters
elements.filters.forEach((btn) =>
  btn.addEventListener("click", (e) => {
    elements.filters.forEach((b) => b.classList.remove("active"));

    e.currentTarget.classList.add("active");

    filter = e.currentTarget.dataset.filter;

    renderTasks();
  }),
);

// Debounce helper
function debounce(func, delay = 600) {
  let timeout;

  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

elements.search.addEventListener(
  "input",
  debounce((e) => {
    searchQuery = e.target.value.trim();
    renderTasks();
  }),
);

// Init
loadInitialData();
