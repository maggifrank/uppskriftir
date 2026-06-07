// ============================================================
// admin-auth.js — authentication
// Depends on: admin-utils.js, admin-recipes.js, admin-users.js
// ============================================================

sb.auth.onAuthStateChange((_event, session) => {
  const loggedIn = !!session;
  $("loginPanel").hidden = loggedIn;
  $("adminPanel").hidden = !loggedIn;
  $("logoutBtn").hidden  = !loggedIn;
  if (loggedIn) {
    checkSuperAdmin();
    // If opened via edit link e.g. admin.html#edit/recipe-id
    const hash = window.location.hash;
    if (hash.startsWith("#edit/")) {
      const id = decodeURIComponent(hash.slice(6));
      window.location.hash = "";
      // Wait for recipe list to load first, then open editor
      loadRecipeList().then(() => editRecipe(id));
    } else {
      loadRecipeList();
    }
  }
});

$("loginBtn").addEventListener("click", async () => {
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!email || !password) {
    flash($("loginFlash"), "Netfang og lykilorð eru nauðsynleg.");
    return;
  }
  $("loginBtn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("loginBtn").disabled = false;
  // Generic error — don't reveal whether email exists
  if (error) flash($("loginFlash"), "Innskráning mistókst. Athugaðu netfang og lykilorð.");
});

$("signupBtn").addEventListener("click", async () => {
  const email    = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!email || !password) {
    flash($("loginFlash"), "Netfang og lykilorð eru nauðsynleg."); return;
  }
  if (password.length < 6) {
    flash($("loginFlash"), "Lykilorð verður að vera að minnsta kosti 6 stafir."); return;
  }
  $("signupBtn").disabled = true;
  const { error } = await sb.auth.signUp({ email, password });
  $("signupBtn").disabled = false;
  if (error) {
    flash($("loginFlash"), "Nýskráning mistókst. Athugaðu að netfangið þitt sé samþykkt.");
  } else {
    flash($("loginFlash"), "Aðgangur búinn til! Skráðu þig inn.", "success");
  }
});

// Submit login on Enter in either field
["loginEmail", "loginPassword"].forEach(id => {
  $(id).addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("loginBtn").click(); }
  });
});

$("logoutBtn").addEventListener("click", () => sb.auth.signOut());

async function checkSuperAdmin() {
  const { data, error } = await sb.rpc("is_super_admin");
  const isSuperAdmin = !error && data === true;
  $("usersTab").hidden = !isSuperAdmin;
  return isSuperAdmin;
}