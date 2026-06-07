// ============================================================
// admin-users.js — user management (super admin only)
// Depends on: admin-utils.js
// ============================================================

async function loadUserList() {
  $("userListLoading").hidden = false;
  $("userList").innerHTML = "";
  const { data, error } = await sb.rpc("list_admin_users");
  $("userListLoading").hidden = true;
  if (error) { flash($("usersFlash"), error.message); return; }

  const list = $("userList");
  for (const u of data || []) {
    const row = document.createElement("div");
    row.className = "recipe-row";

    const info = document.createElement("div");
    info.style.flex = "1";
    const emailEl = document.createElement("div");
    emailEl.className = "rname";
    emailEl.textContent = u.email;
    const roleEl = document.createElement("div");
    roleEl.className = "rmeta";
    roleEl.textContent = u.is_super ? "Super admin" : "Admin";
    info.appendChild(emailEl);
    info.appendChild(roleEl);

    const actions = document.createElement("div");
    actions.className = "actions";
    if (!u.is_super) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn danger small";
      removeBtn.textContent = "Fjarlægja";
      removeBtn.addEventListener("click", () => removeUser(u.email));
      actions.appendChild(removeBtn);
    }

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

async function removeUser(email) {
  if (!confirm(`Fjarlægja ${email}?`)) return;
  const { data, error } = await sb.rpc("remove_admin_user", { target_email: email });
  if (error) { flash($("usersFlash"), error.message); return; }
  const msgs = {
    not_found:           "Notandi finnst ekki.",
    forbidden:           "Þú hefur ekki leyfi til þessa.",
    cannot_remove_self:  "Þú getur ekki fjarlægt þig sjálf/an.",
    cannot_remove_super: "Ekki er hægt að fjarlægja super admin.",
  };
  if (data !== "ok") { flash($("usersFlash"), msgs[data] || data); return; }
  await loadUserList();
}

$("newUserEmail").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); $("addUserBtn").click(); }
});

$("addUserBtn").addEventListener("click", async () => {
  const email = $("newUserEmail").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    flash($("usersFlash"), "Sláðu inn gilt netfang."); return;
  }
  $("addUserBtn").disabled = true;
  const { data, error } = await sb.rpc("add_admin_user", { target_email: email });
  $("addUserBtn").disabled = false;
  if (error) { flash($("usersFlash"), error.message); return; }
  const msgs = {
    already_exists: "Þessi notandi er þegar til.",
    forbidden:      "Þú hefur ekki leyfi til þessa.",
  };
  if (data !== "ok") { flash($("usersFlash"), msgs[data] || data); return; }
  $("newUserEmail").value = "";
  flash($("usersFlash"), `${email} bætt við.`, "success");
  await loadUserList();
});