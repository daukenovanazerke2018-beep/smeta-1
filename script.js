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

function addItem(focus = true) {
  const fragment = document.getElementById("item-template").content.cloneNode(true);
  items.append(fragment);
  labelItems();
  recalculate();
  if (focus) items.lastElementChild.querySelector("input").focus();
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
});
[discountInput, vatInput].forEach((input) => input.addEventListener("input", recalculate));
currencyInput.addEventListener("change", recalculate);
addButton.addEventListener("click", () => addItem());
const today = new Date();
document.getElementById("estimate-date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
addItem(false);
