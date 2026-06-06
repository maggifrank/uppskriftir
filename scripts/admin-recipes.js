// ============================================================
// admin-recipes.js — recipe list, editor, parts builder
// Depends on: admin-utils.js, admin-storage.js
// ============================================================

let editingId = null;

// ── Tab wiring ────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn =>
  btn.addEventListener("click", () => {
    showTab(btn.dataset.tab);
    if (btn.dataset.tab === "users") loadUserList();
  })
);

// Enter on single-line fields saves the recipe
// (textareas like fDescription and fNotes are excluded — Enter adds a newline there)
["fTitle", "fCategory", "fTags"].forEach(id => {
  $(id).addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("saveRecipeBtn").click(); }
  });
});

$("newRecipeBtn").addEventListener("click",  () => { resetEditor(); showTab("editor"); });
$("cancelEditBtn").addEventListener("click", () => { resetEditor(); showTab("recipes"); });

// ── Recipe list ───────────────────────────────────────────────
async function loadRecipeList() {
  $("recipeListLoading").hidden = false;
  $("recipeList").innerHTML = "";
  const { data, error } = await sb.from("recipes")
    .select("id, title, category").order("title");
  $("recipeListLoading").hidden = true;
  if (error) { flash($("recipeListFlash"), error.message); return; }
  if (!data.length) {
    $("recipeList").innerHTML = `<p style="color:var(--muted);font-size:14px">Engar uppskriftir enn.</p>`;
    return;
  }
  const list = $("recipeList");
  list.innerHTML = "";
  for (const r of data) {
    const row = document.createElement("div");
    row.className = "recipe-row";

    const info = document.createElement("div");
    info.style.flex = "1";
    const name = document.createElement("div");
    name.className = "rname";
    name.textContent = r.title;
    const meta = document.createElement("div");
    meta.className = "rmeta";
    meta.textContent = r.category || "";
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn secondary small";
    editBtn.textContent = "Breyta";
    editBtn.addEventListener("click", () => editRecipe(r.id));
    const delBtn = document.createElement("button");
    delBtn.className = "btn danger small";
    delBtn.textContent = "Eyða";
    delBtn.addEventListener("click", () => deleteRecipe(r.id, r.title));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

// ── Editor reset ──────────────────────────────────────────────
function resetEditor() {
  editingId = null;
  $("editorHeading").textContent  = "Ný uppskrift";
  $("editorTabLabel").textContent = "Ný uppskrift";
  $("deleteRecipeBtn").hidden = true;
  $("editorFlash").className = "flash";
  ["fTitle", "fCategory", "fDescription", "fTags", "fNotes"].forEach(id => $(id).value = "");
  $("fTime").value = "";
  $("fServings").value = "";
  $("partsContainer").innerHTML = "";
  resetCoverImage();
}

// ── Edit recipe ───────────────────────────────────────────────
async function editRecipe(id) {
  const { data, error } = await sb.from("recipes")
    .select("data").eq("id", id).single();
  if (error || !data) { alert("Tókst ekki að sækja uppskrift."); return; }

  const r = data.data;
  editingId = id;
  $("editorHeading").textContent  = "Breyta: " + r.title;
  $("editorTabLabel").textContent = "Breyta";
  $("deleteRecipeBtn").hidden = false;
  $("fTitle").value       = r.title || "";
  $("fCategory").value    = r.category || "";
  $("fTime").value        = r.time_minutes || "";
  $("fServings").value    = r.servings || "";
  $("fDescription").value = r.description || "";
  $("fTags").value        = (r.tags || []).join(", ");
  $("fNotes").value       = r.notes || "";
  $("partsContainer").innerHTML = "";
  (r.parts || []).forEach(p => $("partsContainer").appendChild(makePart(p)));

  $("coverPreview").innerHTML = "";
  $("coverProgress").textContent = "";
  coverImageUrl  = r.cover_image      || null;
  coverImagePath = r.cover_image_path || null;
  if (coverImageUrl) renderCoverPreview(coverImageUrl, coverImagePath);

  showTab("editor");
}

// ── Delete recipe ─────────────────────────────────────────────
async function deleteRecipe(id, title) {
  if (!confirm(`Eyða „${title}"? Þetta er óafturkræft.`)) return;
  const { data: recipeRow } = await sb.from("recipes")
    .select("data").eq("id", id).single();
  const imagePath = recipeRow?.data?.cover_image_path;
  const { error } = await sb.from("recipes").delete().eq("id", id);
  if (error) { alert("Tókst ekki að eyða: " + error.message); return; }
  if (imagePath) await sb.storage.from(BUCKET).remove([imagePath]);
  await loadRecipeList();
}

$("deleteRecipeBtn").addEventListener("click", async () => {
  if (!editingId) return;
  await deleteRecipe(editingId, $("fTitle").value);
  resetEditor();
  showTab("recipes");
});

// ── Save recipe ───────────────────────────────────────────────
$("saveRecipeBtn").addEventListener("click", async () => {
  const title = sanitiseText($("fTitle").value, 200);
  if (!title) { flash($("editorFlash"), "Titill vantar."); return; }

  const id    = editingId || slugify(title);
  const parts = getParts();

  const recipe = {
    id,
    title,
    category:     sanitiseText($("fCategory").value, 100) || null,
    time_minutes: Math.min(Math.max(parseInt($("fTime").value)     || 0, 0), 10000),
    servings:     Math.min(Math.max(parseInt($("fServings").value) || 0, 0), 1000),
    description:  sanitiseText($("fDescription").value, 1000) || null,
    tags: $("fTags").value.split(",")
      .map(t => sanitiseText(t, 50))
      .filter(Boolean)
      .slice(0, 20),
    parts: parts.length ? parts : undefined,
    notes: sanitiseText($("fNotes").value, 500) || null,
    cover_image:      coverImageUrl  || null,
    cover_image_path: coverImagePath || null,
  };

  const { data: { user } } = await sb.auth.getUser();
  const row = { id, title: recipe.title, category: recipe.category, data: recipe, created_by: user?.id };

  $("saveRecipeBtn").disabled = true;
  const { error } = editingId
    ? await sb.from("recipes").update(row).eq("id", editingId)
    : await sb.from("recipes").insert(row);
  $("saveRecipeBtn").disabled = false;

  if (error) { flash($("editorFlash"), error.message); return; }

  flash($("editorFlash"), "Uppskrift vistuð!", "success");
  setTimeout(async () => {
    resetEditor();
    await loadRecipeList();
    showTab("recipes");
  }, 1000);
});

// ── Parts builder ─────────────────────────────────────────────
function makeListEditor(items = [], placeholder = "") {
  const wrap = document.createElement("div");
  wrap.className = "list-editor";

  function addRow(val = "") {
    const row = document.createElement("div");
    row.className = "list-item-row";
    const ta = document.createElement("textarea");
    ta.rows = 1; ta.value = val; ta.placeholder = placeholder; ta.maxLength = 500;
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; });
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "remove-item"; rm.textContent = "×";
    rm.setAttribute("aria-label", "Fjarlægja línu");
    rm.addEventListener("click", () => row.remove());
    row.appendChild(ta); row.appendChild(rm);
    wrap.insertBefore(row, addBtn);
    setTimeout(() => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }, 0);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button"; addBtn.className = "add-item-btn"; addBtn.textContent = "+ Bæta við línu";
  addBtn.addEventListener("click", () => addRow());
  wrap.appendChild(addBtn);
  items.forEach(i => addRow(i));
  return wrap;
}

