import { api, requireRole, clearToken } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

function setMsg(id, text) {
  el(id).textContent = text || "";
}

function renderAttendance(rows) {
  const tbody = el("attTbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.check_in_at || "-"}</td>
      <td>${r.check_out_at || "-"}</td>
      <td>${r.check_out_at ? "Completed" : "Checked in"}</td>
    `;

    tbody.appendChild(tr);
  }
}

async function refresh() {
  const me = await api("/api/member/me");

  el("memberName").textContent =
    me.member?.full_name || me.user?.username || "Member";

  el("memberAvatar").src = me.member?.profile_picture || "";

  const att = await api("/api/member/attendance");
  renderAttendance(att.attendance);
}

async function checkIn() {
  try {
    await api("/api/member/check-in", { method: "POST" });
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

async function checkOut() {
  try {
    await api("/api/member/check-out", { method: "POST" });
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

async function main() {
  const user = await requireSession();
  if (!user) return;

  el("memberLogoutBtn").addEventListener("click", () => {
    clearToken();
    window.location.href = "/login.html";
  });

  el("checkInBtn").addEventListener("click", checkIn);
  el("checkOutBtn").addEventListener("click", checkOut);

  await refresh();
}

main();