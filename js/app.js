document.addEventListener("DOMContentLoaded", () => {
  TasksView.init({
    onChange: () => {
      CalendarView.refreshDots();
    },
  });

  CalendarView.init({
    onSelect: (dateKey) => {
      const label = CalendarView.formatSelectedLabel(dateKey);
      TasksView.show(dateKey, label);
    },
    onExpand: () => {
      TasksView.hide();
    },
  });
});
