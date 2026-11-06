const Storage = (() => {
  const KEY = "calendar-tasks";

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

  return {
    getTasks,
    addTask,
    updateTask,
    reorderTasks,
    getStatusMap,
  };
})();
