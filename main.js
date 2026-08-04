const STORAGE_KEY = "okusuriRecordData_v1";

const DEFAULT_DATA = {
  medicines: [
    { id: "morning", name: "朝", type: "regular", order: 1 },
    { id: "noon", name: "昼", type: "regular", order: 2 },
    { id: "night", name: "夜", type: "regular", order: 3 },
    { id: "as-needed", name: "とんぷく", type: "asNeeded", order: 4 },
  ],
  records: [],
};

const regularMedicineList = document.getElementById("regularMedicineList");
const asNeededMedicineList = document.getElementById("asNeededMedicineList");
const historyList = document.getElementById("historyList");
const calendarList = document.getElementById("calendarList");
const medicineSettingsList = document.getElementById("medicineSettingsList");
const calendarButton = document.getElementById("calendarButton");
const settingsButton = document.getElementById("settingsButton");
const medicineForm = document.getElementById("medicineForm");
const medicineName = document.getElementById("medicineName");
const medicineType = document.getElementById("medicineType");
const undoButton = document.getElementById("undoButton");
const toast = document.getElementById("toast");

let appData = loadData();
let toastTimer = null;

calendarButton.addEventListener("click", () => {
  renderCalendar();
  showPanel("calendarPanel");
});

settingsButton.addEventListener("click", () => {
  renderSettings();
  showPanel("settingsPanel");
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    showPanel("mainPanel");
    renderAll();
  });
});

medicineForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addMedicine();
});

undoButton.addEventListener("click", undoLastRecord);

renderAll();

