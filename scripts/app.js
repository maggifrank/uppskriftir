/* =============================================================
   UPPSKRIFTIR — app.js
   Sections:
     1. Utils
     2. Data layer  (Supabase)
     3. Render helpers
     4. List view
     5. Recipe view
     6. Router
     7. UI bindings & init
   ============================================================= */

// ─── 1. UTILS ────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function normalizeText(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatTime(mins) {
  if (!mins && mins !== 0) return "";
  if (mins < 60) return `${mins} mín`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function escapeHtml(str) {
  return (str ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function pill(text) {
  return `<span class="pill">${escapeHtml(text)}</span>`;
}

// ─── 2. DATA LAYER (SUPABASE) ────────────────────────────────

let RECIPES = [];
let activeTag = null;

async function loadRecipes() {
  const { data, error } = await window._sb
    .from("recipes")
    .select("data")
    .order("title");

  if (error) {
    console.error("Failed to load recipes:", error.message);
    return;
  }

  // Each row's `data` column is the full recipe object
  RECIPES = (data || []).map((row) => row.data);
  RECIPES.sort((a, b) => a.title.localeCompare(b.title, "is"));
}

function findRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}

function getCategories() {
  const cats = new Set(RECIPES.map((r) => r.category).filter(Boolean));
  return ["Allir flokkar", ...[...cats].sort((a, b) => a.localeCompare(b, "is"))];
}

function computeAllTags() {
  const map = new Map();
  for (const r of RECIPES) {
    for (const t of r.tags || []) {
      map.set(t, (map.get(t) || 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "is"))
    .map(([tag]) => tag);
}

function recipeSearchText(r) {
  const parts = Array.isArray(r.parts) ? r.parts : [];
  const partsIngredients = parts.flatMap((p) => p.ingredients || []).join(" ");
  const partsSteps = parts
    .flatMap((p) =>
      (p.steps || []).map((s) => (typeof s === "string" ? s : s.text || ""))
    )
    .join(" ");
  return [
    r.title, r.category,
    (r.tags || []).join(" "),
    (r.ingredients || []).join(" "),
    partsIngredients, partsSteps,
    r.description || "", r.notes || "",
  ].join(" ");
}

function filterRecipes() {
  const q = $("search").value.trim();
  const cat = $("category").value;
  const nq = normalizeText(q);
  return RECIPES.filter((r) => {
    if (cat !== "all" && r.category !== cat) return false;
    if (activeTag && !(r.tags || []).includes(activeTag)) return false;
    if (!nq) return true;
    return normalizeText(recipeSearchText(r)).includes(nq);
  });
}

// ─── 3. RENDER HELPERS ───────────────────────────────────────

function renderSteps(steps = []) {
  return steps.map((s) => {
    if (typeof s === "string") return `<li>${escapeHtml(s)}</li>`;

    // Support old single `image` string and new `images` array
    const imageUrls = s.images || (s.image ? [s.image] : []);
    const imgs = imageUrls
      .map(url => `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`)
      .join("");

    return `<li class="step">
      <div class="step-text">${escapeHtml(s.text || "")}</div>
      ${imgs}
    </li>`;
  }).join("");
}

function renderSingleRecipe(recipe) {
  const ingredients = (recipe.ingredients || [])
    .map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const steps = renderSteps(recipe.steps || []);
  return `
    <div class="cols">
      <section><h4>Innihald</h4><ul>${ingredients}</ul></section>
      <section><h4>Skref</h4><ol>${steps}</ol></section>
    </div>`;
}

function renderPartsRecipe(recipe) {
  return (recipe.parts || []).map((p, idx) => {
    const mt = idx === 0 ? "0" : "20px";
    if (p.type === "equipment") {
      const items = (p.items || [])
        .map((i) => `<span class="chip">${escapeHtml(i)}</span>`).join("");
      return `<section style="margin-top:${mt}">
        <h3>${escapeHtml(p.title || "Áhöld")}</h3>
        <div class="chips">${items}</div>
      </section>`;
    }
    const ings = (p.ingredients || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
    const stps = renderSteps(p.steps || []);
    return `<section style="margin-top:${mt}">
      <h3>${escapeHtml(p.title || `Hluti ${idx + 1}`)}</h3>
      <div class="cols">
        <section><h4>Innihald</h4><ul>${ings}</ul></section>
        <section><h4>Skref</h4><ol>${stps}</ol></section>
      </div>
    </section>`;
  }).join("");
}

// ─── 4. LIST VIEW ────────────────────────────────────────────

function populateCategorySelect() {
  const sel = $("category");
  sel.innerHTML = "";
  for (const c of getCategories()) {
    const opt = document.createElement("option");
    opt.value = c === "Allir flokkar" ? "all" : c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
}

function renderTagChips() {
  const tags = computeAllTags().slice(0, 14);
  const el = $("chips");
  el.innerHTML = "";
  for (const tag of tags) {
    const b = document.createElement("button");
    b.className = "chip" + (activeTag === tag ? " active" : "");
    b.type = "button";
    b.textContent = tag;
    b.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderTagChips();
      renderList();
    });
    el.appendChild(b);
  }
}

function renderList() {
  const list = filterRecipes();
  const count = list.length;
  $("resultCount").textContent =
    count === 1 ? `${count} uppskrift` : `${count} uppskriftir`;
  $("empty").hidden = count !== 0;

  const grid = $("grid");
  grid.innerHTML = "";
  for (const r of list) {
    const a = document.createElement("a");
    a.className = "cardlink";
    a.href = `#/recipe/${encodeURIComponent(r.id)}`;
    const tags = (r.tags || []).slice(0, 4).map(pill).join(" ");
    a.innerHTML = `
      <img class="card-cover" src="${escapeHtml(r.cover_image || '')}" alt="" loading="lazy" />
      <div class="title">${escapeHtml(r.title)}</div>
      <div class="meta">
        ${pill(r.category || "Uppskrift")}
        ${r.time_minutes ? pill(formatTime(r.time_minutes)) : ""}
        ${r.servings ? pill(`${r.servings} skammtar`) : ""}
      </div>
      <div class="meta">${tags}</div>`;
    grid.appendChild(a);
  }
}

function showListView() {
  $("listView").hidden = false;
  $("recipeView").hidden = true;
  document.title = "Uppskriftir";
}

// ─── 5. RECIPE VIEW ──────────────────────────────────────────

function showRecipeView() {
  $("listView").hidden = true;
  $("recipeView").hidden = false;
}

function renderRecipe(recipe) {
  if (!recipe) {
    $("recipeArticle").innerHTML = `<p class="muted">Uppskrift fannst ekki.</p>`;
    return;
  }
  document.title = `${recipe.title} — Uppskriftir`;
  const meta = [
    recipe.category ? pill(recipe.category) : "",
    recipe.time_minutes ? pill(formatTime(recipe.time_minutes)) : "",
    recipe.servings ? pill(`${recipe.servings} skammtar`) : "",
  ].filter(Boolean).join(" ");

  const tags = (recipe.tags || []).map(pill).join(" ");
  const body = Array.isArray(recipe.parts) && recipe.parts.length
    ? renderPartsRecipe(recipe)
    : renderSingleRecipe(recipe);
  const notes = recipe.notes
    ? `<div class="note"><strong>Athugasemd:</strong> ${escapeHtml(recipe.notes)}</div>`
    : "";

  $("recipeArticle").innerHTML = `
    ${recipe.cover_image ? `<img class="recipe-cover" src="${escapeHtml(recipe.cover_image)}" alt="${escapeHtml(recipe.title)}" />` : ""}
    <h2>${escapeHtml(recipe.title)}</h2>
    <div class="hero">
      ${meta}
      ${tags ? `<div class="hero-tags">${tags}</div>` : ""}
    </div>
    ${recipe.description ? `<div class="desc">${escapeHtml(recipe.description)}</div>` : ""}
    ${body}
    ${notes}`;
}

// ─── 6. ROUTER ───────────────────────────────────────────────

function parseRoute() {
  const hash = window.location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "recipe" && parts[1])
    return { view: "recipe", id: decodeURIComponent(parts[1]) };
  return { view: "list" };
}

function route() {
  const r = parseRoute();
  if (r.view === "recipe") {
    showRecipeView();
    renderRecipe(findRecipe(r.id));
  } else {
    showListView();
    renderList();
  }
}

// ─── 7. UI BINDINGS & INIT ───────────────────────────────────

function randomRecipe() {
  if (!RECIPES.length) return;
  const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  window.location.hash = `#/recipe/${encodeURIComponent(r.id)}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    alert("Tókst ekki að afrita — vafrinn þinn leyfir hugsanlega ekki aðgang að klippiborðinu.");
  }
}

function bindUI() {
  $("search").addEventListener("input", renderList);
  $("category").addEventListener("change", renderList);
  $("random").addEventListener("click", randomRecipe);

  // Hamburger menu toggle
  const menuBtn      = $("menuBtn");
  const menuDropdown = $("menuDropdown");
  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.hidden = !menuDropdown.hidden;
    });
    // Close when clicking anywhere outside
    document.addEventListener("click", () => { menuDropdown.hidden = true; });
  }
  $("clearFilters").addEventListener("click", () => {
    $("search").value = "";
    $("category").value = "all";
    activeTag = null;
    renderTagChips();
    renderList();
  });
  $("back").addEventListener("click", () => history.back());
  $("print").addEventListener("click", () => window.print());
  $("copyLink").addEventListener("click", () => copyToClipboard(window.location.href));
  window.addEventListener("hashchange", route);
}

(async function init() {
  // Only run on index.html — bail out if the main grid element isn't present
  if (!document.getElementById("grid")) return;

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  window._sb = sb;

  await loadRecipes();
  populateCategorySelect();
  renderTagChips();
  bindUI();
  route();
})();