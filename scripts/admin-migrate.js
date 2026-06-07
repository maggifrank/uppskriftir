// ============================================================
// admin-migrate.js — import recipes from JSON
// Depends on: admin-utils.js, admin-recipes.js
// ============================================================

$("migrateBtn").addEventListener("click", async () => {
  let recipes;
  try {
    recipes = JSON.parse($("migrateJson").value);
  } catch {
    flash($("migrateFlash"), "Ógilt JSON — athugaðu sniðið."); return;
  }
  if (!Array.isArray(recipes)) {
    flash($("migrateFlash"), "JSON þarf að vera fylki [ ... ]."); return;
  }
  if (recipes.length > 500) {
    flash($("migrateFlash"), "Of margar uppskriftir í einu (hámark 500)."); return;
  }

  const { data: { user } } = await sb.auth.getUser();
  $("migrateBtn").disabled = true;
  $("migrateBtn").textContent = "Flytur inn...";

  let ok = 0, fail = 0;
  for (const r of recipes) {
    if (typeof r !== "object" || !r.id || !r.title) { fail++; continue; }
    const row = {
      id:         String(r.id).slice(0, 80),
      title:      String(r.title).slice(0, 200),
      category:   r.category ? String(r.category).slice(0, 100) : null,
      data:       r,
      created_by: user?.id,
    };
    const { error } = await sb.from("recipes").upsert(row, { onConflict: "id" });
    if (error) { console.error(r.id, error.message); fail++; }
    else ok++;
  }

  $("migrateBtn").disabled = false;
  $("migrateBtn").textContent = "Flytja inn";

  const msg = `Lokið: ${ok} uppskriftir fluttar inn${fail ? `, ${fail} mistókst` : ""}.`;
  flash($("migrateFlash"), msg, fail && ok === 0 ? "error" : "success");
  if (ok) await loadRecipeList();
});