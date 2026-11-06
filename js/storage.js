const Storage = (() => {
  const KEY = "calendar-tasks";
  const BIRTHDAY_KEY = "calendar-birthdays";

  function loadAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function loadBirthdays() {
    try {
      const raw = localStorage.getItem(BIRTHDAY_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveBirthdays(list) {
    localStorage.setItem(BIRTHDAY_KEY, JSON.stringify(list));
  }

  function monthDayKey(month, day) {
    return `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function monthDayFromDateKey(dateKey) {
    const parts = dateKey.split("-");
    return `${parts[1]}-${parts[2]}`;
  }

  function getTasks(dateKey) {
    const all = loadAll();
    const list = Array.isArray(all[dateKey]) ? all[dateKey] : [];
    return list.slice().sort((a, b) => a.order - b.order);
  }

  function setTasks(dateKey, tasks) {
    const all = loadAll();
    if (!tasks.length) {
      delete all[dateKey];
    } else {
      all[dateKey] = tasks.map((task, index) => ({
        ...task,
        order: index,
      }));
    }
    saveAll(all);
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function addTask(dateKey, text) {
    const tasks = getTasks(dateKey);
    const task = {
      id: createId(),
      text: text.trim(),
      done: false,
      order: tasks.length,
    };
    tasks.push(task);
    setTasks(dateKey, tasks);
    return task;
  }

  function updateTask(dateKey, taskId, patch) {
    const tasks = getTasks(dateKey);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...patch };
    setTasks(dateKey, tasks);
    return tasks[index];
  }

  function deleteTask(dateKey, taskId) {
    const tasks = getTasks(dateKey).filter((t) => t.id !== taskId);
    setTasks(dateKey, tasks);
    return tasks;
  }

  function reorderTasks(dateKey, orderedIds) {
    const tasks = getTasks(dateKey);
    const map = new Map(tasks.map((t) => [t.id, t]));
    const next = orderedIds.map((id, order) => {
      const task = map.get(id);
      return task ? { ...task, order } : null;
    }).filter(Boolean);
    setTasks(dateKey, next);
    return next;
  }

  function getStatusMap() {
    const all = loadAll();
    const map = {};
    for (const [dateKey, tasks] of Object.entries(all)) {
      if (!Array.isArray(tasks) || !tasks.length) continue;
      const hasOpen = tasks.some((t) => !t.done);
      const allDone = tasks.every((t) => t.done);
      map[dateKey] = { hasOpen, allDone, count: tasks.length };
    }
    return map;
  }

  function getBirthdaysForDate(dateKey) {
    const md = monthDayFromDateKey(dateKey);
    return loadBirthdays().filter((b) => monthDayKey(b.month, b.day) === md);
  }

  function hasBirthdayOnDate(dateKey) {
    return getBirthdaysForDate(dateKey).length > 0;
  }

  function getBirthdayMonthDays() {
    const set = new Set();
    loadBirthdays().forEach((b) => set.add(monthDayKey(b.month, b.day)));
    return set;
  }

  function addBirthday(dateKey, name) {
    const [, month, day] = dateKey.split("-").map(Number);
    const list = loadBirthdays();
    const entry = {
      id: createId(),
      name: name.trim(),
      month: month - 1,
      day,
    };
    list.push(entry);
    saveBirthdays(list);
    return entry;
  }

  function updateBirthday(id, patch) {
    const list = loadBirthdays();
    const index = list.findIndex((b) => b.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...patch };
    saveBirthdays(list);
    return list[index];
  }

  function deleteBirthday(id) {
    const list = loadBirthdays().filter((b) => b.id !== id);
    saveBirthdays(list);
    return list;
  }

  return {
    getTasks,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    getStatusMap,
    getBirthdaysForDate,
    hasBirthdayOnDate,
    getBirthdayMonthDays,
    addBirthday,
    updateBirthday,
    deleteBirthday,
  };
})();
