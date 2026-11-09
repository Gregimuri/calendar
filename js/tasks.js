const TasksView = (() => {
  let currentDateKey = null;
  let onChange = () => {};
  let pendingDelete = null; // { type: 'task'|'birthday', id, label }
  let addMode = "task"; // 'task' | 'birthday'

  const listEl = () => document.getElementById("taskList");
  const emptyEl = () => document.getElementById("emptyHint");
  const formEl = () => document.getElementById("addForm");
  const inputEl = () => document.getElementById("addInput");
  const dateLabelEl = () => document.getElementById("tasksDateLabel");
  const sectionEl = () => document.getElementById("tasksSection");
  const overlayEl = () => document.getElementById("confirmOverlay");
  const confirmTextEl = () => document.getElementById("confirmText");
  const confirmTitleEl = () => document.getElementById("confirmTitle");

  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="5 13 10 18 19 7"></polyline>
    </svg>
  `;

  const TRASH_SVG = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14"></path>
      <path d="M10 7V5h4v2"></path>
      <path d="M8 7l1 12h6l1-12"></path>
    </svg>
  `;

  function show(dateKey, label) {
    currentDateKey = dateKey;
    sectionEl().hidden = false;
    dateLabelEl().textContent = label;
    formEl().hidden = true;
    inputEl().value = "";
    addMode = "task";
    closeConfirm();
    render();
  }

  function hide() {
    currentDateKey = null;
    sectionEl().hidden = true;
    formEl().hidden = true;
    closeConfirm();
  }

  function render() {
    if (!currentDateKey) return;
    const birthdays = Storage.getBirthdaysForDate(currentDateKey);
    const tasks = Storage.getTasks(currentDateKey);
    const list = listEl();
    list.innerHTML = "";
    emptyEl().hidden = birthdays.length > 0 || tasks.length > 0;

    birthdays.forEach((b) => {
      list.appendChild(createBirthdayItem(b));
    });
    tasks.forEach((task) => {
      list.appendChild(
        Storage.isSeparator(task) ? createSeparatorItem(task) : createTaskItem(task)
      );
    });
  }

  function createSeparatorItem(item) {
    const li = document.createElement("li");
    li.className = "task-item separator-item";
    li.dataset.id = item.id;

    const line = document.createElement("div");
    line.className = "separator-line";
    line.setAttribute("aria-hidden", "true");

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.setAttribute("aria-label", "Удалить разделитель");
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", () => {
      openConfirm({
        type: "separator",
        id: item.id,
        label: "Разделительная линия",
      });
    });

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "task-handle";
    handle.setAttribute("aria-label", "Перетащить разделитель");
    handle.innerHTML = "<span></span><span></span><span></span>";
    bindDrag(handle, li);

    li.appendChild(line);
    li.appendChild(del);
    li.appendChild(handle);
    return li;
  }

  function createBirthdayItem(entry) {
    const li = document.createElement("li");
    li.className = "task-item birthday-item";
    li.dataset.id = entry.id;

    const icon = document.createElement("span");
    icon.className = "birthday-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "🎁";

    const text = document.createElement("p");
    text.className = "task-text birthday-text";
    text.textContent = `День рождения: ${entry.name}`;
    text.contentEditable = "true";
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-label", "Имя именинника");
    text.spellcheck = true;

    let draft = entry.name;

    text.addEventListener("focus", () => {
      draft = entry.name;
      text.textContent = entry.name;
    });

    text.addEventListener("blur", () => {
      const next = (text.textContent || "").trim();
      if (!next) {
        text.textContent = `День рождения: ${draft || entry.name}`;
        return;
      }
      if (next !== entry.name) {
        Storage.updateBirthday(entry.id, { name: next });
        notifyChange();
      }
      text.textContent = `День рождения: ${next}`;
    });

    text.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        text.blur();
      }
      if (event.key === "Escape") {
        text.textContent = `День рождения: ${entry.name}`;
        text.blur();
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.setAttribute("aria-label", "Удалить день рождения");
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", () => {
      openConfirm({
        type: "birthday",
        id: entry.id,
        label: entry.name,
      });
    });

    const spacer = document.createElement("span");
    spacer.className = "task-handle-spacer";
    spacer.setAttribute("aria-hidden", "true");

    li.appendChild(icon);
    li.appendChild(text);
    li.appendChild(del);
    li.appendChild(spacer);
    return li;
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

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.setAttribute("aria-label", "Удалить задачу");
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", () => {
      openConfirm({
        type: "task",
        id: task.id,
        label: task.text,
      });
    });

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "task-handle";
    handle.setAttribute("aria-label", "Перетащить задачу");
    handle.innerHTML = "<span></span><span></span><span></span>";
    bindDrag(handle, li);

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(del);
    li.appendChild(handle);
    return li;
  }

  function openConfirm(item) {
    pendingDelete = item;
    const titles = {
      birthday: "Удалить день рождения?",
      separator: "Удалить разделитель?",
      task: "Удалить задачу?",
    };
    confirmTitleEl().textContent = titles[item.type] || titles.task;
    const preview = item.label.length > 80 ? `${item.label.slice(0, 80)}…` : item.label;
    confirmTextEl().textContent = preview || "Без названия";
    overlayEl().hidden = false;
    document.getElementById("confirmOk").focus();
  }

  function closeConfirm() {
    pendingDelete = null;
    overlayEl().hidden = true;
  }

  function confirmDelete() {
    if (!pendingDelete) {
      closeConfirm();
      return;
    }
    if (pendingDelete.type === "birthday") {
      Storage.deleteBirthday(pendingDelete.id);
    } else if (currentDateKey) {
      Storage.deleteTask(currentDateKey, pendingDelete.id);
    }
    closeConfirm();
    notifyChange();
    render();
  }

  function notifyChange() {
    onChange();
  }

  function syncSubmitLabel() {
    const btn = formEl().querySelector(".add-submit");
    if (!btn) return;
    if (addMode === "birthday") {
      btn.textContent = "Готово";
      return;
    }
    btn.textContent = inputEl().value.trim() ? "Готово" : "Разделитель";
  }

  function openAddForm(mode) {
    if (!currentDateKey) return;
    // Second tap on + with empty field → create separator immediately
    if (
      mode === "task" &&
      addMode === "task" &&
      !formEl().hidden &&
      !inputEl().value.trim()
    ) {
      Storage.addSeparator(currentDateKey);
      formEl().hidden = true;
      inputEl().placeholder = "Новая задача…";
      notifyChange();
      render();
      return;
    }
    addMode = mode;
    formEl().hidden = false;
    inputEl().value = "";
    inputEl().placeholder = mode === "birthday"
      ? "Имя именинника…"
      : "Текст задачи или пусто для линии";
    syncSubmitLabel();
    inputEl().focus();
  }

  function submitAdd(event) {
    if (event) event.preventDefault();
    if (!currentDateKey) return;
    const text = inputEl().value.trim();
    if (addMode === "birthday") {
      if (!text) {
        inputEl().focus();
        return;
      }
      Storage.addBirthday(currentDateKey, text);
    } else if (!text) {
      Storage.addSeparator(currentDateKey);
    } else {
      Storage.addTask(currentDateKey, text);
    }
    inputEl().value = "";
    formEl().hidden = true;
    addMode = "task";
    inputEl().placeholder = "Новая задача…";
    syncSubmitLabel();
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
    const items = [...list.querySelectorAll(".task-item:not(.birthday-item)")];
    const index = items.indexOf(item);
    if (index < 0) return;

    dragState = {
      item,
      startY: event.clientY,
      offsetY: 0,
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
    const items = [...list.querySelectorAll(".task-item:not(.birthday-item)")];
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

    const orderedIds = [...listEl().querySelectorAll(".task-item:not(.birthday-item)")].map(
      (el) => el.dataset.id
    );
    Storage.reorderTasks(currentDateKey, orderedIds);
    dragState = null;
    notifyChange();
    render();
  }

  function init(handlers = {}) {
    onChange = handlers.onChange || (() => {});
    document.getElementById("addTaskBtn").addEventListener("click", () => openAddForm("task"));
    document.getElementById("addBirthdayBtn").addEventListener("click", () => openAddForm("birthday"));
    formEl().addEventListener("submit", submitAdd);
    inputEl().addEventListener("input", syncSubmitLabel);
    inputEl().addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitAdd(event);
      }
    });
    document.getElementById("confirmCancel").addEventListener("click", closeConfirm);
    document.getElementById("confirmOk").addEventListener("click", confirmDelete);
    overlayEl().addEventListener("click", (event) => {
      if (event.target === overlayEl()) closeConfirm();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlayEl().hidden) {
        closeConfirm();
      }
    });
  }

  return {
    init,
    show,
    hide,
    render,
  };
})();
