import { clearMemberToken, memberApi, requireMemberSession } from "/assets/js/memberApp.js";

const el = (id) => document.getElementById(id);
const parseLocalDate = (value) => value ? new Date(value.replace(" ", "T")) : null;

function setMsg(id, text) {
  el(id).textContent = text || "";
}

function renderAttendance(rows) {
  const tbody = el("attTbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const open = !r.check_out_at;
    const checkInDate = parseLocalDate(r.check_in_at);
    const checkOutDate = r.check_out_at ? parseLocalDate(r.check_out_at) : null;

    // Format date and time with seconds for exact precision
    const checkInFormatted = `${checkInDate.toLocaleDateString()} ${checkInDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true})}`;
    const checkOutFormatted = checkOutDate ? `${checkOutDate.toLocaleDateString()} ${checkOutDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true})}` : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${checkInFormatted}</td>
      <td>${checkOutFormatted}</td>
      <td><span class="tag ${open ? "warn" : "good"}">${open ? "Checked in" : "Completed"}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadTrainers(selectedId) {
  const { trainers } = await memberApi("/api/member/trainers");
  const sel = el("trainerSelect");
  sel.innerHTML = `<option value="">-</option>`;
  for (const t of trainers) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.full_name} (${t.assigned_members} members)`;
    sel.appendChild(opt);
  }
  if (selectedId) sel.value = selectedId;
}

async function refresh() {
  const me = await memberApi("/api/member/me");
  el("memberName").textContent = me.member?.full_name || me.user?.username || "Member";

  await loadTrainers(me.member?.assigned_trainer_id || "");
  const att = await memberApi("/api/member/attendance");
  renderAttendance(att.attendance);

  const open = me.openAttendance;
  if (open) setMsg("checkMsg", "Status: Checked in (remember to check out).");
  else setMsg("checkMsg", "Status: Not checked in.");
}

async function checkIn() {
  setMsg("checkMsg", "Checking in...");
  try {
    await memberApi("/api/member/check-in", { method: "POST" });
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

async function checkOut() {
  setMsg("checkMsg", "Checking out...");
  try {
    await memberApi("/api/member/check-out", { method: "POST" });
    await refresh();
  } catch (e) {
    setMsg("checkMsg", e.message);
  }
}

async function saveTrainer() {
  setMsg("trainerMsg", "Saving...");
  try {
    const trainerId = el("trainerSelect").value;
    if (!trainerId) {
      setMsg("trainerMsg", "Please select a trainer.");
      return;
    }
    await memberApi("/api/member/select-trainer", { method: "POST", body: { trainer_id: trainerId } });
    setMsg("trainerMsg", "Trainer updated.");
  } catch (e) {
    setMsg("trainerMsg", e.message);
  }
}

async function main() {
  const session = await requireMemberSession();
  if (!session) return;

  el("memberLogoutBtn").addEventListener("click", () => {
    clearMemberToken();
    window.location.href = "/memberLogin.html";
  });
  el("checkInBtn").addEventListener("click", checkIn);
  el("checkOutBtn").addEventListener("click", checkOut);
  el("saveTrainerBtn").addEventListener("click", saveTrainer);

  await refresh();
}

main();

