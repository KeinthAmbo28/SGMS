import { api, mountSidebar, requireSession } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);
const parseLocalDate = (value) => value ? new Date(value.replace(" ", "T")) : null;

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

function printAttendance() {
  window.print();
}

async function main() {
  mountSidebar("attendance");
  const user = await requireSession();
  if (!user) return;
  el("userLabel").textContent = user.username;

  await refresh();
  el("printAttendanceBtn").addEventListener("click", printAttendance);
}

main();

