import { api, formatPeso, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

async function loadMembers() {
  try {
    const { members } = await api("/api/members");
    const sel = el("memberSelect");
    sel.innerHTML = "";
    for (const m of members) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.full_name;
      sel.appendChild(opt);
    }
  } catch (err) {
    console.error("Failed to load members:", err);
    el("msg").textContent = "Could not load members.";
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
      <td>${p.paid_at ? new Date(p.paid_at).toLocaleString() : "-"}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function refresh() {
  try {
    const { payments } = await api("/api/payments");
    render(payments);
  } catch (err) {
    console.error("Failed to load payments:", err);
    el("msg").textContent = "Could not load payments.";
  }
}

async function addPayment() {
  el("msg").textContent = "";

  try {
    const memberId = el("memberSelect").value;
    const amount = Number(el("amount").value);
    if (!memberId || !amount || amount <= 0) {
      el("msg").textContent = "Please select a member and enter a valid amount.";
      return;
    }

    // Validate paid_at
    let paidAt = el("paidAt").value.trim();
    if (!paidAt) paidAt = null;
    else {
      const date = new Date(paidAt);
      if (isNaN(date.getTime())) paidAt = null;
      else paidAt = date.toISOString().slice(0, 19).replace("T", " ");
    }

    await api("/api/payments", {
      method: "POST",
      body: {
        member_id: memberId,
        amount,
        method: el("method").value,
        paid_at: paidAt
      }
    });

    el("amount").value = "";
    el("paidAt").value = "";
    el("msg").textContent = "Payment recorded successfully!";
    await refresh();

  } catch (e) {
    console.error("Error adding payment:", e);
    el("msg").textContent = e.data?.error || e.message || "Failed to record payment.";
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