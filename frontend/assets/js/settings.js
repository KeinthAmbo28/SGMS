import { api, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

function setMsg(target, text) {
  el(target).textContent = text || "";
}

function fillUserForm(u) {
  el("username").value = u?.username || "";
  el("role").value = u?.role || "staff";
  el("password").value = "";
}

async function loadUsersIntoSelect() {
  const { users } = await api("/api/admin/users");
  el("userSelect").innerHTML = `<option value="">(new user)</option>`;
  for (const u of users) {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.username} (${u.role}, ${u.status || "active"})`;
    opt.dataset.username = u.username;
    opt.dataset.role = u.role;
    el("userSelect").appendChild(opt);
  }
  return users;
}

async function retrieveUsers() {
  setMsg("retrieveMsg", "Loading...");
  try {
    const { users } = await api("/api/admin/users");
    const tbody = el("usersTbody");
    tbody.innerHTML = "";
    for (const u of users) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><b>${u.username}</b></td><td>${u.role}</td><td>${u.status || "active"}</td>`;
      tbody.appendChild(tr);
    }
    setMsg("retrieveMsg", `Retrieved ${users.length} users.`);
  } catch (e) {
    setMsg("retrieveMsg", e.message);
  }
}

async function createUser() {
  setMsg("userMsg", "");
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: {
        username: el("username").value.trim(),
        password: el("password").value || undefined,
        role: el("role").value
      }
    });
    setMsg("userMsg", "User created.");
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("userMsg", e.message);
  }
}

async function updateUser() {
  setMsg("userMsg", "");
  const id = el("userSelect").value;
  if (!id) {
    setMsg("userMsg", "Select an existing user to update.");
    return;
  }
  try {
    const body = {
      username: el("username").value.trim(),
      role: el("role").value
    };
    const pass = el("password").value;
    if (pass) body.password = pass;
    await api(`/api/admin/users/${id}`, { method: "PUT", body });
    setMsg("userMsg", "User updated.");
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("userMsg", e.message);
  }
}

async function deleteUser() {
  setMsg("userMsg", "");
  const id = el("userSelect").value;
  if (!id) {
    setMsg("userMsg", "Select an existing user to delete.");
    return;
  }
  if (!confirm("Delete this user?")) return;
  try {
    await api(`/api/admin/users/${id}`, { method: "DELETE" });
    setMsg("userMsg", "User deleted.");
    el("userSelect").value = "";
    fillUserForm(null);
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("userMsg", e.message);
  }
}

async function loadFreezeSettings() {
  setMsg("freezeMsg", "Loading...");
  try {
    const { settings } = await api("/api/admin/account-freeze/settings");
    el("freezeEnabled").checked = !!settings.enabled;
    el("freezeDays").value = settings.inactive_days ?? 30;
    el("freezeNeverUsed").checked = !!settings.include_never_used;
    setMsg("freezeMsg", "");
  } catch (e) {
    setMsg("freezeMsg", e.message);
  }
}

async function saveFreezeSettings() {
  setMsg("freezeMsg", "Saving...");
  try {
    const enabled = el("freezeEnabled").checked;
    const inactiveDays = Number(el("freezeDays").value || 0);
    const includeNeverUsed = el("freezeNeverUsed").checked;

    await api("/api/admin/account-freeze/settings", {
      method: "PUT",
      body: {
        enabled,
        inactive_days: inactiveDays,
        include_never_used: includeNeverUsed
      }
    });

    setMsg("freezeMsg", "Freeze settings saved.");
  } catch (e) {
    setMsg("freezeMsg", e.message);
  }
}

async function freezeNow() {
  setMsg("freezeMsg", "Freezing inactive accounts...");
  try {
    const data = await api("/api/admin/account-freeze/run", { method: "POST" });
    if (!data?.ran) {
      setMsg("freezeMsg", "No accounts were frozen. Check inactivity settings.");
      return;
    }

    setMsg("freezeMsg", `Frozen ${data.frozenCount} user(s).`);
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("freezeMsg", e.message);
  }
}

async function freezeSelectedUser() {
  setMsg("userMsg", "");
  const id = el("userSelect").value;
  if (!id) {
    setMsg("userMsg", "Select an existing user to freeze.");
    return;
  }
  if (!confirm("Freeze this user account? (They will be unable to log in until reactivated.)")) return;

  try {
    await api(`/api/admin/users/${id}/freeze`, { method: "POST" });
    setMsg("userMsg", "User frozen.");
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("userMsg", e.message);
  }
}