function getListValues(listEditorEl) {
  return [...listEditorEl.querySelectorAll(".list-item-row textarea")]
    .map(ta => sanitiseText(ta.value))
    .filter(Boolean);
}

function makePart(partData = {}) {
  const block = document.createElement("div");
  block.className = "part-block";
  block.dataset.type = partData.type || "normal";
  const isEquipment = partData.type === "equipment";

  const header = document.createElement("div");
  header.className = "part-header";
  const titleInput = document.createElement("input");
  titleInput.type = "text"; titleInput.className = "part-title-input";
  titleInput.placeholder = isEquipment ? "Áhöld" : "t.d. Botn, Kremið...";
  titleInput.value = partData.title || (isEquipment ? "Áhöld" : "");
  titleInput.maxLength = 100;
  const removeBtn = document.createElement("button");
  removeBtn.type = "button"; removeBtn.className = "remove-part"; removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "Fjarlægja hluta");
  removeBtn.addEventListener("click", () => block.remove());
  header.appendChild(titleInput); header.appendChild(removeBtn);
  block.appendChild(header);

  const body = document.createElement("div");
  if (isEquipment) {
    const lbl = document.createElement("div");
    lbl.className = "section-label"; lbl.textContent = "Áhöld";
    body.appendChild(lbl);
    const editor = makeListEditor(partData.items || [], "t.d. Hrærivél");
    editor.dataset.role = "items";
    body.appendChild(editor);
  } else {
    const ingLbl = document.createElement("div");
    ingLbl.className = "section-label"; ingLbl.textContent = "Innihald";
    body.appendChild(ingLbl);
    const ingEditor = makeListEditor(partData.ingredients || [], "t.d. 2 stk. egg");
    ingEditor.dataset.role = "ingredients";
    body.appendChild(ingEditor);

    const stpLbl = document.createElement("div");
    stpLbl.className = "section-label"; stpLbl.textContent = "Skref";
    body.appendChild(stpLbl);
    const stepsRaw = (partData.steps || []).map(s => typeof s === "string" ? s : s.text || "");
    const stpEditor = makeListEditor(stepsRaw, "t.d. Blandið saman eggjum og mjólk");
    stpEditor.dataset.role = "steps";
    body.appendChild(stpEditor);
  }
  block.appendChild(body);
  return block;
}

function getParts() {
  return [...$("partsContainer").querySelectorAll(".part-block")].map(block => {
    const title = sanitiseText(block.querySelector(".part-title-input").value, 100);
    if (block.dataset.type === "equipment") {
      return { type: "equipment", title, items: getListValues(block.querySelector("[data-role=items]")) };
    }
    return {
      title,
      ingredients: getListValues(block.querySelector("[data-role=ingredients]")),
      steps:       getListValues(block.querySelector("[data-role=steps]")),
    };
  });
}

$("addPartBtn").addEventListener("click",      () => $("partsContainer").appendChild(makePart()));
$("addEquipmentBtn").addEventListener("click", () => $("partsContainer").appendChild(makePart({ type: "equipment" })));