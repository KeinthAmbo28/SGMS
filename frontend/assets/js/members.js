import { api, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

function clearForm() {
  el("memberId").value = "";
  el("fullName").value = "";
  el("membershipType").value = "monthly";
  el("status").value = "active";
  el("joinDate").valueAsDate = new Date();
  el("assignedTrainer").value = "";
  el("phone").value = "";
  el("email").value = "";
  el("emergency").value = "";
  el("notes").value = "";
  el("deleteBtn").disabled = true;
  el("formMsg").textContent = "";
}

async function loadTrainers() {
  const { trainers } = await api("/api/trainers");
  const select = el("assignedTrainer");
  select.innerHTML = `<option value="">-</option>`;
  for (const t of trainers) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.full_name;
    select.appendChild(opt);
  }
}

function renderMembers(members) {
  const tbody = el("membersTbody");
  tbody.innerHTML = "";
  for (const m of members) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    const joinDate = m.join_date ? new Date(m.join_date) : null;
    let expiryDate = "-";
    if (m.expiration_date) {
      expiryDate = new Date(m.expiration_date).toLocaleDateString('en-CA');
    } else if (joinDate && !Number.isNaN(joinDate.getTime())) {
      const expiry = new Date(joinDate.getTime());
      if (m.membership_type === "monthly") {
        expiry.setMonth(expiry.getMonth() + 1);
      } else if (m.membership_type === "annual") {
        expiry.setFullYear(expiry.getFullYear() + 1);
      }
      expiryDate = expiry.toLocaleDateString('en-CA');
    }
    tr.innerHTML = `
      <td><b>${m.full_name}</b></td>
      <td>${m.membership_type}</td>
      <td>${m.trainer_name || "-"}</td>
      <td><span class="tag ${m.status === "active" ? "good" : "bad"}">${m.status}</span></td>
      <td>${m.join_date}</td>
      <td><b>${expiryDate}</b></td>
    `;
    tr.addEventListener("click", () => fillForm(m));
    tbody.appendChild(tr);
  }
}

function fillForm(m) {
  el("memberId").value = m.id;
  el("fullName").value = m.full_name || "";
  el("membershipType").value = m.membership_type || "monthly";
  el("status").value = m.status || "active";
  el("joinDate").value = m.join_date || "";
  el("assignedTrainer").value = m.assigned_trainer_id || "";
  el("phone").value = m.phone || "";
  el("email").value = m.email || "";
  el("emergency").value = m.emergency_contact || "";
  el("notes").value = m.notes || "";
  el("deleteBtn").disabled = false;
  el("formMsg").textContent = "Editing selected member.";
}

async function refresh() {
  const { members } = await api("/api/members");
  window.__members = members;
  renderMembers(members);
}

async function save() {
  const id = el("memberId").value;
  const body = {
    full_name: el("fullName").value.trim(),
    membership_type: el("membershipType").value,
    join_date: el("joinDate").value,
    status: el("status").value,
    assigned_trainer_id: el("assignedTrainer").value || null,
    phone: el("phone").value.trim() || null,
    email: el("email").value.trim() || null,
    emergency_contact: el("emergency").value.trim() || null,
    notes: el("notes").value.trim() || null
  };
  try {
    if (!id) {
      await api("/api/members", { method: "POST", body });
      el("formMsg").textContent = "Member created.";
    } else {
      await api(`/api/members/${id}`, { method: "PUT", body });
      el("formMsg").textContent = "Member updated.";
    }
    await refresh();
    clearForm();
  } catch (e) {
    el("formMsg").textContent = e.message;
  }
}

async function del() {
  const id = el("memberId").value;
  if (!id) return;
  if (!confirm("Delete this member?")) return;
  await api(`/api/members/${id}`, { method: "DELETE" });
  await refresh();
  clearForm();
}

async function main() {
  mountSidebar("members");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  await loadTrainers();
  clearForm();
  await refresh();

  el("saveBtn").addEventListener("click", save);
  el("clearBtn").addEventListener("click", clearForm);
  el("deleteBtn").addEventListener("click", del);
}

main();

