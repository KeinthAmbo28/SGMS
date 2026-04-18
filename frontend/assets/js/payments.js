import { api, formatPeso, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

const PLAN_PRICES = {
  monthly: 500,
  annual: 1500,
};

let membersData = []; // store full member objects for lookup

async function loadMembers() {
  const { members } = await api("/api/members");
  membersData = members;

  const sel = el("memberSelect");
  sel.innerHTML = "";
  for (const m of members) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.full_name;
    sel.appendChild(opt);
  }

  // Auto-fill on first load
  autoFillAmount();
}

function autoFillAmount() {
  const selectedId = el("memberSelect").value;
  const member = membersData.find((m) => String(m.id) === String(selectedId));
  if (!member) return;

  const plan = member.membership_type?.toLowerCase(); // e.g. "monthly" or "annual"
  const price = PLAN_PRICES[plan];

  const amountInput = el("amount");
  const hint = el("amountHint");

  if (price !== undefined) {
    amountInput.value = price;
    if (hint) {
      hint.textContent = `Suggested amount for ${plan} plan: ${formatPeso(price)}`;
    }
  } else {
    amountInput.value = "";
    if (hint) hint.textContent = "";
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
        paid_at: el("paidAt").value.trim() || undefined,
      },
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

  // Re-fill amount whenever the selected member changes
  el("memberSelect").addEventListener("change", autoFillAmount);
  el("payBtn").addEventListener("click", addPayment);
}

main();