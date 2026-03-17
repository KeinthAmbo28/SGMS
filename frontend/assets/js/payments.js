import { api, formatPeso, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

async function loadMembers() {
  const { members } = await api("/api/members");
  const sel = el("memberSelect");
  sel.innerHTML = "";
  for (const m of members) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.full_name;
    sel.appendChild(opt);
  }
}

function render(payments) {
  const tbody = el("tbody");
  tbody.innerHTML = "";
  for (const p of payments) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${p.member_name}</b></td>
      <td>${formatPeso(p.amount)}</td>
      <td>${p.method}</td>
      <td>${new Date(p.paid_at).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function refresh() {
  const { payments } = await api("/api/payments");
  render(payments);
}

async function addPayment() {
  el("msg").textContent = "";
  try {
    await api("/api/payments", {
      method: "POST",
      body: {
        member_id: el("memberSelect").value,
        amount: Number(el("amount").value),
        method: el("method").value,
        paid_at: el("paidAt").value.trim() || undefined
      }
    });
    el("amount").value = "";
    el("paidAt").value = "";
    el("msg").textContent = "Payment recorded.";
    await refresh();
  } catch (e) {
    el("msg").textContent = e.message;
  }
}

async function main() {
  mountSidebar("payments");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  await loadMembers();
  await refresh();
  el("payBtn").addEventListener("click", addPayment);
}

main();