function loadData() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    return structuredClone(DEFAULT_DATA);
  }

  try {
    const savedData = JSON.parse(savedText);

    if (
      !savedData ||
      !Array.isArray(savedData.medicines) ||
      !Array.isArray(savedData.records)
    ) {
      throw new Error("保存形式が正しくありません。");
    }

    return savedData;
  } catch (error) {
    console.error(error);
    alert(
      "保存データを読み込めなかったため、初期状態で開きました。\n" +
      "壊れたデータは上書きしていません。"
    );

    return structuredClone(DEFAULT_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function renderAll() {
  renderMedicineButtons();
  renderHistory();
}

function showPanel(panelId) {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  document.getElementById(panelId).classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderMedicineButtons() {
  regularMedicineList.innerHTML = "";
  asNeededMedicineList.innerHTML = "";

  const medicines = [...appData.medicines].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  medicines.forEach((medicine) => {
    if (medicine.type === "regular") {
      regularMedicineList.appendChild(createRegularMedicineButton(medicine));
      return;
    }

    asNeededMedicineList.appendChild(createAsNeededMedicineCard(medicine));
  });
}

function createRegularMedicineButton(medicine) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "medicine-button";
  button.setAttribute("aria-label", `${medicine.name}のお薬を記録`);

  const isTaken = hasRegularRecordToday(medicine.id);

  if (isTaken) {
    button.classList.add("taken");

    const heart = document.createElement("span");
    heart.className = "taken-heart";
    heart.textContent = "♥";
    heart.setAttribute("aria-label", "飲みました");

    button.appendChild(heart);
  }

  const label = document.createElement("span");
  label.textContent = medicine.name;
  button.appendChild(label);

  button.addEventListener("click", () => {
    toggleRegularMedicine(medicine);
  });

  return button;
}

function createAsNeededMedicineCard(medicine) {
  const card = document.createElement("div");
  card.className = "as-needed-card";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "as-needed-button";
  button.textContent = medicine.name;
  button.setAttribute("aria-label", `${medicine.name}を飲んだと記録`);

  button.addEventListener("click", () => {
    addRecord(medicine);
  });

  const summary = document.createElement("div");
  summary.className = "as-needed-summary";

  const todayRecords = getTodayRecords().filter(
    (record) => record.medicineId === medicine.id
  );

  if (todayRecords.length === 0) {
    summary.textContent = "今日 0回";
  } else {
    const latest = todayRecords[todayRecords.length - 1];

    summary.textContent =
      `今日 ${todayRecords.length}回　最後 ${formatTime(latest.takenAt)}`;
  }

  card.appendChild(button);
  card.appendChild(summary);

  return card;
}

function toggleRegularMedicine(medicine) {
  const existingRecordIndex = appData.records.findIndex((record) => {
    return (
      record.medicineId === medicine.id &&
      getDateKey(record.takenAt) === getDateKey(new Date())
    );
  });

  if (existingRecordIndex >= 0) {
    const shouldRemove = confirm(
      `「${medicine.name}」は今日すでに記録されています。\n\n` +
      "今日の記録を取り消しますか？"
    );

    if (!shouldRemove) return;

    appData.records.splice(existingRecordIndex, 1);
    saveData();
    renderAll();
    showToast(`${medicine.name}の記録を取り消しました`);
    return;
  }

  addRecord(medicine);
}

function addRecord(medicine) {
  appData.records.push({
    id: createId(),
    medicineId: medicine.id,
    medicineName: medicine.name,
    medicineType: medicine.type,
    takenAt: new Date().toISOString(),
  });

  saveData();
  renderAll();
  showToast(`${medicine.name}を記録しました`);
}

function undoLastRecord() {
  if (appData.records.length === 0) return;

  const latestRecord = [...appData.records].sort(
    (a, b) => new Date(b.takenAt) - new Date(a.takenAt)
  )[0];

  const shouldRemove = confirm(
    `直前の記録\n` +
    `${formatMonthDay(latestRecord.takenAt)} ${formatTime(latestRecord.takenAt)} ` +
    `${latestRecord.medicineName}\n\n` +
    "この記録を取り消しますか？"
  );

  if (!shouldRemove) return;

  appData.records = appData.records.filter(
    (record) => record.id !== latestRecord.id
  );

  saveData();
  renderAll();
  showToast("直前の記録を取り消しました");
}

function renderHistory() {
  historyList.innerHTML = "";

  const recentRecords = getRecordsWithinDays(2);

  undoButton.disabled = appData.records.length === 0;

  if (recentRecords.length === 0) {
    historyList.innerHTML =
      '<div class="empty-message">まだ記録がありません。</div>';
    return;
  }

  const grouped = groupRecordsByDate(recentRecords);
  const dateKeys = Object.keys(grouped).sort().reverse();

  dateKeys.forEach((dateKey) => {
    const day = document.createElement("section");
    day.className = "history-day";

    const heading = document.createElement("div");
    heading.className = "history-date";
    heading.textContent = formatHistoryDate(dateKey);
    day.appendChild(heading);

    grouped[dateKey]
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))
      .forEach((record) => {
        const row = document.createElement("div");
        row.className = "history-entry";

        const time = document.createElement("span");
        time.textContent = formatTime(record.takenAt);

        const name = document.createElement("span");
        name.textContent = record.medicineName;

        row.appendChild(time);
        row.appendChild(name);
        day.appendChild(row);
      });

    historyList.appendChild(day);
  });
}

function renderCalendar() {
  calendarList.innerHTML = "";

  const medicines = [...appData.medicines].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);

    const dateKey = getDateKey(date);
    const dayRecords = appData.records
      .filter((record) => getDateKey(record.takenAt) === dateKey)
      .sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt));

    const card = document.createElement("section");
    card.className = "calendar-day-card";

    const title = document.createElement("div");
    title.className = "calendar-day-title";
    title.textContent = formatCalendarDate(date, dayOffset);
    card.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "calendar-record-grid";

    medicines.forEach((medicine) => {
      const records = dayRecords.filter(
        (record) => record.medicineId === medicine.id
      );

      const item = document.createElement("div");
      item.className = "calendar-record";

      if (records.length === 0) {
        item.classList.add("none");
        item.textContent = `${medicine.name}：記録なし`;
      } else if (medicine.type === "regular") {
        item.textContent = `${medicine.name}：♥ ${formatTime(records[0].takenAt)}`;
      } else {
        const times = records.map((record) => formatTime(record.takenAt));
        item.textContent =
          `${medicine.name}：${records.length}回（${times.join("、")}）`;
      }

      grid.appendChild(item);
    });

    card.appendChild(grid);
    calendarList.appendChild(card);
  }
}

