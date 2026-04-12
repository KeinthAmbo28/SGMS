import { api, formatPeso, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

// Load members into the dropdown
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

// Render the payments table
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

// Refresh payments table
async function refresh() {
  try {
    const { payments } = await api("/api/payments");
    render(payments);
  } catch (err) {
    console.error("Failed to load payments:", err);
    el("msg").textContent = "Could not load payments.";
  }
}

// Show error or success
function showError(msg) {
  el("msg").textContent = msg;
  el("msg").style.color = "red";
}
function showSuccess(msg) {
  el("msg").textContent = msg;
  el("msg").style.color = "green";
}

// Add a new payment
async function addPayment() {
  el("msg").textContent = "";

  try {
    const memberId = el("memberSelect").value;
    let amount = Number(el("amount").value);
    const method = el("method").value;
    let paidAt = el("paidAt").value.trim();

    // =======================
    // VALIDATIONS
    // =======================
    if (!memberId) return showError("Select a member.");
    if (!amount || isNaN(amount) || amount <= 0) return showError("Enter a valid amount.");
    if (!["cash", "card", "gcash", "bank"].includes(method)) return showError("Select a valid method.");

    // Convert paidAt to MySQL DATETIME or null
    if (paidAt) {
      const date = new Date(paidAt);
      if (isNaN(date.getTime())) return showError("Invalid date format for Paid at.");
      paidAt = date.toISOString().slice(0, 19).replace("T", " ");
    } else {
      paidAt = null;
    }

    // =======================
    // SEND API REQUEST
    // =======================
    await api("/api/payments", {
      method: "POST",
      body: { member_id: memberId, amount, method, paid_at: paidAt }
    });

    // Clear form
    el("amount").value = "";
    el("paidAt").value = "";

    showSuccess("Payment recorded successfully!");
    await refresh();
  } catch (e) {
    console.error("Error adding payment:", e);
    showError(e.data?.error || e.message || "Failed to record payment.");
  }
}

// MAIN
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