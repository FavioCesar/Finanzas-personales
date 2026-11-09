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
const navButtons = document.querySelectorAll(".nav-button"), flowView = document.querySelector("#cashflow-view"), homeView = document.querySelector("#home-view"), flowPeriod = document.querySelector("#cashflow-period"), flowDate = document.querySelector("#cashflow-date"), flowOpening = document.querySelector("#flow-opening"), flowIncome = document.querySelector("#flow-income"), flowExpense = document.querySelector("#flow-expense"), flowClosing = document.querySelector("#flow-closing"), chart = document.querySelector("#cashflow-chart"), chartArea = document.querySelector("#chart-area"), chartEmpty = document.querySelector("#chart-empty"), chartTooltip = document.querySelector("#chart-tooltip");

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
  renderCashflow();
  renderExpenseAnalysis();
}

function dateParts(s){return s.split("-").map(Number)} function dateKey(y,m,d){return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`} function addDays(s,n){const [y,m,d]=dateParts(s),x=new Date(y,m-1,d+n);return dateKey(x.getFullYear(),x.getMonth()+1,x.getDate())} function monday(s){const [y,m,d]=dateParts(s),x=new Date(y,m-1,d),k=(x.getDay()+6)%7;return addDays(s,-k)} function daysInMonth(y,m){return new Date(y,m,0).getDate()} function sorted(){return [...movements].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0))}
function periodInfo(){const v=flowDate.value||localDateToday(),p=flowPeriod.value;let start,end,labels=[];if(p==="day"){start=end=v}else if(p==="week"){start=monday(v);end=addDays(start,6)}else if(p==="month"){const [y,m]=dateParts(v);start=dateKey(y,m,1);end=dateKey(y,m,daysInMonth(y,m))}else{const [y]=dateParts(v);start=dateKey(y,1,1);end=dateKey(y,12,31)}return {p,start,end,labels}}
function renderCashflow(){if(!flowDate)return;const {p,start,end}=periodInfo(),all=sorted(),before=all.filter(x=>x.date<start),inside=all.filter(x=>x.date>=start&&x.date<=end);let opening=before.reduce((s,x)=>s+(x.type==="income"?x.amountCents:-x.amountCents),0),income=inside.filter(x=>x.type==="income").reduce((s,x)=>s+x.amountCents,0),expense=inside.filter(x=>x.type==="expense").reduce((s,x)=>s+x.amountCents,0);flowOpening.textContent=money(opening);flowIncome.textContent=money(income);flowExpense.textContent=money(expense);flowClosing.textContent=money(opening+income-expense);chartEmpty.hidden=inside.length>0;chartArea.hidden=inside.length===0;if(!inside.length)return;let points=[];if(p==="day"){let s=opening;inside.forEach((x,i)=>{s+=x.type==="income"?x.amountCents:-x.amountCents;points.push({label:`${formatDate(x.date)} ${i+1}`,value:s})})}else{let keys=[];if(p==="week")for(let k=start;k<=end;k=addDays(k,1))keys.push(k);if(p==="month"){const [y,m]=dateParts(start);for(let d=1;d<=daysInMonth(y,m);d++)keys.push(dateKey(y,m,d))}if(p==="year"){const [y]=dateParts(start);for(let m=1;m<=12;m++)keys.push(dateKey(y,m,daysInMonth(y,m)))}let s=opening;keys.forEach(k=>{all.filter(x=>x.date===k).forEach(x=>s+=x.type==="income"?x.amountCents:-x.amountCents);points.push({label:p==="year"?k.slice(0,7):formatDate(k),value:s})});points=points.filter((q,i)=>i===points.length-1||inside.some(x=>x.date===keys[i]))} drawChart(points)}
function drawChart(points){const r=chart.getBoundingClientRect(),d=devicePixelRatio||1,w=r.width,h=r.height;chart.width=w*d;chart.height=h*d;const c=chart.getContext("2d");c.scale(d,d);c.clearRect(0,0,w,h);const pad={l:65,r:20,t:25,b:42},min=Math.min(...points.map(x=>x.value),0),max=Math.max(...points.map(x=>x.value),0),range=max-min||100;const X=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,points.length-1),Y=v=>pad.t+(max-v)*(h-pad.t-pad.b)/range;c.strokeStyle="#e5e9e6";c.beginPath();for(let i=0;i<4;i++){let y=pad.t+i*(h-pad.t-pad.b)/3;c.moveTo(pad.l,y);c.lineTo(w-pad.r,y)}c.stroke();c.fillStyle="#6d7773";c.font="11px DM Sans";for(let i=0;i<4;i++){let v=max-i*range/3,y=pad.t+i*(h-pad.t-pad.b)/3;c.fillText(money(Math.round(v)),4,y+4)}c.strokeStyle="#1d6b51";c.lineWidth=2.5;c.beginPath();points.forEach((q,i)=>i?c.lineTo(X(i),Y(q.value)):c.moveTo(X(i),Y(q.value)));c.stroke();c.fillStyle="#1d6b51";points.forEach((q,i)=>{c.beginPath();c.arc(X(i),Y(q.value),3.5,0,Math.PI*2);c.fill()});c.fillStyle="#6d7773";c.textAlign="center";points.filter((_,i)=>i===0||i===points.length-1||points.length<=6).forEach((q,i)=>c.fillText(q.label,X(i),h-13));chart.onmousemove=e=>{let i=Math.round((e.offsetX-pad.l)*Math.max(1,points.length-1)/(w-pad.l-pad.r));i=Math.max(0,Math.min(points.length-1,i));chartTooltip.hidden=false;chartTooltip.textContent=`${points[i].label}: ${money(points[i].value)}`;chartTooltip.style.left=`${X(i)}px`;chartTooltip.style.top=`${Y(points[i].value)}px`};chart.onmouseleave=()=>chartTooltip.hidden=true}
navButtons.forEach(b=>b.addEventListener("click",()=>{const viewId=b.dataset.view;document.querySelectorAll(".app-view").forEach(view=>view.hidden=view.id!==viewId);navButtons.forEach(x=>x.classList.toggle("active",x===b));if(viewId==="cashflow-view")requestAnimationFrame(renderCashflow);if(viewId==="expenses-view")requestAnimationFrame(renderExpenseAnalysis)}));flowPeriod.addEventListener("change",renderCashflow);flowDate.addEventListener("change",renderCashflow);window.addEventListener("resize",()=>{if(!flowView.hidden)renderCashflow();if(!expensesView.hidden)renderExpenseAnalysis()});

function localDateToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

const expensesView = document.querySelector("#expenses-view");
const expensesPeriod = document.querySelector("#expenses-period");
const expensesDate = document.querySelector("#expenses-date");
const expensesTotal = document.querySelector("#expenses-total");
const expensesEmpty = document.querySelector("#expenses-empty");
const expensesContent = document.querySelector("#expenses-content");
const donutChart = document.querySelector("#donut-chart");
const expenseLegend = document.querySelector("#expense-legend");
const barChart = document.querySelector("#bar-chart");
const expensesCategoryList = document.querySelector("#expenses-category-list");
const expensesCategoryTotal = document.querySelector("#expenses-category-total");
const expenseColors = ["#1d6b51", "#a66b25", "#b24c45", "#4e7aaf", "#7c5aa6", "#287d7b", "#b4742e", "#7b8b45"];

function expenseRange() {
  const value = expensesDate.value || localDateToday();
  const period = expensesPeriod.value;
  if (period === "week") { const start = monday(value); return { start, end: addDays(start, 6) }; }
  const [year, month] = dateParts(value);
  return period === "month"
    ? { start: dateKey(year, month, 1), end: dateKey(year, month, daysInMonth(year, month)) }
    : { start: dateKey(year, 1, 1), end: dateKey(year, 12, 31) };
}

function expenseGroups() {
  const { start, end } = expenseRange();
  const groups = new Map();
  movements.filter(item => item.type === "expense" && item.date >= start && item.date <= end).forEach(item => {
    const current = groups.get(item.category) || { category: item.category, cents: 0, count: 0 };
    current.cents += item.amountCents;
    current.count += 1;
    groups.set(item.category, current);
  });
  return [...groups.values()].sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
}

function renderExpenseAnalysis() {
  if (!expensesView) return;
  const groups = expenseGroups();
  const total = groups.reduce((sum, group) => sum + group.cents, 0);
  expensesTotal.textContent = money(total);
  expensesEmpty.hidden = groups.length > 0;
  expensesContent.hidden = groups.length === 0;
  if (!groups.length) return;
  renderDonut(groups, total);
  renderBars(groups, total);
  expensesCategoryList.replaceChildren();
  groups.forEach(group => {
    const row = document.createElement("tr");
    const percent = total ? (group.cents / total) * 100 : 0;
    row.innerHTML = `<td></td><td>${group.count}</td><td class="transaction-amount">${money(group.cents)}</td><td class="transaction-amount">${percent.toFixed(1)}%</td>`;
    row.firstElementChild.textContent = group.category;
    expensesCategoryList.append(row);
  });
  expensesCategoryTotal.innerHTML = `<tr><th>Total</th><th>${groups.reduce((sum, group) => sum + group.count, 0)}</th><th class="transaction-amount">${money(total)}</th><th class="transaction-amount">100%</th></tr>`;
}

function renderDonut(groups, total) {
  let cursor = 0;
  const stops = groups.map((group, index) => {
    const start = cursor; cursor += (group.cents / total) * 100;
    return `${expenseColors[index % expenseColors.length]} ${start}% ${cursor}%`;
  }).join(", ");
  donutChart.style.background = `conic-gradient(${stops})`;
  donutChart.innerHTML = `<div><strong>${money(total)}</strong><span>gastos</span></div>`;
  expenseLegend.replaceChildren();
  groups.forEach((group, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="legend-dot" style="background:${expenseColors[index % expenseColors.length]}"></span><span></span><strong>${((group.cents / total) * 100).toFixed(1)}%</strong>`;
    item.querySelector("span:nth-child(2)").textContent = `${group.category} · ${money(group.cents)}`;
    expenseLegend.append(item);
  });
}

function renderBars(groups, total) {
  barChart.replaceChildren();
  const max = groups[0].cents || 1;
  groups.forEach((group, index) => {
    const item = document.createElement("div");
    item.className = "bar-row";
    item.title = `${group.category}: ${money(group.cents)} (${((group.cents / total) * 100).toFixed(1)}%)`;
    item.innerHTML = `<span></span><div class="bar-track"><i style="width:${Math.max(4, (group.cents / max) * 100)}%;background:${expenseColors[index % expenseColors.length]}"></i></div><strong>${money(group.cents)}</strong>`;
    item.firstElementChild.textContent = group.category;
    barChart.append(item);
  });
}

expensesPeriod.addEventListener("change", renderExpenseAnalysis);
expensesDate.addEventListener("change", renderExpenseAnalysis);

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
flowDate.value = localDateToday();
expensesDate.value = localDateToday();
render();
