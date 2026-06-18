const STORAGE_KEY = "split-vacanza-expenses";
const PEOPLE = 2;
const API_URL = "/api/expenses";
const EVENTS_URL = "/api/events";

const form = document.querySelector("#expenseForm");
const nameInput = document.querySelector("#expenseName");
const costInput = document.querySelector("#expenseCost");
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

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

let expenses = loadLocalExpenses({ useSeed: true });
let undoSnapshot = null;
let backend = "local";
let firestoreDocRef = null;
let firestoreSetDoc = null;

function seedExpenses() {
  return [
    { id: crypto.randomUUID(), name: "Hotel", cost: 420, paid: false, payerA: false, payerB: false },
    { id: crypto.randomUUID(), name: "Cena vista mare", cost: 86.5, paid: false, payerA: false, payerB: false },
    { id: crypto.randomUUID(), name: "Treno aeroporto", cost: 32, paid: false, payerA: false, payerB: false },
  ];
}

function normalizeExpenses(items) {
  return Array.isArray(items)
    ? items
        .filter((expense) => expense && typeof expense.name === "string")
        .map((expense) => ({
          id: expense.id || crypto.randomUUID(),
          name: expense.name,
          cost: Number(expense.cost) || 0,
          paid: Boolean(expense.paid),
          payerA: Boolean(expense.payerA),
          payerB: Boolean(expense.payerB),
        }))
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

function setSyncStatus(text, mode = "local") {
  syncStatus.textContent = text;
  syncStatus.dataset.mode = mode;
}

function cloneExpenses(items) {
  return items.map((expense) => ({ ...expense }));
}

function clearUndoSnapshot() {
  undoSnapshot = null;
  undoClearBar.classList.add("hidden");
}

function showUndoSnapshot() {
  if (!undoSnapshot || undoSnapshot.length === 0) {
    clearUndoSnapshot();
    return;
  }

  const label = undoSnapshot.length === 1 ? "voce eliminata" : "voci eliminate";
  undoClearText.textContent = `${undoSnapshot.length} ${label}.`;
  undoClearBar.classList.remove("hidden");
}

function formatMoney(value) {
  return euroFormatter.format(value);
}

function getPayerStatus(expense) {
  if (expense.payerA && expense.payerB) {
    return "Divisa tra Lore e Bea";
  }

  if (expense.payerA) {
    return "Pagato da Lore";
  }

  if (expense.payerB) {
    return "Pagato da Bea";
  }

  return "Chi ha pagato?";
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

function applyRemoteExpenses(remoteExpenses) {
  const nextExpenses = normalizeExpenses(remoteExpenses);

  if (!sameExpenses(expenses, nextExpenses)) {
    clearUndoSnapshot();
  }

  expenses = nextExpenses;
  saveLocalExpenses();
  render();
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
    firestoreSetDoc = setDoc;
    backend = "firebase";
    setSyncStatus("Firebase attivo: sincronizzazione cloud", "live");

    const localExpenses = loadLocalExpenses({ useSeed: false });

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
    expenses = expenses.map((itemExpense) =>
      itemExpense.id === expense.id ? { ...itemExpense, [field]: checkbox.checked } : itemExpense
    );
    render();
    await persistExpenses();
  });

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(checkbox, text);
  return label;
}

function render() {
  list.innerHTML = "";

  expenses.forEach((expense) => {
    const item = document.createElement("li");
    item.className = "expense-item";
    item.classList.toggle("is-paid", expense.paid);

    const paidLabel = document.createElement("label");
    paidLabel.className = "paid-toggle";

    const paidCheckbox = document.createElement("input");
    paidCheckbox.className = "paid-checkbox";
    paidCheckbox.type = "checkbox";
    paidCheckbox.checked = expense.paid;
    paidCheckbox.setAttribute("aria-label", `Segna ${expense.name} come pagata`);
    paidCheckbox.addEventListener("change", async () => {
      clearUndoSnapshot();
      expenses = expenses.map((itemExpense) =>
        itemExpense.id === expense.id ? { ...itemExpense, paid: paidCheckbox.checked } : itemExpense
      );
      render();
      await persistExpenses();
    });

    const paidMark = document.createElement("span");
    paidMark.className = "paid-mark";

    paidLabel.append(paidCheckbox, paidMark);

    const name = document.createElement("span");
    name.className = "expense-name";
    name.textContent = expense.name;

    const status = document.createElement("span");
    status.className = "expense-status";
    status.textContent = expense.paid ? "Pagata" : "Da pagare";

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
    payerGroup.append(payerOptions, payerStatus);

    const details = document.createElement("div");
    details.className = "expense-details";
    details.append(name, status, payerGroup);

    const priceGroup = document.createElement("div");
    priceGroup.className = "expense-price-group";

    const price = document.createElement("span");
    price.className = "expense-price";
    price.textContent = formatMoney(expense.cost);

    const splitPrice = document.createElement("span");
    splitPrice.className = "expense-split";
    splitPrice.textContent = `${formatMoney(expense.cost / PEOPLE)} a testa`;

    priceGroup.append(price, splitPrice);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Elimina ${expense.name}`);
    deleteButton.addEventListener("click", async () => {
      clearUndoSnapshot();
      expenses = expenses.filter((itemExpense) => itemExpense.id !== expense.id);
      render();
      await persistExpenses();
    });

    item.append(paidLabel, details, priceGroup, deleteButton);
    list.append(item);
  });

  const total = expenses.reduce((sum, expense) => sum + expense.cost, 0);
  const paidExpenses = expenses.filter((expense) => expense.paid);
  const pendingExpenses = expenses.filter((expense) => !expense.paid);

  totalAmount.textContent = formatMoney(total);
  perPersonAmount.textContent = formatMoney(total / PEOPLE);
  expenseCount.textContent = String(expenses.length);
  emptyState.classList.toggle("hidden", expenses.length > 0);
  clearAllButton.disabled = expenses.length === 0;
  renderStatusGroup(paidList, paidTotal, paidExpenses, "Nessuna voce pagata");
  renderStatusGroup(pendingList, pendingTotal, pendingExpenses, "Nessuna voce in sospeso");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const cost = Number(costInput.value);

  if (!name || Number.isNaN(cost) || cost <= 0) {
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

render();
initSync();
