const $ = (id) => document.getElementById(id);

let RECIPES = [];
let activeTag = null;

function normalizeText(s){
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatTime(mins){
  if (!mins && mins !== 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function pill(text){ return `<span class="pill">${escapeHtml(text)}</span>`; }

function escapeHtml(str){
  return (str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}

async function loadRecipes(){
  const res = await fetch("recipes.json", { cache: "no-store" });
  RECIPES = await res.json();
  RECIPES.sort((a,b) => a.title.localeCompare(b.title));
}

function getCategories(){
  const cats = new Set(RECIPES.map(r => r.category).filter(Boolean));
  return ["All", ...[...cats].sort((a,b)=>a.localeCompare(b))];
}

function populateCategorySelect(){
  const sel = $("category");
  const cats = getCategories();
  sel.innerHTML = "";
  for (const c of cats){
    const opt = document.createElement("option");
    opt.value = c === "All" ? "all" : c;
    opt.textContent = c === "All" ? "Allir flokkar" : c;
    sel.appendChild(opt);
  }
}

function computeAllTags(){
  const map = new Map();
  for (const r of RECIPES){
    for (const t of (r.tags || [])){
      map.set(t, (map.get(t) || 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

function renderTagChips(){
  const tags = computeAllTags().slice(0, 14);
  const el = $("chips");
  el.innerHTML = "";

  const makeChip = (tag) => {
    const b = document.createElement("button");
    b.className = "chip" + (activeTag === tag ? " active" : "");
    b.type = "button";
    b.textContent = tag;
    b.addEventListener("click", () => {
      activeTag = (activeTag === tag) ? null : tag;
      renderTagChips();
      renderList();
    });
    return b;
  };

  tags.forEach(t => el.appendChild(makeChip(t)));
}

function currentFilters(){
  const q = $("search").value.trim();
  const cat = $("category").value;
  return { q, cat };
}

function filterRecipes(){
  const { q, cat } = currentFilters();
  const nq = normalizeText(q);

  return RECIPES.filter(r => {
    if (cat !== "all" && r.category !== cat) return false;
    if (activeTag && !(r.tags || []).includes(activeTag)) return false;

    if (!nq) return true;

    const hay = normalizeText([
      r.title,
      r.category,
      (r.tags || []).join(" "),
      (r.ingredients || []).join(" "),
      (r.description || "")
    ].join(" "));

    return hay.includes(nq);
  });
}

function renderList(){
  const list = filterRecipes();

  $("resultCount").textContent = `${list.length} recipe${list.length === 1 ? "" : "s"}`;
  $("empty").hidden = list.length !== 0;

  const grid = $("grid");
  grid.innerHTML = "";

  for (const r of list){
    const a = document.createElement("a");
    a.className = "cardlink";
    a.href = `#/recipe/${encodeURIComponent(r.id)}`;

    const tags = (r.tags || []).slice(0, 4).map(pill).join(" ");
    a.innerHTML = `
      <div class="title">${escapeHtml(r.title)}</div>
      <div class="meta">
        ${pill(r.category || "Recipe")}
        ${r.time_minutes ? pill(formatTime(r.time_minutes)) : ""}
        ${r.servings ? pill(`${r.servings} servings`) : ""}
      </div>
      <div class="meta">${tags}</div>
    `;
    grid.appendChild(a);
  }
}

function showListView(){
  $("listView").hidden = false;
  $("recipeView").hidden = true;
  document.title = "My Cookbook";
}

function showRecipeView(){
  $("listView").hidden = true;
  $("recipeView").hidden = false;
}

function findRecipe(id){
  return RECIPES.find(r => r.id === id);
}

function renderRecipe(recipe){
  if (!recipe){
    $("recipeArticle").innerHTML = `<p class="muted">Recipe not found.</p>`;
    return;
  }

  document.title = `${recipe.title} — My Cookbook`;

  const meta = [
    recipe.category ? pill(recipe.category) : "",
    recipe.time_minutes ? pill(formatTime(recipe.time_minutes)) : "",
    recipe.servings ? pill(`${recipe.servings} servings`) : ""
  ].filter(Boolean).join(" ");

  const tags = (recipe.tags || []).map(pill).join(" ");

  const renderSingle = () => {
    const ingredients = (recipe.ingredients || [])
      .map(i => `<li>${escapeHtml(i)}</li>`).join("");

    const steps = (recipe.steps || [])
      .map(s => `<li>${escapeHtml(s)}</li>`).join("");

    return `
      <div class="cols">
        <section>
          <h3>Innihald</h3>
          <ul>${ingredients}</ul>
        </section>
        <section>
          <h3>Skref</h3>
          <ol>${steps}</ol>
        </section>
      </div>
    `;
  };

const renderParts = () => {
  const parts = Array.isArray(recipe.parts) ? recipe.parts : [];

  return parts.map((p, idx) => {
    // Equipment / prep block
    if (p.type === "equipment") {
      const items = (p.items || [])
        .map(i => `<li>${escapeHtml(i)}</li>`)
        .join("");

      return `
        <section style="margin-top:${idx === 0 ? "0" : "16px"};">
          <h4>${escapeHtml(p.title || "Áhöld")}</h4>
          <ul>${items}</ul>
        </section>
      `;
    }

    // Normal recipe part
    const ings = (p.ingredients || [])
      .map(i => `<li>${escapeHtml(i)}</li>`).join("");

    const stps = (p.steps || [])
      .map(s => `<li>${escapeHtml(s)}</li>`).join("");

    return `
      <section style="margin-top:${idx === 0 ? "0" : "16px"};">
        <h3>${escapeHtml(p.title || `Part ${idx+1}`)}</h3>
        <div class="cols">
          <section>
            <h4>Innihald</h4>
            <ul>${ings}</ul>
          </section>
          <section>
            <h4>Skref</h4>
            <ol>${stps}</ol>
          </section>
        </div>
      </section>
    `;
  }).join("");
};


  const notes = recipe.notes
    ? `<div class="note"><strong>Note:</strong> ${escapeHtml(recipe.notes)}</div>`
    : "";

  const body = (Array.isArray(recipe.parts) && recipe.parts.length)
    ? renderParts()
    : renderSingle();

  $("recipeArticle").innerHTML = `
    <h2>${escapeHtml(recipe.title)}</h2>
    <div class="hero">
      ${meta}
      ${tags ? `<span class="pill">Tags</span>${tags}` : ""}
    </div>
    ${recipe.description ? `<div class="desc">${escapeHtml(recipe.description)}</div>` : ""}
    ${body}
    ${notes}
  `;
}


function parseRoute(){
  const hash = window.location.hash || "#/";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "recipe" && parts[1]) return { view: "recipe", id: decodeURIComponent(parts[1]) };
  return { view: "list" };
}

function route(){
  const r = parseRoute();
  if (r.view === "recipe"){
    const recipe = findRecipe(r.id);
    showRecipeView();
    renderRecipe(recipe);
  } else {
    showListView();
    renderList();
  }
}

function randomRecipe(){
  if (!RECIPES.length) return;
  const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  window.location.hash = `#/recipe/${encodeURIComponent(r.id)}`;
}

async function copyToClipboard(text){
  try { await navigator.clipboard.writeText(text); }
  catch { alert("Copy failed — your browser may block clipboard access."); }
}

function bindUI(){
  $("search").addEventListener("input", () => renderList());
  $("category").addEventListener("change", () => renderList());

  $("random").addEventListener("click", randomRecipe);

  $("clearFilters").addEventListener("click", () => {
    $("search").value = "";
    $("category").value = "all";
    activeTag = null;
    renderTagChips();
    renderList();
  });

  $("back").addEventListener("click", () => history.back());

  $("print").addEventListener("click", () => window.print());

  $("copyLink").addEventListener("click", async () => {
    await copyToClipboard(window.location.href);
  });

  window.addEventListener("hashchange", route);
}

(async function init(){
  await loadRecipes();
  populateCategorySelect();
  renderTagChips();
  bindUI();
  route();
})();
