const STORAGE_KEY = "split-vacanza-expenses";
const PACKING_STORAGE_KEY = "split-vacanza-packing";
const PEOPLE = 2;
const API_URL = "/api/expenses";
const EVENTS_URL = "/api/events";
const DEFAULT_YEAR = "2026";

const form = document.querySelector("#expenseForm");
const nameInput = document.querySelector("#expenseName");
const costInput = document.querySelector("#expenseCost");
const dateInput = document.querySelector("#expenseDate");
const list = document.querySelector("#expenseList");
const emptyState = document.querySelector("#emptyState");
const clearAllButton = document.querySelector("#clearAll");
const totalAmount = document.querySelector("#totalAmount");
const perPersonAmount = document.querySelector("#perPersonAmount");
const expenseCount = document.querySelector("#expenseCount");
const paidList = document.querySelector("#paidList");
const pendingList = document.querySelector("#pendingList");
const paidTotal = document.querySelector("#paidTotal");
const pendingTotal = document.querySelector("#pendingTotal");
const undoClearBar = document.querySelector("#undoClearBar");
const undoClearButton = document.querySelector("#undoClear");
const undoClearText = document.querySelector("#undoClearText");
const syncStatus = document.querySelector("#syncStatus");
const lorePaidTotal = document.querySelector("#lorePaidTotal");
const beaPaidTotal = document.querySelector("#beaPaidTotal");
const settlementAmount = document.querySelector("#settlementAmount");
const settlementText = document.querySelector("#settlementText");
const dateFilter = document.querySelector("#dateFilter");
const filterCount = document.querySelector("#filterCount");
const navigationButtons = [...document.querySelectorAll("[data-view]")];
const appViews = [...document.querySelectorAll("[data-app-view]")];
const packingForm = document.querySelector("#packingForm");
const packingNameInput = document.querySelector("#packingName");
const packingList = document.querySelector("#packingList");
const packingEmptyState = document.querySelector("#packingEmptyState");
const packingCount = document.querySelector("#packingCount");
const packedCount = document.querySelector("#packedCount");
const unpackedCount = document.querySelector("#unpackedCount");
const packingProgress = document.querySelector("#packingProgress");

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

let expenses = loadLocalExpenses({ useSeed: true });
let packingItems = loadLocalPackingItems();
let undoSnapshot = null;
let backend = "local";
let firestoreDocRef = null;
let firestoreSetDoc = null;
let firestorePackingDocRef = null;
let editingExpenseId = null;
let editingPackingItemId = null;
let undoMessage = "";
let selectedDateFilter = "all";

function seedExpenses() {
  return [
    { id: crypto.randomUUID(), name: "Hotel", cost: 420, paid: false, payerA: false, payerB: false, description: "" },
    { id: crypto.randomUUID(), name: "Cena vista mare", cost: 86.5, paid: false, payerA: false, payerB: false, description: "" },
    { id: crypto.randomUUID(), name: "Treno aeroporto", cost: 32, paid: false, payerA: false, payerB: false, description: "" },
  ];
}

function normalizeExpenses(items) {
  return Array.isArray(items)
    ? items
        .filter((expense) => expense && typeof expense.name === "string")
        .map((expense) => {
          const payerA = Boolean(expense.payerA);
          const payerB = Boolean(expense.payerB);

          return {
            id: expense.id || crypto.randomUUID(),
            name: expense.name,
            cost: Number(expense.cost) || 0,
            paid: payerA && payerB,
            payerA,
            payerB,
            description: typeof expense.description === "string" ? expense.description : "",
          };
        })
    : [];
}

function sameExpenses(left, right) {
  return JSON.stringify(normalizeExpenses(left)) === JSON.stringify(normalizeExpenses(right));
}

function loadLocalExpenses({ useSeed }) {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return useSeed ? seedExpenses() : [];
  }

  try {
    return normalizeExpenses(JSON.parse(saved));
  } catch {
    return useSeed ? seedExpenses() : [];
  }
}

function saveLocalExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function normalizePackingItems(items) {
  return Array.isArray(items)
    ? items
        .filter((item) => item && typeof item.name === "string" && item.name.trim())
        .map((item) => ({
          id: item.id || crypto.randomUUID(),
          name: capitalizeFirstLetter(item.name),
          packed: Boolean(item.packed),
        }))
    : [];
}

function loadLocalPackingItems() {
  const saved = localStorage.getItem(PACKING_STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    return normalizePackingItems(JSON.parse(saved));
  } catch {
    return [];
  }
}

function saveLocalPackingItems() {
  localStorage.setItem(PACKING_STORAGE_KEY, JSON.stringify(packingItems));
}

function setSyncStatus(text, mode = "local") {
  syncStatus.textContent = text;
  syncStatus.dataset.mode = mode;
}

function cloneExpenses(items) {
  return items.map((expense) => ({ ...expense }));
}

function clearUndoSnapshot() {
  undoSnapshot = null;
  undoMessage = "";
  undoClearBar.classList.add("hidden");
}

function showUndoSnapshot(message = "") {
  if (!undoSnapshot || undoSnapshot.length === 0) {
    clearUndoSnapshot();
    return;
  }

  const label = undoSnapshot.length === 1 ? "voce eliminata" : "voci eliminate";
  undoMessage = message || `${undoSnapshot.length} ${label}.`;
  undoClearText.textContent = undoMessage;
  undoClearBar.classList.remove("hidden");
}

function formatMoney(value) {
  return euroFormatter.format(value);
}

function capitalizeFirstLetter(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  return `${trimmedValue.charAt(0).toLocaleUpperCase("it-IT")}${trimmedValue.slice(1)}`;
}