async function reactivateSelectedUser() {
  setMsg("userMsg", "");
  const id = el("userSelect").value;
  if (!id) {
    setMsg("userMsg", "Select an existing user to reactivate.");
    return;
  }
  if (!confirm("Reactivate this frozen user account?")) return;

  try {
    await api(`/api/admin/users/${id}/reactivate`, { method: "POST" });
    setMsg("userMsg", "User reactivated.");
    await loadUsersIntoSelect();
    await retrieveUsers();
  } catch (e) {
    setMsg("userMsg", e.message);
  }
}

async function renderAssignments() {
  const [{ members }, { trainers }] = await Promise.all([api("/api/members"), api("/api/trainers")]);
  const trainerMap = new Map(trainers.map((t) => [t.id, t.full_name]));

  const tbody = el("memberAssignTbody");
  tbody.innerHTML = "";
  for (const m of members) {
    const tr = document.createElement("tr");

    const trainerOptions = [`<option value="">-</option>`]
      .concat(
        trainers.map(
          (t) => `<option value="${t.id}" ${t.id === m.assigned_trainer_id ? "selected" : ""}>${t.full_name}</option>`
        )
      )
      .join("");

    tr.innerHTML = `
      <td><b>${m.full_name}</b></td>
      <td>
        <select data-trainer="${m.id}">
          ${trainerOptions}
        </select>
      </td>
      <td>
        <select data-status="${m.id}">
          <option value="active" ${m.status === "active" ? "selected" : ""}>With Trainer</option>
          <option value="inactive" ${m.status !== "active" ? "selected" : ""}>Without Trainer</option>
        </select>
      </td>
      <td>
        <button class="btn btn-primary btn-small" data-save="${m.id}">Update</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.save;
      const trainerId = tbody.querySelector(`[data-trainer="${id}"]`).value || null;
      const statusRaw = tbody.querySelector(`[data-status="${id}"]`).value;
      const status = statusRaw === "active" ? "active" : "inactive";
      setMsg("assignMsg", "Saving...");
      try {
        await api(`/api/members/${id}`, { method: "PUT", body: { assigned_trainer_id: trainerId, status } });
        const trainerName = trainerId ? trainerMap.get(trainerId) : "-";
        setMsg("assignMsg", `Updated: ${id} (trainer: ${trainerName})`);
      } catch (e) {
        setMsg("assignMsg", e.message);
      }
    });
  });
}

async function resetPasswords() {
  setMsg("quickMsg", "Resetting...");
  try {
    const res = await api("/api/admin/reset-all-passwords", { method: "POST" });
    setMsg("quickMsg", `All passwords reset. New password: ${res.newPassword}`);
  } catch (e) {
    setMsg("quickMsg", e.message);
  }
}

async function downloadBackup() {
  setMsg("quickMsg", "Preparing backup...");
  try {
    const data = await api("/api/admin/backup");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartgym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg("quickMsg", "Backup downloaded.");
  } catch (e) {
    setMsg("quickMsg", e.message);
  }
}

async function main() {
  mountSidebar("settings");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  await loadUsersIntoSelect();
  await retrieveUsers();
  await renderAssignments();

  el("retrieveBtn").addEventListener("click", retrieveUsers);
  el("createBtn").addEventListener("click", createUser);
  el("updateBtn").addEventListener("click", updateUser);
  el("deleteBtn").addEventListener("click", deleteUser);
  el("freezeUserBtn").addEventListener("click", freezeSelectedUser);
  el("reactivateUserBtn").addEventListener("click", reactivateSelectedUser);
  el("resetBtn").addEventListener("click", resetPasswords);
  el("backupBtn").addEventListener("click", downloadBackup);

  el("saveFreezeSettingsBtn").addEventListener("click", saveFreezeSettings);
  el("freezeNowBtn").addEventListener("click", freezeNow);

  el("userSelect").addEventListener("change", async () => {
    const id = el("userSelect").value;
    if (!id) {
      fillUserForm(null);
      return;
    }
    const { users } = await api("/api/admin/users");
    const u = users.find((x) => x.id === id);
    fillUserForm(u);
  });

  await loadFreezeSettings();
}

main();

