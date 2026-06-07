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

  // Support both formats:
  // - New format: r.parts array
  // - Old flat format: r.ingredients + r.steps (from recipes.json migration)
  const partsToRender = Array.isArray(r.parts) && r.parts.length
    ? r.parts
    : (r.ingredients || r.steps)
      ? [{ title: "", ingredients: r.ingredients || [], steps: r.steps || [] }]
      : [];

  partsToRender.forEach(p => $("partsContainer").appendChild(makePart(p)));

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
    const stpEditor = makeStepEditor(partData.steps || []);
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
      steps:       getStepValues(block.querySelector("[data-role=steps]")),
    };
  });
}

// ── Step editor (text + optional photos) ─────────────────────
function makeStepEditor(steps = []) {
  const wrap = document.createElement("div");
  wrap.className = "list-editor";
  wrap.dataset.role = "steps";

  function addStepRow(stepData = {}) {
    const text   = typeof stepData === "string" ? stepData : stepData.text || "";
    // Support both old single `image` and new `images` array
    const images = typeof stepData === "object"
      ? (stepData.images || (stepData.image ? [stepData.image] : []))
      : [];

    const row = document.createElement("div");
    row.className = "list-item-row step-item-row";

    // Text area
    const ta = document.createElement("textarea");
    ta.rows = 1; ta.value = text;
    ta.placeholder = "t.d. Blandið saman eggjum og mjólk";
    ta.maxLength = 500;
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; });

    // Photo button
    const photoBtn = document.createElement("button");
    photoBtn.type = "button";
    photoBtn.className = "step-photo-btn";
    photoBtn.title = "Bæta við mynd";
    photoBtn.textContent = "📷";

    // Hidden file input
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/gif";
    fileInput.style.display = "none";

    // Photos container
    const photosWrap = document.createElement("div");
    photosWrap.className = "step-photos";

    // Track uploaded image URLs/paths for this step
    row._stepImages = [...images];

    // Render existing images
    images.forEach((url, idx) => renderStepThumb(photosWrap, url, null, row, idx));

    photoBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInput.value = "";
      await uploadStepImage(file, row, photosWrap);
    });

    // Remove button
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "remove-item"; rm.textContent = "×";
    rm.setAttribute("aria-label", "Fjarlægja skref");
    rm.addEventListener("click", async () => {
      // Delete any uploaded images for this step
      for (const url of row._stepImages) {
        const path = stepImagePathFromUrl(url);
        if (path) await sb.storage.from(BUCKET).remove([path]);
      }
      row.remove();
    });

    row.appendChild(ta);
    row.appendChild(photoBtn);
    row.appendChild(fileInput);
    row.appendChild(rm);

    // Photos on second line
    const photoLine = document.createElement("div");
    photoLine.className = "step-photo-line";
    photoLine.appendChild(photosWrap);
    
    const rowWrap = document.createElement("div");
    rowWrap.className = "step-row-wrap";
    rowWrap.appendChild(row);
    rowWrap.appendChild(photoLine);

    wrap.insertBefore(rowWrap, addBtn);
    setTimeout(() => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }, 0);
    return rowWrap;
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button"; addBtn.className = "add-item-btn"; addBtn.textContent = "+ Bæta við skrefi";
  addBtn.addEventListener("click", () => addStepRow());
  wrap.appendChild(addBtn);
  steps.forEach(s => addStepRow(s));
  return wrap;
}

function stepImagePathFromUrl(url) {
  // Extract storage path from public URL
  // e.g. https://xxx.supabase.co/storage/v1/object/public/recipe-images/bananabraud/steps/...
  try {
    const marker = "/recipe-images/";
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length) : null;
  } catch { return null; }
}

async function uploadStepImage(file, row, photosWrap) {
  const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];
  if (!ALLOWED.includes(file.type)) {
    flash($("editorFlash"), "Ógilt skráarsnið."); return;
  }

  // Show uploading indicator
  const indicator = document.createElement("span");
  indicator.className = "step-upload-indicator";
  indicator.textContent = "Hleð upp...";
  photosWrap.appendChild(indicator);

  const resized  = await resizeImage(file);
  const base     = editingId || slugify($("fTitle").value.trim()) || "new";
  const ext      = "jpg";
  const path     = `${base}/steps/step-${Date.now()}.${ext}`;

  const { data, error } = await sb.storage
    .from(BUCKET)
    .upload(path, resized, { upsert: true, contentType: "image/jpeg" });

  indicator.remove();

  if (error) { flash($("editorFlash"), "Upphlöðun mistókst: " + error.message); return; }

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(data.path);
  row._stepImages.push(publicUrl);
  renderStepThumb(photosWrap, publicUrl, data.path, row, row._stepImages.length - 1);
}

function renderStepThumb(photosWrap, url, storagePath, row, idx) {
  const item = document.createElement("div");
  item.className = "step-thumb";

  const img = document.createElement("img");
  // Use data URL for local preview if URL is localhost
  if (url.includes("127.0.0.1") || url.includes("localhost:54321")) {
    // Already a data URL or needs conversion — just set src directly
    img.src = url;
  } else {
    img.src = url;
  }
  img.alt = "";

  const rm = document.createElement("button");
  rm.type = "button"; rm.className = "remove-img"; rm.textContent = "×";
  rm.addEventListener("click", async () => {
    const path = storagePath || stepImagePathFromUrl(url);
    if (path) await sb.storage.from(BUCKET).remove([path]);
    row._stepImages.splice(row._stepImages.indexOf(url), 1);
    item.remove();
  });

  item.appendChild(img);
  item.appendChild(rm);
  photosWrap.appendChild(item);
}

function getStepValues(stepsEditorEl) {
  return [...stepsEditorEl.querySelectorAll(".step-row-wrap")].map(rowWrap => {
    const ta     = rowWrap.querySelector("textarea");
    const row    = rowWrap.querySelector(".list-item-row");
    const text   = sanitiseText(ta?.value || "");
    const images = row?._stepImages || [];
    if (!text && !images.length) return null;
    if (!images.length) return text;           // plain string if no images
    if (images.length === 1) return { text, images };  // single image
    return { text, images };                   // multiple images
  }).filter(Boolean);
}

$("addPartBtn").addEventListener("click",      () => $("partsContainer").appendChild(makePart()));
$("addEquipmentBtn").addEventListener("click", () => $("partsContainer").appendChild(makePart({ type: "equipment" })));