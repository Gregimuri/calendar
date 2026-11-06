const TasksView = (() => {
  let currentDateKey = null;
  let onChange = () => {};

  const listEl = () => document.getElementById("taskList");
  const emptyEl = () => document.getElementById("emptyHint");
  const formEl = () => document.getElementById("addForm");
  const inputEl = () => document.getElementById("addInput");
  const dateLabelEl = () => document.getElementById("tasksDateLabel");
  const sectionEl = () => document.getElementById("tasksSection");

  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="5 13 10 18 19 7"></polyline>
    </svg>
  `;

  function show(dateKey, label) {
    currentDateKey = dateKey;
    sectionEl().hidden = false;
    dateLabelEl().textContent = label;
    formEl().hidden = true;
    inputEl().value = "";
    render();
  }

  function hide() {
    currentDateKey = null;
    sectionEl().hidden = true;
    formEl().hidden = true;
  }

  function render() {
    if (!currentDateKey) return;
    const tasks = Storage.getTasks(currentDateKey);
    const list = listEl();
    list.innerHTML = "";
    emptyEl().hidden = tasks.length > 0;

    tasks.forEach((task) => {
      list.appendChild(createTaskItem(task));
    });
  }

  function createTaskItem(task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");
    li.dataset.id = task.id;

    const check = document.createElement("button");
    check.type = "button";
    check.className = "task-check";
    check.setAttribute("aria-label", task.done ? "Отметить невыполненной" : "Отметить выполненной");
    check.innerHTML = CHECK_SVG;
    check.addEventListener("click", () => {
      Storage.updateTask(currentDateKey, task.id, { done: !task.done });
      notifyChange();
      render();
    });

    const text = document.createElement("p");
    text.className = "task-text";
    text.textContent = task.text;
    text.contentEditable = "true";
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-label", "Текст задачи");
    text.spellcheck = true;

    let draft = task.text;

    text.addEventListener("focus", () => {
      draft = text.textContent;
    });

    text.addEventListener("blur", () => {
      const next = (text.textContent || "").trim();
      if (!next) {
        text.textContent = draft || task.text;
        return;
      }
      if (next !== task.text) {
        Storage.updateTask(currentDateKey, task.id, { text: next });
        notifyChange();
      }
    });

    text.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        text.blur();
      }
      if (event.key === "Escape") {
        text.textContent = task.text;
        text.blur();
      }
    });

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "task-handle";
    handle.setAttribute("aria-label", "Перетащить задачу");
    handle.innerHTML = "<span></span><span></span><span></span>";
    bindDrag(handle, li);

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(handle);
    return li;
  }

  function notifyChange() {
    onChange();
  }

  function openAddForm() {
    if (!currentDateKey) return;
    formEl().hidden = false;
    inputEl().value = "";
    inputEl().focus();
  }

  function submitAdd(event) {
    event.preventDefault();
    if (!currentDateKey) return;
    const text = inputEl().value.trim();
    if (!text) {
      inputEl().focus();
      return;
    }
    Storage.addTask(currentDateKey, text);
    inputEl().value = "";
    formEl().hidden = true;
    notifyChange();
    render();
  }

  /* ---- Drag & drop (pointer events) ---- */

  let dragState = null;

  function bindDrag(handle, item) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      startDrag(item, event);
    });
  }

  function startDrag(item, event) {
    const list = listEl();
    const items = [...list.querySelectorAll(".task-item")];
    const index = items.indexOf(item);
    if (index < 0) return;

    dragState = {
      item,
      startY: event.clientY,
      offsetY: 0,
      order: items.map((el) => el.dataset.id),
      heights: items.map((el) => el.getBoundingClientRect().height),
      pointerId: event.pointerId,
    };

    item.classList.add("dragging");
    handleSetPointerCapture(item, event.pointerId);

    item.addEventListener("pointermove", onPointerMove);
    item.addEventListener("pointerup", onPointerUp);
    item.addEventListener("pointercancel", onPointerUp);
  }

  function handleSetPointerCapture(el, pointerId) {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(event) {
    if (!dragState) return;
    const dy = event.clientY - dragState.startY;
    dragState.offsetY = dy;
    dragState.item.style.transform = `translateY(${dy}px)`;

    const list = listEl();
    const items = [...list.querySelectorAll(".task-item")];
    const from = items.indexOf(dragState.item);
    if (from < 0) return;

    let target = from;
    const mid = dragState.item.getBoundingClientRect().top + dragState.item.offsetHeight / 2;

    items.forEach((el, i) => {
      if (el === dragState.item) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      if (from < i && mid > center) target = i;
      if (from > i && mid < center) target = i;
    });

    if (target !== from) {
      const ref = target > from ? items[target].nextSibling : items[target];
      list.insertBefore(dragState.item, ref);
      dragState.startY = event.clientY;
      dragState.item.style.transform = "translateY(0)";
    }
  }

  function onPointerUp() {
    if (!dragState) return;
    const { item, pointerId } = dragState;
    item.classList.remove("dragging");
    item.style.transform = "";

    item.removeEventListener("pointermove", onPointerMove);
    item.removeEventListener("pointerup", onPointerUp);
    item.removeEventListener("pointercancel", onPointerUp);

    try {
      item.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }

    const orderedIds = [...listEl().querySelectorAll(".task-item")].map((el) => el.dataset.id);
    Storage.reorderTasks(currentDateKey, orderedIds);
    dragState = null;
    notifyChange();
    render();
  }

  function init(handlers = {}) {
    onChange = handlers.onChange || (() => {});
    document.getElementById("addTaskBtn").addEventListener("click", openAddForm);
    formEl().addEventListener("submit", submitAdd);
  }

  return {
    init,
    show,
    hide,
    render,
  };
})();
