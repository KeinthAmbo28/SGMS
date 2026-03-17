import { api, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

function clearForm() {
  el("trainerId").value = "";
  el("fullName").value = "";
  el("specialty").value = "";
  el("status").value = "active";
  el("phone").value = "";
  el("email").value = "";
  el("deleteBtn").disabled = true;
  el("formMsg").textContent = "";
}

function fillForm(t) {
  el("trainerId").value = t.id;
  el("fullName").value = t.full_name || "";
  el("specialty").value = t.specialty || "";
  el("status").value = t.status || "active";
  el("phone").value = t.phone || "";
  el("email").value = t.email || "";
  el("deleteBtn").disabled = false;
  el("formMsg").textContent = "Editing selected trainer.";
}

function renderTrainers(trainers) {
  const tbody = el("trainersTbody");
  tbody.innerHTML = "";
  for (const t of trainers) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td><b>${t.full_name}</b></td>
      <td>${t.specialty || "-"}</td>
      <td><span class="tag ${t.status === "active" ? "good" : "bad"}">${t.status}</span></td>
      <td>${t.phone || "-"}</td>
    `;
    tr.addEventListener("click", () => fillForm(t));
    tbody.appendChild(tr);
  }
}

async function refresh() {
  const { trainers } = await api("/api/trainers");
  window.__trainers = trainers;
  renderTrainers(trainers);
}

async function save() {
  const id = el("trainerId").value;
  const body = {
    full_name: el("fullName").value.trim(),
    specialty: el("specialty").value.trim() || null,
    status: el("status").value,
    phone: el("phone").value.trim() || null,
    email: el("email").value.trim() || null
  };
  try {
    if (!id) {
      await api("/api/trainers", { method: "POST", body });
      el("formMsg").textContent = "Trainer created.";
    } else {
      await api(`/api/trainers/${id}`, { method: "PUT", body });
      el("formMsg").textContent = "Trainer updated.";
    }
    await refresh();
    clearForm();
  } catch (e) {
    el("formMsg").textContent = e.message;
  }
}

async function del() {
  const id = el("trainerId").value;
  if (!id) return;
  if (!confirm("Delete this trainer? Members assigned will become unassigned.")) return;
  await api(`/api/trainers/${id}`, { method: "DELETE" });
  await refresh();
  clearForm();
}

async function main() {
  mountSidebar("trainers");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  clearForm();
  await refresh();

  el("saveBtn").addEventListener("click", save);
  el("clearBtn").addEventListener("click", clearForm);
  el("deleteBtn").addEventListener("click", del);
}

main();

