document.addEventListener("DOMContentLoaded", () => {
  const monthTools = document.getElementById("monthTools");
  const exportBtn = document.getElementById("exportDataBtn");
  const importInput = document.getElementById("importDataInput");

  function setMonthToolsVisible(visible) {
    if (!monthTools) return;
    monthTools.hidden = !visible;
  }

  function refreshOpenDay() {
    CalendarView.refreshDots();
    const key = CalendarView.getSelectedKey();
    if (key) {
      TasksView.show(key, CalendarView.formatSelectedLabel(key));
    }
  }

  function downloadBackup() {
    const payload = Storage.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `calendar-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        const ok = window.confirm("Заменить текущие задачи и дни рождения данными из файла?");
        if (!ok) return;
        Storage.importData(data);
        refreshOpenDay();
      } catch {
        window.alert("Не удалось прочитать файл. Нужен JSON, сохранённый из этого календаря.");
      }
    };
    reader.readAsText(file);
  }

  TasksView.init({
    onChange: () => {
      CalendarView.refreshDots();
    },
  });

  CalendarView.init({
    onSelect: (dateKey) => {
      const label = CalendarView.formatSelectedLabel(dateKey);
      TasksView.show(dateKey, label);
      setMonthToolsVisible(false);
    },
    onExpand: () => {
      TasksView.hide();
      setMonthToolsVisible(true);
    },
  });

  if (exportBtn) exportBtn.addEventListener("click", downloadBackup);
  if (importInput) {
    importInput.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      if (file) importBackup(file);
    });
  }

  setMonthToolsVisible(true);
});