function formatDescription(value) {
  if (!value) {
    return "";
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return value;
  }

  return `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
}

function parseDayMonth(value) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return "";
  }

  const dateMatch = cleanValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateMatch) {
    return cleanValue;
  }

  const compactMatch = cleanValue.match(/^(\d{2})(\d{2})$/);
  const separatedMatch = cleanValue.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  const match = compactMatch || separatedMatch;

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Number(DEFAULT_YEAR), month - 1, day);

  if (date.getFullYear() !== Number(DEFAULT_YEAR) || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${DEFAULT_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function storageDateToDayMonth(value) {
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return dateMatch ? `${dateMatch[3]}/${dateMatch[2]}` : value;
}

function getDateFilterLabel(value) {
  if (value === "no-date") {
    return "Senza data";
  }

  return formatDescription(value);
}

function getPayerStatus(expense) {
  return expense.paid ? "" : "Chi ha pagato?";
}

function canMarkAsPaid(expense) {
  return Boolean(expense.payerA && expense.payerB);
}

function getPaymentBalance(items) {
  return items.reduce(
    (balance, expense) => {
      if (expense.payerA && expense.payerB) {
        balance.lore += expense.cost / PEOPLE;
        balance.bea += expense.cost / PEOPLE;
      } else if (expense.payerA) {
        balance.lore += expense.cost;
      } else if (expense.payerB) {
        balance.bea += expense.cost;
      } else {
        balance.unassigned += expense.cost;
      }

      return balance;
    },
    { lore: 0, bea: 0, unassigned: 0 }
  );
}

async function persistExpenses() {
  saveLocalExpenses();

  if (backend === "firebase" && firestoreDocRef && firestoreSetDoc) {
    try {
      await firestoreSetDoc(firestoreDocRef, {
        expenses,
        updatedAt: Date.now(),
      });
      return;
    } catch {
      backend = "local";
      setSyncStatus("Firebase non raggiungibile: salvataggio locale", "local");
      return;
    }
  }

  if (backend === "server") {
    try {
      const response = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      });

      if (!response.ok) {
        throw new Error("Errore di salvataggio");
      }
    } catch {
      backend = "local";
      setSyncStatus("Connessione server persa: salvataggio locale", "local");
    }
  }
}

async function persistPackingItems() {
  saveLocalPackingItems();

  if (backend === "firebase" && firestorePackingDocRef && firestoreSetDoc) {
    try {
      await firestoreSetDoc(firestorePackingDocRef, {
        items: packingItems,
        updatedAt: Date.now(),
      });
      return;
    } catch {
      backend = "local";
      setSyncStatus("Firebase non raggiungibile: salvataggio locale", "local");
    }
  }
}

function applyRemoteExpenses(remoteExpenses) {
  const nextExpenses = normalizeExpenses(remoteExpenses);

  if (!sameExpenses(expenses, nextExpenses)) {
    clearUndoSnapshot();
  }

  expenses = nextExpenses;
  saveLocalExpenses();
  render();
}

function applyRemotePackingItems(remoteItems) {
  packingItems = normalizePackingItems(remoteItems);
  saveLocalPackingItems();
  renderPackingList();
}

async function initFirebaseMode() {
  let firebaseConfig;
  let firebaseTripId;

  try {
    const configModule = await import("./firebase-config.js");
    firebaseConfig = configModule.firebaseConfig;
    firebaseTripId = configModule.tripId || "vacanza";
  } catch {
    return false;
  }

  if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("INSERISCI")) {
    return false;
  }

  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"),
    ]);
    const { getFirestore, doc, onSnapshot, setDoc } = firestore;
    const app = initializeApp(firebaseConfig);
    const database = getFirestore(app);

    firestoreDocRef = doc(database, "trips", firebaseTripId);
    firestorePackingDocRef = doc(database, "trips", firebaseTripId, "packing", "items");
    firestoreSetDoc = setDoc;
    backend = "firebase";
    setSyncStatus("Firebase attivo: sincronizzazione cloud", "live");

    const localExpenses = loadLocalExpenses({ useSeed: false });
    const localPackingItems = loadLocalPackingItems();

    onSnapshot(firestoreDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        applyRemoteExpenses(snapshot.data().expenses || []);
        return;
      }

      if (localExpenses.length > 0) {
        expenses = localExpenses;
        render();
        await persistExpenses();
      } else {
        applyRemoteExpenses([]);
      }
    });

    onSnapshot(
      firestorePackingDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          applyRemotePackingItems(snapshot.data().items || []);
          return;
        }

        if (localPackingItems.length > 0) {
          packingItems = localPackingItems;
          renderPackingList();
          await persistPackingItems();
        } else {
          applyRemotePackingItems([]);
        }
      },
      () => {
        setSyncStatus("Aggiorna le regole Firebase per sincronizzare la Valigia", "local");
      }
    );

    return true;
  } catch {
    backend = "local";
    setSyncStatus("Firebase non configurato: modalita locale", "local");
    return false;
  }
}

async function initServerMode() {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return false;
  }

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("API non disponibile");
    }

    const payload = await response.json();
    const serverExpenses = normalizeExpenses(payload.expenses);
    const localExpenses = loadLocalExpenses({ useSeed: false });

    backend = "server";
    setSyncStatus("Server locale attivo: sincronizzazione in rete", "live");

    if (serverExpenses.length === 0 && localExpenses.length > 0) {
      expenses = localExpenses;
      render();
      await persistExpenses();
    } else {
      applyRemoteExpenses(serverExpenses);
    }

    connectToServerEvents();
    return true;
  } catch {
    return false;
  }
}

function connectToServerEvents() {
  const events = new EventSource(EVENTS_URL);

  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "expenses") {
      applyRemoteExpenses(payload.expenses);
    }
  };

  events.onerror = () => {
    setSyncStatus("Riconnessione server locale", "local");
  };

  events.onopen = () => {
    backend = "server";
    setSyncStatus("Server locale attivo: sincronizzazione in rete", "live");
  };
}

async function initSync() {
  if (await initFirebaseMode()) {
    return;
  }

  if (await initServerMode()) {
    return;
  }

  setSyncStatus("Modalita locale", "local");
}

function renderStatusGroup(targetList, targetTotal, groupExpenses, emptyText) {
  targetList.innerHTML = "";

  groupExpenses.forEach((expense) => {
    const item = document.createElement("li");
    item.className = "status-item";

    const name = document.createElement("span");
    name.textContent = expense.name;

    const amount = document.createElement("strong");
    amount.textContent = formatMoney(expense.cost);

    item.append(name, amount);
    targetList.append(item);
  });

  if (groupExpenses.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "status-item is-empty";
    emptyItem.textContent = emptyText;
    targetList.append(emptyItem);
  }

  const total = groupExpenses.reduce((sum, expense) => sum + expense.cost, 0);
  targetTotal.textContent = formatMoney(total);
}

function renderSettlement(total) {
  const balance = getPaymentBalance(expenses);
  const perPerson = total / PEOPLE;
  const loreDelta = balance.lore - perPerson;
  const roundedDelta = Math.round(loreDelta * 100) / 100;
  const absoluteDelta = Math.abs(roundedDelta);

  lorePaidTotal.textContent = formatMoney(balance.lore);
  beaPaidTotal.textContent = formatMoney(balance.bea);
  settlementAmount.textContent = formatMoney(absoluteDelta);

  if (balance.unassigned > 0) {
    settlementAmount.textContent = "Da definire";
    settlementText.textContent = `Mancano ${formatMoney(balance.unassigned)} senza pagatore: seleziona Lore o Bea per completare il conguaglio.`;
    return;
  }

  if (expenses.length === 0) {
    settlementText.textContent = "Aggiungi le spese e seleziona chi ha pagato.";
    return;
  }

  if (absoluteDelta < 0.01) {
    settlementText.textContent = "Tutto pari: Lore e Bea hanno sostenuto la stessa quota.";
    return;
  }

  if (roundedDelta > 0) {
    settlementText.textContent = `Bea deve a Lore ${formatMoney(absoluteDelta)}.`;
  } else {
    settlementText.textContent = `Lore deve a Bea ${formatMoney(absoluteDelta)}.`;
  }
}

function getFilteredExpenses() {
  if (selectedDateFilter === "all") {
    return expenses;
  }

  if (selectedDateFilter === "no-date") {
    return expenses.filter((expense) => !expense.description);
  }

  return expenses.filter((expense) => expense.description === selectedDateFilter);
}

function renderDateFilter() {
  const currentValue = selectedDateFilter;
  const dateValues = [...new Set(expenses.map((expense) => expense.description).filter(Boolean))].sort();
  const hasNoDate = expenses.some((expense) => !expense.description);

  dateFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Tutte le date";
  dateFilter.append(allOption);

  dateValues.forEach((dateValue) => {
    const option = document.createElement("option");
    option.value = dateValue;
    option.textContent = getDateFilterLabel(dateValue);
    dateFilter.append(option);
  });

  if (hasNoDate) {
    const noDateOption = document.createElement("option");
    noDateOption.value = "no-date";
    noDateOption.textContent = "Senza data";
    dateFilter.append(noDateOption);
  }

  const values = [...dateFilter.options].map((option) => option.value);
  selectedDateFilter = values.includes(currentValue) ? currentValue : "all";
  dateFilter.value = selectedDateFilter;
}

function createPayerToggle(expense, field, labelText) {
  const label = document.createElement("label");
  label.className = "payer-toggle";

  const checkbox = document.createElement("input");
  checkbox.className = "payer-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(expense[field]);
  checkbox.setAttribute("aria-label", `${labelText} ha pagato ${expense.name}`);
  checkbox.addEventListener("change", async () => {
    clearUndoSnapshot();
    expenses = expenses.map((itemExpense) => {
      if (itemExpense.id !== expense.id) {
        return itemExpense;
      }

      const updatedExpense = { ...itemExpense, [field]: checkbox.checked };
      return {
        ...updatedExpense,
        paid: canMarkAsPaid(updatedExpense),
      };
    });
    render();
    await persistExpenses();
  });

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(checkbox, text);
  return label;
}

function createEditForm(expense) {
  const editForm = document.createElement("form");
  editForm.className = "inline-edit-form";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Voce";
  const editName = document.createElement("input");
  editName.type = "text";
  editName.value = expense.name;
  editName.required = true;
  nameLabel.append(editName);

  const costLabel = document.createElement("label");
  costLabel.textContent = "Costo";
  const editCost = document.createElement("input");
  editCost.type = "number";
  editCost.min = "0.01";
  editCost.step = "0.01";
  editCost.value = String(expense.cost);
  editCost.required = true;
  costLabel.append(editCost);

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "Data acquisto";
  const editDescription = document.createElement("input");
  editDescription.type = "text";
  editDescription.inputMode = "numeric";
  editDescription.maxLength = 5;
  editDescription.placeholder = "gg/mm";
  editDescription.value = storageDateToDayMonth(expense.description || "");
  dateLabel.append(editDescription);

  const actions = document.createElement("div");
  actions.className = "inline-edit-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Salva";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Annulla";
  cancelButton.addEventListener("click", () => {
    editingExpenseId = null;
    render();
  });

  actions.append(saveButton, cancelButton);
  editForm.append(nameLabel, costLabel, dateLabel, actions);

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nextName = capitalizeFirstLetter(editName.value);
    const nextCost = Number(editCost.value);
    const nextDescription = parseDayMonth(editDescription.value);

    if (!nextName || Number.isNaN(nextCost) || nextCost <= 0 || nextDescription === null) {
      return;
    }

    clearUndoSnapshot();
    expenses = expenses.map((itemExpense) =>
      itemExpense.id === expense.id
        ? {
            ...itemExpense,
            name: nextName,
            cost: Math.round(nextCost * 100) / 100,
            description: nextDescription,
          }
        : itemExpense
    );
    editingExpenseId = null;
    render();
    await persistExpenses();
  });

  return editForm;
}

function createPackingEditForm(packingItem) {
  const editForm = document.createElement("form");
  editForm.className = "packing-edit-form";

  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.value = packingItem.name;
  editInput.required = true;
  editInput.setAttribute("aria-label", `Modifica ${packingItem.name}`);

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Salva";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Annulla";
  cancelButton.addEventListener("click", () => {
    editingPackingItemId = null;
    renderPackingList();
  });

  editForm.append(editInput, saveButton, cancelButton);
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nextName = capitalizeFirstLetter(editInput.value);

    if (!nextName) {
      return;
    }

    packingItems = packingItems.map((item) =>
      item.id === packingItem.id ? { ...item, name: nextName } : item
    );
    editingPackingItemId = null;
    renderPackingList();
    await persistPackingItems();
  });

  queueMicrotask(() => editInput.focus());
  return editForm;
}

function renderPackingList() {
  packingList.innerHTML = "";

  packingItems.forEach((packingItem) => {
    const item = document.createElement("li");
    item.className = "packing-item";
    item.classList.toggle("is-packed", packingItem.packed);

    const checkLabel = document.createElement("label");
    checkLabel.className = "packing-check";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = packingItem.packed;
    checkbox.setAttribute("aria-label", `${packingItem.name} in valigia`);
    checkbox.addEventListener("change", async () => {
      packingItems = packingItems.map((itemValue) =>
        itemValue.id === packingItem.id ? { ...itemValue, packed: checkbox.checked } : itemValue
      );
      renderPackingList();
      await persistPackingItems();
    });

    const checkMark = document.createElement("span");
    checkMark.className = "packing-check-mark";
    checkLabel.append(checkbox, checkMark);

    const name = document.createElement("span");
    name.className = "packing-item-name";
    name.textContent = packingItem.name;

    const actions = document.createElement("div");
    actions.className = "packing-actions";

    const editButton = document.createElement("button");
    editButton.className = "packing-edit-button";
    editButton.type = "button";
    editButton.textContent = "Modifica";
    editButton.setAttribute("aria-label", `Modifica ${packingItem.name}`);
    editButton.addEventListener("click", () => {
      editingPackingItemId = packingItem.id;
      renderPackingList();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "packing-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Elimina ${packingItem.name}`);
    deleteButton.addEventListener("click", async () => {
      packingItems = packingItems.filter((itemValue) => itemValue.id !== packingItem.id);
      editingPackingItemId = null;
      renderPackingList();
      await persistPackingItems();
    });

    actions.append(editButton, deleteButton);
    item.append(checkLabel, name, actions);

    if (editingPackingItemId === packingItem.id) {
      item.append(createPackingEditForm(packingItem));
    }

    packingList.append(item);
  });

  const completedItems = packingItems.filter((item) => item.packed).length;
  packingCount.textContent = String(packingItems.length);
  packedCount.textContent = String(completedItems);
  unpackedCount.textContent = String(packingItems.length - completedItems);
  packingProgress.textContent = `${completedItems} di ${packingItems.length}`;
  packingEmptyState.classList.toggle("hidden", packingItems.length > 0);
}

