"use strict";

function readNumber(value) {
  const normalized = String(value).replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function finiteAmount(number) {
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function calculateTotals(subtotal, discountPercent, vatPercent) {
  const sum = finiteAmount(subtotal);
  const discount = sum * (Math.min(readNumber(discountPercent), 100) / 100);
  const discounted = finiteAmount(sum - discount);
  const vat = finiteAmount(discounted * (readNumber(vatPercent) / 100));
  return { subtotal: sum, discount, discounted, vat, total: finiteAmount(discounted + vat) };
}

function formatMoney(amount, currency) {
  return `${Math.round(finiteAmount(amount)).toLocaleString("ru-RU", { maximumFractionDigits: 0 }).replace(/[\u00a0\u202f]/g, " ")} ${currency}`;
}

const items = document.getElementById("items");
const discountInput = document.getElementById("discount");
const vatInput = document.getElementById("vat");
const currencyInput = document.getElementById("currency");
const addButton = document.getElementById("add-item");
const draftKey = "smeta-5-minutes-draft-v1";
const savedFields = ["sender", "recipient", "estimate-number", "estimate-date", "discount", "vat", "currency", "comment"];
let restoringDraft = true;
let copyTimer;

function recalculate() {
  const currency = currencyInput.value;
  let subtotal = 0;
  items.querySelectorAll("tr").forEach((row) => {
    const amount = finiteAmount(readNumber(row.querySelector(".quantity").value) * readNumber(row.querySelector(".price").value));
    subtotal = finiteAmount(subtotal + amount);
    row.querySelector(".item-total").textContent = formatMoney(amount, currency);
  });
  const totals = calculateTotals(subtotal, discountInput.value, vatInput.value);
  const fields = { subtotal: "subtotal", discount: "discount-total", discounted: "discounted-total", vat: "vat-total", total: "grand-total" };
  Object.entries(fields).forEach(([key, id]) => {
    document.getElementById(id).textContent = formatMoney(totals[key], currency);
  });
  document.getElementById("discount-row").hidden = Math.round(totals.discount) === 0;
  document.getElementById("discounted-row").hidden = Math.round(totals.discounted) === 0;
  document.getElementById("vat-row").hidden = Math.round(totals.vat) === 0;
}

function labelItems() {
  items.querySelectorAll("tr").forEach((row, index) => {
    row.querySelector(".item-name").setAttribute("aria-label", `Наименование позиции ${index + 1}`);
    row.querySelector(".quantity").setAttribute("aria-label", `Количество позиции ${index + 1}`);
    row.querySelector(".price").setAttribute("aria-label", `Цена позиции ${index + 1}`);
    row.querySelector(".unit").setAttribute("aria-label", `Единица позиции ${index + 1}`);
    row.querySelector(".remove-item").setAttribute("aria-label", `Удалить позицию ${index + 1}`);
  });
}

function addItem(focus = true, values = null) {
  const fragment = document.getElementById("item-template").content.cloneNode(true);
  items.append(fragment);
  if (values) {
    Object.entries(values).forEach(([key, value]) => {
      items.lastElementChild.querySelector(`.${key}`).value = value;
    });
  }
  labelItems();
  recalculate();
  if (focus) items.lastElementChild.querySelector("input").focus();
  if (!restoringDraft) clearCopyResult();
  saveDraft();
}

items.addEventListener("input", recalculate);
items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  if (!event.target.matches("input") || event.target.closest("tr") !== items.lastElementChild) return;
  event.preventDefault();
  addItem();
});
items.addEventListener("click", (event) => {
  if (!event.target.closest(".remove-item")) return;
  event.target.closest("tr").remove();
  labelItems();
  recalculate();
  addButton.focus();
  clearCopyResult();
  saveDraft();
});
[discountInput, vatInput].forEach((input) => input.addEventListener("input", recalculate));
currencyInput.addEventListener("change", recalculate);
addButton.addEventListener("click", () => addItem());
function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getDraft() {
  return {
    version: 1,
    fields: Object.fromEntries(savedFields.map((id) => [id, document.getElementById(id).value])),
    items: Array.from(items.querySelectorAll("tr"), (row) => Object.fromEntries(
      ["item-name", "quantity", "unit", "price"].map((key) => [key, row.querySelector(`.${key}`).value])
    ))
  };
}

function storageMessage(message) {
  const status = document.getElementById("storage-status");
  status.textContent = message;
  status.hidden = !message;
}

function saveDraft() {
  if (restoringDraft) return;
  try {
    localStorage.setItem(draftKey, JSON.stringify(getDraft()));
    storageMessage("");
  } catch {
    storageMessage("Не удалось сохранить черновик в браузере. Данные могут потеряться после обновления страницы.");
  }
}

function validDraft(draft) {
  return draft && draft.version === 1 && draft.fields &&
    savedFields.every((id) => typeof draft.fields[id] === "string") &&
    ["₸", "₽", "$", "€"].includes(draft.fields.currency) && Array.isArray(draft.items) &&
    draft.items.every((row) => row && ["item-name", "quantity", "unit", "price"].every((key) => typeof row[key] === "string") &&
      ["шт", "час", "услуга"].includes(row.unit));
}

