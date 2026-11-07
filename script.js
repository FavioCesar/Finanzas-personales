"use strict";

const STORAGE_KEY = "mis-finanzas-movimientos-v1";
const categories = {
  income: ["Salario", "Freelance", "Ventas", "Inversiones", "Regalo", "Otros ingresos"],
  expense: ["Alimentación", "Vivienda", "Transporte", "Servicios", "Salud", "Educación", "Entretenimiento", "Otros gastos"]
};

const form = document.querySelector("#movement-form");
const typeInput = document.querySelector("#type");
const categoryInput = document.querySelector("#category");
const amountInput = document.querySelector("#amount");
const dateInput = document.querySelector("#date");
const descriptionInput = document.querySelector("#description");
const formMessage = document.querySelector("#form-message");
const list = document.querySelector("#movement-list");
const emptyState = document.querySelector("#empty-state");
const tableWrapper = document.querySelector("#history-table-wrapper");
const count = document.querySelector("#movement-count");
const incomeTotal = document.querySelector("#income-total");
const expenseTotal = document.querySelector("#expense-total");
const balanceTotal = document.querySelector("#balance-total");
const clearAllButton = document.querySelector("#clear-all-button");
const deleteMovementDialog = document.querySelector("#delete-movement-dialog");
const movementDetails = document.querySelector("#movement-details");
const confirmDeleteButton = document.querySelector("#confirm-delete-button");
const clearAllDialog = document.querySelector("#clear-all-dialog");
const clearAllSummary = document.querySelector("#clear-all-summary");
const clearAllConfirmation = document.querySelector("#clear-all-confirmation");
const confirmClearAllButton = document.querySelector("#confirm-clear-all-button");

let movements = loadMovements();
let movementPendingDeletion = null;

function loadMovements() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter(isValidMovement) : [];
  } catch {
    return [];
  }
}

function isValidMovement(item) {
  return item && typeof item.id === "string" && ["income", "expense"].includes(item.type) &&
    Number.isSafeInteger(item.amountCents) && item.amountCents > 0 &&
    typeof item.category === "string" && typeof item.date === "string";
}

function saveMovements() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
}

function populateCategories() {
  categoryInput.replaceChildren(...categories[typeInput.value].map((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    return option;
  }));
}

function money(cents) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency", currency: "BOB", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(cents / 100).replace("BOB", "Bs");
}

function parseAmountToCents(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function isValidDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const [year, month, day] = dateString.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function showMessage(message, kind) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${kind}`;
}

function escapeText(value) {
  return String(value);
}

function render() {
  const totals = movements.reduce((result, movement) => {
    result[movement.type] += movement.amountCents;
    return result;
  }, { income: 0, expense: 0 });
  incomeTotal.textContent = money(totals.income);
  expenseTotal.textContent = money(totals.expense);
  balanceTotal.textContent = money(totals.income - totals.expense);
  balanceTotal.parentElement.classList.toggle("negative-balance", totals.income < totals.expense);

  const ordered = [...movements].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
  );
  count.textContent = `${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}`;
  clearAllButton.disabled = movements.length === 0;
  emptyState.hidden = ordered.length > 0;
  tableWrapper.hidden = ordered.length === 0;
  list.replaceChildren();

  ordered.forEach((movement) => {
    const row = document.createElement("tr");
    const sign = movement.type === "income" ? "+" : "−";
    row.innerHTML = `
      <td class="date">${formatDate(movement.date)}</td>
      <td class="description"></td>
      <td><span class="category-tag"></span></td>
      <td><span class="type-tag ${movement.type}">${movement.type === "income" ? "Ingreso" : "Egreso"}</span></td>
      <td class="transaction-amount ${movement.type}">${sign}${money(movement.amountCents)}</td>
      <td><button class="delete-button" type="button" data-id="${movement.id}" aria-label="Eliminar movimiento" title="Eliminar movimiento">×</button></td>`;
    row.querySelector(".description").textContent = escapeText(movement.description) || "Sin descripción";
    row.querySelector(".category-tag").textContent = escapeText(movement.category);
    list.append(row);
  });
}

function localDateToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

typeInput.addEventListener("change", populateCategories);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amountCents = parseAmountToCents(amountInput.value);
  const type = typeInput.value;
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!amountCents) return showMessage("Ingresa un importe positivo válido, con hasta dos decimales.", "error");
  if (!categories[type]?.includes(category)) return showMessage("Selecciona una categoría válida.", "error");
  if (!isValidDate(date)) return showMessage("Ingresa una fecha válida.", "error");

  movements.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    type,
    amountCents,
    category,
    date,
    description: descriptionInput.value.trim()
  });
  saveMovements();
  form.reset();
  typeInput.value = "income";
  populateCategories();
  dateInput.value = localDateToday();
  showMessage("Movimiento guardado correctamente.", "success");
  render();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  const movement = movements.find((item) => item.id === button.dataset.id);
  if (!movement) return;
  movementPendingDeletion = movement;
  movementDetails.replaceChildren(
    detailItem("Descripción", movement.description || "Sin descripción"),
    detailItem("Fecha", formatDate(movement.date)),
    detailItem("Importe", `${movement.type === "income" ? "+" : "−"}${money(movement.amountCents)}`)
  );
  deleteMovementDialog.showModal();
});

function detailItem(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

deleteMovementDialog.addEventListener("close", () => {
  if (deleteMovementDialog.returnValue === "confirm" && movementPendingDeletion) {
    movements = movements.filter((item) => item.id !== movementPendingDeletion.id);
    saveMovements();
    render();
  }
  movementPendingDeletion = null;
});

clearAllButton.addEventListener("click", () => {
  clearAllSummary.textContent = `Se eliminarán ${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}.`;
  clearAllConfirmation.value = "";
  confirmClearAllButton.disabled = true;
  clearAllDialog.showModal();
});

clearAllConfirmation.addEventListener("input", () => {
  confirmClearAllButton.disabled = clearAllConfirmation.value !== "ELIMINAR";
});

clearAllDialog.addEventListener("close", () => {
  if (clearAllDialog.returnValue !== "confirm" || clearAllConfirmation.value !== "ELIMINAR") return;
  movements = [];
  saveMovements();
  render();
});

populateCategories();
dateInput.value = localDateToday();
render();