function selectView(viewName) {
  navigationButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  appViews.forEach((view) => {
    const isActive = view.dataset.appView === viewName;
    view.classList.toggle("is-active", isActive);
    view.hidden = !isActive;
  });
}

function render() {
  list.innerHTML = "";
  renderDateFilter();

  const visibleExpenses = getFilteredExpenses();

  visibleExpenses.forEach((expense) => {
    const item = document.createElement("li");
    item.className = "expense-item";
    item.classList.toggle("is-paid", expense.paid);
    item.classList.toggle("is-editing", editingExpenseId === expense.id);

    const paidLabel = document.createElement("label");
    paidLabel.className = "paid-toggle";

    const paidCheckbox = document.createElement("input");
    paidCheckbox.className = "paid-checkbox";
    paidCheckbox.type = "checkbox";
    paidCheckbox.checked = expense.paid;
    paidCheckbox.disabled = true;
    paidCheckbox.setAttribute("aria-label", expense.paid ? `${expense.name} pagata` : `${expense.name} da pagare`);

    const paidMark = document.createElement("span");
    paidMark.className = "paid-mark";

    paidLabel.append(paidCheckbox, paidMark);

    const name = document.createElement("span");
    name.className = "expense-name";
    name.textContent = expense.name;

    const status = document.createElement("span");
    status.className = "expense-status";
    status.textContent = expense.paid ? "Pagata" : "Da pagare";

    const description = document.createElement("span");
    description.className = "expense-description";
    description.textContent = expense.description ? formatDescription(expense.description) : "Senza data";

    const payerGroup = document.createElement("div");
    payerGroup.className = "payer-group";
    payerGroup.setAttribute("aria-label", `Chi ha pagato ${expense.name}`);

    const payerStatus = document.createElement("span");
    payerStatus.className = "payer-status";
    payerStatus.textContent = getPayerStatus(expense);

    const payerOptions = document.createElement("div");
    payerOptions.className = "payer-options";

  const payerA = createPayerToggle(expense, "payerA", "Lore");
  const payerB = createPayerToggle(expense, "payerB", "Bea");

    payerOptions.append(payerA, payerB);
    payerGroup.append(payerOptions);

    if (payerStatus.textContent) {
      payerGroup.append(payerStatus);
    }

    const details = document.createElement("div");
    details.className = "expense-details";
    details.append(name, status);

    const priceGroup = document.createElement("div");
    priceGroup.className = "expense-price-group";

    const price = document.createElement("span");
    price.className = "expense-price";
    price.textContent = formatMoney(expense.cost);

    const splitPrice = document.createElement("span");
    splitPrice.className = "expense-split";
    splitPrice.textContent = `${formatMoney(expense.cost / PEOPLE)} a testa`;

    priceGroup.append(price, splitPrice);

    const rowActions = document.createElement("div");
    rowActions.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "Modifica";
    editButton.setAttribute("aria-label", `Modifica ${expense.name}`);
    editButton.addEventListener("click", () => {
      editingExpenseId = editingExpenseId === expense.id ? null : expense.id;
      render();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Elimina ${expense.name}`);
    deleteButton.addEventListener("click", async () => {
      undoSnapshot = cloneExpenses(expenses);
      expenses = expenses.filter((itemExpense) => itemExpense.id !== expense.id);
      editingExpenseId = null;
      render();
      showUndoSnapshot(`"${expense.name}" eliminata.`);
      await persistExpenses();
    });

    rowActions.append(editButton, deleteButton);
    item.append(paidLabel, details, description, payerGroup, priceGroup, rowActions);

    if (editingExpenseId === expense.id) {
      item.append(createEditForm(expense));
    }

    list.append(item);
  });

  const total = expenses.reduce((sum, expense) => sum + expense.cost, 0);
  const paidExpenses = expenses.filter((expense) => expense.paid);
  const pendingExpenses = expenses.filter((expense) => !expense.paid);

  totalAmount.textContent = formatMoney(total);
  perPersonAmount.textContent = formatMoney(total / PEOPLE);
  expenseCount.textContent = String(expenses.length);
  filterCount.textContent =
    selectedDateFilter === "all"
      ? `${expenses.length} voci totali`
      : `${visibleExpenses.length} di ${expenses.length} voci`;
  emptyState.querySelector("p").textContent =
    expenses.length > 0 && visibleExpenses.length === 0
      ? "Nessuna voce per questa data."
      : "Aggiungi la prima spesa della vacanza.";
  emptyState.classList.toggle("hidden", visibleExpenses.length > 0);
  clearAllButton.disabled = expenses.length === 0;
  renderStatusGroup(paidList, paidTotal, paidExpenses, "Nessuna voce pagata");
  renderStatusGroup(pendingList, pendingTotal, pendingExpenses, "Nessuna voce in sospeso");
  renderSettlement(total);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = capitalizeFirstLetter(nameInput.value);
  const cost = Number(costInput.value);
  const description = parseDayMonth(dateInput.value);

  if (!name || Number.isNaN(cost) || cost <= 0 || description === null) {
    return;
  }

  clearUndoSnapshot();
  expenses.unshift({
    id: crypto.randomUUID(),
    name,
    cost: Math.round(cost * 100) / 100,
    paid: false,
    payerA: false,
    payerB: false,
    description,
  });

  render();
  await persistExpenses();
  form.reset();
  nameInput.focus();
});

clearAllButton.addEventListener("click", async () => {
  undoSnapshot = cloneExpenses(expenses);
  expenses = [];
  render();
  showUndoSnapshot();
  await persistExpenses();
});

undoClearButton.addEventListener("click", async () => {
  if (!undoSnapshot) {
    return;
  }

  expenses = cloneExpenses(undoSnapshot);
  clearUndoSnapshot();
  render();
  await persistExpenses();
});

dateFilter.addEventListener("change", () => {
  selectedDateFilter = dateFilter.value;
  editingExpenseId = null;
  render();
});

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => selectView(button.dataset.view));
});

packingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = capitalizeFirstLetter(packingNameInput.value);

  if (!name) {
    return;
  }

  packingItems.unshift({
    id: crypto.randomUUID(),
    name,
    packed: false,
  });
  renderPackingList();
  await persistPackingItems();
  packingForm.reset();
  packingNameInput.focus();
});

render();
renderPackingList();
initSync();