function restoreDraft() {
  try {
    const stored = localStorage.getItem(draftKey);
    if (stored === null) return false;
    const draft = JSON.parse(stored);
    if (!validDraft(draft)) throw new Error("Invalid draft");
    savedFields.forEach((id) => { document.getElementById(id).value = draft.fields[id]; });
    draft.items.forEach((row) => addItem(false, {
      "item-name": row["item-name"], quantity: row.quantity, unit: row.unit, price: row.price
    }));
    recalculate();
    return true;
  } catch {
    storageMessage("Не удалось восстановить черновик. Хранилище недоступно или сохранённые данные повреждены.");
    return false;
  }
}

function clearCopyResult() {
  clearTimeout(copyTimer);
  document.getElementById("copy-status").textContent = "";
  document.getElementById("manual-copy").hidden = true;
  document.getElementById("share-text").value = "";
}

function nextEstimateNumber(value) {
  const number = value.trim();
  const match = number.match(/(\d+)$/);
  if (!match) return "1";
  const next = (BigInt(match[1]) + 1n).toString().padStart(match[1].length, "0");
  return number.slice(0, match.index) + next;
}

function newEstimate() {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const nextNumber = nextEstimateNumber(document.getElementById("estimate-number").value);
  restoringDraft = true;
  savedFields.forEach((id) => { document.getElementById(id).value = ""; });
  document.getElementById("estimate-number").value = nextNumber;
  document.getElementById("estimate-date").value = todayValue();
  discountInput.value = "0";
  vatInput.value = "0";
  currencyInput.value = "₸";
  items.replaceChildren();
  document.querySelectorAll(".print-value").forEach((element) => element.remove());
  document.getElementById("print-title").textContent = "";
  clearCopyResult();
  addItem(false);
  restoringDraft = false;
  saveDraft();
  document.getElementById("sender").focus();
}

function buildShareText() {
  recalculate();
  const draft = getDraft();
  const currency = draft.fields.currency;
  const date = draft.fields["estimate-date"].split("-").reverse().join(".") || "____";
  const lines = [`Смета № ${draft.fields["estimate-number"].trim() || "____"} от ${date}`];
  if (draft.fields.sender.trim()) lines.push(`От кого: ${draft.fields.sender.trim()}`);
  if (draft.fields.recipient.trim()) lines.push(`Для кого: ${draft.fields.recipient.trim()}`);
  lines.push("");
  draft.items.forEach((row) => {
    const quantity = readNumber(row.quantity).toLocaleString("ru-RU", { maximumFractionDigits: 20 }).replace(/[\u00a0\u202f]/g, " ");
    const amount = finiteAmount(readNumber(row.quantity) * readNumber(row.price));
    lines.push(`• ${row["item-name"].trim() || "Без наименования"} — ${quantity} ${row.unit} × ${formatMoney(readNumber(row.price), currency)} = ${formatMoney(amount, currency)}`);
  });
  lines.push("", `Сумма: ${document.getElementById("subtotal").textContent}`);
  if (!document.getElementById("discount-row").hidden) {
    lines.push(`Скидка (${Math.min(readNumber(draft.fields.discount), 100)} %): ${document.getElementById("discount-total").textContent}`);
  }
  if (!document.getElementById("discounted-row").hidden && !document.getElementById("discount-row").hidden) {
    lines.push(`Сумма со скидкой: ${document.getElementById("discounted-total").textContent}`);
  }
  if (!document.getElementById("vat-row").hidden) lines.push(`НДС (${readNumber(draft.fields.vat)} %): ${document.getElementById("vat-total").textContent}`);
  lines.push(`Итого к оплате: ${document.getElementById("grand-total").textContent}`);
  if (draft.fields.comment.trim()) lines.push("", `Комментарий: ${draft.fields.comment.trim()}`);
  return lines.join("\n");
}

async function copyForWhatsApp() {
  clearCopyResult();
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById("copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.getElementById("copy-status").textContent = ""; }, 2000);
  } catch {
    const field = document.getElementById("share-text");
    field.value = text;
    document.getElementById("manual-copy").hidden = false;
    document.getElementById("copy-status").textContent = "Копирование недоступно. Выделите текст ниже и скопируйте вручную.";
    field.focus();
    field.select();
  }
}

document.querySelector("main").addEventListener("input", (event) => {
  if (!event.target.matches(".details input, #items input, #items select, .settings input, .settings select, #comment")) return;
  clearCopyResult();
  saveDraft();
});
document.querySelector("main").addEventListener("change", (event) => {
  if (!event.target.matches("input, select, #comment")) return;
  clearCopyResult();
  saveDraft();
});
document.getElementById("new-estimate").addEventListener("click", newEstimate);
document.getElementById("copy-whatsapp").addEventListener("click", copyForWhatsApp);
document.getElementById("estimate-date").value = todayValue();
document.getElementById("estimate-number").value = "1";
if (!restoreDraft()) addItem(false);
restoringDraft = false;

function preparePrint() {
  recalculate();
  const number = document.getElementById("estimate-number").value.trim() || "____";
  const dateParts = document.getElementById("estimate-date").value.split("-");
  const date = dateParts.length === 3 ? dateParts.reverse().join(".") : "____";
  document.getElementById("print-title").textContent = `Смета № ${number} от ${date}`;

  // Текстовые копии позволяют печатать длинные значения без обрезки полями ввода.
  document.querySelectorAll(".print-value").forEach((element) => element.remove());
  document.querySelectorAll(".details input, #items input, #items select, #comment").forEach((field) => {
    const value = document.createElement("span");
    value.className = "print-value";
    value.textContent = field.type === "date" ? date : field.value;
    field.insertAdjacentElement("afterend", value);
  });
}

window.addEventListener("beforeprint", preparePrint);
document.getElementById("save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
