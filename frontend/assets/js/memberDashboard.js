// /assets/js/memberDashboard.js
import { api, clearToken, getToken } from "/assets/js/app.js";

const el = (id) => document.getElementById(id);

// --- SESSION CHECK ---
async function requireSession() {
  const token = getToken();
  if (!token) {
    window.location.href = "/memberLogin.html";
    return null;
  }
  try {
    const res = await api("/api/member/me");
    return res.member || res.user;
  } catch (e) {
    clearToken();
    window.location.href = "/memberLogin.html";
    return null;
  }
}

// --- ATTENDANCE RENDER ---
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

// --- REFRESH DASHBOARD DATA ---
async function refresh() {
  try {
    const me = await api("/api/member/me");
    el("memberName").textContent = me.member?.full_name || me.user?.username || "Member";
    el("memberAvatar").src = me.member?.profile_picture || "";

    // Attendance
    const att = await api("/api/member/attendance");
    renderAttendance(att.attendance);

    // Load trainers for select
    const trainersData = await api("/api/trainers");
    const select = el("trainerSelect");
    select.innerHTML = `<option value="">- Select -</option>`;
    for (const t of trainersData.trainers) {
      const option = document.createElement("option");
      option.value = t.id;
      option.textContent = t.full_name;
      select.appendChild(option);
    }

  } catch (e) {
    clearToken();
    window.location.href = "/memberLogin.html";
  }
}

// --- CHECK-IN / CHECK-OUT ---
async function checkIn() {
  try {
    await api("/api/member/check-in", { method: "POST" });
    setMsg("checkMsg", "Checked in successfully");
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

async function checkOut() {
  try {
    await api("/api/member/check-out", { method: "POST" });
    setMsg("checkMsg", "Checked out successfully");
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

// --- SAVE TRAINER SELECTION ---
async function saveTrainer() {
  const trainerId = el("trainerSelect").value;
  if (!trainerId) return setMsg("trainerMsg", "Please select a trainer.");
  try {
    await api("/api/member/assign-trainer", {
      method: "POST",
      body: { trainer_id: trainerId }
    });
    setMsg("trainerMsg", "Trainer assigned successfully!");
  } catch (e) {
    setMsg("trainerMsg", e.message);
  }
}

// --- HELPER TO SET MESSAGES ---
function setMsg(id, msg) {
  const elMsg = document.getElementById(id);
  if (elMsg) elMsg.textContent = msg || "";
}

// --- MAIN FUNCTION ---
async function main() {
  const user = await requireSession();
  if (!user) return;

  // Logout button
  const logoutBtn = el("memberLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken();
      window.location.href = "/memberLogin.html";
    });
  }

  // Check-in / Check-out buttons
  const checkInBtn = el("checkInBtn");
  if (checkInBtn) checkInBtn.addEventListener("click", checkIn);

  const checkOutBtn = el("checkOutBtn");
  if (checkOutBtn) checkOutBtn.addEventListener("click", checkOut);

  // Save trainer
  const saveTrainerBtn = el("saveTrainerBtn");
  if (saveTrainerBtn) saveTrainerBtn.addEventListener("click", saveTrainer);

  // Initial refresh
  await refresh();
}

main();