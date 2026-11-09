const CalendarView = (() => {
  const MONTHS = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
  ];

  let viewYear;
  let viewMonth;
  let selectedKey = null;
  let collapsed = false;
  let onSelect = () => {};
  let onExpand = () => {};

  const gridEl = () => document.getElementById("calendarGrid");
  const monthLabelEl = () => document.getElementById("monthLabel");
  const expandHintEl = () => document.getElementById("expandHint");
  const sectionEl = () => document.querySelector(".calendar-section");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toKey(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function todayKey() {
    const now = new Date();
    return toKey(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function compareKeys(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function getMondayIndex(date) {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  function getWeekStart(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() - getMondayIndex(copy));
    return copy;
  }

  // Fixed-date Russian public holidays (month 0-based)
  const HOLIDAYS = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], // New Year holidays
    [1, 23], // Defender of the Fatherland Day
    [2, 8],  // International Women's Day
    [4, 1],  // Spring and Labour Day
    [4, 9],  // Victory Day
    [5, 12], // Russia Day
    [10, 4], // Unity Day
  ];

  function isHoliday(date) {
    const m = date.getMonth();
    const d = date.getDate();
    return HOLIDAYS.some(([hm, hd]) => hm === m && hd === d);
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function dotClassFor(dateKey, status) {
    if (!status) return "";
    const today = todayKey();
    const cmp = compareKeys(dateKey, today);

    // All tasks done → green (any date)
    if (status.allDone) return "all-done";

    // Incomplete tasks
    if (status.hasOpen) {
      if (cmp > 0) return "future-open"; // future → gray
      if (cmp === 0) return "today-open"; // today → yellow
      return "past-open"; // past → red
    }
    return "";
  }

  function buildCells() {
    const first = new Date(viewYear, viewMonth, 1);
    const start = getWeekStart(first);
    const cells = [];

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      cells.push({
        date,
        key: toKey(date.getFullYear(), date.getMonth(), date.getDate()),
        inMonth: date.getMonth() === viewMonth,
      });
    }

    // Trim trailing empty week if last week is entirely next month
    const lastWeekInMonth = cells.slice(35).some((c) => c.inMonth);
    return lastWeekInMonth ? cells : cells.slice(0, 35);
  }

  function selectedWeekKeys() {
    if (!selectedKey) return new Set();
    const start = getWeekStart(parseKey(selectedKey));
    const keys = new Set();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      keys.add(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return keys;
  }

  function render() {
    const statusMap = Storage.getStatusMap();
    const birthdayDays = Storage.getBirthdayMonthDays();
    const cells = buildCells();
    const weekKeys = collapsed ? selectedWeekKeys() : null;
    const today = todayKey();

    monthLabelEl().textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    expandHintEl().hidden = !collapsed;
    sectionEl().classList.toggle("collapsed", collapsed);

    const grid = gridEl();
    grid.innerHTML = "";

    cells.forEach((cell) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-cell";
      btn.dataset.date = cell.key;
      btn.setAttribute("aria-label", cell.date.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }));

      if (!cell.inMonth) btn.classList.add("other-month");
      if (cell.key === today) btn.classList.add("today");
      if (cell.key === selectedKey) btn.classList.add("selected");
      if (isWeekend(cell.date) || isHoliday(cell.date)) btn.classList.add("day-off");

      if (collapsed && weekKeys && !weekKeys.has(cell.key)) {
        btn.classList.add("week-hidden");
      }

      const num = document.createElement("span");
      num.className = "day-num";
      num.textContent = String(cell.date.getDate());
      btn.appendChild(num);

      const markers = document.createElement("span");
      markers.className = "day-markers";

      const md = `${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
      if (birthdayDays.has(md)) {
        const gift = document.createElement("img");
        gift.className = "day-gift star-icon";
        gift.src = "assets/star.png";
        gift.alt = "";
        gift.width = 10;
        gift.height = 10;
        gift.setAttribute("aria-hidden", "true");
        markers.appendChild(gift);
      }

      const dot = document.createElement("span");
      dot.className = "day-dot";
      const cls = dotClassFor(cell.key, statusMap[cell.key]);
      if (cls) dot.classList.add(cls);
      markers.appendChild(dot);

      btn.appendChild(markers);

      btn.addEventListener("click", () => {
        selectDay(cell.key);
      });

      grid.appendChild(btn);
    });
  }

  function selectDay(dateKey) {
    const date = parseKey(dateKey);
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    selectedKey = dateKey;
    collapsed = true;
    render();
    onSelect(dateKey);
  }

  function expand() {
    if (!collapsed) return;
    collapsed = false;
    render();
    onExpand();
  }

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    if (collapsed && selectedKey) {
      const selected = parseKey(selectedKey);
      if (selected.getFullYear() !== viewYear || selected.getMonth() !== viewMonth) {
        collapsed = false;
        selectedKey = null;
        onExpand();
      }
    }
    render();
  }

  function init(handlers = {}) {
    onSelect = handlers.onSelect || (() => {});
    onExpand = handlers.onExpand || (() => {});
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    document.getElementById("prevMonth").addEventListener("click", () => shiftMonth(-1));
    document.getElementById("nextMonth").addEventListener("click", () => shiftMonth(1));
    document.getElementById("monthTitle").addEventListener("click", () => {
      if (collapsed) expand();
    });

    render();
  }

  function refreshDots() {
    render();
  }

  function getSelectedKey() {
    return selectedKey;
  }

  function formatSelectedLabel(dateKey) {
    const date = parseKey(dateKey);
    return date.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  return {
    init,
    selectDay,
    expand,
    refreshDots,
    getSelectedKey,
    formatSelectedLabel,
    todayKey,
  };
})();
