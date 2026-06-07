// ============================================================
// admin-auth.js — authentication
// Depends on: admin-utils.js, admin-recipes.js, admin-users.js
// ============================================================

// Capture the edit ID from the hash immediately on page load,
// before anything clears or changes the hash.
const _initialEditId = (function() {
  const h = window.location.hash;
  if (h.startsWith("#edit/")) {
    window.location.hash = "";
    return decodeURIComponent(h.slice(6));
  }
  return null;
})();

let _adminReady = false;

sb.auth.onAuthStateChange((_event, session) => {
  const loggedIn = !!session;
  $("loginPanel").hidden = loggedIn;
  $("adminPanel").hidden = !loggedIn;
  $("logoutBtn").hidden  = !loggedIn;

  if (loggedIn && !_adminReady) {
    _adminReady = true;
    checkSuperAdmin();
    loadRecipeList().then(() => {
      if (_initialEditId) {
        editRecipe(_initialEditId);
      }
    });
  } else if (!loggedIn) {
    // Reset on logout so login works again
    _adminReady = false;
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