function renderSettings() {
  medicineSettingsList.innerHTML = "";

  const medicines = [...appData.medicines].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  medicines.forEach((medicine) => {
    const item = document.createElement("div");
    item.className = "medicine-setting-item";

    const text = document.createElement("div");
    text.className = "medicine-setting-text";
    text.textContent = medicine.name;

    const type = document.createElement("span");
    type.className = "medicine-setting-type";
    type.textContent =
      medicine.type === "regular"
        ? "決まった時間のお薬"
        : "とんぷく";

    text.appendChild(type);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";

    deleteButton.addEventListener("click", () => {
      deleteMedicine(medicine);
    });

    item.appendChild(text);
    item.appendChild(deleteButton);
    medicineSettingsList.appendChild(item);
  });
}

function addMedicine() {
  const name = medicineName.value.trim();
  const type = medicineType.value;

  if (!name) {
    medicineName.focus();
    return;
  }

  appData.medicines.push({
    id: createId(),
    name,
    type,
    order: appData.medicines.length + 1,
  });

  saveData();
  medicineForm.reset();
  renderSettings();
  showToast(`${name}を追加しました`);
}

function deleteMedicine(medicine) {
  const recordCount = appData.records.filter(
    (record) => record.medicineId === medicine.id
  ).length;

  const message =
    recordCount === 0
      ? `「${medicine.name}」を削除しますか？`
      : `「${medicine.name}」を削除しますか？\n\n` +
      `過去の服薬記録 ${recordCount}件は、履歴として残します。`;

  if (!confirm(message)) return;

  appData.medicines = appData.medicines.filter(
    (item) => item.id !== medicine.id
  );

  saveData();
  renderSettings();
  showToast(`${medicine.name}を削除しました`);
}

function hasRegularRecordToday(medicineId) {
  const todayKey = getDateKey(new Date());

  return appData.records.some((record) => {
    return (
      record.medicineId === medicineId &&
      getDateKey(record.takenAt) === todayKey
    );
  });
}

function getTodayRecords() {
  const todayKey = getDateKey(new Date());

  return appData.records
    .filter((record) => getDateKey(record.takenAt) === todayKey)
    .sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt));
}

function getRecordsWithinDays(dayCount) {
  const allowedDateKeys = new Set();

  for (let dayOffset = 0; dayOffset < dayCount; dayOffset++) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    allowedDateKeys.add(getDateKey(date));
  }

  return appData.records.filter((record) => {
    return allowedDateKeys.has(getDateKey(record.takenAt));
  });
}

function groupRecordsByDate(records) {
  return records.reduce((groups, record) => {
    const dateKey = getDateKey(record.takenAt);

    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(record);

    return groups;
  }, {});
}

function getDateKey(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(dateValue) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateValue));
}

function formatMonthDay(dateValue) {
  const date = new Date(dateValue);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatHistoryDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  const todayKey = getDateKey(new Date());

  const yesterday = new Date();
  yesterday.setHours(12, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  if (dateKey === todayKey) {
    return `${date.getDate()}日（今日）`;
  }

  if (dateKey === yesterdayKey) {
    return `${date.getDate()}日（昨日）`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatCalendarDate(date, dayOffset) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const suffix =
    dayOffset === 0 ? "・今日" :
      dayOffset === 1 ? "・昨日" : "";

  return `${date.getMonth() + 1}月${date.getDate()}日（${weekday}）${suffix}`;
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}
