// ============================================================
// admin-utils.js — shared helpers
// Loaded first. Exposes: $, sb, esc, sanitiseText, slugify, flash, showTab
// ============================================================

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
const $  = (id) => document.getElementById(id);

function esc(str) {
  return (str ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripTags(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.textContent;
}

function sanitiseText(str, maxLen = 500) {
  return stripTags(str).trim().slice(0, maxLen);
}

function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function flash(el, msg, type = "error") {
  el.textContent = msg;
  el.className = `flash ${type}`;
  if (type === "success") setTimeout(() => { el.className = "flash"; }, 3500);
}

function showTab(name) {
  ["recipes", "editor", "migrate", "users"].forEach(t => {
    $(`tab-${t}`).hidden = t !== name;
    document.querySelector(`.tab[data-tab="${t}"]`)
      .classList.toggle("active", t === name);
  });
}