document.addEventListener("DOMContentLoaded", () => {
  const apkLink = document.getElementById("apkDownload");

  function setApkVisible(visible) {
    if (!apkLink) return;
    apkLink.hidden = !visible;
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
      setApkVisible(false);
    },
    onExpand: () => {
      TasksView.hide();
      setApkVisible(true);
    },
  });

  setApkVisible(true);
});
