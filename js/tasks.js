const TasksView = (() => {
  const LONG_PRESS_MS = 420;
  const MOVE_TOLERANCE = 10;

  let currentDateKey = null;
  let onChange = () => {};
  let pendingDelete = null;
  let addMode = "task";
  let dragState = null;
  let suppressTapUntil = 0;

  const listEl = () => document.getElementById("taskList");
  const emptyEl = () => document.getElementById("emptyHint");
  const formEl = () => document.getElementById("addForm");
  const inputEl = () => document.getElementById("addInput");
  const dateLabelEl = () => document.getElementById("tasksDateLabel");
  const sectionEl = () => document.getElementById("tasksSection");
  const overlayEl = () => document.getElementById("confirmOverlay");
  const confirmTextEl = () => document.getElementById("confirmText");
  const confirmTitleEl = () => document.getElementById("confirmTitle");
  const dropzoneEl = () => document.getElementById("deleteDropzone");

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
    addMode = "task";
    closeConfirm();
    hideDropzone();
    render();
  }

  function hide() {
    currentDateKey = null;
    sectionEl().hidden = true;
    formEl().hidden = true;
    closeConfirm();
    hideDropzone();
    cancelPendingDrag();
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
    li.dataset.kind = "separator";
    li.dataset.label = "Разделительная линия";

    const line = document.createElement("div");
    line.className = "separator-line";
    line.setAttribute("aria-hidden", "true");
    li.appendChild(line);

    bindLongPressDrag(li, { editable: false });
    return li;
  }

  function bindDoubleTapEdit(text, options) {
    let draft = options.getValue();
    let lastTapAt = 0;
    let editing = false;

    text.contentEditable = "false";
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-label", options.ariaLabel);
    text.spellcheck = true;
    text.classList.add("task-text-readonly");

    function beginEdit() {
      if (editing) return;
      if (dragState && dragState.activated) return;
      editing = true;
      draft = options.getValue();
      text.contentEditable = "true";
      text.classList.remove("task-text-readonly");
      text.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function endEdit(save) {
      if (!editing) {
        text.contentEditable = "false";
        text.classList.add("task-text-readonly");
        return;
      }
      editing = false;
      text.contentEditable = "false";
      text.classList.add("task-text-readonly");

      if (!save) {
        text.textContent = draft;
        return;
      }

      const next = (text.textContent || "").trim();
      if (!next) {
        text.textContent = draft || options.getValue();
        return;
      }
      text.textContent = next;
      if (next !== draft) {
        options.onSave(next);
      }
    }

    text.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      beginEdit();
    });

    text.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse") return;
      if (Date.now() < suppressTapUntil) {
        lastTapAt = 0;
        return;
      }
      if (dragState && dragState.activated) {
        lastTapAt = 0;
        return;
      }
      const now = Date.now();
      if (now - lastTapAt < 340) {
        event.preventDefault();
        beginEdit();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
      }
    });

    text.addEventListener("blur", () => {
      endEdit(true);
    });

    text.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        text.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        endEdit(false);
        text.blur();
      }
    });
  }

  function createBirthdayItem(entry) {
    const li = document.createElement("li");
    li.className = "task-item birthday-item";
    li.dataset.id = entry.id;
    li.dataset.kind = "birthday";
    li.dataset.label = entry.name;

    const icon = document.createElement("img");
    icon.className = "birthday-icon star-icon";
    icon.src = "assets/star.png";
    icon.alt = "";
    icon.width = 28;
    icon.height = 28;
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("p");
    text.className = "task-text birthday-text";
    text.textContent = entry.name;

    bindDoubleTapEdit(text, {
      ariaLabel: "Имя именинника",
      getValue: () => entry.name,
      onSave: (next) => {
        Storage.updateBirthday(entry.id, { name: next });
        entry.name = next;
        li.dataset.label = next;
        notifyChange();
      },
    });

    li.appendChild(icon);
    li.appendChild(text);
    bindLongPressDrag(li);
    return li;
  }

  function createTaskItem(task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");
    li.dataset.id = task.id;
    li.dataset.kind = "task";
    li.dataset.label = task.text;

    const check = document.createElement("button");
    check.type = "button";
    check.className = "task-check";
    check.setAttribute("aria-label", task.done ? "Отметить невыполненной" : "Отметить выполненной");
    check.innerHTML = CHECK_SVG;
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      Storage.updateTask(currentDateKey, task.id, { done: !task.done });
      notifyChange();
      render();
    });
    check.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    const text = document.createElement("p");
    text.className = "task-text";
    text.textContent = task.text;

    bindDoubleTapEdit(text, {
      ariaLabel: "Текст задачи",
      getValue: () => task.text,
      onSave: (next) => {
        Storage.updateTask(currentDateKey, task.id, { text: next });
        task.text = next;
        li.dataset.label = next;
        notifyChange();
      },
    });

    li.appendChild(check);
    li.appendChild(text);
    bindLongPressDrag(li);
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

  /* ---- Long-press drag + top trash dropzone ---- */

  function showDropzone() {
    dropzoneEl().hidden = false;
    document.body.classList.add("is-dragging-item");
  }

  function hideDropzone() {
    const zone = dropzoneEl();
    zone.hidden = true;
    zone.classList.remove("active");
    document.body.classList.remove("is-dragging-item");
  }

  function isOverDropzone(clientX, clientY) {
    const zone = dropzoneEl();
    if (zone.hidden) return false;
    const rect = zone.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function cancelPendingDrag() {
    if (!dragState) return;
    if (dragState.timer) clearTimeout(dragState.timer);
    cleanupDragListeners(dragState);
    if (dragState.item) {
      dragState.item.classList.remove("dragging");
      dragState.item.style.transform = "";
      dragState.item.style.zIndex = "";
    }
    hideDropzone();
    dragState = null;
  }

  function cleanupDragListeners(state) {
    if (!state) return;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function bindLongPressDrag(item) {
    item.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest(".task-check")) return;

      cancelPendingDrag();

      dragState = {
        item,
        kind: item.dataset.kind,
        id: item.dataset.id,
        label: item.dataset.label || "",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        activated: false,
        overTrash: false,
        timer: null,
        startTop: item.getBoundingClientRect().top,
      };

      dragState.timer = setTimeout(() => {
        if (!dragState || dragState.item !== item) return;
        activateDrag(event.clientY);
      }, LONG_PRESS_MS);

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
  }

  function activateDrag(clientY) {
    if (!dragState) return;
    dragState.activated = true;
    dragState.timer = null;
    dragState.lastY = clientY;
    dragState.startY = clientY;

    const active = document.activeElement;
    if (active && dragState.item.contains(active) && typeof active.blur === "function") {
      active.blur();
    }

    dragState.item.classList.add("dragging");
    showDropzone();

    if (navigator.vibrate) {
      try {
        navigator.vibrate(18);
      } catch {
        /* ignore */
      }
    }

    try {
      dragState.item.setPointerCapture(dragState.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    if (!dragState.activated) {
      if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) {
        clearTimeout(dragState.timer);
        cleanupDragListeners(dragState);
        dragState = null;
      }
      return;
    }

    event.preventDefault();
    const offsetY = event.clientY - dragState.startY;
    dragState.item.style.transform = `translateY(${offsetY}px)`;

    const overTrash = isOverDropzone(event.clientX, event.clientY);
    dragState.overTrash = overTrash;
    dropzoneEl().classList.toggle("active", overTrash);

    if (!overTrash && dragState.kind !== "birthday") {
      reorderWhileDragging(event.clientY);
    }
  }

  function reorderWhileDragging(clientY) {
    const list = listEl();
    const items = [...list.querySelectorAll(".task-item:not(.birthday-item)")];
    const from = items.indexOf(dragState.item);
    if (from < 0) return;

    let target = from;
    const mid = clientY;

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
      dragState.startY = clientY;
      dragState.item.style.transform = "translateY(0)";
    }
  }

  function onPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const state = dragState;
    if (state.timer) clearTimeout(state.timer);

    cleanupDragListeners(state);

    try {
      state.item.releasePointerCapture(state.pointerId);
    } catch {
      /* ignore */
    }

    state.item.classList.remove("dragging");
    state.item.style.transform = "";
    hideDropzone();
    dragState = null;

    if (!state.activated) return;

    suppressTapUntil = Date.now() + 450;

    if (state.overTrash) {
      openConfirm({
        type: state.kind,
        id: state.id,
        label: state.label,
      });
      render();
      return;
    }

    if (state.kind !== "birthday" && currentDateKey) {
      const orderedIds = [...listEl().querySelectorAll(".task-item:not(.birthday-item)")].map(
        (el) => el.dataset.id
      );
      Storage.reorderTasks(currentDateKey, orderedIds);
      notifyChange();
    }
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
