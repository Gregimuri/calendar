document.addEventListener("DOMContentLoaded", () => {
  const monthTools = document.getElementById("monthTools");
  const exportBtn = document.getElementById("exportDataBtn");
  const importInput = document.getElementById("importDataInput");
  const apkLink = document.getElementById("apkDownload");

  const cap = window.Capacitor;
  const nativeApp = Boolean(
    cap && (
      (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) ||
      (typeof cap.getPlatform === "function" && cap.getPlatform() !== "web")
    )
  );
  if (nativeApp && apkLink) apkLink.remove();

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

  const moreToggle = document.getElementById("moreToggle");
  const morePanel = document.getElementById("morePanel");

  function setMoreOpen(open) {
    if (!morePanel || !moreToggle) return;
    morePanel.hidden = !open;
    moreToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (moreToggle) {
    moreToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setMoreOpen(morePanel.hidden);
    });
  }

  document.addEventListener("click", (event) => {
    if (!morePanel || morePanel.hidden) return;
    if (event.target.closest("#moreMenu")) return;
    setMoreOpen(false);
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      downloadBackup();
      setMoreOpen(false);
    });
  }
  if (importInput) {
    importInput.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      setMoreOpen(false);
      if (file) importBackup(file);
    });
  }

  setMonthToolsVisible(true);
});
