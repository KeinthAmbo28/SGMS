import { api, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);
const parseLocalDate = (value) => value ? new Date(value.replace(" ", "T")) : null;

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

function render(attendance) {
  const tbody = el("tbody");
  tbody.innerHTML = "";
  for (const a of attendance) {
    const checkInDate = parseLocalDate(a.check_in_at);
    const checkOutDate = a.check_out_at ? parseLocalDate(a.check_out_at) : null;

    // Format date and time with seconds for exact precision
    const checkInFormatted = `${checkInDate.toLocaleDateString()} ${checkInDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true})}`;
    const checkOutFormatted = checkOutDate ? `${checkOutDate.toLocaleDateString()} ${checkOutDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true})}` : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${a.member_name}</b></td>
      <td>${checkInFormatted}</td>
      <td>${checkOutFormatted}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function refresh() {
  const { attendance } = await api("/api/attendance");
  render(attendance);
}

async function checkIn() {
  el("msg").textContent = "";
  try {
    await api("/api/attendance", {
      method: "POST",
      body: {
        member_id: el("memberSelect").value,
        check_in_at: el("checkInAt").value.trim() || undefined
      }
    });
    el("checkInAt").value = "";
    el("msg").textContent = "Check-in recorded.";
    await refresh();
  } catch (e) {
    el("msg").textContent = e.message;
  }
}

async function main() {
  mountSidebar("attendance");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  await loadMembers();
  await refresh();
  el("checkInBtn").addEventListener("click", checkIn);
}

main();

